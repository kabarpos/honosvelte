/**
 * Email Management routes (PRD Modul 11): admin configuration + email template
 * CRUD. The active provider + SMTP credentials resolve from the `settings`
 * table (see mailer.ts resolveMailConfig), with .env values as fallback.
 * This surface exposes the active provider, lets admins edit the SMTP
 * configuration, and send a test message; templates are full CRUD with
 * {{placeholder}} substitution, preview, and test-send.
 *
 * Page renders (GET) and form actions (POST/PATCH/DELETE) live together, one
 * file per URL (AGENTS.md "Route conventions").
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requirePermission, requireRole, setFlash } from "../auth";
import {
	deleteEmailTemplateById,
	findEmailTemplateById,
	findEmailTemplateBySlug,
	insertEmailTemplate,
	listEmailTemplates,
	updateEmailTemplate,
} from "../db";
import { resolveMailConfig, sendMail } from "../mailer";
import { recordActivity } from "../activity";
import { getSetting, setSetting } from "../settings";
import type { AppEnv } from "../inertia-middleware";
import type { EmailTemplate } from "../../shared/types";
import { validateJson } from "../validation";

/** Split the stored token string into a clean placeholder list. */
function parsePlaceholders(raw: string): string[] {
	return (raw ?? "")
		.split(/[,;]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Sample value for a placeholder, used in preview/test rendering. */
function sampleValue(key: string): string {
	const k = key.toLowerCase();
	if (k.includes("name")) return "Jane Doe";
	if (k.includes("email")) return "jane@example.com";
	if (k.includes("link") || k.includes("url"))
		return "https://example.com/welcome";
	if (k.includes("date")) return new Date().toLocaleDateString();
	return `Sample ${key}`;
}

/** Replace {{ token }} occurrences with values from `data` (missing → ''). */
function renderTemplate(text: string, data: Record<string, string>): string {
	return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
		const value = data[key.trim()];
		return value === undefined ? "" : value;
	});
}

function toTemplate(row: {
	id: number;
	name: string;
	slug: string;
	subject: string;
	body: string;
	placeholders: string;
	trigger: string;
	recipient: string;
	enabled: number;
	delayMinutes: number;
	createdAt: string;
	updatedAt: string;
}): EmailTemplate {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		subject: row.subject,
		body: row.body,
		placeholders: parsePlaceholders(row.placeholders),
		trigger: (row.trigger as EmailTemplate["trigger"]) || "manual",
		recipient: (row.recipient as EmailTemplate["recipient"]) || "customer",
		enabled: Boolean(row.enabled),
		delayMinutes: row.delayMinutes,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

const templateBody = t.Object(
	{
		name: t.String({ minLength: 2, maxLength: 80 }),
		slug: t.String({ pattern: "^[a-z0-9-]+$", maxLength: 80 }),
		subject: t.String({ minLength: 1, maxLength: 200 }),
		body: t.String({ minLength: 1, maxLength: 20000 }),
		placeholders: t.Optional(t.String({ maxLength: 2000 })),
		trigger: t.Optional(
			t.String({ enum: ["manual", "on_register", "on_contact", "on_order"] }),
		),
		recipient: t.Optional(t.String({ enum: ["customer", "admin"] })),
		enabled: t.Optional(t.Boolean()),
		delayMinutes: t.Optional(t.Number({ minimum: 0, maximum: 10080 })),
	},
	{ additionalProperties: false },
);

type TemplateBody = Static<typeof templateBody>;

/** Friendly per-field messages mapped by TypeBox path. */
export const EMAIL_VALIDATION_MESSAGES: Record<string, string> = {
	"/name": "Name must be at least 2 characters.",
	"/slug": "Slug must be lowercase letters, numbers, or hyphens.",
	"/subject": "Subject is required.",
	"/body": "Body is required.",
	"/placeholders": "Placeholders list is too long.",
	"/trigger": "Trigger must be manual, on_register, on_contact, or on_order.",
	"/recipient": "Recipient must be customer or admin.",
};

export const emailRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get(
		"/email",
		requireRole("admin"),
		requirePermission("email.read"),
		(c) => {
			const cfg = resolveMailConfig();
			return c.var.inertia.render("Email", {
				// The SMTP password is intentionally omitted — it is never sent to
				// the client. The form starts blank and an empty submit preserves it.
				mail: {
					driver: cfg.driver,
					from: cfg.from,
					smtpHost: cfg.smtpHost,
					smtpPort: String(cfg.smtpPort),
					smtpUser: cfg.smtpUser,
					smtpSecure: cfg.smtpSecure ? "true" : "false",
				},
				templates: listEmailTemplates.all().map(toTemplate),
				// The admin notification address (recipient of "admin"-bound templates).
				adminNotifyAddress: getSetting("email.admin_notify_address") ?? "",
			});
		},
	);

	// Save the mail/SMTP configuration (Modul 11). A fetch-driven JSON action
	// (not an Inertia request), mirroring /email/test. Resend/Mailtrap API keys
	// stay env-driven; only the SMTP credentials are UI-editable here.
	app.post(
		"/email/config",
		requireRole("admin"),
		requirePermission("email.update"),
		async (c) => {
			const raw = (await c.req.json().catch(() => null)) as Record<
				string,
				unknown
			> | null;
			if (!raw || typeof raw !== "object")
				return c.json({ error: "Malformed JSON body." }, 400);
			const driver = String(raw.driver ?? "");
			const from = String(raw.from ?? "");
			const smtpHost = String(raw.smtp_host ?? "");
			const smtpPort = String(raw.smtp_port ?? "");
			const smtpUser = String(raw.smtp_user ?? "");
			const smtpPass = String(raw.smtp_pass ?? "");
			const smtpSecure = String(raw.smtp_secure ?? "");
			const adminNotifyAddress = String(raw.admin_notify_address ?? "").trim();
			if (!["smtp", "log", "resend", "mailtrap"].includes(driver))
				return c.json({ error: "Invalid mail driver." }, 422);
			if (smtpSecure !== "true" && smtpSecure !== "false")
				return c.json({ error: "Invalid TLS setting." }, 422);
			if (
				adminNotifyAddress !== "" &&
				!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminNotifyAddress)
			)
				return c.json({ error: "Admin address must be a valid email." }, 422);
			const fields: [string, string][] = [
				["mail.driver", driver],
				["mail.from", from],
				["mail.smtp_host", smtpHost],
				["mail.smtp_port", smtpPort],
				["mail.smtp_user", smtpUser],
				["mail.smtp_secure", smtpSecure],
			];
			for (const [key, value] of fields) setSetting(key, value);
			// An empty password submit keeps the previously stored secret.
			if (smtpPass !== "") setSetting("mail.smtp_pass", smtpPass);
			// An empty admin address clears the previously stored value.
			setSetting("email.admin_notify_address", adminNotifyAddress);
			const user = c.var.user;
			if (user)
				recordActivity(
					c,
					user.id,
					"settings.update",
					"Updated mail configuration",
				);
			return c.json({ ok: true });
		},
	);

	// Dedicated create page (no modal).
	app.get(
		"/email/templates/create",
		requireRole("admin"),
		requirePermission("email.update"),
		(c) => c.var.inertia.render("EmailTemplate", { template: null }),
	);

	// Dedicated edit page (no modal).
	app.get(
		"/email/templates/:id/edit",
		requireRole("admin"),
		requirePermission("email.update"),
		(c) => {
			const row = findEmailTemplateById.get(Number(c.req.param("id")));
			if (!row) return c.redirect("/email");
			return c.var.inertia.render("EmailTemplate", {
				template: toTemplate(row),
			});
		},
	);

	// Send a one-off test email using the active provider (PRD: test send).
	app.post(
		"/email/test",
		requireRole("admin"),
		requirePermission("email.update"),
		async (c) => {
			const body = (await c.req.json().catch(() => null)) as {
				to?: string;
				subject?: string;
				body?: string;
			} | null;
			if (!body?.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
				return c.json(
					{ ok: false, error: "A valid recipient email is required." },
					422,
				);
			}
			try {
				await sendMail({
					to: body.to,
					subject: body.subject?.trim() || "Honosvelte test email",
					text:
						body.body?.trim() ||
						"This is a test message from your Honosvelte mailer.",
				});
				if (c.var.sessionToken)
					setFlash(c.var.sessionToken, {
						success: `Test email sent to ${body.to}.`,
					});
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

	// Template CRUD ----------------------------------------------------------
	app.post(
		"/email/templates",
		requireRole("admin"),
		requirePermission("email.update"),
		validateJson(templateBody),
		(c) => {
			const body = c.req.valid("json") as TemplateBody;
			const page = c.var.inertia;
			if (findEmailTemplateBySlug.get(body.slug)) {
				return page.error("EmailTemplate", {
					slug: "That slug is already in use.",
				});
			}
			insertEmailTemplate.run(
				body.name.trim(),
				body.slug.trim(),
				body.subject.trim(),
				body.body,
				body.placeholders?.trim() ?? "",
				body.trigger?.trim() || "manual",
				body.recipient?.trim() || "customer",
				body.enabled === false ? 0 : 1,
				body.delayMinutes && body.delayMinutes > 0
					? Math.floor(body.delayMinutes)
					: 0,
			);
			flash(c, "Template created.");
			return page.redirect("/email");
		},
	);

	app.patch(
		"/email/templates/:id",
		requireRole("admin"),
		requirePermission("email.update"),
		validateJson(templateBody),
		(c) => {
			const id = Number(c.req.param("id"));
			const body = c.req.valid("json") as TemplateBody;
			const page = c.var.inertia;
			const existing = findEmailTemplateById.get(id);
			if (!existing) return c.redirect("/email");
			const clash = findEmailTemplateBySlug.get(body.slug);
			if (clash && clash.id !== id) {
				return page.error("EmailTemplate", {
					slug: "That slug is already in use.",
				});
			}
			updateEmailTemplate.run(
				body.name.trim(),
				body.slug.trim(),
				body.subject.trim(),
				body.body,
				body.placeholders?.trim() ?? "",
				body.trigger?.trim() || "manual",
				body.recipient?.trim() || "customer",
				body.enabled === false ? 0 : 1,
				body.delayMinutes && body.delayMinutes > 0
					? Math.floor(body.delayMinutes)
					: 0,
				id,
			);
			flash(c, "Template updated.");
			return page.redirect("/email");
		},
	);

	app.delete(
		"/email/templates/:id",
		requireRole("admin"),
		requirePermission("email.update"),
		(c) => {
			const id = Number(c.req.param("id"));
			deleteEmailTemplateById.run(id);
			if (c.var.sessionToken)
				setFlash(c.var.sessionToken, { success: "Template deleted." });
			return c.var.inertia.redirect("/email");
		},
	);

	// Preview: render the template with sample placeholder data (fetch, JSON).
	app.get("/email/templates/:id/preview", requireRole("admin"), (c) => {
		const row = findEmailTemplateById.get(Number(c.req.param("id")));
		if (!row) return c.json({ error: "Template not found." }, 404);
		const data: Record<string, string> = {};
		for (const key of parsePlaceholders(row.placeholders))
			data[key] = sampleValue(key);
		return c.json({
			subject: renderTemplate(row.subject, data),
			body: renderTemplate(row.body, data),
		});
	});

	// Test-send a template to an address with sample data (fetch, JSON).
	app.post("/email/templates/:id/test", requireRole("admin"), async (c) => {
		const row = findEmailTemplateById.get(Number(c.req.param("id")));
		if (!row) return c.json({ ok: false, error: "Template not found." }, 404);
		const body = (await c.req.json().catch(() => null)) as {
			to?: string;
		} | null;
		if (!body?.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
			return c.json(
				{ ok: false, error: "A valid recipient email is required." },
				422,
			);
		}
		const data: Record<string, string> = {};
		for (const key of parsePlaceholders(row.placeholders))
			data[key] = sampleValue(key);
		try {
			await sendMail({
				to: body.to,
				subject: renderTemplate(row.subject, data),
				text: renderTemplate(row.body, data),
			});
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
	});

	return app;
};

function flash(c: import("hono").Context<AppEnv>, message: string): void {
	if (c.var.sessionToken) setFlash(c.var.sessionToken, { success: message });
}
