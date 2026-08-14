/**
 * Retention & sweep (PERF-06): the periodic cleanup purges expired sessions,
 * password-reset tokens, old activity-log rows, and (when configured) old
 * notifications. Contact messages are business-critical and must never be
 * auto-deleted — that invariant is asserted here too.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.ACTIVITY_RETENTION_DAYS = "30";
	process.env.NOTIFICATION_RETENTION_DAYS = "7";
	// Importing the app module applies migrations + prepares statements on
	// the in-memory DB (env must be set before this import).
	await import("../../src/server/app");
});

afterAll(async () => {
	const { db } = await import("../../src/server/db");
	db.close();
});

describe("retention sweep (PERF-06)", () => {
	it("purges activity rows older than the retention window, keeps newer ones", async () => {
		const { insertActivity } = await import("../../src/server/db");
		insertActivity.run(
			null,
			"test.old",
			"older than retention",
			null,
			null,
			null,
		);
		insertActivity.run(null, "test.new", "within retention", null, null, null);
		// Backdate the old row past the 30-day window.
		const { db } = await import("../../src/server/db");
		db.query(
			`UPDATE activity_logs SET created_at = ? WHERE detail = 'older than retention'`,
		).run(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString());

		const { sweepExpired } = await import(
			"../../src/server/routes/uploads.routes"
		);
		sweepExpired();

		const remaining = db
			.query<{ event: string }, []>(`SELECT event FROM activity_logs`)
			.all()
			.map((r) => r.event);
		expect(remaining).not.toContain("test.old");
		expect(remaining).toContain("test.new");
	});

	it("purges notifications past their configured window", async () => {
		const { insertNotification, db } = await import("../../src/server/db");
		insertNotification.run(null, "info", "old notice", "stale");
		insertNotification.run(null, "info", "fresh notice", "current");
		db.query(
			`UPDATE notifications SET created_at = ? WHERE body = 'stale'`,
		).run(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString());

		const { sweepExpired } = await import(
			"../../src/server/routes/uploads.routes"
		);
		sweepExpired();

		const titles = db
			.query<{ title: string }, []>(`SELECT title FROM notifications`)
			.all()
			.map((r) => r.title);
		expect(titles).not.toContain("old notice");
		expect(titles).toContain("fresh notice");
	});

	it("never deletes contact messages (business-critical inbox data)", async () => {
		const { insertContactMessage, db } = await import("../../src/server/db");
		insertContactMessage.run(
			"Visitor",
			"visitor@example.com",
			"Subject",
			"Message body",
		);
		db.query(`UPDATE contact_messages SET created_at = ?`).run(
			new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
		);

		const { sweepExpired } = await import(
			"../../src/server/routes/uploads.routes"
		);
		sweepExpired();

		const count = (
			db
				.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM contact_messages`)
				.get() ?? { n: 0 }
		).n;
		expect(count).toBeGreaterThanOrEqual(1);
	});
});
