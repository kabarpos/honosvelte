/**
 * Regression test: the auth rate limiter must be scoped to the credential
 * endpoints. Mounted unscoped at "/", it rate-limited EVERY request in the
 * app (settings, media, pages…) to authMax/60s per IP — a settings page with
 * a few navigations + uploads exhausted the bucket and the whole app 429'd.
 * See src/server/routes/auth.routes.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { createApp } from "../src/server/app";

let app: Awaited<ReturnType<typeof createApp>>;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "3";
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";

async function post(path: string): Promise<Response> {
	return app.request(`${BASE}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
	});
}

describe("auth rate limiter scoping", () => {
	it("rate-limits /login after authMax attempts", async () => {
		const codes: number[] = [];
		for (let i = 0; i < 4; i++) codes.push((await post("/login")).status);
		// 1..3 pass through the limiter (they 422 on validation of a wrong
		// body — the important part is they are NOT 429), the 4th is blocked.
		expect(codes[0]).not.toBe(429);
		expect(codes[1]).not.toBe(429);
		expect(codes[2]).not.toBe(429);
		expect(codes[3]).toBe(429);
	});

	it("does not rate-limit unrelated routes after the auth bucket is exhausted", async () => {
		// Bucket for /login is already full; hitting 4 more /login attempts
		// keeps it 429, proving the limiter is active…
		expect((await post("/login")).status).toBe(429);
		expect((await post("/login")).status).toBe(429);
		// …while non-auth endpoints are unaffected.
		const page = await app.request(`${BASE}/login`, { method: "GET" });
		expect(page.status).not.toBe(429);
		const media = await app.request(`${BASE}/media`, { method: "GET" });
		expect(media.status).not.toBe(429);
	});
});
