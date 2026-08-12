/**
 * End-to-end test suite for PRD Modul 15 — Settings. Boots the full app
 * against an in-memory database and drives it via app.request().
 * Run with: bun test --isolate (each file gets fresh globals).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createApp } from "../src/server/app";

let app: Awaited<ReturnType<typeof createApp>>;
let mediaDir: string;

beforeAll(async () => {
	// MEDIA_DIR must be set before the app modules are imported.
	mediaDir = mkdtempSync(join(tmpdir(), "settings-test-"));
	process.env.DATABASE_PATH = ":memory:";
	process.env.MEDIA_DIR = mediaDir;
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
	try {
		rmSync(mediaDir, { recursive: true, force: true });
	} catch {
		/* ignore */
	}
});

const BASE = "http://localhost:3000";
const xhr = { "x-inertia": "true" };

async function call(
	path: string,
	options: {
		method?: string;
		headers?: Record<string, string>;
		body?: Record<string, unknown>;
		cookie?: string;
	} = {},
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
	const row = createUserWithRole.get(name, email, hash, role);
	if (!row) throw new Error("failed to seed user");
	return row.id;
}

interface SettingsItemShape {
	key: string;
	label: string;
	value: string;
	kind: "text" | "textarea" | "select" | "repeater" | "media";
}

interface SettingsGroupShape {
	category: string;
	label: string;
	items: SettingsItemShape[];
}

function group(
	groups: SettingsGroupShape[],
	category: string,
): SettingsGroupShape | undefined {
	return groups.find((g) => g.category === category);
}

describe("Modul 15 — Settings", () => {
	it("redirects guests to login", async () => {
		const res = await call("/settings");
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("blocks plain users from the settings page", async () => {
		await seedUser("Plain", "settings-plain@test.com", "user");
		const cookie = await loginAs("settings-plain@test.com");
		const res = await call("/settings", { headers: { ...xhr, cookie } });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
	});

	it("renders seeded settings grouped by category to an admin", async () => {
		await seedUser("Sett Admin", "settings-admin@test.com", "admin");
		const cookie = await loginAs("settings-admin@test.com");
		const res = await call("/settings", { headers: { ...xhr, cookie } });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.component).toBe("Settings");
		const groups = data.props.groups as SettingsGroupShape[];
		expect(groups.map((g) => g.category)).toEqual([
			"general",
			"contact",
			"regional",
			"footer",
			"script",
		]);
		const general = group(groups, "general")!;
		expect(general.items.find((i) => i.key === "app.name")?.value).toBe(
			"Honosvelte",
		);
		// Field kinds match the upgraded Modul 15 shapes: description is a
		// textarea, logos/favicon are media uploads, text everywhere else.
		expect(general.items.find((i) => i.key === "app.description")?.kind).toBe(
			"textarea",
		);
		for (const key of ["app.logo_light", "app.logo_dark", "app.favicon"]) {
			expect(general.items.find((i) => i.key === key)?.kind).toBe("media");
		}
		expect(general.items.find((i) => i.key === "app.name")?.kind).toBe("text");
		// WhatsApp is a repeater of numbers; regional fields are selects.
		expect(
			group(groups, "contact")!.items.find((i) => i.key === "contact.whatsapp")
				?.kind,
		).toBe("repeater");
		const regional = group(groups, "regional")!;
		expect(regional.items.length).toBe(2);
		expect(regional.items.every((i) => i.kind === "select")).toBe(true);
		// Every script field (head/body + the four analytics pixels) is textarea.
		const script = group(groups, "script")!;
		expect(script.items.every((i) => i.kind === "textarea")).toBe(true);
		expect(script.items.map((i) => i.key)).toEqual([
			"script.head",
			"script.body",
			"script.meta_pixel",
			"script.tiktok",
			"script.google_ads",
			"script.google_analytics",
		]);
	});

	it("lets an admin update settings and persists the new values", async () => {
		const { getSetting } = await import("../src/server/settings");
		const cookie = await loginAs("settings-admin@test.com");
		const res = await call("/settings", {
			method: "POST",
			headers: { ...xhr, cookie },
			// Inertia's useForm nests dotted keys (`app.name` → `{ app: { name } }`).
			body: {
				app: { name: "Acme Corp", tagline: "Built on Honosvelte." },
				regional: { timezone: "Asia/Jakarta" },
				script: { head: '<meta name="robots" content="noindex">' },
			},
		});
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/settings");

		expect(getSetting("app.name")).toBe("Acme Corp");
		expect(getSetting("app.tagline")).toBe("Built on Honosvelte.");
		expect(getSetting("regional.timezone")).toBe("Asia/Jakarta");

		const view = await call("/settings", { headers: { ...xhr, cookie } });
		const data = await view.json();
		const groups = data.props.groups as SettingsGroupShape[];
		expect(
			group(groups, "general")!.items.find((i) => i.key === "app.name")?.value,
		).toBe("Acme Corp");
	});

	it("ignores unknown keys in the body and only writes known settings", async () => {
		const { getSetting, getSettings } = await import("../src/server/settings");
		const cookie = await loginAs("settings-admin@test.com");
		const before = getSettings().size;
		const res = await call("/settings", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: { app: { name: "Still Acme" }, hacked: { key: "nope" } },
		});
		expect(res.status).toBe(303);
		expect(getSettings().size).toBe(before);
		expect(getSetting("hacked.key")).toBe("");
		expect(getSetting("app.name")).toBe("Still Acme");
	});

	it("rejects a non-string value with 422 validation errors", async () => {
		const cookie = await loginAs("settings-admin@test.com");
		const res = await call("/settings", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: { app: { name: { nested: true } } },
		});
		expect(res.status).toBe(422);
		const data = await res.json();
		expect(data.props.errors).toBeDefined();
	});

	it("records a settings.update activity entry", async () => {
		const { listActivityEvents } = await import("../src/server/db");
		await seedUser("Sett Logger", "settings-logger@test.com", "admin");
		const cookie = await loginAs("settings-logger@test.com");
		const res = await call("/settings", {
			method: "POST",
			headers: { ...xhr, cookie },
			body: { footer: { text: "Made with Honosvelte" } },
		});
		expect(res.status).toBe(303);
		const events = listActivityEvents.all().map((r) => r.event);
		expect(events).toContain("settings.update");
	});

	// ---- media-valued settings (logos / favicon) ----------------------------

	const PNG = new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
	]);
	const PDF = new TextEncoder().encode("%PDF-1.4 fake pdf body");

	/** Upload a raw file to the media library (POST /media, Modul 8). */
	async function uploadMedia(
		cookie: string,
		name: string,
		mime: string,
		bytes: Uint8Array<ArrayBuffer>,
	): Promise<number> {
		const res = await app.request(`${BASE}/media`, {
			method: "POST",
			headers: {
				cookie,
				"x-file-name": name,
				"Content-Type": mime,
			},
			body: bytes,
		});
		expect(res.status).toBe(201);
		const data = (await res.json()) as { media: { id: number } };
		return data.media.id;
	}

	async function linkMedia(
		cookie: string,
		body: Record<string, unknown>,
	): Promise<Response> {
		return call("/settings/media", {
			method: "POST",
			headers: { cookie },
			body,
		});
	}

	it("stores a media-library upload as a media-valued setting", async () => {
		const { getSetting } = await import("../src/server/settings");
		await seedUser("Media Admin", "settings-media@test.com", "admin");
		const cookie = await loginAs("settings-media@test.com");
		const id = await uploadMedia(cookie, "logo.png", "image/png", PNG);

		const res = await linkMedia(cookie, { key: "app.logo_light", mediaId: id });
		expect(res.status).toBe(200);
		const data = (await res.json()) as { ok: boolean; url: string };
		expect(data.ok).toBe(true);
		expect(data.url).toBe(`/media/${id}`);
		expect(getSetting("app.logo_light")).toBe(`/media/${id}`);
	});

	it("rejects unknown keys, non-images, and missing media", async () => {
		const { getSetting } = await import("../src/server/settings");
		const cookie = await loginAs("settings-media@test.com");

		// Unknown key.
		const id = await uploadMedia(cookie, "logo.png", "image/png", PNG);
		const unknown = await linkMedia(cookie, { key: "app.name", mediaId: id });
		expect(unknown.status).toBe(422);

		// Non-image media item (PDF is uploadable but not a raster image).
		const pdf = await uploadMedia(cookie, "doc.pdf", "application/pdf", PDF);
		const notImage = await linkMedia(cookie, {
			key: "app.logo_dark",
			mediaId: pdf,
		});
		expect(notImage.status).toBe(422);

		// Nonexistent media id.
		const missing = await linkMedia(cookie, {
			key: "app.favicon",
			mediaId: 999999,
		});
		expect(missing.status).toBe(404);

		// Nothing was written by the rejected calls (logo_light kept its value
		// from the earlier test — same in-memory DB); the untouched keys stay empty.
		expect(getSetting("app.logo_dark")).toBe("");
		expect(getSetting("app.favicon")).toBe("");
	});
});
