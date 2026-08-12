/**
 * End-to-end test suite for the activity log (Modul 13): recording on auth
 * and admin actions, list/filter/search, the detail endpoint, and the
 * admin-only guard. Run with: bun test --isolate.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;

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

interface CallOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	cookie?: string;
}

async function call(
	path: string,
	options: CallOptions = {},
): Promise<Response> {
	const headers = new Headers(options.headers);
	if (options.cookie) headers.set("cookie", options.cookie);
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

const xhr = { "x-inertia": "true" };

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

async function page(res: Response): Promise<any> {
	return res.json();
}

async function registerUser(email: string): Promise<string> {
	const res = await call("/register", {
		method: "POST",
		headers: xhr,
		body: { name: "Test User", email, password: "password123" },
	});
	expect(res.status).toBe(303);
	const cookie = sessionCookie(res);
	expect(cookie).not.toBe("");
	return cookie;
}

async function loginAs(email: string): Promise<string> {
	const res = await call("/login", {
		method: "POST",
		headers: xhr,
		body: { email, password: "password123" },
	});
	expect(res.status).toBe(303);
	return sessionCookie(res);
}

async function seedUser(
	name: string,
	email: string,
	role: "user" | "admin" | "super_admin",
): Promise<void> {
	const { createUserWithRole } = await import("../src/server/db");
	const { hashPassword } = await import("../src/server/auth");
	const hash = await hashPassword("password123");
	createUserWithRole.get(name, email, hash, role);
}

describe("activity log", () => {
	it("records register, login and logout events", async () => {
		const cookie = await registerUser("act@example.com");
		await loginAs("act@example.com");

		await call("/logout", {
			method: "POST",
			headers: { ...xhr, cookie },
		});

		const { listActivity } = await import("../src/server/db");
		const events = listActivity
			.all("", "", "", "", "", "", "", 100, 0)
			.map((r) => r.event);
		expect(events).toContain("register");
		expect(events).toContain("login");
		expect(events).toContain("logout");
	});

	it("records admin CRUD actions", async () => {
		await seedUser("BossAct", "bossact@example.com", "admin");
		const cookie = await loginAs("bossact@example.com");

		await call("/users", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: {
				name: "Act Newcomer",
				email: "actnew@example.com",
				role: "user",
				status: "active",
				password: "password123",
				passwordConfirmation: "password123",
			},
		});

		const { listActivity } = await import("../src/server/db");
		const events = listActivity
			.all("", "", "", "", "", "", "", 100, 0)
			.map((r) => r.event);
		expect(events).toContain("users.create");
		expect(events.some((e) => e === "login")).toBe(true);
	});

	it("lists activity to an admin with pagination and filters", async () => {
		await seedUser("BossView", "bossview@example.com", "admin");
		const cookie = await loginAs("bossview@example.com");

		const res = await call("/activity", { headers: { ...xhr, cookie } });
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Activity");
		expect(data.props.activity.meta.total).toBeGreaterThanOrEqual(1);
		expect(data.props.activity.data[0].userName).toBe("BossView");
		expect(data.props.activity.data[0].event).toBe("login");
		expect(Array.isArray(data.props.events)).toBe(true);
		expect(data.props.events).toContain("login");
	});

	it("filters by event and searches", async () => {
		await seedUser("BossFilter", "bossfilter@example.com", "admin");
		const cookie = await loginAs("bossfilter@example.com");

		const byEvent = await call("/activity?event=login", {
			headers: { ...xhr, cookie },
		});
		const eventData = await page(byEvent);
		expect(eventData.props.event).toBe("login");
		expect(
			eventData.props.activity.data.every(
				(a: any) => a.event === "login",
			),
		).toBe(true);

		const bySearch = await call("/activity?search=BossFilter", {
			headers: { ...xhr, cookie },
		});
		const searchData = await page(bySearch);
		expect(
			searchData.props.activity.data.every(
				(a: any) => a.userName === "BossFilter",
			),
		).toBe(true);
	});

	it("serves the JSON detail endpoint", async () => {
		await seedUser("BossDetail", "bossdetail@example.com", "admin");
		const cookie = await loginAs("bossdetail@example.com");

		const { listActivity } = await import("../src/server/db");
		const row = listActivity.all("", "", "", "", "", "", "", 1, 0)[0]!;

		const res = await call(`/activity/${row.id}`, {
			headers: { ...xhr, cookie },
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.activity.id).toBe(row.id);
		expect(data.activity.event).toBe(row.event);
		expect(data.activity.userName).toBeTruthy();
	});

	it("404s for a missing activity entry", async () => {
		await seedUser("BossMiss", "bossmiss@example.com", "admin");
		const cookie = await loginAs("bossmiss@example.com");

		const res = await call("/activity/999999", {
			headers: { ...xhr, cookie },
		});
		expect(res.status).toBe(404);
	});

	it("blocks guests and plain users", async () => {
		const guest = await call("/activity", { headers: xhr });
		expect(guest.status).toBe(302);
		expect(new URL(guest.headers.get("location")!).pathname).toBe("/login");

		const userCookie = await registerUser("actplain@example.com");
		const denied = await call("/activity", {
			headers: { ...xhr, cookie: userCookie },
		});
		expect(denied.status).toBe(302);
		expect(new URL(denied.headers.get("location")!).pathname).toBe(
			"/dashboard",
		);
	});
});
