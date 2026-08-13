/**
 * WhatsApp Management (PRD Modul 12) — admin config + template CRUD, preview,
 * test send, and the Dripsender inbound webhook. Boots the full app against an
 * in-memory database and drives it via app.request(). Run with: bun test --isolate
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let counter = 0;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";
const xhr = { "x-inertia": "true" };

async function call(
	path: string,
	options: {
		method?: string;
		headers?: Record<string, string>;
		body?: Record<string, unknown>;
	} = {},
): Promise<Response> {
	const headers = new Headers(options.headers);
	let body: string | undefined;
	if (options.body) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(options.body);
	}
	return app.request(`${BASE}${path}`, {
		method: options.method ?? "GET",
		headers,
		body,
	});
}

function sessionCookie(res: Response): string {
	const h = res.headers as Headers & { getSetCookie?: () => string[] };
	const cookies =
		typeof h.getSetCookie === "function"
			? h.getSetCookie()
			: [res.headers.get("set-cookie") ?? ""];
	const c = cookies.find((x) => x.startsWith("session="));
	return c ? c.split(";")[0]! : "";
}

/** Register a user, promote to admin, return a session cookie. */
async function adminCookie(): Promise<string> {
	counter += 1;
	const email = `admin${counter}@test.com`;
	await call("/register", {
		method: "POST",
		headers: xhr,
		body: { name: "Admin", email, password: "password123" },
	});
	const { db } = await import("../src/server/db");
	db.run("UPDATE users SET role = ? WHERE email = ?", ["admin", email]);
	const res = await call("/login", {
		method: "POST",
		headers: xhr,
		body: { email, password: "password123" },
	});
	return sessionCookie(res);
}

async function post(
	path: string,
	body: Record<string, unknown>,
	cookie: string,
	headers: Record<string, string> = {},
): Promise<Response> {
	return app.request(`${BASE}${path}`, {
		method: "POST",
		headers: { cookie, "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

describe("whatsapp management", () => {
	it("renders the WhatsApp page for admins", async () => {
		const cookie = await adminCookie();
		const res = await call("/whatsapp", { headers: { cookie, ...xhr } });
		expect(res.status).toBe(200);
		const payload = (await res.json()) as { component: string };
		expect(payload.component).toBe("WhatsApp");
	});

	it("redirects non-admins away from /whatsapp", async () => {
		const res = await call("/whatsapp", { headers: xhr });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("creates a template and stores it", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/whatsapp/templates",
			{
				name: "Welcome",
				slug: "welcome",
				body: "Hi {{ name }}!",
				placeholders: "name",
			},
			cookie,
			xhr,
		);
		expect(res.status).toBe(303);
		const { listWhatsAppTemplates } = await import("../src/server/db");
		const list = listWhatsAppTemplates.all();
		expect(list.length).toBeGreaterThanOrEqual(1);
		expect(list.some((t) => t.slug === "welcome")).toBe(true);
	});

	it("rejects an invalid template with field errors (422)", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/whatsapp/templates",
			{ name: "x", slug: "BAD SLUG", body: "" },
			cookie,
			xhr,
		);
		expect(res.status).toBe(422);
		const payload = (await res.json()) as {
			props: { errors: Record<string, string> };
		};
		expect(payload.props.errors.slug).toBeTruthy();
	});

	it("renders a preview with sample placeholder data", async () => {
		const cookie = await adminCookie();
		await post(
			"/whatsapp/templates",
			{
				name: "Welcome",
				slug: `welcome-${counter}`,
				body: "Hi {{ name }}!",
				placeholders: "name",
			},
			cookie,
			xhr,
		);
		const { findWhatsAppTemplateBySlug } = await import("../src/server/db");
		const tpl = findWhatsAppTemplateBySlug.get(`welcome-${counter}`)!;
		const res = await call(`/whatsapp/templates/${tpl.id}/preview`, {
			headers: { cookie, ...xhr },
		});
		expect(res.status).toBe(200);
		const data = (await res.json()) as { body: string };
		expect(data.body).toContain("Jane Doe");
	});

	it("sends a provider test message via the log driver", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/whatsapp/test",
			{ phone: "6281399999999", text: "Hi" },
			cookie,
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
		const { sentWhatsapp } = await import("../src/server/whatsapp");
		expect(sentWhatsapp.some((m) => m.phone === "6281399999999")).toBe(true);
	});

	it("saves provider configuration and preserves an unchanged api key", async () => {
		const { getSetting, setSetting } = await import("../src/server/settings");
		const cookie = await adminCookie();
		setSetting("whatsapp.api_key", "supersecret");
		const res = await post(
			"/whatsapp/config",
			{ provider: "dripsender", api_key: "" },
			cookie,
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
		expect(getSetting("whatsapp.provider")).toBe("dripsender");
		// An empty key submit keeps the previously stored secret.
		expect(getSetting("whatsapp.api_key")).toBe("supersecret");
	});

	it("rejects an invalid provider with 422", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/whatsapp/config",
			{ provider: "pigeon", api_key: "" },
			cookie,
		);
		expect(res.status).toBe(422);
	});

	it("receives an inbound webhook message", async () => {
		const res = await post(
			"/whatsapp/webhook",
			{
				phone: "6281351941000",
				id: "3EB02155115CDB6024CF",
				jid: "6281351941000@s.whatsapp.net",
				text: "Sample Text",
				name: "Abdullah",
				timestamp: 1650957541,
			},
			"",
		);
		expect(res.status).toBe(200);
		const { listWhatsAppMessages } = await import("../src/server/db");
		const rows = listWhatsAppMessages.all(5);
		expect(rows.some((m) => m.phone === "6281351941000")).toBe(true);
	});

	it("saves the integration webhook URL", async () => {
		const { getSetting } = await import("../src/server/settings");
		const cookie = await adminCookie();
		const res = await post(
			"/whatsapp/config",
			{
				provider: "log",
				api_key: "",
				integration_url: "https://ali.dripsender.id:14942/api/integration/abc",
			},
			cookie,
		);
		expect(res.status).toBe(200);
		expect(getSetting("whatsapp.integration_url")).toBe(
			"https://ali.dripsender.id:14942/api/integration/abc",
		);
	});

	it("rejects a non-http integration URL with 422", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/whatsapp/config",
			{ provider: "log", api_key: "", integration_url: "ftp://nope" },
			cookie,
		);
		expect(res.status).toBe(422);
	});

	it("pushes a registered contact to the integration (log driver)", async () => {
		// Ensure log mode: no integration URL configured so pushLead records
		// locally instead of hitting the real Dripsender endpoint (settings
		// persist across tests in this file).
		const { setSetting } = await import("../src/server/settings");
		setSetting("whatsapp.integration_url", "");
		await call("/register", {
			method: "POST",
			headers: xhr,
			body: {
				name: "Lead User",
				email: "lead@test.com",
				password: "password123",
				whatsapp: "081351999888",
			},
		});
		const { pushedLeads } = await import("../src/server/whatsapp");
		expect(
			pushedLeads.some(
				(l) => l.phone === "081351999888" && l.name === "Lead User",
			),
		).toBe(true);
	});

	it("sends an on_register template to the new customer's phone", async () => {
		const { setSetting } = await import("../src/server/settings");
		const { insertWhatsAppTemplate } = await import("../src/server/db");
		const { sentWhatsapp } = await import("../src/server/whatsapp");
		setSetting("whatsapp.provider", "log");
		sentWhatsapp.length = 0;
		insertWhatsAppTemplate.run(
			"Welcome",
			"welcome-trigger",
			"Hi {{name}}, welcome!",
			"",
			"name",
			"on_register",
			"customer",
			1,
			0,
		);
		const res = await call("/register", {
			method: "POST",
			headers: xhr,
			body: {
				name: "Budi",
				email: "budi-trigger@test.com",
				password: "password123",
				whatsapp: "6281399999999",
			},
		});
		expect(res.status).toBe(303);
		expect(
			sentWhatsapp.some(
				(m) => m.phone === "6281399999999" && m.text.includes("Budi"),
			),
		).toBe(true);
	});

	it("sends an on_contact template to the admin number (customer-bound skipped)", async () => {
		const { setSetting } = await import("../src/server/settings");
		const { insertWhatsAppTemplate } = await import("../src/server/db");
		const { sentWhatsapp } = await import("../src/server/whatsapp");
		setSetting("whatsapp.provider", "log");
		setSetting("whatsapp.admin_notify_number", "6281200000000");
		sentWhatsapp.length = 0;
		insertWhatsAppTemplate.run(
			"New lead",
			"lead-trigger",
			"New contact {{name}}",
			"",
			"name",
			"on_contact",
			"admin",
			1,
			0,
		);
		insertWhatsAppTemplate.run(
			"Auto reply",
			"auto-trigger",
			"Thanks {{name}}",
			"",
			"name",
			"on_contact",
			"customer",
			1,
			0,
		);
		const res = await call("/contact", {
			method: "POST",
			headers: xhr,
			body: {
				name: "Siti",
				email: "siti-trigger@test.com",
				message: "Hello there, I need help",
			},
		});
		expect(res.status).toBe(303);
		expect(
			sentWhatsapp.some(
				(m) => m.phone === "6281200000000" && m.text.includes("Siti"),
			),
		).toBe(true);
		// No phone on the contact form → customer-bound template is skipped.
		expect(sentWhatsapp.some((m) => m.text.includes("Thanks Siti"))).toBe(
			false,
		);
	});

	it("does not auto-send a manual template on register", async () => {
		const { setSetting } = await import("../src/server/settings");
		const { insertWhatsAppTemplate, db } = await import("../src/server/db");
		const { sentWhatsapp } = await import("../src/server/whatsapp");
		setSetting("whatsapp.provider", "log");
		// Isolate: clear templates so only the manual one exists.
		db.run("DELETE FROM whatsapp_templates");
		sentWhatsapp.length = 0;
		insertWhatsAppTemplate.run(
			"Manual only",
			"manual-trigger1",
			"Manual {{name}}",
			"",
			"name",
			"manual",
			"customer",
			1,
			0,
		);
		const res = await call("/register", {
			method: "POST",
			headers: xhr,
			body: {
				name: "Tono",
				email: "tono-trigger@test.com",
				password: "password123",
				whatsapp: "6281398888888",
			},
		});
		expect(res.status).toBe(303);
		expect(sentWhatsapp.length).toBe(0);
	});
});
