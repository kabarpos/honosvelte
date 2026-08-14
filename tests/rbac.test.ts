import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { createApp } from "../src/server/app";

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

async function registerUser(
	email: string,
	password = "password123",
): Promise<string> {
	const res = await call("/register", {
		method: "POST",
		headers: xhr,
		body: { name: "Test User", email, password },
	});
	expect(res.status).toBe(303);
	const cookie = sessionCookie(res);
	expect(cookie).not.toBe("");
	return cookie;
}

async function loginAs(
	email: string,
	password = "password123",
): Promise<string> {
	const res = await call("/login", {
		method: "POST",
		headers: xhr,
		body: { email, password },
	});
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
	return createUserWithRole.get(name, email, hash, role)!.id;
}

describe("rbac access control", () => {
	it("redirects guests from /users to /login", async () => {
		const res = await call("/users", { headers: xhr });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("blocks plain users from management pages", async () => {
		const cookie = await registerUser("plain@example.com");
		for (const path of ["/users", "/roles", "/permissions"]) {
			const res = await call(path, { headers: { ...xhr, cookie } });
			expect(res.status).toBe(302);
			expect(new URL(res.headers.get("location")!).pathname).toBe(
				"/dashboard",
			);
		}
	});

	it("lists users and roles to an admin", async () => {
		await seedUser("Boss", "boss@example.com", "admin");
		const cookie = await loginAs("boss@example.com");

		const res = await call("/users", { headers: { ...xhr, cookie } });
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Users");
		expect(data.props.users.meta.total).toBeGreaterThanOrEqual(1);
		expect(
			data.props.users.data.some((u: any) => u.email === "boss@example.com"),
		).toBe(true);
		expect(data.props.roles.some((r: any) => r.slug === "user")).toBe(true);
		expect(data.props.roles.some((r: any) => r.slug === "super_admin")).toBe(
			true,
		);
	});

	it("creates a user with a whatsapp number", async () => {
		await seedUser("BossC", "bossc@example.com", "admin");
		const cookie = await loginAs("bossc@example.com");

		const res = await call("/users", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: {
				name: "Newcomer",
				email: "newcomer@example.com",
				whatsapp: "+628111111111",
				role: "user",
				status: "active",
				password: "password123",
				passwordConfirmation: "password123",
			},
		});
		expect(res.status).toBe(303);

		const list = await call("/users", { headers: { ...xhr, cookie } });
		const created = (await page(list)).props.users.data.find(
			(u: any) => u.email === "newcomer@example.com",
		);
		expect(created).toBeTruthy();
		expect(created.whatsapp).toBe("+628111111111");
	});

	it("rejects a mismatch on password confirmation", async () => {
		await seedUser("Boss2", "boss2@example.com", "admin");
		const cookie = await loginAs("boss2@example.com");

		const res = await call("/users", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: {
				name: "Oops",
				email: "oops@example.com",
				role: "user",
				status: "active",
				password: "password123",
				passwordConfirmation: "different",
			},
		});
		expect(res.status).toBe(422);
		const data = await page(res);
		expect(data.component).toBe("Users");
		expect(data.props.errors.password).toContain("does not match");
	});

	it("refuses to delete your own account", async () => {
		const id = await seedUser("Selfy", "selfy@example.com", "admin");
		const cookie = await loginAs("selfy@example.com");

		const res = await call(`/users/${id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie },
		});
		expect(res.status).toBe(422);
		expect((await page(res)).component).toBe("Users");
	});

	it("deactivates then deletes a user", async () => {
		await seedUser("Boss3", "boss3@example.com", "admin");
		await seedUser("Doomed", "doomed@example.com", "user");
		const cookie = await loginAs("boss3@example.com");

		const { findUserByEmail } = await import("../src/server/db");
		const victim = findUserByEmail.get("doomed@example.com")!;
		expect(victim.status).toBe("active");

		const deact = await call(`/users/${victim.id}/status`, {
			method: "POST",
			headers: { ...xhr, cookie },
			body: { status: "inactive" },
		});
		expect(deact.status).toBe(303);
		expect(findUserByEmail.get("doomed@example.com")!.status).toBe("inactive");

		const del = await call(`/users/${victim.id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie },
		});
				expect(del.status).toBe(303);
		expect(findUserByEmail.get("doomed@example.com")).toBeNull();
	});
});

describe("rbac roles", () => {
	let adminCookie: string;

	beforeAll(async () => {
		// super_admin: holds roles.delete too, which the admin role lacks.
		await seedUser("RoleRoot", "roleroot@example.com", "super_admin");
		adminCookie = await loginAs("roleroot@example.com");
	});

	it("creates a custom role", async () => {
		const res = await call("/roles", {
			method: "POST",
			headers: { ...xhr, cookie: adminCookie },
			body: { slug: "editor", name: "Editor", description: "Content editor" },
		});
		expect(res.status).toBe(303);
		const { findRoleBySlug } = await import("../src/server/db");
		expect(findRoleBySlug.get("editor")).toBeTruthy();
	});

	it("blocks renaming built-in roles", async () => {
		const { findRoleBySlug } = await import("../src/server/db");
		const admin = findRoleBySlug.get("admin")!;
		const res = await call(`/roles/${admin.id}`, {
			method: "PATCH",
			headers: { ...xhr, cookie: adminCookie },
			body: { slug: "chief", name: "Chief" },
		});
		expect(res.status).toBe(422);
		expect((await page(res)).props.errors.slug).toContain("Built-in");
		expect(findRoleBySlug.get("chief")).toBeNull();
	});

	it("assigns a permission set to a role", async () => {
		const { findRoleBySlug, listRolePermissionSlugs } = await import(
			"../src/server/db"
		);
		const editor = findRoleBySlug.get("editor")!;

		const res = await call(`/roles/${editor.id}/permissions`, {
			method: "POST",
			headers: { ...xhr, cookie: adminCookie },
			body: { permissionSlugs: ["users.create", "users.read"] },
		});
		expect(res.status).toBe(303);
		expect(listRolePermissionSlugs.all(editor.id).map((p) => p.slug)).toEqual([
			"users.create",
			"users.read",
		]);

		const narrow = await call(`/roles/${editor.id}/permissions`, {
			method: "POST",
			headers: { ...xhr, cookie: adminCookie },
			body: { permissionSlugs: ["users.read"] },
		});
		expect(narrow.status).toBe(303);
		expect(listRolePermissionSlugs.all(editor.id).map((p) => p.slug)).toEqual([
			"users.read",
		]);
	});

	it("deletes a custom role", async () => {
		const { findRoleBySlug, insertRole } = await import("../src/server/db");
		const { id } = insertRole.get("tempRole", "Temp", null)!;
		const res = await call(`/roles/${id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie: adminCookie },
		});
		expect(res.status).toBe(303);
		expect(findRoleBySlug.get("tempRole")).toBeNull();
	});

	it("refuses to delete built-in roles", async () => {
		const { findRoleBySlug } = await import("../src/server/db");
		const user = findRoleBySlug.get("user")!;
		const res = await call(`/roles/${user.id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie: adminCookie },
		});
		expect(res.status).toBe(422);
		expect(findRoleBySlug.get("user")).toBeTruthy();
	});
});

describe("rbac permissions", () => {
	let adminCookie: string;

	beforeAll(async () => {
		// super_admin: holds permissions.delete too, which the admin role lacks.
		await seedUser("PermRoot", "permroot@example.com", "super_admin");
		adminCookie = await loginAs("permroot@example.com");
	});

	it("creates, edits, and deletes a custom permission", async () => {
		const { findPermissionBySlug } = await import("../src/server/db");

		const created = await call("/permissions", {
			method: "POST",
			headers: { ...xhr, cookie: adminCookie },
			body: { slug: "reports.export", name: "Export reports" },
		});
		expect(created.status).toBe(303);
		expect(findPermissionBySlug.get("reports.export")).toBeTruthy();

		const perm = findPermissionBySlug.get("reports.export")!;
		const edited = await call(`/permissions/${perm.id}`, {
			method: "PATCH",
			headers: { ...xhr, cookie: adminCookie },
			body: { slug: "reports.export", name: "Export all reports" },
		});
		expect(edited.status).toBe(303);
		expect(findPermissionBySlug.get("reports.export")!.name).toBe(
			"Export all reports",
		);

		const del = await call(`/permissions/${perm.id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie: adminCookie },
		});
		expect(del.status).toBe(303);
		expect(findPermissionBySlug.get("reports.export")).toBeNull();
	});

	it("refuses to rename or delete built-in permissions", async () => {
		const { findPermissionBySlug } = await import("../src/server/db");
		const read = findPermissionBySlug.get("users.read")!;

		const del = await call(`/permissions/${read.id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie: adminCookie },
		});
		expect(del.status).toBe(422);
		expect((await page(del)).props.errors.slug).toContain("Built-in");
		expect(findPermissionBySlug.get("users.read")).toBeTruthy();

		const rename = await call(`/permissions/${read.id}`, {
			method: "PATCH",
			headers: { ...xhr, cookie: adminCookie },
			body: { slug: "users.browse", name: "Browse users" },
		});
		expect(rename.status).toBe(422);
		expect(findPermissionBySlug.get("users.browse")).toBeNull();
	});
});

describe("rbac permission guards", () => {
	it("denies user creation to an admin with a personal deny", async () => {
		const { findUserByEmail, findPermissionBySlug, setUserPermission } =
			await import("../src/server/db");
		const id = await seedUser("Locked", "locked@example.com", "admin");
		setUserPermission.run(id, findPermissionBySlug.get("users.create")!.id, 0);

		const cookie = await loginAs("locked@example.com");
		const res = await call("/users", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: {
				name: "Denied",
				email: "denied@example.com",
				role: "user",
				status: "active",
				password: "password123",
				passwordConfirmation: "password123",
			},
		});
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
		expect(findUserByEmail.get("denied@example.com")).toBeNull();
	});

	it("lets a super_admin act on every permission", async () => {
		await seedUser("Root", "root@example.com", "super_admin");
		const cookie = await loginAs("root@example.com");

		const res = await call("/users", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: {
				name: "RootMade",
				email: "rootmade@example.com",
				role: "admin",
				status: "active",
				password: "password123",
				passwordConfirmation: "password123",
			},
		});
		expect(res.status).toBe(303);
	});

	describe("shared capability payload (SEC-08 / UX-06)", () => {
		it("exposes the effective permission slugs to an admin", async () => {
			await seedUser("CapAdmin", "capadmin@example.com", "admin");
			const cookie = await loginAs("capadmin@example.com");

			const res = await call("/users", { headers: { ...xhr, cookie } });
			expect(res.status).toBe(200);
			const data = await page(res);
			expect(Array.isArray(data.props.auth.can)).toBe(true);
			// The admin role holds the full admin set; the specific slugs the
			// UI gates on must be present so nav + page guards render.
			for (const slug of [
				"users.read",
				"roles.read",
				"permissions.read",
				"settings.read",
				"whatsapp.read",
				"email.read",
				"activity.read",
			]) {
				expect(data.props.auth.can).toContain(slug);
			}
			// Super-admin grant marker must NOT leak to a regular admin.
			expect(data.props.auth.can).not.toContain("*");
		});

		it("grants super_admin the '*' marker (implicit access)", async () => {
			await seedUser("CapRoot", "caproot@example.com", "super_admin");
			const cookie = await loginAs("caproot@example.com");

			const res = await call("/users", { headers: { ...xhr, cookie } });
			expect(res.status).toBe(200);
			const data = await page(res);
			expect(data.props.auth.can).toEqual(["*"]);
		});

		it("lets a super_admin render every admin page (no blank page)", async () => {
			await seedUser("UxRoot", "uxroot@example.com", "super_admin");
			const cookie = await loginAs("uxroot@example.com");

			for (const path of [
				"/users",
				"/roles",
				"/permissions",
				"/settings",
				"/whatsapp",
				"/email",
				"/activity",
				"/notifications",
				"/contact/inbox",
			]) {
				const res = await call(path, { headers: { ...xhr, cookie } });
				expect(res.status, path).toBe(200);
				const data = await page(res);
				expect(data.props.auth.user.role).toBe("super_admin");
			}
		});

		it("denies an admin whose permission was revoked (nav parity)", async () => {
			const id = await seedUser("RevokedAdmin", "revoked@example.com", "admin");
			const cookie = await loginAs("revoked@example.com");
			const { findPermissionBySlug, setUserPermission } = await import(
				"../src/server/db"
			);
			setUserPermission.run(
				id,
				findPermissionBySlug.get("activity.read")!.id,
				0,
			);

			// The server guard mirrors the nav gating: the revoked admin is
			// redirected from /activity even though they are 'admin'.
			const res = await call("/activity", { headers: { ...xhr, cookie } });
			expect(res.status).toBe(302);
			expect(new URL(res.headers.get("location")!).pathname).toBe(
				"/dashboard",
			);
		});
	});
});
