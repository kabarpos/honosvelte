import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { call, registerUser, type TestApp } from "./helpers";

let app: TestApp;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	const { createApp } = await import("../../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../../src/server/db");
	db.close();
});

describe("CSRF origin validation", () => {
	it("rejects malformed origins", async () => {
		const cookie = await registerUser(app, "csrf-malformed@example.com");
		const response = await call(app, "/logout", {
			method: "POST",
			cookie,
			headers: { origin: "not-a-url" },
		});
		expect(response.status).toBe(403);
	});

	it("rejects a scheme-mismatched origin", async () => {
		const cookie = await registerUser(app, "csrf-scheme@example.com");
		const response = await call(app, "/logout", {
			method: "POST",
			cookie,
			headers: { origin: "https://localhost:3000" },
		});
		expect(response.status).toBe(403);
	});

	it("allows the exact request origin", async () => {
		const cookie = await registerUser(app, "csrf-same-origin@example.com");
		const response = await call(app, "/logout", {
			method: "POST",
			cookie,
			headers: { origin: "http://localhost:3000" },
		});
		expect(response.status).toBe(303);
	});
});
