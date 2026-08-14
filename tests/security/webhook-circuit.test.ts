import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { call, type TestApp } from "./helpers";

let app: TestApp;
const secret = "webhook-circuit-secret";
const realFetch = globalThis.fetch;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	process.env.WHATSAPP_WEBHOOK_SECRET = secret;
	const { createApp } = await import("../../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
	globalThis.fetch = (async (): Promise<Response> =>
		new Response("provider unavailable", {
			status: 503,
		})) as unknown as typeof fetch;
});

afterAll(async () => {
	globalThis.fetch = realFetch;
	const { db } = await import("../../src/server/db");
	db.close();
});

function payload(id: string) {
	return {
		id,
		phone: "6281200000000",
		text: "circuit test",
		timestamp: Math.floor(Date.now() / 1000),
	};
}

describe("WhatsApp auto-reply circuit breaker", () => {
it("treats redirect responses as provider failures", async () => {
const { __resetAutoReplyState } = await import(
"../../src/server/routes/whatsapp.routes"
);
__resetAutoReplyState();
const { setSetting } = await import("../../src/server/settings");
const { insertWhatsAppTemplate } = await import("../../src/server/db");
setSetting("whatsapp.provider", "dripsender");
setSetting("whatsapp.api_key", "provider-key");
setSetting("whatsapp.auto_reply", "true");
setSetting("whatsapp.auto_reply_slug", "redirect-test");
insertWhatsAppTemplate.run(
"Redirect Test",
"redirect-test",
"Reply",
"",
"",
"manual",
"customer",
1,
0,
);
globalThis.fetch = (async () =>
new Response(null, { status: 302, headers: { location: "https://evil.example" } })) as unknown as typeof fetch;

const response = await call(app, "/whatsapp/webhook", {
method: "POST",
headers: { "x-webhook-secret": secret },
body: payload("redirect-event"),
});
expect(await response.json()).toEqual({
ok: true,
reply: false,
suppressed: "provider",
});
globalThis.fetch = (async (): Promise<Response> =>
new Response("provider unavailable", {
status: 503,
})) as unknown as typeof fetch;
});

it("opens after repeated provider failures", async () => {
const { __resetAutoReplyState } = await import(
"../../src/server/routes/whatsapp.routes"
);
__resetAutoReplyState();
		const { setSetting } = await import("../../src/server/settings");
		const { insertWhatsAppTemplate } = await import("../../src/server/db");
		setSetting("whatsapp.provider", "dripsender");
		setSetting("whatsapp.api_key", "provider-key");
		setSetting("whatsapp.auto_reply", "true");
		setSetting("whatsapp.auto_reply_slug", "circuit-test");
		insertWhatsAppTemplate.run(
			"Circuit Test",
			"circuit-test",
			"Reply",
			"",
			"",
			"manual",
			"customer",
			1,
			0,
		);

		for (let i = 0; i < 3; i += 1) {
			const response = await call(app, "/whatsapp/webhook", {
				method: "POST",
				headers: { "x-webhook-secret": secret },
				body: payload(`circuit-provider-${i}`),
			});
			expect(await response.json()).toEqual({
				ok: true,
				reply: false,
				suppressed: "provider",
			});
		}

		const opened = await call(app, "/whatsapp/webhook", {
			method: "POST",
			headers: { "x-webhook-secret": secret },
			body: payload("circuit-open"),
		});
		expect(await opened.json()).toEqual({
			ok: true,
			reply: false,
			suppressed: "circuit",
		});
	});
});
