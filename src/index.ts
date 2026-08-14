/**
 * Entry point. Builds client assets on first run / in dev, then serves.
 *   bun run dev    → watch mode, rebuilds assets on restart
 *   bun run build  → prebuild assets for production
 *   bun run start  → serve prebuilt assets (NODE_ENV=production)
 *
 * Bun.serve hands the Bun Server to `fetch` as its 2nd argument, which Hono
 * stores as `c.env` — the rate limiter reads the peer IP from it.
 */
import {
	buildClientAssets,
	loadManifest,
	manifestExists,
} from "./server/assets";
import { createApp } from "./server/app";
import { config } from "./server/config";
import { db } from "./server/db";
import { sweepExpired } from "./server/routes/uploads.routes";
import { reconcileMedia } from "./server/routes/media.routes";

const isProd = config.isProd;
if (!isProd || !manifestExists()) {
	await buildClientAssets();
}

const assets = loadManifest();
const port = config.port;

const server = Bun.serve({
	port,
	fetch: createApp(assets).fetch,
});
const cleanupIntervalMs = 15 * 60 * 1000;
const cleanupTimer = setInterval(() => {
	sweepExpired();
	// COR-05: reconcile media rows ↔ stored files (orphan sweep).
	reconcileMedia();
}, cleanupIntervalMs);
cleanupTimer.unref?.();
console.log(`Honosvelte boilerplate → http://localhost:${port}`);

function shutdown(signal: string): void {
	console.log(`\n${signal} received — shutting down`);
	clearInterval(cleanupTimer);
	server.stop(true); // graceful: wait for in-flight requests
	db.close();
	process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
// Fail loudly on stray async errors instead of swallowing them; the
// supervisor (Docker restart policy) brings the process back up.
process.on("unhandledRejection", (reason) => {
	console.error("Unhandled promise rejection:", reason);
	process.exit(1);
});
