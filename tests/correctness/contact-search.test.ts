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

describe("contact inbox search", () => {
	it("filters contact messages and count metadata", async () => {
		await call(app, "/contact", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				name: "Searchable Contact",
				email: "searchable-contact@example.com",
				subject: "Unique Subject",
				message: "This message contains a unique search phrase.",
			},
		});
		await call(app, "/contact", {
			method: "POST",
			headers: INERTIA_HEADERS,
			body: {
				name: "Other Contact",
				email: "other-contact@example.com",
				subject: "Other Subject",
				message: "Another message.",
			},
		});
		await seedUser(
			"Contact Admin",
			"contact-search-admin@example.com",
			"admin",
		);
		const cookie = await loginAs(app, "contact-search-admin@example.com");

		const response = await call(app, "/contact/inbox?search=Unique%20Subject", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			props: {
				messages: {
					data: Array<{ email: string }>;
					meta: { total: number };
				};
			};
		};
		expect(payload.props.messages.meta.total).toBe(1);
		expect(payload.props.messages.data[0]?.email).toBe(
			"searchable-contact@example.com",
		);
	});
});
