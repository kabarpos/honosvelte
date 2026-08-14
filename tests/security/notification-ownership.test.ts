import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { call, loginAs, seedUser, type TestApp } from "./helpers";

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

describe("notification ownership", () => {
	it("prevents one admin from marking another admin's notification read", async () => {
		const firstId = await seedUser(
			"First Admin",
			"first-notification-admin@example.com",
			"admin",
		);
		const secondId = await seedUser(
			"Second Admin",
			"second-notification-admin@example.com",
			"admin",
		);
		const { insertNotification, listNotifications } = await import(
			"../../src/server/db"
		);
		const notification = insertNotification.get(
			secondId,
			"info",
			"Private",
			"Private notification",
		);
		if (!notification) throw new Error("Could not create notification");
		const firstCookie = await loginAs(
			app,
			"first-notification-admin@example.com",
		);
		const secondCookie = await loginAs(
			app,
			"second-notification-admin@example.com",
		);

		const denied = await call(app, `/notifications/${notification.id}/read`, {
			method: "POST",
			cookie: firstCookie,
		});
		expect(denied.status).toBe(404);

		const allowed = await call(app, `/notifications/${notification.id}/read`, {
			method: "POST",
			cookie: secondCookie,
		});
		expect(allowed.status).toBe(200);
		expect(listNotifications.all(secondId, 20, 0)[0]?.read).toBe(1);
		expect(firstId).toBeGreaterThan(0);
	});

	it("fans notifications out to super_admin users", async () => {
		const superId = await seedUser(
			"Notification Super Admin",
			"notification-super@example.com",
			"super_admin",
		);
		const { notifyAdmins } = await import("../../src/server/notifications");
		const { listNotifications } = await import("../../src/server/db");
		notifyAdmins("info", "Broadcast", "Visible to all admins");
		expect(
			listNotifications
				.all(superId, 20, 0)
				.some((n) => n.title === "Broadcast"),
		).toBe(true);
	});
});
