import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	call,
	INERTIA_HEADERS,
	loginAs,
	seedUser,
	type TestApp,
} from "../security/helpers";

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

describe("user search", () => {
	it("filters by name and email with consistent pagination metadata", async () => {
		await seedUser("Needle Name", "first@example.com");
		await seedUser("Other Name", "needle-email@example.com");
		await seedUser("Unrelated", "unrelated@example.com");
		await seedUser("Search Admin", "search-admin@example.com", "admin");
		const cookie = await loginAs(app, "search-admin@example.com");

		const byName = await call(app, "/users?search=Needle%20Name", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(byName.status).toBe(200);
		const namePayload = (await byName.json()) as {
			props: {
				users: { data: Array<{ email: string }>; meta: { total: number } };
			};
		};
		expect(namePayload.props.users.meta.total).toBe(1);
		expect(namePayload.props.users.data.map((u) => u.email)).toEqual([
			"first@example.com",
		]);

		const byEmail = await call(app, "/users?search=needle-email", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(byEmail.status).toBe(200);
		const emailPayload = (await byEmail.json()) as {
			props: {
				users: { data: Array<{ email: string }>; meta: { total: number } };
			};
		};
		expect(emailPayload.props.users.meta.total).toBe(1);
		expect(emailPayload.props.users.data[0]?.email).toBe(
			"needle-email@example.com",
		);
	});

	it("paginates a filtered search with stable metadata", async () => {
		// 25 users matching the same pattern, small page size.
		for (let i = 0; i < 25; i++) {
			await seedUser(`Page Match ${i}`, `page-match-${i}@example.com`);
		}
		await seedUser("Page Admin", "page-admin@example.com", "admin");
		const cookie = await loginAs(app, "page-admin@example.com");

		const page1 = (await call(app, "/users?search=Page%20Match&perPage=10", {
			headers: INERTIA_HEADERS,
			cookie,
		}).then((r) => r.json())) as {
			props: {
				users: {
					data: Array<{ name: string }>;
					meta: {
						currentPage: number;
						lastPage: number;
						total: number;
						perPage: number;
					};
				};
			};
		};
		expect(page1.props.users.meta.total).toBe(25);
		expect(page1.props.users.meta.currentPage).toBe(1);
		expect(page1.props.users.data).toHaveLength(10);

		const page2 = (await call(
			app,
			"/users?search=Page%20Match&perPage=10&page=2",
			{
				headers: INERTIA_HEADERS,
				cookie,
			},
		).then((r) => r.json())) as typeof page1;
		expect(page2.props.users.meta.currentPage).toBe(2);
		expect(page2.props.users.data).toHaveLength(10);
		expect(page2.props.users.data[0]?.name).not.toBe(
			page1.props.users.data[0]?.name,
		);

		const page3 = (await call(
			app,
			"/users?search=Page%20Match&perPage=10&page=3",
			{
				headers: INERTIA_HEADERS,
				cookie,
			},
		).then((r) => r.json())) as typeof page1;
		expect(page3.props.users.data).toHaveLength(5); // 25 total → 10/10/5
	});

	it("returns an empty list (not an error) for a search with no matches", async () => {
		await seedUser("Zero Admin", "zero-admin@example.com", "admin");
		const cookie = await loginAs(app, "zero-admin@example.com");

		const res = await call(app, "/users?search=no-such-user-anywhere", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			props: { users: { data: Array<unknown>; meta: { total: number } } };
		};
		expect(payload.props.users.meta.total).toBe(0);
		expect(payload.props.users.data).toEqual([]);
	});

	it("clamps invalid page/perPage instead of crashing or scanning (QA-03/PERF-04)", async () => {
		await seedUser("Clamp Admin", "clamp-admin@example.com", "admin");
		const cookie = await loginAs(app, "clamp-admin@example.com");

		const huge = await call(app, "/users?page=99999&perPage=9999", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(huge.status).toBe(200);
		const hugePayload = (await huge.json()) as {
			props: { users: { meta: { currentPage: number; perPage: number } } };
		};
		expect(hugePayload.props.users.meta.currentPage).toBe(1000);
		expect(hugePayload.props.users.meta.perPage).toBe(100);

		const garbage = await call(app, "/users?page=abc&perPage=xyz", {
			headers: INERTIA_HEADERS,
			cookie,
		});
		expect(garbage.status).toBe(200);
		const garbagePayload = (await garbage.json()) as {
			props: { users: { meta: { currentPage: number; perPage: number } } };
		};
		expect(garbagePayload.props.users.meta.currentPage).toBe(1);
		expect(garbagePayload.props.users.meta.perPage).toBe(10);
	});
});
