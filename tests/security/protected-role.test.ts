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

function userBody(
	email: string,
	role: "user" | "admin" | "super_admin",
	status: "active" | "inactive" = "active",
) {
	return {
		name: "Protected Role User",
		email,
		role,
		status,
		whatsapp: "",
		password: "password123",
		passwordConfirmation: "password123",
	};
}

describe("protected role authorization", () => {
	it("prevents ordinary admins from creating or assigning super_admin", async () => {
		const adminId = await seedUser(
			"Ordinary Admin",
			"ordinary-admin@example.com",
			"admin",
		);
		const targetId = await seedUser(
			"Regular Target",
			"regular-target@example.com",
		);
		const cookie = await loginAs(app, "ordinary-admin@example.com");

		const createResponse = await call(app, "/users", {
			method: "POST",
			headers: INERTIA_HEADERS,
			cookie,
			body: userBody("created-super@example.com", "super_admin"),
		});
		expect(createResponse.status).toBe(403);

		const selfResponse = await call(app, `/users/${adminId}`, {
			method: "PATCH",
			headers: INERTIA_HEADERS,
			cookie,
			body: userBody("ordinary-admin@example.com", "super_admin"),
		});
		expect(selfResponse.status).toBe(403);

		const targetResponse = await call(app, `/users/${targetId}`, {
			method: "PATCH",
			headers: INERTIA_HEADERS,
			cookie,
			body: userBody("regular-target@example.com", "super_admin"),
		});
		expect(targetResponse.status).toBe(403);
	});

	it("prevents the last super_admin from being demoted or deactivated", async () => {
		const superAdminId = await seedUser(
			"Only Super Admin",
			"only-super@example.com",
			"super_admin",
		);
		const cookie = await loginAs(app, "only-super@example.com");

		const demoteResponse = await call(app, `/users/${superAdminId}`, {
			method: "PATCH",
			headers: INERTIA_HEADERS,
			cookie,
			body: userBody("only-super@example.com", "user"),
		});
		expect(demoteResponse.status).toBe(422);

		const deactivateResponse = await call(
			app,
			`/users/${superAdminId}/status`,
			{
				method: "POST",
				headers: INERTIA_HEADERS,
				cookie,
				body: { status: "inactive" },
			},
		);
		expect(deactivateResponse.status).toBe(422);
	});

	it("allows a super_admin to create another super_admin", async () => {
		await seedUser("Root Super Admin", "root-super@example.com", "super_admin");
		const cookie = await loginAs(app, "root-super@example.com");
		const response = await call(app, "/users", {
			method: "POST",
			headers: INERTIA_HEADERS,
			cookie,
			body: userBody("second-super@example.com", "super_admin"),
		});
		expect(response.status).toBe(303);
		const { findUserByEmail } = await import("../../src/server/db");
		expect(findUserByEmail.get("second-super@example.com")?.role).toBe(
			"super_admin",
		);
	});
});
