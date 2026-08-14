import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	call,
	INERTIA_HEADERS,
	loginAs,
	seedUser,
	type TestApp,
} from "../security/helpers";

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

describe("user search", () => {
	it("filters by name and email with consistent pagination metadata", async () => {
		await seedUser("Needle Name", "first@example.com");
		await seedUser("Other Name", "needle-email@example.com");
		await seedUser("Unrelated", "unrelated@example.com");
		await seedUser("Search Admin", "search-admin@example.com", "admin");
		const cookie = await loginAs(app, "search-admin@example.com");

		const byName = await call(app, "/users?search=Needle%20Name", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(byName.status).toBe(200);
		const namePayload = (await byName.json()) as {
			props: {
				users: { data: Array<{ email: string }>; meta: { total: number } };
			};
		};
		expect(namePayload.props.users.meta.total).toBe(1);
		expect(namePayload.props.users.data.map((u) => u.email)).toEqual([
			"first@example.com",
		]);

		const byEmail = await call(app, "/users?search=needle-email", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(byEmail.status).toBe(200);
		const emailPayload = (await byEmail.json()) as {
			props: {
				users: { data: Array<{ email: string }>; meta: { total: number } };
			};
		};
		expect(emailPayload.props.users.meta.total).toBe(1);
		expect(emailPayload.props.users.data[0]?.email).toBe(
			"needle-email@example.com",
		);
	});
});
