/**
 * Notification Center routes (PRD Modul 16). Admin-only list of in-app
 * notifications (own + admin broadcasts) with unread count, plus mark-read and
 * mark-all-read actions. Producers call notifyAdmins() (see notifications.ts).
 */
import { Hono } from "hono";
import { requirePermission, requireRole } from "../auth";
import {
	countNotifications,
	countUnreadNotifications,
	listNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { Notification, Paginated } from "../../shared/types";

function pageMeta(total: number, page: number, perPage: number) {
	return {
		currentPage: page,
		perPage,
		lastPage: Math.max(1, Math.ceil(total / perPage)),
		total,
	};
}

export const notificationRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get(
		"/notifications",
		requireRole("admin"),
		requirePermission("notifications.read"),
		(c) => {
			const user = c.var.user!;
			const page = Math.min(
			1000,
			Math.max(1, Number(c.req.query("page") ?? 1) || 1),
		);
			const perPage = Math.min(
				100,
				Math.max(1, Number(c.req.query("perPage") ?? 20) || 20),
			);
			const total = countNotifications.get(user.id)?.n ?? 0;
			const unread = countUnreadNotifications.get(user.id)?.n ?? 0;
			const data: Paginated<Notification> = {
				data: listNotifications
					.all(user.id, perPage, (page - 1) * perPage)
					.map((row) => ({
						id: row.id,
						userId: row.userId,
						type: row.type,
						title: row.title,
						body: row.body,
						read: row.read === 1,
						createdAt: row.createdAt,
					})),
				meta: pageMeta(total, page, perPage),
			};
			return c.var.inertia.render("NotificationCenter", {
				notifications: data,
				unread,
			});
		},
	);

	app.post(
		"/notifications/:id/read",
		requireRole("admin"),
		requirePermission("notifications.update"),
		(c) => {
			const id = Number(c.req.param("id"));
			const user = c.var.user!;
			const result = markNotificationRead.run(id, user.id);
			if (result.changes !== 1)
				return c.json({ error: "Notification not found." }, 404);
			return c.json({ ok: true });
		},
	);

	app.post(
		"/notifications/read-all",
		requireRole("admin"),
		requirePermission("notifications.update"),
		(c) => {
			const user = c.var.user!;
			markAllNotificationsRead.run(user.id);
			return c.json({ ok: true });
		},
	);

	return app;
};
