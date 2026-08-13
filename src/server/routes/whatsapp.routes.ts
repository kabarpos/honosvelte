/**
 * WhatsApp Management routes (PRD Modul 12): admin provider configuration +
 * WhatsApp template CRUD, plus the Dripsender.id webhook receiver.
 *
 * The active provider + API key resolve from the `settings` table (see
 * whatsapp.ts resolveWhatsAppConfig), with DRIPSENDER_API_KEY as env
 * fallback. This surface exposes the active provider, lets admins edit the
 * configuration, run a test send, manage templates, and receive inbound
 * messages via the webhook.
 *
 * Page renders (GET) and form actions (POST/PATCH/DELETE) live together, one
 * file per URL (AGENTS.md "Route conventions").
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requirePermission, requireRole, setFlash } from "../auth";
import {
	deleteWhatsAppTemplateById,
	findWhatsAppTemplateById,
	findWhatsAppTemplateBySlug,
	insertWhatsAppMessage,
	insertWhatsAppTemplate,
	listWhatsAppTemplates,
	updateWhatsAppTemplate,
} from "../db";
import {
	resolveWhatsAppConfig,
	sendWhatsApp,
	resolveIntegrationUrl,
	parsePlaceholders,
	renderTemplate,
} from "../whatsapp";
import { recordActivity } from "../activity";
import { getSetting, setSetting } from "../settings";
import { config } from "../config";
import type { AppEnv } from "../inertia-middleware";
import type { WhatsAppTemplate } from "../../shared/types";
import { validateJson } from "../validation";

/** Sample value for a placeholder, used in preview/test rendering. */
function sampleValue(key: string): string {
	const k = key.toLowerCase();
	if (k.includes("name")) return "Jane Doe";
	if (k.includes("phone")) return "6281399999999";
	if (k.includes("message") || k.includes("text"))
		return "Thanks for reaching out!";
	if (k.includes("link") || k.includes("url"))
		return "https://example.com/welcome";
	if (k.includes("date")) return new Date().toLocaleDateString();
	return `Sample ${key}`;
}

function toTemplate(row: {
	id: number;
	name: string;
	slug: string;
	body: string;
	mediaUrl: string;
	placeholders: string;
	trigger: string;
	recipient: string;
	enabled: number;
	delayMinutes: number;
	createdAt: string;
	updatedAt: string;
}): WhatsAppTemplate {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		body: row.body,
		mediaUrl: row.mediaUrl ? row.mediaUrl : null,
		placeholders: parsePlaceholders(row.placeholders),
		trigger: (row.trigger as WhatsAppTemplate["trigger"]) || "manual",
		recipient: (row.recipient as WhatsAppTemplate["recipient"]) || "customer",
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
		body: t.String({ minLength: 1, maxLength: 20000 }),
		mediaUrl: t.Optional(t.String({ maxLength: 2000 })),
		placeholders: t.Optional(t.String({ maxLength: 2000 })),
		trigger: t.Optional(
			t.String({ enum: ["manual", "on_register", "on_contact", "on_order"] }),
		),
		recipient: t.Optional(t.String({ enum: ["customer", "admin"] })),
		enabled: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);

type TemplateBody = Static<typeof templateBody>;

/** Friendly per-field messages mapped by TypeBox path. */
export const WHATSAPP_VALIDATION_MESSAGES: Record<string, string> = {
	"/name": "Name must be at least 2 characters.",
	"/slug": "Slug must be lowercase letters, numbers, or hyphens.",
	"/body": "Body is required.",
	"/mediaUrl": "Media URL is too long.",
	"/placeholders": "Placeholders list is too long.",
	"/trigger": "Trigger must be manual, on_register, on_contact, or on_order.",
	"/recipient": "Recipient must be customer or admin.",
};

export const whatsappRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get(
		"/whatsapp",
		requireRole("admin"),
		requirePermission("whatsapp.read"),
		(c) => {
			const cfg = resolveWhatsAppConfig();
			return c.var.inertia.render("WhatsApp", {
				// The API key is sent to the (admin-only) client so the form can show
				// that a key is already set, with a reveal/concat toggle. An empty
				// submit still preserves the stored secret (see POST /whatsapp/config).
				whatsapp: {
					provider: cfg.driver,
					apiKey: cfg.apiKey,
					adminNotifyNumber: getSetting("whatsapp.admin_notify_number") ?? "",
					integrationUrl: resolveIntegrationUrl(),
				},
				templates: listWhatsAppTemplates.all().map(toTemplate),
				// Absolute URL for admins to paste into Dripsender's "Bot" menu.
				webhookUrl: `${config.appUrl}/whatsapp/webhook`,
			});
		},
	);

	// Save the provider configuration (Modul 12). A fetch-driven JSON action
	// (not an Inertia request), mirroring /whatsapp/test.
	app.post(
		"/whatsapp/config",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		async (c) => {
			const raw = (await c.req.json().catch(() => null)) as Record<
				string,
				unknown
			> | null;
			if (!raw || typeof raw !== "object")
				return c.json({ error: "Malformed JSON body." }, 400);
			const provider = String(raw.provider ?? "");
			const apiKey = String(raw.api_key ?? "");
			const integrationUrl = String(raw.integration_url ?? "");
			const adminNotifyNumber = String(raw.admin_notify_number ?? "").trim();
			if (!["dripsender", "log"].includes(provider))
				return c.json({ error: "Invalid provider." }, 422);
			if (integrationUrl !== "" && !/^https?:\/\//i.test(integrationUrl))
				return c.json(
					{ error: "Integration URL must start with http(s)." },
					422,
				);
			if (adminNotifyNumber !== "" && !/^\+?\d{6,}$/.test(adminNotifyNumber))
				return c.json({ error: "Admin number must be a phone number." }, 422);
			setSetting("whatsapp.provider", provider);
			// An empty key submit keeps the previously stored secret.
			if (apiKey !== "") setSetting("whatsapp.api_key", apiKey);
			// An empty integration URL clears the stored value.
			setSetting("whatsapp.integration_url", integrationUrl);
			// An empty admin number clears the stored value.
			setSetting("whatsapp.admin_notify_number", adminNotifyNumber);
			const user = c.var.user;
			if (user)
				recordActivity(
					c,
					user.id,
					"settings.update",
					"Updated WhatsApp configuration",
				);
			return c.json({ ok: true });
		},
	);

	// Dedicated create page (no modal).
	app.get(
		"/whatsapp/templates/create",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		(c) => c.var.inertia.render("WhatsAppTemplate", { template: null }),
	);

	// Dedicated edit page (no modal).
	app.get(
		"/whatsapp/templates/:id/edit",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		(c) => {
			const row = findWhatsAppTemplateById.get(Number(c.req.param("id")));
			if (!row) return c.redirect("/whatsapp");
			return c.var.inertia.render("WhatsAppTemplate", {
				template: toTemplate(row),
			});
		},
	);

	// Send a one-off test WhatsApp via the active provider (PRD: test send).
	app.post(
		"/whatsapp/test",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		async (c) => {
			const body = (await c.req.json().catch(() => null)) as {
				phone?: string;
				text?: string;
				mediaUrl?: string;
			} | null;
			const phone = body?.phone?.trim() ?? "";
			// E.164-ish without "+": digits, at least 8 chars (country + number).
			if (!/^\d{8,}$/.test(phone.replace(/\D/g, ""))) {
				return c.json(
					{ ok: false, error: "A valid recipient phone is required." },
					422,
				);
			}
			try {
				await sendWhatsApp({
					phone: phone.replace(/\D/g, ""),
					text: body?.text?.trim() || "Honosvelte WhatsApp test",
					mediaUrl: body?.mediaUrl?.trim() || undefined,
				});
				if (c.var.sessionToken)
					setFlash(c.var.sessionToken, {
						success: `Test message sent to ${phone}.`,
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
		"/whatsapp/templates",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		validateJson(templateBody),
		(c) => {
			const body = c.req.valid("json") as TemplateBody;
			const page = c.var.inertia;
			if (findWhatsAppTemplateBySlug.get(body.slug)) {
				return page.error("WhatsAppTemplate", {
					slug: "That slug is already in use.",
				});
			}
			insertWhatsAppTemplate.run(
				body.name.trim(),
				body.slug.trim(),
				body.body,
				body.mediaUrl?.trim() ?? "",
				body.placeholders?.trim() ?? "",
				body.trigger?.trim() || "manual",
				body.recipient?.trim() || "customer",
				body.enabled === false ? 0 : 1,
				0,
			);
			flash(c, "Template created.");
			return page.redirect("/whatsapp");
		},
	);

	app.patch(
		"/whatsapp/templates/:id",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		validateJson(templateBody),
		(c) => {
			const id = Number(c.req.param("id"));
			const body = c.req.valid("json") as TemplateBody;
			const page = c.var.inertia;
			const existing = findWhatsAppTemplateById.get(id);
			if (!existing) return c.redirect("/whatsapp");
			const clash = findWhatsAppTemplateBySlug.get(body.slug);
			if (clash && clash.id !== id) {
				return page.error("WhatsAppTemplate", {
					slug: "That slug is already in use.",
				});
			}
			updateWhatsAppTemplate.run(
				body.name.trim(),
				body.slug.trim(),
				body.body,
				body.mediaUrl?.trim() ?? "",
				body.placeholders?.trim() ?? "",
				body.trigger?.trim() || "manual",
				body.recipient?.trim() || "customer",
				body.enabled === false ? 0 : 1,
				0,
				id,
			);
			flash(c, "Template updated.");
			return page.redirect("/whatsapp");
		},
	);

	app.delete(
		"/whatsapp/templates/:id",
		requireRole("admin"),
		requirePermission("whatsapp.update"),
		(c) => {
			const id = Number(c.req.param("id"));
			deleteWhatsAppTemplateById.run(id);
			if (c.var.sessionToken)
				setFlash(c.var.sessionToken, { success: "Template deleted." });
			return c.var.inertia.redirect("/whatsapp");
		},
	);

	// Preview: render the template with sample placeholder data (fetch, JSON).
	app.get("/whatsapp/templates/:id/preview", requireRole("admin"), (c) => {
		const row = findWhatsAppTemplateById.get(Number(c.req.param("id")));
		if (!row) return c.json({ error: "Template not found." }, 404);
		const data: Record<string, string> = {};
		for (const key of parsePlaceholders(row.placeholders))
			data[key] = sampleValue(key);
		return c.json({
			body: renderTemplate(row.body, data),
			mediaUrl: row.mediaUrl || "",
		});
	});

	// Test-send a template to a phone with sample data (fetch, JSON).
	app.post("/whatsapp/templates/:id/test", requireRole("admin"), async (c) => {
		const row = findWhatsAppTemplateById.get(Number(c.req.param("id")));
		if (!row) return c.json({ ok: false, error: "Template not found." }, 404);
		const body = (await c.req.json().catch(() => null)) as {
			phone?: string;
		} | null;
		const phone = body?.phone?.trim() ?? "";
		if (!/^\d{8,}$/.test(phone.replace(/\D/g, ""))) {
			return c.json(
				{ ok: false, error: "A valid recipient phone is required." },
				422,
			);
		}
		const data: Record<string, string> = {};
		for (const key of parsePlaceholders(row.placeholders))
			data[key] = sampleValue(key);
		try {
			await sendWhatsApp({
				phone: phone.replace(/\D/g, ""),
				text: renderTemplate(row.body, data),
				mediaUrl: row.mediaUrl || undefined,
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

	// Dripsender webhook receiver (public, no session). Dripsender POSTs JSON
	// { phone, id, jid, text, name, timestamp } on inbound messages. It carries
	// no browser Origin, so the CSRF origin check in security.ts lets it through.
	// Optionally auto-replies with a configured template when enabled.
	app.post("/whatsapp/webhook", async (c) => {
		const raw = (await c.req.json().catch(() => null)) as Record<
			string,
			unknown
		> | null;
		if (!raw || typeof raw !== "object")
			return c.json({ error: "Malformed JSON." }, 400);
		const phone = raw.phone != null ? String(raw.phone) : "";
		const text = raw.text != null ? String(raw.text) : "";
		if (!phone || !text)
			return c.json({ error: "phone and text are required." }, 400);

		insertWhatsAppMessage.run(
			raw.id != null ? String(raw.id) : null,
			String(phone),
			raw.jid != null ? String(raw.jid) : null,
			raw.name != null ? String(raw.name) : null,
			text,
			raw.timestamp != null ? String(raw.timestamp) : null,
		);
		recordActivity(
			c,
			null,
			"whatsapp.inbound",
			`Inbound WhatsApp from ${raw.name ? String(raw.name) : phone}`,
		);

		// Optional auto-reply from a configured template (Settings:
		// whatsapp.auto_reply + whatsapp.auto_reply_slug).
		const autoSlug = getSetting("whatsapp.auto_reply_slug");
		if (getSetting("whatsapp.auto_reply") === "true" && autoSlug) {
			const tpl = findWhatsAppTemplateBySlug.get(autoSlug);
			if (tpl) {
				const data: Record<string, string> = {
					name: raw.name != null ? String(raw.name) : "",
					phone: String(phone),
					message: text,
					text,
				};
				const reply = renderTemplate(tpl.body, data);
				if (reply.trim()) {
					await sendWhatsApp({
						phone: String(phone).replace(/\D/g, ""),
						text: reply,
						mediaUrl: tpl.mediaUrl || undefined,
					}).catch(() => {});
					return c.json({ reply: true, text: reply });
				}
			}
		}
		return c.json({ ok: true });
	});

	return app;
};

function flash(c: import("hono").Context<AppEnv>, message: string): void {
	if (c.var.sessionToken) setFlash(c.var.sessionToken, { success: message });
}
