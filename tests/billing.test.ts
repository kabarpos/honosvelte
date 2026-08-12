import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof createApp>>;

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
	options: { method?: string; headers?: Record<string, string>; body?: Record<string, unknown>; cookie?: string } = {},
): Promise<Response> {
	const headers = new Headers(options.headers);
	if (options.cookie) headers.set("cookie", options.cookie);
	let body: string | undefined;
	if (options.body) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(options.body);
	}
	return app.request(`${BASE}${path}`, { method: options.method ?? "GET", headers, body });
}

function allSetCookies(res: Response): string[] {
	const headers = res.headers as Headers & { getSetCookie?: () => string[] };
	return typeof headers.getSetCookie === "function"
		? headers.getSetCookie()
		: [res.headers.get("set-cookie") ?? ""].filter(Boolean);
}

function sessionCookie(res: Response): string {
	const cookie = allSetCookies(res).find((c) => c.startsWith("session="));
	return cookie ? cookie.split(";")[0]! : "";
}

async function loginAs(email: string, password = "password123"): Promise<string> {
	const res = await call("/login", { method: "POST", headers: xhr, body: { email, password } });
	expect(res.status).toBe(303);
	return sessionCookie(res);
}

async function seedUser(
	name: string,
	email: string,
	role: "user" | "admin" | "super_admin",
): Promise<number> {
	const { createUserWithRole } = await import("../src/server/db");
	const { hashPassword } = await import("../src/server/auth");
	const hash = await hashPassword("password123");
	return createUserWithRole.get(name, email, hash, role).id;
}

describe("Modul 17 — Billing", () => {
	it("redirects guests to login", async () => {
		const res = await call("/billing");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/login");
	});

	it("renders billing page with plan and payment history for a regular user", async () => {
		const uid = await seedUser("Billing Client", "billing-client@test.com", "user");
		const cookie = await loginAs("billing-client@test.com");
		const res = await call("/billing", { headers: xhr, cookie });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.component).toBe("Billing");
		expect(data.props.plan.name).toBe("Starter");
		expect(data.props.plan.limits.length).toBeGreaterThan(0);
		expect(data.props.payments.length).toBe(2);
		expect(data.props.payments[0].status).toBe("paid");
		expect(uid).toBeGreaterThan(0);
	});

	it("is visible to admins as well", async () => {
		await seedUser("Billing Admin", "billing-admin@test.com", "admin");
		const cookie = await loginAs("billing-admin@test.com");
		const res = await call("/billing", { headers: xhr, cookie });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.component).toBe("Billing");
	});
});