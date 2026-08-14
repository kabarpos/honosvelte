import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

		const publicHtmlResponse = await call(app, "/");
		expect(publicHtmlResponse.status).toBe(200);
		const publicHtml = await publicHtmlResponse.text();
		expectBodyNotToContain(publicHtml, [
			"mail.smtp_pass",
			"whatsapp.api_key",
			"smtp-secret-for-test",
			"whatsapp-secret-for-test",
		]);

		const loginHtmlResponse = await call(app, "/login");
		expect(loginHtmlResponse.status).toBe(200);
		const loginHtml = await loginHtmlResponse.text();
		expectBodyNotToContain(loginHtml, [
			"mail.smtp_pass",
			"whatsapp.api_key",
			"smtp-secret-for-test",
			"whatsapp-secret-for-test",
		]);

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

	it("does not leak secrets into the admin settings page or its flash", async () => {
		const { createUserWithRole } = await import("../../src/server/db");
		const { hashPassword } = await import("../../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get(
			"Settings Admin",
			"settings-admin@example.com",
			hash,
			"admin",
		);
		const cookie = await loginAs(app, "settings-admin@example.com");

		// Render the admin settings page — server-only settings must not be
		// projected into its props either (SEC-01 full-payload audit).
		const page = await call(app, "/settings", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(page.status).toBe(200);
		const pagePayload = JSON.stringify(await json(page));
		expectBodyNotToContain(pagePayload, [
			"mail.smtp_pass",
			"whatsapp.api_key",
			"smtp-secret-for-test",
			"whatsapp-secret-for-test",
		]);

		// Save settings while the WhatsApp API key secret is present: the
		// one-shot flash rendered afterwards must be the static success
		// message, never an echo of the secret.
		const save = await call(app, "/settings", {
			method: "POST",
			headers: INERTIA_HEADERS,
			cookie,
			body: { general: { "app.name": "SecretLeak Test" } },
		});
		expect(save.status).toBe(303);
		const after = await call(app, "/settings", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(after.status).toBe(200);
		const afterPayload = JSON.stringify(await json(after));
		expect(afterPayload).toContain("Settings saved.");
		expectBodyNotToContain(afterPayload, [
			"smtp-secret-for-test",
			"whatsapp-secret-for-test",
		]);
	});

	it("does not log request query strings or bodies (secret-in-log audit)", async () => {
		// Boot the app in a subprocess and drive real requests whose query
		// strings and bodies carry secret-looking values; the batched request
		// logger must never emit them (it logs method + pathname + status
		// only). Spawning keeps the logger's stdout capture independent of
		// this test process.
		const { spawnSync } = await import("node:child_process");
		const { writeFileSync } = await import("node:fs");
		const script = `
process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_AUTH_MAX = "1000";
const { createApp } = await import(process.cwd() + "/src/server/app");
const app = createApp({ version: "t", js: "a.js", css: "a.css" });
const BASE = "http://localhost:3000";
await app.request(BASE + "/users?search=LEAKQUERYVALUE", { method: "GET" });
await app.request(BASE + "/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "LEAKBODY@example.com", password: "LEAKPASSWORD" }),
});
await new Promise((r) => setTimeout(r, 150));
`;
		const tmp = join(tmpdir(), `secret-log-${Date.now()}.ts`);
		writeFileSync(tmp, script);
		try {
			const result = spawnSync(
				process.execPath,
				["-e", `await import(process.argv[1])`, tmp].filter(Boolean),
				{ encoding: "utf8", timeout: 30000, cwd: process.cwd() },
			);
			const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
			expectBodyNotToContain(output, [
				"LEAKQUERYVALUE",
				"LEAKBODY@example.com",
				"LEAKPASSWORD",
			]);
		} finally {
			const { rmSync } = await import("node:fs");
			rmSync(tmp, { force: true });
		}
	});
});
