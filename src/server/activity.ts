/**
 * Activity log helper (Modul 13). `recordActivity` appends one row to the
 * activity_logs table with the acting user, event, detail, IP, URL and
 * method. Shared by every route that records a meaningful action; the SQL
 * lives in db.ts (all prepared statements live there — see AGENTS.md).
 *
 * Peer IP resolution mirrors the rate limiter: X-Forwarded-For first entry
 * (trust only behind a proxy that sets it), else the Bun server's requestIP,
 * else null.
 */
import type { Server } from "bun";
import type { Context } from "hono";
import type { AppEnv } from "./inertia-middleware";
import { insertActivity } from "./db";
import { safeUrl } from "./url";

type BunServer = Server<any>;

function peerIp(c: Context<AppEnv>): string | null {
	const forwarded = c.req.header("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]!.trim();
	const server = (c.env as unknown as BunServer | undefined) ?? null;
	const ip = server?.requestIP?.(c.req.raw)?.address;
	return ip ?? null;
}

/** Record one activity entry for the current request/user. */
export function recordActivity(
	c: Context<AppEnv>,
	userId: number | null,
	event: string,
	detail: string | null = null,
): void {
	insertActivity.run(
		userId,
		event,
		detail,
		peerIp(c),
		safeUrl(c.req.url).pathname,
		c.req.method,
	);
}
