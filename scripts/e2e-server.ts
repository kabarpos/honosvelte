/**
 * E2E server: seeds a disposable admin + data dirs, then boots the real app
 * (src/index.ts) for the Playwright suite. Env is resolved at import time,
 * so it must be set BEFORE importing any src/server module.
 *
 * Usage: `bun run e2e:server` (or via the Playwright webServer config).
 */
import { mkdirSync, rmSync } from "node:fs";

const port = process.env.PORT ?? "4310";
const dbPath = process.env.DATABASE_PATH ?? "./data/e2e.sqlite";
const uploadDir = process.env.UPLOAD_DIR ?? "./data/e2e-uploads";
const mediaDir = process.env.MEDIA_DIR ?? "./data/e2e-media";

process.env.PORT = port;
process.env.DATABASE_PATH = dbPath;
process.env.UPLOAD_DIR = uploadDir;
process.env.MEDIA_DIR = mediaDir;
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? "1000";
process.env.APP_URL = process.env.APP_URL ?? `http://localhost:${port}`;

// Fresh state every run (Playwright's webServer restarts the process).
// SAFETY: only ever clean paths that look like the disposable e2e data —
// never touch a real DATABASE_PATH/UPLOAD_DIR/MEDIA_DIR.
const e2eDataPaths = [dbPath, uploadDir, mediaDir].filter((p) =>
	p.includes("e2e"),
);
if (e2eDataPaths.length !== 3) {
	throw new Error(
		"e2e-server refuses to run: DATABASE_PATH/UPLOAD_DIR/MEDIA_DIR must all point under an 'e2e' path (got " +
			`db=${dbPath}, upload=${uploadDir}, media=${mediaDir}` +
			") — use the Playwright webServer env or set E2E_* vars.",
	);
}
for (const target of e2eDataPaths) {
	rmSync(target, { recursive: true, force: true });
}
// Force a fresh client build so e2e never runs against stale assets
// (index.ts only rebuilds when the manifest is missing).
rmSync("dist/manifest.json", { force: true });
mkdirSync(uploadDir, { recursive: true });
mkdirSync(mediaDir, { recursive: true });

const { hashPassword } = await import("../src/server/auth");
const { createUserWithRole, findUserByEmail } = await import("../src/server/db");
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "admin123";
if (!findUserByEmail.get(adminEmail)) {
	createUserWithRole.get(
		"E2E Admin",
		adminEmail,
		await hashPassword(adminPassword),
		"admin",
	);
}
console.log(`[e2e] seeded ${adminEmail} → http://localhost:${port}`);

// Boot the app (serves until killed by Playwright teardown).
await import("../src/index");
