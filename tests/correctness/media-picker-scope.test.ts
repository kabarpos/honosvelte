import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { call, loginAs, seedUser, type TestApp } from "../security/helpers";

let app: TestApp;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	const { createApp } = await import("../../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../../src/server/db");
	db.close();
});

describe("media picker ownership", () => {
	it("shows regular users only their own media metadata", async () => {
		const ownerId = await seedUser("Media Owner", "picker-owner@example.com");
		const otherId = await seedUser("Other User", "picker-other@example.com");
		const adminId = await seedUser(
			"Media Admin",
			"picker-admin@example.com",
			"admin",
		);
		const { insertMedia } = await import("../../src/server/db");
		insertMedia.get(
			ownerId,
			"owner.jpg",
			"owner.jpg",
			"image/jpeg",
			10,
			"image",
		);
		insertMedia.get(
			otherId,
			"other.jpg",
			"other.jpg",
			"image/jpeg",
			20,
			"image",
		);
		const ownerCookie = await loginAs(app, "picker-owner@example.com");
		const adminCookie = await loginAs(app, "picker-admin@example.com");

		const ownerResponse = await call(app, "/media/picker", {
			cookie: ownerCookie,
		});
		expect(ownerResponse.status).toBe(200);
		const ownerPayload = (await ownerResponse.json()) as {
			media: Array<{ originalName: string; userId: number | null }>;
		};
		expect(ownerPayload.media.map((item) => item.originalName)).toEqual([
			"owner.jpg",
		]);
		expect(ownerPayload.media[0]?.userId).toBe(ownerId);

		const adminResponse = await call(app, "/media/picker", {
			cookie: adminCookie,
		});
		const adminPayload = (await adminResponse.json()) as {
			media: Array<{ originalName: string }>;
		};
		expect(adminPayload.media.map((item) => item.originalName)).toEqual([
			"other.jpg",
			"owner.jpg",
		]);
		expect(adminId).toBeGreaterThan(0);
	});
});
