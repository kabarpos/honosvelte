/**
 * Minimal in-memory fixed-window rate limiter — zero dependencies.
 * Registered on the auth routes; Hono middleware MUST call `next()` to
 * continue the chain (unlike Elysia beforeHandle, where returning undefined
 * continued).
 *
 * Notes:
 *  - Per-process memory; fine for a single instance. For horizontal scaling
 *    swap this for a shared store (Redis) behind the same hook signature.
 *  - Client key: the direct peer IP (via the Bun server Bun passes as the
 *    2nd fetch arg → `c.env`), else 'local'. `X-Forwarded-For` is ONLY
 *    honored when the direct peer belongs to the configured `trustedProxies`
 *    — see SEC-09. Spoofed XFF from untrusted clients is ignored, otherwise
 *    an attacker could rotate the header to evade per-IP limits.
 *  - `accountKey` (optional) adds an account-level bucket (`client:account`)
 *    on top of the client bucket — used on credential endpoints so a
 *    targeted brute force on one account is blocked regardless of IP.
 *  - Why not hono-rate-limiter: its keyGenerator story leans on
 *    `hono/conninfo`, whose ESM build is an empty stub in hono 4.13. The
 *    hand-rolled version keeps the exact semantics with zero deps.
 */
import type { Server } from "bun";
import type { Context, Next } from "hono";
import type { AppEnv } from "./inertia-middleware";

export interface RateLimitOptions {
	max: number;
	windowSeconds: number;
	/** Optional per-request account component (e.g. the email from a login
	 *  body). When it resolves to a non-empty string, the request counts
	 *  against BOTH the client bucket and a `client:account` bucket. */
	accountKey?: (c: Context<AppEnv>) => Promise<string | null> | string | null;
	/** Proxy networks (IP or IPv4 CIDR) that are trusted to set
	 *  `X-Forwarded-For`. Default: none — header never trusted. */
	trustedProxies?: string[];
}

interface Bucket {
	count: number;
	resetAt: number;
}

const MAX_BUCKETS = 10_000;

type BunServer = Server<any>;

/** Normalize "::ffff:127.0.0.1" → "127.0.0.1" so IPv4-mapped IPv6 peers
 *  compare equal to plain IPv4 addresses. */
function normalizeIp(ip: string): string {
	const v = ip.trim().toLowerCase();
	return v.startsWith("::ffff:") ? v.slice(7) : v;
}

/** Parse an IP into 4 (IPv4) or 16 (IPv6) bytes, or null if malformed. */
function ipToBytes(ip: string): Uint8Array | null {
	const v = normalizeIp(ip);
	const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) {
		const parts = v4.slice(1).map(Number);
		if (parts.some((p) => p > 255)) return null;
		return new Uint8Array(parts);
	}
	// IPv6: accept the canonical 8-group form plus "::" compression.
	if (!v.includes(":")) return null;
	const halves = v.split("::");
	if (halves.length > 2) return null;
	const groups = (text: string): number[] =>
		text === ""
			? []
			: text.split(":").map((g) => {
					const n = Number.parseInt(g, 16);
					return Number.isNaN(n) ? -1 : n;
				});
	const head = groups(halves[0] ?? "");
	const tail = halves.length === 2 ? groups(halves[1] ?? "") : [];
	const compressed = halves.length === 2 ? 8 - head.length - tail.length : 0;
	if (compressed < 0) return null;
	const all = [...head, ...new Array<number>(compressed).fill(0), ...tail];
	if (all.length !== 8 || all.some((n) => n < 0 || n > 0xffff)) return null;
	const bytes = new Uint8Array(16);
	all.forEach((n, i) => {
		bytes[i * 2] = (n >> 8) & 0xff;
		bytes[i * 2 + 1] = n & 0xff;
	});
	return bytes;
}

const byte = (arr: Uint8Array, i: number): number => arr[i] ?? 0;

/** Whether `ip` falls inside `network` (exact IP or IPv4 CIDR). */
export function ipInNetwork(ip: string, network: string): boolean {
	const [base, prefixRaw] = network.split("/");
	if (!base) return false;
	const ipBytes = ipToBytes(ip);
	if (!ipBytes) return false;
	const baseBytes = ipToBytes(base);
	if (!baseBytes) return false;
	if (prefixRaw === undefined) {
		// Exact match (lengths must agree — 127.0.0.1 ≠ 127.0.0.1::1).
		return (
			ipBytes.length === baseBytes.length &&
			ipBytes.every((b, i) => b === byte(baseBytes, i))
		);
	}
	const prefix = Number(prefixRaw);
	if (!Number.isInteger(prefix)) return false;
	const bits = ipBytes.length * 8;
	if (prefix < 0 || prefix > bits || ipBytes.length !== baseBytes.length)
		return false;
	const fullBytes = Math.floor(prefix / 8);
	for (let i = 0; i < fullBytes; i++) {
		if (byte(ipBytes, i) !== byte(baseBytes, i)) return false;
	}
	if (prefix % 8 !== 0) {
		const mask = 0xff << (8 - (prefix % 8));
		if (
			(byte(ipBytes, fullBytes) & mask) !==
			(byte(baseBytes, fullBytes) & mask)
		) {
			return false;
		}
	}
	return true;
}

export interface ClientKeyInput {
	/** Direct peer address from the socket, if known. */
	peerIp?: string | null;
	/** Raw `X-Forwarded-For` header value, if present. */
	forwardedFor?: string | null;
	/** Trusted proxy networks (IP or CIDR). */
	trustedProxies?: string[];
}

/** Resolve the effective rate-limit key for a request.
 *
 *  Security contract (SEC-09): the header is honored ONLY when the direct
 *  peer is a configured trusted proxy, and only the FIRST (client-most)
 *  entry is used — later entries are attacker-controllable. When the peer
 *  is unknown ('local') or untrusted, the header is ignored entirely. */
export function resolveClientKey(input: ClientKeyInput): string {
	const peer = input.peerIp?.trim();
	if (!peer) return "local";
	const normalizedPeer = normalizeIp(peer);
	const trusted = (input.trustedProxies ?? []).some((n) =>
		ipInNetwork(normalizedPeer, n),
	);
	if (trusted && input.forwardedFor) {
		const first = input.forwardedFor.split(",")[0]!.trim();
		// Only accept a syntactically valid IP — garbage in the header must
		// not become a key (e.g. a header full of identical junk would
		// collapse every client into one bucket).
		if (first && ipToBytes(first) !== null) return normalizeIp(first);
	}
	return normalizedPeer;
}

function clientKey(
	request: Request,
	server: BunServer | null,
	trustedProxies: string[],
): string {
	const peer = server?.requestIP?.(request)?.address ?? null;
	return resolveClientKey({
		peerIp: peer,
		forwardedFor: request.headers.get("x-forwarded-for"),
		trustedProxies,
	});
}

export function rateLimit({
	max,
	windowSeconds,
	accountKey,
	trustedProxies = [],
}: RateLimitOptions) {
	const buckets = new Map<string, Bucket>();

	// Opportunistic pruning so the map cannot grow unbounded.
	function pruneExpired(now: number): void {
		if (buckets.size <= MAX_BUCKETS) return;
		for (const [k, bucket] of buckets) {
			if (bucket.resetAt <= now) buckets.delete(k);
		}
	}

	async function checkAndRecord(
		key: string,
		now: number,
	): Promise<number | null> {
		const bucket = buckets.get(key);
		if (!bucket || bucket.resetAt <= now) {
			buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
			return null;
		}
		bucket.count += 1;
		return bucket.count > max
			? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
			: null;
	}

	return async (c: Context<AppEnv>, next: Next) => {
		const now = Date.now();
		pruneExpired(now);

		const client = clientKey(
			c.req.raw,
			(c.env as unknown as BunServer | undefined) ?? null,
			trustedProxies,
		);
		const account = accountKey ? await accountKey(c) : null;
		// Account-aware mode double-counts: the client bucket protects against
		// distributed brute force, the client:account bucket protects the
		// targeted account regardless of which IP is used.
		const keys = account ? [client, `${client}:${account}`] : [client];

		let retryAfter: number | null = null;
		for (const key of keys) {
			const blocked = await checkAndRecord(key, now);
			if (blocked !== null) {
				retryAfter = blocked;
				break;
			}
		}
		if (retryAfter !== null) {
			return new Response("Too many attempts. Please try again later.", {
				status: 429,
				headers: { "retry-after": String(retryAfter) },
			});
		}
		return next();
	};
}
