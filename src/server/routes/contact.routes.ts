/**
 * Contact routes (PRD Modul 9): public message submission through the
 * landing-page contact form. POST /contact validates and stores the message,
 * optionally notifies the configured contact inbox, and redirects back with a
 * success flag. The admin inbox (list / detail / reply / archive / bulk) is a
 * separate follow-up and reads from the same `contact_messages` table.
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requirePermission, requireRole } from "../auth";
import {
	countContactMessages,
	countContactMessagesSearch,
	deleteContactMessage,
	findContactMessageById,
	findSettingByKey,
	insertContactMessage,
	listContactMessages,
	escapeLike,
	listContactMessagesSearch,
	updateContactMessageStatus,
} from "../db";
import { config } from "../config";
import { rateLimit } from "../rate-limit";
import { recordActivity } from "../activity";
import { sendMail } from "../mailer";
import { notifyAdmins } from "../notifications";
import { dispatchTrigger } from "../whatsapp";
import { dispatchEmailTrigger } from "../mailer";
import { validateJson } from "../validation";
import type { AppEnv } from "../inertia-middleware";
import { logErrorRaw } from "../logger";
import type { ContactMessage, Paginated } from "../../shared/types";

const contactBody = t.Object(
	{
		name: t.String({ minLength: 2, maxLength: 80 }),
		email: t.String({ format: "email", maxLength: 160 }),
		subject: t.Optional(t.String({ maxLength: 160 })),
		message: t.String({ minLength: 10, maxLength: 5000 }),
	},
	{ additionalProperties: false },
);

type ContactBody = Static<typeof contactBody>;

/** Friendly per-field messages mapped by TypeBox path. Only the
 * contact-specific fields are listed here; /name and /email intentionally
 * fall back to the global auth messages (same TypeBox paths) to avoid
 * clobbering them in the merged VALIDATION_MESSAGES_ALL. */
export const CONTACT_VALIDATION_MESSAGES: Record<string, string> = {
	"/subject": "Subject must be at most 160 characters.",
	"/message": "Message must be at least 10 characters.",
};

export const contactRoutes = () => {
	const app = new Hono<AppEnv>();

	// Same brute-force protection as the auth endpoints.
	const limit = rateLimit({
		max: config.rateLimit.authMax,
		windowSeconds: config.rateLimit.authWindow,
		trustedProxies: config.trustedProxies,
	});

	app.post("/contact", limit, validateJson(contactBody), async (c) => {
		const body = c.req.valid("json") as ContactBody;
		const page = c.var.inertia;

		insertContactMessage.run(
			body.name.trim(),
			body.email.trim(),
			(body.subject?.trim() || null) as string | null,
			body.message.trim(),
		);

		recordActivity(c, null, "contact.submit", `Message from ${body.name}`);
		// Fan out a notification to all admins (PRD Modul 16).
		notifyAdmins(
			"contact",
			`New message from ${body.name}`,
			body.message.trim(),
		);

		// Best-effort notification to the configured inbox (PRD Modul 15 contact.email).
		const inbox = findSettingByKey.get("contact.email")?.value;
		if (inbox) {
			await sendMail({
				to: inbox,
				subject: body.subject?.trim()
					? `New contact message: ${body.subject.trim()}`
					: `New contact message from ${body.name}`,
				text: [
					`From: ${body.name} <${body.email}>`,
					body.subject?.trim() ? `Subject: ${body.subject.trim()}` : "",
					"",
					body.message.trim(),
				]
					.filter(Boolean)
					.join("\n"),
			}).catch((err) => logErrorRaw("mail", err));
		}

		// Best-effort: fire any WhatsApp templates bound to contact submission.
		await dispatchTrigger("on_contact", {
			name: body.name,
			email: body.email,
			phone: undefined,
		}).catch(() => {});
		// Best-effort: fire any email templates bound to contact submission.
		await dispatchEmailTrigger("on_contact", {
			name: body.name,
			email: body.email,
		}).catch(() => {});
		return page.redirect("/contact?sent=1");
	});

	// --- Admin inbox (Modul 9) -----------------------------------------------
	// Paginated list of visitor messages with status filter + search. Status
	// counts power the filter tabs. Admin-only.
	const STATUSES = ["unread", "read", "replied", "archived"] as const;

	function pageMeta(total: number, page: number, perPage: number) {
		return {
			currentPage: page,
			perPage,
			lastPage: Math.max(1, Math.ceil(total / perPage)),
			total,
		};
	}

	app.get(
		"/contact/inbox",
		requireRole("admin"),
		requirePermission("contact.read"),
		(c) => {
			const page = Math.min(
				1000,
				Math.max(1, Number(c.req.query("page") ?? 1) || 1),
			);
			const perPage = Math.min(
				100,
				Math.max(1, Number(c.req.query("perPage") ?? 20) || 20),
			);
			const status = String(c.req.query("status") ?? "");
			const search = String(c.req.query("search") ?? "").trim();
			const like = `%${escapeLike(search)}%`;
			const total = search
				? (countContactMessagesSearch.get(
						status,
						status,
						like,
						like,
						like,
						like,
						like,
					)?.n ?? 0)
				: (countContactMessages.get(status, status)?.n ?? 0);
			const messages: Paginated<ContactMessage> = {
				data: (search
					? listContactMessagesSearch.all(
							status,
							status,
							like,
							like,
							like,
							like,
							like,
							perPage,
							(page - 1) * perPage,
						)
					: listContactMessages.all(
							status,
							status,
							perPage,
							(page - 1) * perPage,
						)
				).map((row) => ({
					id: row.id,
					name: row.name,
					email: row.email,
					subject: row.subject,
					message: row.message,
					status: row.status as ContactMessage["status"],
					createdAt: row.createdAt,
				})),
				meta: pageMeta(total, page, perPage),
			};
			const counts: Record<string, number> = {};
			for (const s of STATUSES)
				counts[s] = countContactMessages.get(s, s)?.n ?? 0;
			return c.var.inertia.render("ContactInbox", {
				messages,
				statuses: STATUSES,
				status,
				search,
				counts,
			});
		},
	);

	// JSON detail; opening a message marks it read (unless already replied/archived).
	app.get(
		"/contact/inbox/:id",
		requireRole("admin"),
		requirePermission("contact.read"),
		(c) => {
			const id = Number(c.req.param("id"));
			const row = findContactMessageById.get(id);
			if (!row) return c.json({ error: "Message not found." }, 404);
			if (row.status === "unread") {
				updateContactMessageStatus.run("read", id);
				recordActivity(
					c,
					null,
					"contact.read",
					`Opened message from ${row.name}`,
				);
			}
			return c.json({
				message: {
					id: row.id,
					name: row.name,
					email: row.email,
					subject: row.subject,
					message: row.message,
					status: row.status as ContactMessage["status"],
					createdAt: row.createdAt,
				},
			});
		},
	);

	// Change a single message's status (read / replied / archived).
	app.post(
		"/contact/inbox/:id/status",
		requireRole("admin"),
		requirePermission("contact.update"),
		async (c) => {
			const id = Number(c.req.param("id"));
			const row = findContactMessageById.get(id);
			if (!row) return c.json({ error: "Message not found." }, 404);
			const raw = (await c.req.json().catch(() => null)) as Record<
				string,
				unknown
			> | null;
			const status = String(raw?.status ?? "");
			if (!(STATUSES as readonly string[]).includes(status))
				return c.json({ error: "Invalid status." }, 422);
			updateContactMessageStatus.run(status, id);
			return c.json({ ok: true, status });
		},
	);

	// Reply to a message by email and mark it replied.
	app.post(
		"/contact/inbox/:id/reply",
		requireRole("admin"),
		requirePermission("contact.reply"),
		async (c) => {
			const id = Number(c.req.param("id"));
			const row = findContactMessageById.get(id);
			if (!row) return c.json({ error: "Message not found." }, 404);
			const raw = (await c.req.json().catch(() => null)) as Record<
				string,
				unknown
			> | null;
			const text = String(raw?.message ?? "").trim();
			if (!text) return c.json({ error: "Reply message is required." }, 422);
			try {
				await sendMail({
					to: row.email,
					subject: row.subject?.trim()
						? `Re: ${row.subject.trim()}`
						: "Re: your message",
					text,
				});
				updateContactMessageStatus.run("replied", id);
				return c.json({ ok: true });
			} catch (err) {
				return c.json(
					{
						ok: false,
						error: err instanceof Error ? err.message : "Send failed.",
					},
					502,
				);
			}
		},
	);

	// Bulk actions over selected messages (read / archive / delete).
	app.post(
		"/contact/inbox/bulk",
		requireRole("admin"),
		requirePermission("contact.update", "contact.delete"),
		async (c) => {
			const raw = (await c.req.json().catch(() => null)) as Record<
				string,
				unknown
			> | null;
			const ids = Array.isArray(raw?.ids)
				? (raw!.ids as unknown[]).filter(
						(n): n is number =>
							typeof n === "number" && Number.isInteger(n) && n > 0,
					)
				: [];
			const action = String(raw?.action ?? "");
			if (ids.length === 0)
				return c.json({ error: "No messages selected." }, 422);
			if (action === "delete") {
				for (const id of ids) deleteContactMessage.run(id);
			} else if (
				action === "read" ||
				action === "archived" ||
				action === "archive"
			) {
				const status = action === "archive" ? "archived" : action;
				for (const id of ids) updateContactMessageStatus.run(status, id);
			} else {
				return c.json({ error: "Invalid action." }, 422);
			}
			return c.json({ ok: true });
		},
	);

	return app;
};
