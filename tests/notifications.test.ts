/**
 * Notification Center (PRD Modul 16) — admin list, unread count, mark-read and
 * mark-all-read, plus the producer (a new contact message fans out to admins).
 * Boots the full app against an in-memory database. Run with: bun test --isolate
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

describe("notification center", () => {
	it("renders the center for admins", async () => {
		const cookie = await adminCookie();
		const res = await call("/notifications", { headers: { cookie, ...xhr } });
		expect(res.status).toBe(200);
		const payload = (await res.json()) as { component: string };
		expect(payload.component).toBe("NotificationCenter");
	});

	it("redirects non-admins away from /notifications", async () => {
		const res = await call("/notifications", { headers: xhr });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("shows an unread notification after a contact message is received", async () => {
		const cookie = await adminCookie();
		// A visitor submits the contact form — fans out to admins.
		await call("/contact", {
			method: "POST",
			headers: xhr,
			body: { name: "Budi", email: "budi@test.com", message: "Halo admin" },
		});
		const res = await call("/notifications", { headers: { cookie, ...xhr } });
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			props: {
				notifications: { data: { id: number; read: boolean }[] };
				unread: number;
			};
		};
		expect(payload.props.unread).toBeGreaterThanOrEqual(1);
		expect(payload.props.notifications.data.some((n) => !n.read)).toBe(true);
	});

	it("marks a notification read", async () => {
		const cookie = await adminCookie();
		await call("/contact", {
			method: "POST",
			headers: xhr,
			body: { name: "Siti", email: "siti@test.com", message: "Hello Siti" },
		});
		const list = await call("/notifications", { headers: { cookie, ...xhr } });
		const payload = (await list.json()) as {
			props: { notifications: { data: { id: number; read: boolean }[] } };
		};
		const target = payload.props.notifications.data.find((n) => !n.read);
		expect(target).toBeTruthy();
		const res = await post(`/notifications/${target!.id}/read`, {}, cookie);
		expect(res.status).toBe(200);
		const after = await call("/notifications", { headers: { cookie, ...xhr } });
		const afterPayload = (await after.json()) as {
			props: {
				unread: number;
				notifications: { data: { id: number; read: boolean }[] };
			};
		};
		const marked = afterPayload.props.notifications.data.find(
			(n) => n.id === target!.id,
		);
		expect(marked?.read).toBe(true);
		expect(afterPayload.props.unread).toBe(0);
	});

	it("marks all notifications read", async () => {
		const cookie = await adminCookie();
		await call("/contact", {
			method: "POST",
			headers: xhr,
			body: { name: "Joko", email: "joko@test.com", message: "Hello Joko" },
		});
		const res = await post("/notifications/read-all", {}, cookie);
		expect(res.status).toBe(200);
		const after = await call("/notifications", { headers: { cookie, ...xhr } });
		const payload = (await after.json()) as { props: { unread: number } };
		expect(payload.props.unread).toBe(0);
	});
});
