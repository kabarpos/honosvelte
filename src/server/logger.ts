/**
 * Request logging + correlation id.
 *
 * Log lines are batched: the per-request cost is one string push into an
 * in-memory buffer — no syscall on the hot path (console.log per request is
 * a write syscall each, and can block the event loop under backpressure).
 * A timer flushes the buffer to stdout every FLUSH_INTERVAL_MS, and the
 * 'exit' handler drains synchronously so shutdown never loses lines.
 * Errors are written immediately to stderr — never batched.
 *
 * /health and /assets/* still get the x-request-id header but produce no
 * log line (infrastructure noise, not user traffic).
 */
import { randomBytes } from "node:crypto";
import { writeSync } from "node:fs";
import type { Context, Next } from "hono";
import type { AppEnv } from "./inertia-middleware";
import { safeUrl } from "./url";
import { inc } from "./metrics";

const FLUSH_INTERVAL_MS = 50;
const SILENT_PATHS: RegExp[] = [/^\/health$/, /^\/assets\//];

let buffer: string[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function flush(): void {
	if (buffer.length === 0) return;
	const lines = buffer.join("\n") + "\n";
	buffer = [];
	writeSync(1, lines); // fd 1 = stdout (12-factor: logs go to stdout)
}

function schedule(): void {
	if (timer) return;
	timer = setInterval(flush, FLUSH_INTERVAL_MS);
	timer.unref?.(); // must not keep the process alive
}

process.on("exit", () => {
	if (buffer.length > 0) {
		// Synchronous drain on shutdown (the interval may be unref'd).
		writeSync(1, buffer.join("\n") + "\n");
		buffer = [];
	}
});

export const requestLogger = async (c: Context<AppEnv>, next: Next) => {
	const requestId = randomBytes(6).toString("hex");
	const start = performance.now();
	const { pathname } = safeUrl(c.req.url);
	const method = c.req.method;
	c.set("requestId", requestId);

	const result = await next();

	const durationMs = (performance.now() - start).toFixed(1);
	c.res.headers.set("x-request-id", requestId);
	// OPS-02: request counters by status class (cheap in-memory increment).
	const statusClass = `${Math.floor(c.res.status / 100)}xx`;
	inc(`requests.${statusClass}`);
	inc("requests.total");
	if (!SILENT_PATHS.some((re) => re.test(pathname))) {
		buffer.push(
			`[req:${requestId}] ${method} ${pathname} -> ${c.res.status} (${durationMs}ms)`,
		);
		schedule();
	}
	return result;
};

export function logError(c: Context<AppEnv>, error: unknown): void {
	const { pathname } = safeUrl(c.req.url);
	const requestId = c.get("requestId") || "-";
	console.error(
		`[req:${requestId}] ${c.req.method} ${pathname} FAILED:`,
		error,
	);
}

/** Structured error line for background jobs / fire-and-forget paths that
 *  have no Hono context (mail/whatsapp sends, avatar downloads, …). Keeps
 *  the same `[scope]` prefix convention as request errors so log grep works
 *  uniformly (COR-07). */
export function logErrorRaw(scope: string, error: unknown): void {
	const requestId = randomBytes(3).toString("hex");
	console.error(`[job:${requestId}] [${scope}] FAILED:`, error);
}
