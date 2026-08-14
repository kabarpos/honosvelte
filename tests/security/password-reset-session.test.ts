import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	call,
	INERTIA_HEADERS,
	loginAs,
	seedUser,
	type TestApp,
} from "./helpers";

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

describe("password reset session lifecycle", () => {
	it("revokes old sessions and consumes the reset token", async () => {
		await seedUser("Reset User", "reset-session@example.com");
		const oldCookie = await loginAs(app, "reset-session@example.com");
		const { createPasswordReset } = await import("../../src/server/auth");
		const token = createPasswordReset("reset-session@example.com");

		const reset = await call(app, "/reset-password", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				email: "reset-session@example.com",
				token,
				password: "new-password123",
				passwordConfirmation: "new-password123",
			},
		});
		expect(reset.status).toBe(303);

		const oldSessionResponse = await call(app, "/dashboard", {
			headers: INERTIA_HEADERS,
			cookie: oldCookie,
		});
		expect(oldSessionResponse.status).toBe(302);

		const oldPasswordLogin = await call(app, "/login", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				email: "reset-session@example.com",
				password: "password123",
			},
		});
		expect(oldPasswordLogin.status).toBe(422);

		const newCookie = await loginAs(
			app,
			"reset-session@example.com",
			"new-password123",
		);
		expect(newCookie).not.toBe("");

		const reused = await call(app, "/reset-password", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				email: "reset-session@example.com",
				token,
				password: "another-password123",
				passwordConfirmation: "another-password123",
			},
		});
		expect(reused.status).toBe(422);
		const { listActivity } = await import("../../src/server/db");
		expect(
			listActivity
				.all("", "", "", "", "", "", "", 20, 0)
				.some((entry) => entry.event === "password.reset"),
		).toBe(true);
	});
});
