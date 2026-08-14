import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	call,
	INERTIA_HEADERS,
	json,
	loginAs,
	registerUser,
	type TestApp,
	expectBodyNotToContain,
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

describe("secret projection", () => {
	it("does not serialize server-only settings in public or authenticated pages", async () => {
		const { setSetting } = await import("../../src/server/settings");
		setSetting("mail.smtp_pass", "smtp-secret-for-test");
		setSetting("whatsapp.api_key", "whatsapp-secret-for-test");

		const publicResponse = await call(app, "/", {
			headers: INERTIA_HEADERS,
		});
		expect(publicResponse.status).toBe(200);
		const publicPayload = JSON.stringify(await json(publicResponse));
		expectBodyNotToContain(publicPayload, [
			"mail.smtp_pass",
			"whatsapp.api_key",
			"smtp-secret-for-test",
			"whatsapp-secret-for-test",
		]);

		const cookie = await registerUser(app, "secret-projection@example.com");
		const authenticatedResponse = await call(app, "/dashboard", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(authenticatedResponse.status).toBe(200);
		const authenticatedPayload = JSON.stringify(
			await json(authenticatedResponse),
		);
		expectBodyNotToContain(authenticatedPayload, [
			"mail.smtp_pass",
			"whatsapp.api_key",
			"smtp-secret-for-test",
			"whatsapp-secret-for-test",
		]);
	});

	it("returns only API-key presence to the WhatsApp admin page", async () => {
		const { createUserWithRole } = await import("../../src/server/db");
		const { hashPassword } = await import("../../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get(
			"Secret Admin",
			"secret-admin@example.com",
			hash,
			"admin",
		);
		const cookie = await loginAs(app, "secret-admin@example.com");
		const response = await call(app, "/whatsapp", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(response.status).toBe(200);
		const payload = await json(response);
		const serialized = JSON.stringify(payload);
		expectBodyNotToContain(serialized, ["apiKey", "whatsapp-secret-for-test"]);
		const props = payload.props as {
			whatsapp: { hasApiKey: boolean };
		};
		expect(props.whatsapp.hasApiKey).toBe(true);
	});
});
