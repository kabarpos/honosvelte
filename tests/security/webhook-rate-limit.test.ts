import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { call, type TestApp } from "./helpers";

let app: TestApp;
const secret = "webhook-rate-limit-secret";

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	process.env.RATE_LIMIT_WEBHOOK_MAX = "2";
	process.env.RATE_LIMIT_WEBHOOK_WINDOW = "60";
	process.env.WHATSAPP_WEBHOOK_SECRET = secret;
	const { createApp } = await import("../../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../../src/server/db");
	db.close();
});

function payload(id: string) {
	return {
		id,
		phone: "6281200000000",
		text: "rate-limit test",
		timestamp: Math.floor(Date.now() / 1000),
	};
}

describe("WhatsApp webhook rate limit", () => {
	it("returns 429 after the configured request threshold", async () => {
		for (let i = 0; i < 2; i += 1) {
			const response = await call(app, "/whatsapp/webhook", {
				method: "POST",
				headers: { "x-webhook-secret": secret },
				body: payload(`rate-limit-${i}`),
			});
			expect(response.status).toBe(200);
		}
		const blocked = await call(app, "/whatsapp/webhook", {
			method: "POST",
			headers: { "x-webhook-secret": secret },
			body: payload("rate-limit-blocked"),
		});
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("retry-after")).toBeTruthy();
	});
});
