import { expect } from "bun:test";

export const BASE_URL = "http://localhost:3000";
export const INERTIA_HEADERS = { "x-inertia": "true" };

export interface TestApp {
	request(
		input: RequestInfo | URL,
		init?: RequestInit,
	): Response | Promise<Response>;
}

export interface CallOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	cookie?: string;
}

export async function call(
	app: TestApp,
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
	return app.request(`${BASE_URL}${path}`, {
		method: options.method ?? "GET",
		headers,
		body,
	});
}

export function allSetCookies(response: Response): string[] {
	const headers = response.headers as Headers & {
		getSetCookie?: () => string[];
	};
	return typeof headers.getSetCookie === "function"
		? headers.getSetCookie()
		: [response.headers.get("set-cookie") ?? ""].filter(Boolean);
}

export function sessionCookie(response: Response): string {
	const cookie = allSetCookies(response).find((value) =>
		value.startsWith("session="),
	);
	return cookie ? (cookie.split(";")[0] ?? "") : "";
}

export async function registerUser(
	app: TestApp,
	email: string,
	password = "password123",
): Promise<string> {
	const response = await call(app, "/register", {
		method: "POST",
		headers: INERTIA_HEADERS,
		body: { name: "Security Test User", email, password },
	});
	expect(response.status).toBe(303);
	const cookie = sessionCookie(response);
	expect(cookie).not.toBe("");
	return cookie;
}

export async function loginAs(
	app: TestApp,
	email: string,
	password = "password123",
): Promise<string> {
	const response = await call(app, "/login", {
		method: "POST",
		headers: INERTIA_HEADERS,
		body: { email, password },
	});
	expect(response.status).toBe(303);
	const cookie = sessionCookie(response);
	expect(cookie).not.toBe("");
	return cookie;
}

export async function seedUser(
	name: string,
	email: string,
	role: "user" | "admin" | "super_admin" = "user",
	status: "active" | "inactive" = "active",
): Promise<number> {
	const { createUserFull } = await import("../../src/server/db");
	const { hashPassword } = await import("../../src/server/auth");
	const hash = await hashPassword("password123");
	const row = createUserFull.get(name, email, hash, null, role, status);
	if (!row) throw new Error(`Could not seed user: ${email}`);
	return row.id;
}

export async function grantPermission(
	userId: number,
	slug: string,
	granted = true,
): Promise<void> {
	const { findPermissionBySlug, setUserPermission } = await import(
		"../../src/server/db"
	);
	const permission = findPermissionBySlug.get(slug);
	if (!permission) throw new Error(`Unknown permission: ${slug}`);
	setUserPermission.run(userId, permission.id, granted ? 1 : 0);
}

export async function json(
	response: Response,
): Promise<Record<string, unknown>> {
	return (await response.json()) as Record<string, unknown>;
}

export function expectRedirect(response: Response, pathname: string): void {
	expect(response.status).toBe(302);
	const location = response.headers.get("location");
	expect(location).toBeTruthy();
	if (!location) return;
	try {
		expect(new URL(location, BASE_URL).pathname).toBe(pathname);
	} catch {
		throw new Error(`Invalid redirect location: ${location}`);
	}
}

export function expectBodyNotToContain(
	body: string,
	values: readonly string[],
): void {
	for (const value of values) expect(body).not.toContain(value);
}
