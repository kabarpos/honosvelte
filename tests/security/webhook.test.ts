import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { call, type TestApp } from "./helpers";

let app: TestApp;
const secret = "security-webhook-secret";

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	process.env.WHATSAPP_WEBHOOK_SECRET = secret;
	const { createApp } = await import("../../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../../src/server/db");
	db.close();
});

function event(id: string, timestamp = Math.floor(Date.now() / 1000)) {
	return {
		id,
		phone: "6281200000000",
		jid: "6281200000000@s.whatsapp.net",
		name: "Webhook Test",
		text: "Hello",
		timestamp,
	};
}

describe("WhatsApp webhook security", () => {
	it("rejects requests without the configured secret", async () => {
		const response = await call(app, "/whatsapp/webhook", {
			method: "POST",
			body: event("missing-secret"),
		});
		expect(response.status).toBe(401);
	});

	it("rejects invalid payloads before persistence", async () => {
		const response = await call(app, "/whatsapp/webhook", {
			method: "POST",
			headers: { "x-webhook-secret": secret },
			body: { phone: "6281200000000", text: "missing id and timestamp" },
		});
		expect(response.status).toBe(422);
	});

	it("rejects replayed timestamps", async () => {
		const response = await call(app, "/whatsapp/webhook", {
			method: "POST",
			headers: { "x-webhook-secret": secret },
			body: event("old-event", Math.floor(Date.now() / 1000) - 601),
		});
		expect(response.status).toBe(401);
	});

	it("ignores duplicate external message IDs", async () => {
		const payload = event("duplicate-event");
		const first = await call(app, "/whatsapp/webhook", {
			method: "POST",
			headers: { "x-webhook-secret": secret },
			body: payload,
		});
		const duplicate = await call(app, "/whatsapp/webhook", {
			method: "POST",
			headers: { "x-webhook-secret": secret },
			body: payload,
		});
		expect(first.status).toBe(200);
		expect(duplicate.status).toBe(200);
		expect(await duplicate.json()).toEqual({ ok: true, duplicate: true });
	});

	it("suppresses auto-replies after the per-phone quota", async () => {
		const { setSetting } = await import("../../src/server/settings");
		const { insertWhatsAppTemplate } = await import("../../src/server/db");
		setSetting("whatsapp.provider", "log");
		setSetting("whatsapp.auto_reply", "true");
		setSetting("whatsapp.auto_reply_slug", "quota-test");
		insertWhatsAppTemplate.run(
			"Quota Test",
			"quota-test",
			"Reply",
			"",
			"",
			"manual",
			"customer",
			1,
			0,
		);
		const responses: Array<Record<string, unknown>> = [];
		for (let i = 0; i < 6; i += 1) {
			const response = await call(app, "/whatsapp/webhook", {
				method: "POST",
				headers: { "x-webhook-secret": secret },
				body: event(`quota-event-${i}`),
			});
			expect(response.status).toBe(200);
			responses.push((await response.json()) as Record<string, unknown>);
		}
		expect(responses.slice(0, 5).every((item) => item.reply === true)).toBe(
			true,
		);
		expect(responses[5]).toEqual({
			ok: true,
			reply: false,
			suppressed: "quota",
		});
	});

	it("rejects an oversized body before JSON processing completes", async () => {
		const raw = await app.request("http://localhost:3000/whatsapp/webhook", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-webhook-secret": secret,
			},
			body: JSON.stringify({
				...event("oversized-event"),
				text: "x".repeat(70_000),
			}),
		});
		expect(raw.status).toBe(413);
	});
});
