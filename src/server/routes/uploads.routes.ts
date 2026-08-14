/**
 * Upload routes at /uploads — tus protocol endpoints with inline handlers.
 * Implements the `X-HTTP-Method-Override` hook (spec-required) so clients in
 * environments that lack PATCH/DELETE can still drive the protocol.
 *
 * Hono notes:
 *  - HEAD requests are auto-converted to GET (body stripped, headers kept)
 *    while `c.req.method` still reports "HEAD", so the dispatch below takes
 *    the HEAD branch correctly for both real HEAD and method-override.
 *  - The handler bodies are framework-agnostic (Request/Response); only the
 *    route definitions bind them to Hono.
 *
 * Auth is enforced inside the handlers (session cookie). The CSRF Origin
 * check in security.ts applies to same-origin Inertia clients (which pass
 * naturally); cross-origin tus clients would need a separate token scheme
 * (out of scope for the MVP).
 */
import { Hono } from "hono";
import { resolveUser } from "../auth";
import { config } from "../config";
import {
	advanceOffset,
	deleteExpiredPasswordResets,
	deleteExpiredSessions,
	deleteUpload,
	findUpload,
	insertUpload,
	listExpired,
} from "../db";
import { rateLimit } from "../rate-limit";
import { readBoundedBytes } from "../validation";
import {
	appendBytes,
	detectMime,
	fileSize,
	removeFile,
	uploadPath,
} from "../tus-storage";
import {
	H,
	OFFSET_CONTENT_TYPE,
	SUPPORTED_EXTENSIONS,
	SUPPORTED_VERSIONS,
	TUS_VERSION,
	checkVersion,
	generateUploadId,
	parseMetadata,
	verifyChecksum,
} from "../tus-protocol";

const UPLOAD_PREFIX = "/uploads/";
const uploadLocks = new Map<string, Promise<void>>();

async function withUploadLock<T>(
	id: string,
	operation: () => Promise<T>,
): Promise<T> {
	const previous = uploadLocks.get(id) ?? Promise.resolve();
	const gate: { release: () => void } = { release: () => {} };
	const current = new Promise<void>((resolve) => {
		gate.release = resolve;
	});
	const queued = previous.then(() => current);
	uploadLocks.set(id, queued);
	await previous;
	try {
		return await operation();
	} finally {
		gate.release();
		if (uploadLocks.get(id) === queued) uploadLocks.delete(id);
	}
}

/** Resolve the session cookie from a Request and return the user id (or null). */
function userIdFromRequest(req: Request): number | null {
	const raw = req.headers.get("cookie") ?? "";
	const match = raw.match(/(?:^|;\s*)session=([^;]+)/);
	if (!match) return null;
	const row = resolveUser(match[1]);
	return row ? row.id : null;
}

/** Build a JSON error response with tus headers. */
function errorResponse(
	status: number,
	message: string,
	extra: Record<string, string> = {},
): Response {
	const headers: Record<string, string> = {
		[H.tusResumable]: TUS_VERSION,
		"content-type": "application/json",
		"cache-control": "no-store",
		...extra,
	};
	return new Response(JSON.stringify({ error: message }), { status, headers });
}

/** Common tus headers for success responses. */
function okResponse(
	status: number,
	body: BodyInit | null,
	extra: Record<string, string | number>,
): Response {
	const headers: Record<string, string> = {
		[H.tusResumable]: TUS_VERSION,
		"cache-control": "no-store",
	};
	for (const [k, v] of Object.entries(extra)) headers[k] = String(v);
	return new Response(body, { status, headers });
}

/** Compute the Expires header (RFC 7231 date) from a TTL in seconds. */
function expiresHeaderFromNow(ttlSeconds: number): string | null {
	if (ttlSeconds <= 0) return null;
	const d = new Date(Date.now() + ttlSeconds * 1000);
	return d.toUTCString();
}

// ---------------------------------------------------------------------------
// OPTIONS — server capability advertisement (no auth, no Tus-Resumable).
// ---------------------------------------------------------------------------

export function handleOptions(): Response {
	const headers: Record<string, string> = {
		[H.tusResumable]: TUS_VERSION,
		[H.tusVersion]: SUPPORTED_VERSIONS.join(","),
		[H.tusExtension]: SUPPORTED_EXTENSIONS.join(","),
		"cache-control": "no-store",
	};
	if (config.upload.maxSize > 0)
		headers[H.tusMaxSize] = String(config.upload.maxSize);
	return new Response(null, { status: 204, headers });
}

// ---------------------------------------------------------------------------
// POST — Creation (+ Creation-With-Upload if a body is present).
// ---------------------------------------------------------------------------

export async function handlePost(
	req: Request,
	body: ArrayBuffer | undefined,
): Promise<Response> {
	const versionErr = checkVersion(req.headers);
	if (versionErr)
		return errorResponse(412, versionErr, {
			[H.tusVersion]: SUPPORTED_VERSIONS.join(","),
		});

	const userId = userIdFromRequest(req);
	if (!userId) return errorResponse(401, "Authentication required");

	const lengthHeader = req.headers.get(H.uploadLength.toLowerCase());
	if (!lengthHeader)
		return errorResponse(400, `Missing ${H.uploadLength} header`);
	const uploadLength = Number(lengthHeader);
	if (!Number.isFinite(uploadLength) || uploadLength < 0) {
		return errorResponse(400, `Invalid ${H.uploadLength}`);
	}
	if (config.upload.maxSize > 0 && uploadLength > config.upload.maxSize) {
		return errorResponse(413, "Upload exceeds maximum size");
	}

	const id = generateUploadId();
	const metadata = parseMetadata(
		req.headers.get(H.uploadMetadata.toLowerCase()),
	);
	const expiresAt = expiresHeaderFromNow(config.upload.expirationSeconds);
	const isoExpires = expiresAt ? new Date(expiresAt).toISOString() : null;

	insertUpload.run(
		id,
		uploadLength,
		JSON.stringify(metadata),
		userId,
		uploadPath(id),
		isoExpires,
	);

	// Creation-With-Upload: if the POST carries a body, append it immediately.
	let initialOffset = 0;
	if (body && body.byteLength > 0) {
		const buf = new Uint8Array(body);
		if (buf.byteLength > uploadLength) {
			removeFile(id);
			deleteUpload.run(id);
			return errorResponse(413, "Initial chunk exceeds declared upload length");
		}
		const checksumHeader = req.headers.get(H.uploadChecksum.toLowerCase());
		if (checksumHeader && !(await verifyChecksum(checksumHeader, buf))) {
			removeFile(id);
			deleteUpload.run(id);
			return errorResponse(460, "Checksum mismatch");
		}
		await appendBytes(id, buf);
		initialOffset = buf.byteLength;
		const res = advanceOffset.get(buf.byteLength, id, 0);
		if (!res || res.n !== 1) {
			// Race: shouldn't happen on a fresh row, but stay safe.
			removeFile(id);
			deleteUpload.run(id);
			return errorResponse(409, "Offset conflict on initial append");
		}
	}

	const extra: Record<string, string | number> = {
		[H.location]: `${UPLOAD_PREFIX}${id}`,
		[H.uploadOffset]: initialOffset,
	};
	if (expiresAt) extra[H.uploadExpires] = expiresAt;
	return okResponse(201, null, extra);
}

// ---------------------------------------------------------------------------
// HEAD — return current offset (and length if known).
// ---------------------------------------------------------------------------

export function handleHead(req: Request, id: string): Response {
	const versionErr = checkVersion(req.headers);
	if (versionErr)
		return errorResponse(412, versionErr, {
			[H.tusVersion]: SUPPORTED_VERSIONS.join(","),
		});

	const row = findUpload.get(id);
	if (!row || row.userId !== userIdFromRequest(req)) {
		return errorResponse(404, "Upload not found");
	}
	// Reconcile offset with the actual file size (defence in depth).
	const actual = fileSize(id);
	const offset = Math.max(row.offset, actual);
	return okResponse(200, null, {
		[H.uploadOffset]: offset,
		[H.uploadLength]: row.uploadLength,
	});
}

// ---------------------------------------------------------------------------
// PATCH — append bytes at the current offset.
// ---------------------------------------------------------------------------

export async function handlePatch(
	req: Request,
	id: string,
	body: ArrayBuffer | undefined,
): Promise<Response> {
	const versionErr = checkVersion(req.headers);
	if (versionErr)
		return errorResponse(412, versionErr, {
			[H.tusVersion]: SUPPORTED_VERSIONS.join(","),
		});

	return withUploadLock(id, async () => {
		const row = findUpload.get(id);
		if (!row || row.userId !== userIdFromRequest(req)) {
			return errorResponse(404, "Upload not found");
		}

		const contentType = req.headers.get("content-type") ?? "";
		if (contentType !== OFFSET_CONTENT_TYPE) {
			return errorResponse(415, `Content-Type must be ${OFFSET_CONTENT_TYPE}`);
		}

		const offsetHeader = req.headers.get(H.uploadOffset.toLowerCase());
		if (offsetHeader === null)
			return errorResponse(400, `Missing ${H.uploadOffset}`);
		const clientOffset = Number(offsetHeader);
		if (!Number.isFinite(clientOffset) || clientOffset < 0) {
			return errorResponse(400, `Invalid ${H.uploadOffset}`);
		}
		if (clientOffset !== row.offset) {
			return errorResponse(409, "Upload-Offset does not match current offset");
		}

		const buf = body ? new Uint8Array(body) : new Uint8Array(0);
		if (buf.byteLength === 0) {
			return okResponse(204, null, { [H.uploadOffset]: row.offset });
		}
		if (row.offset + buf.byteLength > row.uploadLength) {
			return errorResponse(413, "Chunk exceeds declared upload length");
		}

		const checksumHeader = req.headers.get(H.uploadChecksum.toLowerCase());
		if (checksumHeader && !(await verifyChecksum(checksumHeader, buf))) {
			return errorResponse(460, "Checksum mismatch");
		}

		await appendBytes(id, buf);
		const res = advanceOffset.get(buf.byteLength, id, row.offset);
		if (!res || res.n !== 1) {
			return errorResponse(409, "Offset conflict (concurrent write)");
		}

		return okResponse(204, null, {
			[H.uploadOffset]: row.offset + buf.byteLength,
		});
	});
}

// ---------------------------------------------------------------------------
// DELETE — Termination extension.
// ---------------------------------------------------------------------------

export function handleDelete(req: Request, id: string): Response {
	const versionErr = checkVersion(req.headers);
	if (versionErr)
		return errorResponse(412, versionErr, {
			[H.tusVersion]: SUPPORTED_VERSIONS.join(","),
		});

	const row = findUpload.get(id);
	if (!row || row.userId !== userIdFromRequest(req)) {
		return errorResponse(404, "Upload not found");
	}
	removeFile(id);
	deleteUpload.run(id);
	return okResponse(204, null, {});
}

// ---------------------------------------------------------------------------
// GET — serve stored upload bytes (protocol extension, not in the tus spec).
// Used by <img> tags for avatars. Ids are 128-bit random, so files are
// effectively unguessable; content-type comes from the Upload-Metadata.
// ---------------------------------------------------------------------------

async function handleGetFile(req: Request, id: string): Promise<Response> {
	const row = findUpload.get(id);
	if (!row || row.userId !== userIdFromRequest(req))
		return errorResponse(404, "Upload not found");
	if (row.offset < row.uploadLength)
		return errorResponse(409, "Upload is not complete");

	let declaredType = "application/octet-stream";
	try {
		const meta = JSON.parse(row.metadata) as Record<string, string>;
		if (typeof meta.filetype === "string" && meta.filetype)
			declaredType = meta.filetype.split(";", 1)[0]!.trim().toLowerCase();
	} catch {
		/* metadata may be empty or malformed */
	}
	const inlineTypes = new Set([
		"image/png",
		"image/jpeg",
		"image/gif",
		"image/webp",
		"image/x-icon",
		"image/vnd.microsoft.icon",
	]);
	const detectedType = await detectMime(id);
	const inline = inlineTypes.has(declaredType) && detectedType === declaredType;
	const size = fileSize(id);
	if (size < row.uploadLength)
		return errorResponse(404, "Upload file is missing");
	return new Response(Bun.file(uploadPath(id)), {
		status: 200,
		headers: {
			"content-type": inline ? declaredType : "application/octet-stream",
			"content-disposition": `${inline ? "inline" : "attachment"}; filename="${id}"`,
			"cache-control": "private, max-age=86400",
			"content-security-policy":
				"default-src 'none'; script-src 'none'; sandbox",
			"x-content-type-options": "nosniff",
			"content-length": String(size),
		},
	});
}

// ---------------------------------------------------------------------------
// Background sweep for the Expiration extension.
// ---------------------------------------------------------------------------

export function sweepExpired(): void {
	const now = new Date().toISOString();
	// Expired unfinished uploads: remove bytes + row (PERF-06).
	if (config.upload.expirationSeconds > 0) {
		const expired = listExpired.all(now);
		for (const row of expired) {
			removeFile(row.id);
			deleteUpload.run(row.id);
		}
	}
	// Expired sessions and password-reset tokens (PERF-06): the lazy
	// per-request cleanup covers active traffic; this bounds the tables for
	// users who never return.
	deleteExpiredSessions.run(now);
	deleteExpiredPasswordResets.run(now);
}

// ---------------------------------------------------------------------------
// Route binding. `actualMethod` is `c.req.method`: Hono routes HEAD requests
// to the GET handler but still reports "HEAD", so dispatch takes the HEAD
// branch. X-HTTP-Method-Override is applied on top.
//
// Note: Hono's tail wildcard (`/*`) produces no named param, so the upload
// id is derived from `c.req.path` instead of `c.req.param('*')`.
// ---------------------------------------------------------------------------

function routeId(c: { req: { path: string } }): string | null {
	const path = c.req.path;
	return path.length > UPLOAD_PREFIX.length
		? path.slice(UPLOAD_PREFIX.length)
		: null;
}

async function dispatch(
	req: Request,
	actualMethod: string,
	id: string | null,
	body: ArrayBuffer | undefined,
): Promise<Response> {
	const override = req.headers.get(H.xHttpMethodOverride.toLowerCase());
	const method = (override ?? actualMethod).toUpperCase();
	if (method === "OPTIONS") return handleOptions();
	if (method === "POST" && !id) return handlePost(req, body);
	if (method === "HEAD" && id) return handleHead(req, id);
	if (method === "GET" && id) return handleGetFile(req, id);
	if (method === "PATCH" && id) return handlePatch(req, id, body);
	if (method === "DELETE" && id) return handleDelete(req, id);
	return new Response(JSON.stringify({ error: "Method not allowed" }), {
		status: 405,
		headers: { "content-type": "application/json" },
	});
}

export const uploadsRoutes = () => {
	const app = new Hono();

	// OPTIONS /uploads — server capabilities (no auth, no Tus-Resumable).
	app.options("/", () => handleOptions());
	app.options("/*", () => handleOptions());

	// Upload writes are bounded per client (PERF-01): creation + PATCH are
	// rate limited, and every body is capped before buffering — PATCH chunks
	// by chunkMax, creation-with-upload by the global maxSize (0 = unlimited).
	const limitUpload = rateLimit({
		max: config.rateLimit.uploadMax,
		windowSeconds: config.rateLimit.uploadWindow,
		trustedProxies: config.trustedProxies,
	});
	const uploadCap =
		config.upload.maxSize > 0 ? config.upload.maxSize : Number.MAX_SAFE_INTEGER;
	const chunkCap =
		config.upload.chunkMax > 0 ? config.upload.chunkMax : Number.MAX_SAFE_INTEGER;

	// POST /uploads — create a new upload resource (Creation extension).
	app.post("/", limitUpload, async (c) => {
		const bytes = await readBoundedBytes(c, uploadCap);
		if (bytes === null)
			return c.json({ error: "Upload body too large." }, 413);
		return dispatch(c.req.raw, c.req.method, null, bytes);
	});
	// POST /uploads/:id — supports X-HTTP-Method-Override: PATCH/DELETE.
	app.post("/*", limitUpload, async (c) => {
		const bytes = await readBoundedBytes(c, chunkCap);
		if (bytes === null)
			return c.json({ error: "Upload chunk too large." }, 413);
		return dispatch(c.req.raw, c.req.method, routeId(c), bytes);
	});
	// /uploads/:id — HEAD / GET / PATCH / DELETE (HEAD arrives here via the
	// automatic HEAD→GET conversion, with c.req.method still "HEAD").
	app.get("/", (c) => dispatch(c.req.raw, c.req.method, null, undefined));
	app.get("/*", (c) =>
		dispatch(c.req.raw, c.req.method, routeId(c), undefined),
	);
	app.patch("/", limitUpload, async (c) =>
		dispatch(c.req.raw, c.req.method, null, await c.req.arrayBuffer()),
	);
	app.patch("/*", limitUpload, async (c) => {
		const bytes = await readBoundedBytes(c, chunkCap);
		if (bytes === null)
			return c.json({ error: "Upload chunk too large." }, 413);
		return dispatch(c.req.raw, c.req.method, routeId(c), bytes);
	});
	app.delete("/", (c) => dispatch(c.req.raw, c.req.method, null, undefined));
	app.delete("/*", (c) =>
		dispatch(c.req.raw, c.req.method, routeId(c), undefined),
	);

	return app;
};
