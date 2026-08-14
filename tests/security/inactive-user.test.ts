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

describe("inactive account enforcement", () => {
	it("rejects a new login for an inactive user", async () => {
		await seedUser(
			"Inactive Login User",
			"inactive-login@example.com",
			"user",
			"inactive",
		);
		const response = await call(app, "/login", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				email: "inactive-login@example.com",
				password: "password123",
			},
		});
		expect(response.status).toBe(422);
	});

	it("revokes sessions on deactivation and restores access on reactivation", async () => {
		const adminId = await seedUser(
			"Status Admin",
			"status-admin@example.com",
			"admin",
		);
		const targetId = await seedUser(
			"Status Target",
			"status-target@example.com",
		);
		const adminCookie = await loginAs(app, "status-admin@example.com");
		const targetCookie = await loginAs(app, "status-target@example.com");

		const deactivate = await call(app, `/users/${targetId}/status`, {
			method: "POST",
			headers: INERTIA_HEADERS,
			cookie: adminCookie,
			body: { status: "inactive" },
		});
		expect(deactivate.status).toBe(303);

		const existingSession = await call(app, "/dashboard", {
			headers: INERTIA_HEADERS,
			cookie: targetCookie,
		});
		expect(existingSession.status).toBe(302);

		const inactiveLogin = await call(app, "/login", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				email: "status-target@example.com",
				password: "password123",
			},
		});
		expect(inactiveLogin.status).toBe(422);

		const reactivate = await call(app, `/users/${targetId}/status`, {
			method: "POST",
			headers: INERTIA_HEADERS,
			cookie: adminCookie,
			body: { status: "active" },
		});
		expect(reactivate.status).toBe(303);
		await loginAs(app, "status-target@example.com");
		expect(adminId).toBeGreaterThan(0);
	});
});
