/**
 * Email Management (PRD Modul 11) — admin config + template CRUD, preview, test.
 * Boots the full app against an in-memory database and drives it via app.request().
 * Run with: bun test --isolate
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

describe("email management", () => {
	it("renders the Email page for admins", async () => {
		const cookie = await adminCookie();
		const res = await call("/email", { headers: { cookie, ...xhr } });
		expect(res.status).toBe(200);
		const payload = (await res.json()) as { component: string };
		expect(payload.component).toBe("Email");
	});

	it("redirects non-admins away from /email", async () => {
		const res = await call("/email", { headers: xhr });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("creates a template and stores it", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/email/templates",
			{
				name: "Welcome",
				slug: "welcome",
				subject: "Hi {{ name }}",
				body: "Welcome, {{ name }}!",
				placeholders: "name",
			},
			cookie,
			xhr,
		);
		expect(res.status).toBe(303);
		const { listEmailTemplates } = await import("../src/server/db");
		const list = listEmailTemplates.all();
		expect(list.length).toBeGreaterThanOrEqual(1);
		expect(list.some((t) => t.slug === "welcome")).toBe(true);
	});

	it("rejects an invalid template with field errors (422)", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/email/templates",
			{ name: "x", slug: "BAD SLUG", subject: "", body: "" },
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
			"/email/templates",
			{
				name: "Welcome",
				slug: `welcome-${counter}`,
				subject: "Hi {{ name }}",
				body: "Welcome, {{ name }}!",
				placeholders: "name",
			},
			cookie,
			xhr,
		);
		const { findEmailTemplateBySlug } = await import("../src/server/db");
		const tpl = findEmailTemplateBySlug.get(`welcome-${counter}`)!;
		const res = await call(`/email/templates/${tpl.id}/preview`, {
			headers: { cookie, ...xhr },
		});
		expect(res.status).toBe(200);
		const data = (await res.json()) as { subject: string; body: string };
		expect(data.subject).toContain("Jane Doe");
		expect(data.body).toContain("Jane Doe");
	});

	it("sends a provider test email via the log driver", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/email/test",
			{ to: "probe@example.com", subject: "Hi", body: "Test" },
			cookie,
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
	});

	it("saves SMTP configuration and preserves an unchanged password", async () => {
		const { getSetting, setSetting } = await import("../src/server/settings");
		const cookie = await adminCookie();
		setSetting("mail.smtp_pass", "supersecret");
		const res = await post(
			"/email/config",
			{
				driver: "smtp",
				from: "no-reply@example.com",
				smtp_host: "smtp.example.com",
				smtp_port: "465",
				smtp_user: "user",
				smtp_pass: "",
				smtp_secure: "true",
			},
			cookie,
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
		expect(getSetting("mail.driver")).toBe("smtp");
		expect(getSetting("mail.smtp_host")).toBe("smtp.example.com");
		expect(getSetting("mail.smtp_port")).toBe("465");
		expect(getSetting("mail.smtp_secure")).toBe("true");
		// An empty password submit keeps the previously stored secret.
		expect(getSetting("mail.smtp_pass")).toBe("supersecret");
	});

	it("rejects an invalid mail driver with 422", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/email/config",
			{
				driver: "carrier-pigeon",
				from: "",
				smtp_host: "",
				smtp_port: "",
				smtp_user: "",
				smtp_pass: "",
				smtp_secure: "false",
			},
			cookie,
		);
		expect(res.status).toBe(422);
	});

	it("creates a template with trigger fields and stores them", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/email/templates",
			{
				name: "Welcome",
				slug: "welcome-trig",
				subject: "Hi {{ name }}",
				body: "Welcome, {{ name }}!",
				placeholders: "name",
				trigger: "manual",
				recipient: "customer",
				enabled: true,
			},
			cookie,
			xhr,
		);
		expect(res.status).toBe(303);
		const { findEmailTemplateBySlug } = await import("../src/server/db");
		const tpl = findEmailTemplateBySlug.get("welcome-trig")!;
		expect(tpl).toBeTruthy();
		expect(tpl.trigger).toBe("manual");
		expect(tpl.recipient).toBe("customer");
		expect(tpl.enabled).toBe(1);
	});

	it("saves the admin notification address via config", async () => {
		const { getSetting } = await import("../src/server/settings");
		const cookie = await adminCookie();
		const res = await post(
			"/email/config",
			{
				driver: "log",
				from: "no-reply@example.com",
				smtp_host: "",
				smtp_port: "",
				smtp_user: "",
				smtp_pass: "",
				smtp_secure: "false",
				admin_notify_address: "admin@example.com",
			},
			cookie,
		);
		expect(res.status).toBe(200);
		expect(getSetting("email.admin_notify_address")).toBe("admin@example.com");
	});

	it("rejects an invalid admin notification address with 422", async () => {
		const cookie = await adminCookie();
		const res = await post(
			"/email/config",
			{
				driver: "log",
				from: "no-reply@example.com",
				smtp_host: "",
				smtp_port: "",
				smtp_user: "",
				smtp_pass: "",
				smtp_secure: "false",
				admin_notify_address: "not-an-email",
			},
			cookie,
		);
		expect(res.status).toBe(422);
	});

	it("sends an on_register template to the new customer's email", async () => {
		const { setSetting } = await import("../src/server/settings");
		const { insertEmailTemplate } = await import("../src/server/db");
		const { sentMails } = await import("../src/server/mailer");
		setSetting("mail.driver", "log");
		sentMails.length = 0;
		insertEmailTemplate.run(
			"Welcome",
			"welcome-email-trigger",
			"Welcome {{name}}",
			"Hi {{name}}, thanks for signing up!",
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
				email: "budi-email-trigger@test.com",
				password: "password123",
			},
		});
		expect(res.status).toBe(303);
		expect(
			sentMails.some(
				(m) =>
					m.to === "budi-email-trigger@test.com" && m.text.includes("Budi"),
			),
		).toBe(true);
	});

	it("sends on_contact templates to both the admin address and the customer", async () => {
		const { setSetting } = await import("../src/server/settings");
		const { insertEmailTemplate } = await import("../src/server/db");
		const { sentMails } = await import("../src/server/mailer");
		setSetting("mail.driver", "log");
		setSetting("email.admin_notify_address", "admin@example.com");
		sentMails.length = 0;
		insertEmailTemplate.run(
			"Admin alert",
			"lead-email-trigger",
			"New contact",
			"New contact from {{name}}",
			"name",
			"on_contact",
			"admin",
			1,
			0,
		);
		insertEmailTemplate.run(
			"Auto reply",
			"auto-email-trigger",
			"Thanks {{name}}",
			"Thanks for reaching out, {{name}}!",
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
				email: "siti-email-trigger@test.com",
				message: "Hello there, I need help",
			},
		});
		expect(res.status).toBe(303);
		// Admin-bound template → configured address.
		expect(
			sentMails.some(
				(m) => m.to === "admin@example.com" && m.text.includes("Siti"),
			),
		).toBe(true);
		// Customer-bound template → the visitor's own email.
		expect(
			sentMails.some(
				(m) =>
					m.to === "siti-email-trigger@test.com" && m.text.includes("Siti"),
			),
		).toBe(true);
	});

	it("does not auto-send a manual template on register", async () => {
		const { setSetting } = await import("../src/server/settings");
		const { insertEmailTemplate, db } = await import("../src/server/db");
		const { sentMails } = await import("../src/server/mailer");
		setSetting("mail.driver", "log");
		// Isolate: clear templates so only the manual one exists.
		db.run("DELETE FROM email_templates");
		sentMails.length = 0;
		insertEmailTemplate.run(
			"Manual only",
			"manual-email-trigger1",
			"Manual",
			"Manual {{name}}",
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
				email: "tono-email-trigger@test.com",
				password: "password123",
			},
		});
		expect(res.status).toBe(303);
		expect(sentMails.length).toBe(0);
	});
});
