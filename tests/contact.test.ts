/**
 * Contact inbox (PRD Modul 9) — admin list, detail (mark read), status change,
 * email reply, and bulk actions. Boots the full app against an in-memory
 * database. Run with: bun test --isolate
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
): Promise<Response> {
	return app.request(`${BASE}${path}`, {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function lastMessageId(email: string): Promise<number> {
	const { listContactMessages } = await import("../src/server/db");
	const row = listContactMessages
		.all("", "", 50, 0)
		.find((m) => m.email === email);
	if (!row) throw new Error(`contact message for ${email} not found`);
	return row.id;
}

describe("contact inbox", () => {
	it("renders the inbox for admins", async () => {
		const cookie = await adminCookie();
		const res = await call("/contact/inbox", { headers: { cookie, ...xhr } });
		expect(res.status).toBe(200);
		const payload = (await res.json()) as { component: string };
		expect(payload.component).toBe("ContactInbox");
	});

	it("redirects non-admins away from the inbox", async () => {
		const res = await call("/contact/inbox", { headers: xhr });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("lists a submitted message and marks it read on open", async () => {
		await call("/contact", {
			method: "POST",
			headers: xhr,
			body: { name: "Budi", email: "budi@test.com", message: "Halo admin" },
		});
		const { listContactMessages } = await import("../src/server/db");
		const msg = listContactMessages
			.all("", "", 50, 0)
			.find((m) => m.email === "budi@test.com");
		expect(msg).toBeTruthy();
		expect(msg!.status).toBe("unread");

		const cookie = await adminCookie();
		const detailRes = await call(`/contact/inbox/${msg!.id}`, {
			headers: { cookie },
		});
		expect(detailRes.status).toBe(200);
		const updated = listContactMessages
			.all("", "", 50, 0)
			.find((m) => m.id === msg!.id);
		expect(updated!.status).toBe("read");
	});

	it("changes a message status", async () => {
		const { insertContactMessage, findContactMessageById } = await import(
			"../src/server/db"
		);
		insertContactMessage.run("Siti", "siti@test.com", null, "Hai");
		const id = await lastMessageId("siti@test.com");
		const cookie = await adminCookie();
		const res = await post(
			`/contact/inbox/${id}/status`,
			{ status: "archived" },
			cookie,
		);
		expect(res.status).toBe(200);
		expect(findContactMessageById.get(id)!.status).toBe("archived");
	});

	it("replies by email (log driver) and marks replied", async () => {
		const { insertContactMessage, findContactMessageById } = await import(
			"../src/server/db"
		);
		insertContactMessage.run("Joko", "joko@test.com", null, "Test");
		const id = await lastMessageId("joko@test.com");
		const cookie = await adminCookie();
		const res = await post(
			`/contact/inbox/${id}/reply`,
			{ message: "Thanks!" },
			cookie,
		);
		expect(res.status).toBe(200);
		const { sentMails } = await import("../src/server/mailer");
		expect(
			sentMails.some(
				(m) => m.to === "joko@test.com" && m.text.includes("Thanks!"),
			),
		).toBe(true);
		expect(findContactMessageById.get(id)!.status).toBe("replied");
	});

	it("rejects an invalid status with 422", async () => {
		const { insertContactMessage } = await import("../src/server/db");
		insertContactMessage.run("Rina", "rina@test.com", null, "Hi");
		const id = await lastMessageId("rina@test.com");
		const cookie = await adminCookie();
		const res = await post(
			`/contact/inbox/${id}/status`,
			{ status: "nope" },
			cookie,
		);
		expect(res.status).toBe(422);
	});

	it("bulk archives selected messages", async () => {
		const {
			insertContactMessage,
			findContactMessageById,
			listContactMessages,
		} = await import("../src/server/db");
		insertContactMessage.run("A", "a@test.com", null, "x");
		insertContactMessage.run("B", "b@test.com", null, "y");
		const ids = listContactMessages
			.all("", "", 50, 0)
			.filter((m) => ["a@test.com", "b@test.com"].includes(m.email))
			.map((m) => m.id);
		const cookie = await adminCookie();
		const res = await post(
			"/contact/inbox/bulk",
			{ ids, action: "archive" },
			cookie,
		);
		expect(res.status).toBe(200);
		for (const id of ids)
			expect(findContactMessageById.get(id)!.status).toBe("archived");
	});
});
