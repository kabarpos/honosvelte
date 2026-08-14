/**
 * Activity log routes at /activity (Modul 13): paginated list with event +
 * search filters, plus a JSON detail endpoint. Read-only, admin-only —
 * entries are written by recordActivity() at the action sites.
 */
import { Hono } from "hono";
import { requireAuth, requirePermission } from "../auth";
import {
	countActivity,
	findActivityById,
	escapeLike,
	listActivity,
	listActivityEvents,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { ActivityLogEntry, Paginated } from "../../shared/types";

function paramId(value: string | undefined): number | null {
	if (!value) return null;
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function pageMeta(total: number, page: number, perPage: number) {
	return {
		currentPage: page,
		perPage,
		lastPage: Math.max(1, Math.ceil(total / perPage)),
		total,
	};
}

export const activityRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/activity", requireAuth, requirePermission("activity.read"), (c) => {
		const page = Math.min(
			1000,
			Math.max(1, Number(c.req.query("page") ?? 1) || 1),
		);
		const perPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("perPage") ?? 20) || 20),
		);
		const event = String(c.req.query("event") ?? "");
		const search = String(c.req.query("search") ?? "");
		const like = `%${escapeLike(search)}%`;
		const total =
			countActivity.get(event, event, like, like, like, like, like)?.n ?? 0;
		const data: Paginated<ActivityLogEntry> = {
			data: listActivity
				.all(
					event,
					event,
					like,
					like,
					like,
					like,
					like,
					perPage,
					(page - 1) * perPage,
				)
				.map((row) => ({
					id: row.id,
					userId: row.userId,
					userName: row.userName,
					event: row.event,
					detail: row.detail,
					ip: row.ip,
					url: row.url,
					method: row.method,
					createdAt: row.createdAt,
				})),
			meta: pageMeta(total, page, perPage),
		};
		return c.var.inertia.render("Activity", {
			activity: data,
			events: listActivityEvents.all().map((r) => r.event),
			event,
			search,
		});
	});

	app.get(
		"/activity/:id",
		requireAuth,
		requirePermission("activity.read"),
		(c) => {
			const id = paramId(c.req.param("id"));
			const row = id ? findActivityById.get(id) : null;
			if (!row) return c.json({ error: "Activity not found." }, 404);
			return c.json({
				activity: {
					id: row.id,
					userId: row.userId,
					userName: row.userName,
					event: row.event,
					detail: row.detail,
					ip: row.ip,
					url: row.url,
					method: row.method,
					createdAt: row.createdAt,
				},
			});
		},
	);

	return app;
};
