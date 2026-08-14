/**
 * WhatsApp sender with a swappable provider (selected via the `settings`
 * store, overridable by the DRIPSENDER_API_KEY env var):
 *   - log:        record the message in `sentWhatsapp` (dev / tests), no
 *                 network call.
 *   - dripsender: https://dripsender.id — POST https://api.dripsender.id/send
 *                 with { api_key, phone, text, media_url? } (see DRIPSENDER.md).
 *
 * Mirrors mailer.ts: secrets resolve from `settings` (DB) first so admins can
 * configure the provider from the WhatsApp page without restarting the server.
 */
import { config } from "./config";
import { getSetting } from "./settings";
import { listWhatsAppTemplatesByTrigger } from "./db";
import { assertPublicHost } from "./ssrf";

export interface WhatsAppMessage {
	/** Recipient phone in international format without "+", e.g. 62813… */
	phone: string;
	text: string;
	/** Optional attachment link (Dripsender media_url). */
	mediaUrl?: string;
}

export type WhatsAppDriver = "dripsender" | "log";

/** The log driver records sent messages here (assertable in dev and tests). */
export const sentWhatsapp: WhatsAppMessage[] = [];

/** WhatsApp config resolved from settings (DB) with env values as fallback. */
export interface ResolvedWhatsAppConfig {
	driver: WhatsAppDriver;
	apiKey: string;
}

/** Read the active WhatsApp configuration, preferring the DB `settings` store. */
export function resolveWhatsAppConfig(): ResolvedWhatsAppConfig {
	const driver = (getSetting("whatsapp.provider") || "log") as WhatsAppDriver;
	return {
		driver,
		apiKey: getSetting("whatsapp.api_key") || config.whatsapp.apiKey,
	};
}

/** Send a WhatsApp message through the active provider. */
export async function sendWhatsApp(message: WhatsAppMessage): Promise<void> {
	const cfg = resolveWhatsAppConfig();
	if (cfg.driver === "log") {
		sentWhatsapp.push({
			phone: message.phone,
			text: message.text,
			mediaUrl: message.mediaUrl,
		});
		console.log(formatWhatsApp(message));
		return;
	}
	if (!cfg.apiKey) throw new Error("WhatsApp API key is not configured.");
	await assertPublicHost("api.dripsender.id");
	const res = await fetch("https://api.dripsender.id/send", {
		method: "POST",
		signal: AbortSignal.timeout(10_000),
		redirect: "manual",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			api_key: cfg.apiKey,
			phone: message.phone,
			text: message.text,
			...(message.mediaUrl ? { media_url: message.mediaUrl } : {}),
		}),
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Dripsender error ${res.status}: ${detail.slice(0, 200)}`);
	}
}

function formatWhatsApp(message: WhatsAppMessage): string {
	const media = message.mediaUrl ? `\n│ media:    ${message.mediaUrl}` : "";
	return [
		"┌─ whatsapp (log driver) ───────────────────────",
		`│ to:      ${message.phone}`,
		`│ ${message.text.replace(/\n/g, "\n│ ")}`,
		media,
		"└────────────────────────────────────────────────",
	].join("\n");
}

// --- Lead capture (Dripsender integration webhook) -----------------------
// Pushes a captured contact { name, phone } to the Dripsender integration
// webhook (the non-message companion to /send):
//   POST https://<subdomain>.dripsender.id:14942/api/integration/<uuid>
//        { "name": "…", "phone": "…" }
// This is how the app feeds new leads (e.g. registrations) into the WhatsApp
// audience. Mirrors sendWhatsApp: with no integration URL configured the
// record is kept in `pushedLeads` so dev/tests stay offline.

/** Contacts pushed to the integration webhook (assertable in dev and tests). */
export const pushedLeads: { name: string; phone: string }[] = [];

/** Integration webhook URL resolved from settings (DB) with env fallback. */
export function resolveIntegrationUrl(): string {
	return (
		getSetting("whatsapp.integration_url") || config.whatsapp.integrationUrl
	);
}

/** Only Dripsender integration hosts are valid server-side fetch targets. */
export function isAllowedIntegrationUrl(value: string): boolean {
	if (!value) return true;
	try {
		const url = new URL(value);
		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			(url.hostname === "dripsender.id" ||
				url.hostname.endsWith(".dripsender.id"))
		);
	} catch {
		return false;
	}
}

/** Push a captured lead (name + phone) to the Dripsender integration webhook. */
export async function pushLead(input: {
	name: string;
	phone: string;
}): Promise<void> {
	const phone = input.phone.replace(/\D/g, "");
	if (!phone) return; // nothing to push without a phone number
	const url = resolveIntegrationUrl();
	if (!url) {
		// Dev/test: no integration configured — record for observability.
		pushedLeads.push({ name: input.name, phone });
		return;
	}
	if (!isAllowedIntegrationUrl(url))
		throw new Error("Integration URL is not an allowed Dripsender host.");
	let targetUrl: URL;
	try {
		targetUrl = new URL(url);
	} catch {
		throw new Error("Integration URL is not a valid URL.");
	}
	await assertPublicHost(targetUrl.hostname);
	const res = await fetch(url, {
		method: "POST",
		signal: AbortSignal.timeout(10_000),
		redirect: "manual",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name: input.name, phone }),
	});
	if (!res.ok) {
		const detail = await res.text().then((text) => text.slice(0, 200)).catch(() => "");
		throw new Error(
			`Dripsender integration error ${res.status}: ${detail}`,
		);
	}
}

// --- Template triggers (Modul 12) ---------------------------------------
// Reusable helpers for rendering templates and dispatching them on events.

/** Split the stored token string into a clean placeholder list. */
export function parsePlaceholders(raw: string): string[] {
	return (raw ?? "")
		.split(/[,;]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Replace {{ token }} occurrences with values from `data` (missing → ''). */
export function renderTemplate(
	text: string,
	data: Record<string, string>,
): string {
	return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
		const value = data[key.trim()];
		return value === undefined ? "" : value;
	});
}

/** Events that can fire a WhatsApp template automatically. */
export type WhatsAppTrigger = "on_register" | "on_contact" | "on_order";

/**
 * Send every enabled template bound to `trigger`. `ctx` carries the data
 * available at the event (name, phone, email, …). Recipient resolution:
 *   - customer → ctx.phone (the actor's number)
 *   - admin    → the whatsapp.admin_notify_number setting
 * Best-effort: a single failed send never blocks the caller or the others.
 */
export async function dispatchTrigger(
	trigger: string,
	ctx: {
		name?: string;
		phone?: string;
		email?: string;
		[k: string]: string | undefined;
	},
): Promise<void> {
	for (const tpl of listWhatsAppTemplatesByTrigger.all(trigger)) {
		let phone: string | undefined;
		if (tpl.recipient === "admin") {
			phone = getSetting("whatsapp.admin_notify_number") || undefined;
		} else {
			phone = ctx.phone;
		}
		if (!phone) continue; // nothing to send to
		const data: Record<string, string> = {};
		for (const key of parsePlaceholders(tpl.placeholders)) {
			data[key] = (ctx as Record<string, string | undefined>)[key] ?? "";
		}
		// Always expose the common tokens for convenience.
		data.name = ctx.name ?? "";
		data.phone = phone;
		data.email = ctx.email ?? "";
		try {
			await sendWhatsApp({
				phone: phone.replace(/\D/g, ""),
				text: renderTemplate(tpl.body, data),
				mediaUrl: tpl.mediaUrl || undefined,
			});
		} catch (err) {
			console.error(`[whatsapp] trigger ${trigger} send failed:`, err);
		}
	}
}
