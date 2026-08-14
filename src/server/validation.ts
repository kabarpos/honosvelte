/**
 * Route-level request validation via TypeBox (schemas live in the route
 * files). Wraps the JSON body in a typed middleware so TypeBox failures
 * surface as a `ValidationFailed` error carrying per-field messages; app.ts
 * maps that to Inertia 422 page payloads (same contract as the Elysia era).
 */
import type { Static, TSchema } from "@sinclair/typebox";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { AppEnv } from "./inertia-middleware";
import { config } from "./config";

// Elysia's TypeBox wrapper pre-registered the standard string formats; plain
// @sinclair/typebox does not. The boilerplate only uses 'email' today —
// register more formats here if a schema starts using them.
FormatRegistry.Set("email", (value) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
);

const JSON_CONTENT_TYPE =
	/^application\/([a-z-.+]+(\+json)|json)(;\s*[a-zA-Z0-9-]+=[^;]+)*$/i;

export interface FieldError {
	/** TypeBox path, e.g. "/email" — matched against VALIDATION_MESSAGES. */
	path: string;
	message: string;
}

/** Thrown by `validateJson` when the JSON body fails its TypeBox schema. */
export class ValidationFailed extends Error {
	constructor(readonly errors: FieldError[]) {
		super("Request validation failed");
		this.name = "ValidationFailed";
	}
}

/**
 * Read the raw request body with a hard byte cap (PERF-01). Content-Length
 * is checked first (cheap reject), then the stream is read with a running
 * cap so a lying/absent header cannot buffer unbounded memory. Returns null
 * when the body exceeds `cap` — the caller replies 413.
 */
export async function readBoundedBytes(
	c: Context<AppEnv>,
	cap: number,
): Promise<ArrayBuffer | null> {
	const declared = Number(c.req.header("content-length") ?? "0");
	if (declared > cap) return null;
	const stream = c.req.raw.body;
	if (!stream) return new ArrayBuffer(0);
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				total += value.byteLength;
				if (total > cap) return null;
				chunks.push(value);
			}
		}
	} finally {
		reader.cancel().catch(() => {});
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out.buffer;
}

/**
 * Read + parse the request body with a hard byte bound (PERF-01). Bodies
 * over the limit are rejected with 413 before parsing.
 */
async function readBoundedJsonBody(c: Context<AppEnv>): Promise<unknown> {
	const bytes = await readBoundedBytes(c, config.requestBodyLimit);
	if (bytes === null) {
		throw new HTTPException(413, { message: "Request body too large" });
	}
	const text = new TextDecoder().decode(bytes);
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new HTTPException(400, {
			message: "Malformed JSON in request body",
		});
	}
}

/** Parse + validate a JSON body against `schema`. The handler's
 *  `c.req.valid("json")` is typed as the schema's static type. */
export const validateJson = <T extends TSchema>(schema: T) =>
	createMiddleware<
		AppEnv,
		string,
		{ in: { json: Static<T> }; out: { json: Static<T> } }
	>(async (c, next) => {
		let value: unknown = {};
		const contentType = c.req.header("content-type") ?? "";
		if (JSON_CONTENT_TYPE.test(contentType)) {
			value = await readBoundedJsonBody(c);
		}
		if (Value.Check(schema, value)) {
			c.req.addValidatedData("json", value as Static<T> as {});
			await next();
			return;
		}
		throw new ValidationFailed(
			[...Value.Errors(schema, value)].map((e) => ({
				path: e.path,
				message: e.message,
			})),
		);
	});
