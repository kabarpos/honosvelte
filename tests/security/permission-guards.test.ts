import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	call,
	grantPermission,
	INERTIA_HEADERS,
	loginAs,
	expectRedirect,
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

describe("granular permission guards", () => {
	it("reject revoked permissions on each protected admin surface", async () => {
		const adminId = await seedUser(
			"Restricted Admin",
			"restricted-admin@example.com",
			"admin",
		);
		const cookie = await loginAs(app, "restricted-admin@example.com");
		for (const slug of [
			"contact.read",
			"contact.update",
			"contact.delete",
			"contact.reply",
			"notifications.read",
			"notifications.update",
			"email.read",
			"email.test",
			"whatsapp.read",
			"whatsapp.test",
		]) {
			await grantPermission(adminId, slug, false);
		}

		const contact = await call(app, "/contact/inbox", { headers: { cookie } });
		expectRedirect(contact, "/dashboard");
		const notifications = await call(app, "/notifications", {
			headers: { cookie },
		});
		expectRedirect(notifications, "/dashboard");
		const emailPreview = await call(app, "/email/templates/1/preview", {
			headers: { cookie },
		});
		expectRedirect(emailPreview, "/dashboard");
		const emailTest = await call(app, "/email/templates/1/test", {
			method: "POST",
			headers: { cookie, ...INERTIA_HEADERS },
			body: { email: "target@example.com" },
		});
		expectRedirect(emailTest, "/dashboard");
		const whatsappPreview = await call(app, "/whatsapp/templates/1/preview", {
			headers: { cookie },
		});
		expectRedirect(whatsappPreview, "/dashboard");
		const whatsappTest = await call(app, "/whatsapp/templates/1/test", {
			method: "POST",
			headers: { cookie, ...INERTIA_HEADERS },
			body: { phone: "6281200000000" },
		});
		expectRedirect(whatsappTest, "/dashboard");
	});
});
