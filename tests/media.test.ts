import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let app: Awaited<ReturnType<typeof createApp>>;
let mediaDir: string;

beforeAll(async () => {
	mediaDir = mkdtempSync(join(tmpdir(), "honosvelte-media-"));
	process.env.MEDIA_DIR = mediaDir;
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
	rmSync(mediaDir, { recursive: true, force: true });
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
	return createUserWithRole.get(name, email, hash, role).id;
}

function upload(
	cookie: string,
	name: string,
	mime: string,
	bytes: Uint8Array,
): Promise<Response> {
	return app.request(`${BASE}/media`, {
		method: "POST",
		headers: { cookie, "x-file-name": name, "content-type": mime },
		body: bytes,
	});
}

describe("media library", () => {
	it("redirects guests from /media to /login", async () => {
		const res = await call("/media", { headers: xhr });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("renders the media page to an authenticated user", async () => {
		const cookie = await registerUser("viewer@example.com");
		const res = await call("/media", { headers: { ...xhr, cookie } });
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Media");
		expect(data.props.media.meta.total).toBe(0);
		expect(data.props.categories).toContain("image");
	});

	it("stores whatsapp at registration", async () => {
		const res = await call("/register", {
			method: "POST",
			headers: xhr,
			body: {
				name: "Wired",
				email: "wired@example.com",
				password: "password123",
				whatsapp: "+6281234567890",
			},
		});
		expect(res.status).toBe(303);
		const { findUserByEmail } = await import("../src/server/db");
		expect(findUserByEmail.get("wired@example.com")!.whatsapp).toBe(
			"+6281234567890",
		);
	});

	it("uploads a file and serves it back", async () => {
		await seedUser("Boss", "boss@example.com", "admin");
		const cookie = await loginAs("boss@example.com");
		const bytes = new TextEncoder().encode("fake-png-bytes");

		const res = await upload(cookie, "photo.png", "image/png", bytes);
		expect(res.status).toBe(201);
		const data = await page(res);
		expect(data.media.originalName).toBe("photo.png");
		expect(data.media.category).toBe("image");
		const mediaId = data.media.id as number;

		const { findMediaById } = await import("../src/server/db");
		const row = findMediaById.get(mediaId)!;
		expect(existsSync(join(mediaDir, row.filename))).toBe(true);

		const served = await call(`/media/${mediaId}`, { headers: { cookie } });
		expect(served.status).toBe(200);
		expect(served.headers.get("content-type")).toBe("image/png");
		expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);

		const list = await call("/media", { headers: { ...xhr, cookie } });
		const listed = await page(list);
		expect(listed.props.media.meta.total).toBe(1);
		expect(listed.props.media.data[0]!.url).toBe(`/media/${mediaId}`);
	});

	it("rejects missing names, empty bodies, and blocked mime types", async () => {
		await seedUser("Guard", "guard@example.com", "admin");
		const cookie = await loginAs("guard@example.com");

		const noName = await upload(cookie, "", "image/png", new TextEncoder().encode("x"));
		expect(noName.status).toBe(400);

		const empty = await upload(cookie, "a.png", "image/png", new Uint8Array());
		expect(empty.status).toBe(400);

		const html = await upload(
			cookie,
			"evil.html",
			"text/html",
			new TextEncoder().encode("<script>alert(1)</script>"),
		);
		expect(html.status).toBe(400);

		const svg = await upload(
			cookie,
			"bad.svg",
			"image/svg+xml",
			new TextEncoder().encode("<svg onload=alert(1)>"),
		);
		expect(svg.status).toBe(400);
	});

	it("scopes regular users to their own files", async () => {
		await seedUser("Owner", "owner@example.com", "user");
		const ownerCookie = await loginAs("owner@example.com");
		const up = await upload(
			ownerCookie,
			"mine.txt",
			"text/plain",
			new TextEncoder().encode("private"),
		);
		const mediaId = (await page(up)).media.id as number;

		await seedUser("Snoop", "snoop@example.com", "user");
		const snoopCookie = await loginAs("snoop@example.com");

		const peek = await call(`/media/${mediaId}`, { headers: { cookie: snoopCookie } });
		expect(peek.status).toBe(403);

		const list = await call("/media", { headers: { ...xhr, cookie: snoopCookie } });
		const data = await page(list);
		expect(data.props.media.meta.total).toBe(0);

		const del = await call(`/media/${mediaId}`, {
			method: "DELETE",
			headers: { ...xhr, cookie: snoopCookie },
		});
		expect(del.status).toBe(403);
	});

	it("lets an admin edit the file name and metadata", async () => {
		await seedUser("Owner2", "owner2@example.com", "user");
		const ownerCookie = await loginAs("owner2@example.com");
		const up = await upload(
			ownerCookie,
			"note.txt",
			"text/plain",
			new TextEncoder().encode("note"),
		);
		const mediaId = (await page(up)).media.id as number;

		await seedUser("Boss2", "boss2@example.com", "admin");
		const adminCookie = await loginAs("boss2@example.com");

		const list = await call("/media", { headers: { ...xhr, cookie: adminCookie } });
		const data = await page(list);
		expect(data.props.media.meta.total).toBeGreaterThanOrEqual(1);
		expect(
			data.props.media.data.some((m: any) => m.originalName === "note.txt"),
		).toBe(true);

		const patch = await call(`/media/${mediaId}`, {
			method: "PATCH",
			headers: { ...xhr, cookie: adminCookie },
			body: {
				originalName: "renamed.txt",
				title: "My note",
				altText: "",
				description: "Edited",
			},
		});
		expect(patch.status).toBe(303);
		const { findMediaById } = await import("../src/server/db");
		const row = findMediaById.get(mediaId)!;
		expect(row.originalName).toBe("renamed.txt");
		expect(row.title).toBe("My note");
		expect(row.description).toBe("Edited");
	});

	it("renames on the owner side and rejects an empty file name", async () => {
		await seedUser("Renamer", "renamer@example.com", "user");
		const cookie = await loginAs("renamer@example.com");
		const up = await upload(
			cookie,
			"before.txt",
			"text/plain",
			new TextEncoder().encode("x"),
		);
		const mediaId = (await page(up)).media.id as number;

		const patch = await call(`/media/${mediaId}`, {
			method: "PATCH",
			headers: { ...xhr, cookie },
			body: { originalName: "after.txt" },
		});
		expect(patch.status).toBe(303);
		const { findMediaById } = await import("../src/server/db");
		expect(findMediaById.get(mediaId)!.originalName).toBe("after.txt");

		const bad = await call(`/media/${mediaId}`, {
			method: "PATCH",
			headers: { ...xhr, cookie },
			body: { originalName: "" },
		});
		expect(bad.status).toBe(422);
	});

	it("supports bulk upload: several files in sequence become several rows", async () => {
		await seedUser("Bulk", "bulk@example.com", "user");
		const cookie = await loginAs("bulk@example.com");
		const before = await call("/media", { headers: { ...xhr, cookie } });
		const beforeTotal = (await page(before)).props.media.meta.total as number;

		for (const name of ["one.png", "two.jpg", "three.gif"]) {
			const res = await upload(
				cookie,
				name,
				`image/${name.split(".")[1]}`,
				new TextEncoder().encode(name),
			);
			expect(res.status).toBe(201);
		}

		const after = await call("/media", { headers: { ...xhr, cookie } });
		const afterData = await page(after);
		expect(afterData.props.media.meta.total).toBe(beforeTotal + 3);
		const names = afterData.props.media.data.map((m: any) => m.originalName);
		expect(names).toContain("one.png");
		expect(names).toContain("two.jpg");
		expect(names).toContain("three.gif");
	});

	it("deletes the row and the file on disk", async () => {
		await seedUser("Boss3", "boss3@example.com", "admin");
		const cookie = await loginAs("boss3@example.com");
		const up = await upload(
			cookie,
			"gone.txt",
			"text/plain",
			new TextEncoder().encode("bye"),
		);
		const mediaId = (await page(up)).media.id as number;
		const { findMediaById } = await import("../src/server/db");
		const row = findMediaById.get(mediaId)!;

		const del = await call(`/media/${mediaId}`, {
			method: "DELETE",
			headers: { ...xhr, cookie },
		});
		expect(del.status).toBe(303);
		expect(findMediaById.get(mediaId)).toBeNull();
		expect(existsSync(join(mediaDir, row.filename))).toBe(false);
	});

	it("exposes the picker API with search", async () => {
		await seedUser("Boss4", "boss4@example.com", "admin");
		const cookie = await loginAs("boss4@example.com");
		await upload(cookie, "landscape.jpg", "image/jpeg", new TextEncoder().encode("jpg"));

		const all = await call("/media/picker", { headers: { cookie } });
		expect(all.status).toBe(200);
		const picked = await page(all);
		expect(picked.media.length).toBeGreaterThanOrEqual(1);
		expect(
			picked.media.some((m: any) => m.originalName === "landscape.jpg"),
		).toBe(true);

		const none = await call("/media/picker?q=zzz", { headers: { cookie } });
		expect((await page(none)).media.length).toBe(0);
	});
});
