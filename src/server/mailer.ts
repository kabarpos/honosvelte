/**
 * Mailer with swappable drivers (selected via MAIL_DRIVER in .env, overridable
 * per-key through the `settings` table so admins can configure mail from the
 * Email page without restarting the server):
 *   - log:      print to console + record in `sentMails` (dev / tests)
 *   - smtp:     any RFC-compliant SMTP server (nodemailer) — 465 (implicit TLS)
 *               or 587 (STARTTLS)
 *   - resend:   https://resend.com  (RESEND_API_KEY)
 *   - mailtrap: https://mailtrap.io (MAILTRAP_API_TOKEN)
 * Zero dependencies except nodemailer for the SMTP transport.
 */
import { config } from "./config";
import { getSetting } from "./settings";
import { listEmailTemplatesByTrigger } from "./db";
import nodemailer from "nodemailer";
import type { MailDriver } from "./config";

export interface MailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

/** The log driver records sent mail here (assertable in dev and tests). */
export const sentMails: MailMessage[] = [];

/** Mail config resolved from settings (DB) with env values as fallback. */
export interface ResolvedMailConfig {
	driver: MailDriver;
	from: string;
	smtpHost: string;
	smtpPort: number;
	smtpUser: string;
	smtpPass: string;
	smtpSecure: boolean;
	resendApiKey: string;
	mailtrapToken: string;
	mailtrapInboxId: string;
}

/** Read the active mail configuration, preferring the DB `settings` store. */
export function resolveMailConfig(): ResolvedMailConfig {
	const driver = (getSetting("mail.driver") ||
		config.mail.driver) as MailDriver;
	return {
		driver,
		from: getSetting("mail.from") || config.mail.from,
		smtpHost: getSetting("mail.smtp_host") || "localhost",
		smtpPort: Number(getSetting("mail.smtp_port") || "587"),
		smtpUser: getSetting("mail.smtp_user") || "",
		smtpPass: getSetting("mail.smtp_pass") || "",
		smtpSecure: getSetting("mail.smtp_secure") === "true",
		resendApiKey: getSetting("mail.resend_api_key") || config.mail.resendApiKey,
		mailtrapToken:
			getSetting("mail.mailtrap_token") || config.mail.mailtrapToken,
		mailtrapInboxId:
			getSetting("mail.mailtrap_inbox_id") || config.mail.mailtrapInboxId,
	};
}

export async function sendMail(message: MailMessage): Promise<void> {
	const cfg = resolveMailConfig();
	switch (cfg.driver) {
		case "log":
			sentMails.push(message);
			console.log(formatMail(message));
			return;
		case "resend":
			await postJson("https://api.resend.com/emails", cfg.resendApiKey, {
				from: cfg.from,
				to: [message.to],
				subject: message.subject,
				text: message.text,
				html: message.html ?? message.text,
			});
			return;
		case "mailtrap": {
			const url = cfg.mailtrapInboxId
				? `https://sandbox.api.mailtrap.io/api/send/${cfg.mailtrapInboxId}`
				: "https://send.api.mailtrap.io/api/send";
			await postJson(url, cfg.mailtrapToken, {
				from: { email: cfg.from },
				to: [{ email: message.to }],
				subject: message.subject,
				text: message.text,
				html: message.html ?? message.text,
			});
			return;
		}
		case "smtp":
			await sendSmtp(message, cfg);
			return;
	}
}

async function sendSmtp(
	message: MailMessage,
	cfg: ResolvedMailConfig,
): Promise<void> {
	const transport = nodemailer.createTransport({
		host: cfg.smtpHost,
		port: cfg.smtpPort,
		secure: cfg.smtpSecure,
		auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
		// Self-signed / internal relays are common in dev — don't hard-fail TLS.
		tls: { rejectUnauthorized: false },
	});
	await transport.sendMail({
		from: cfg.from,
		to: message.to,
		subject: message.subject,
		text: message.text,
		html: message.html,
	});
}

async function postJson(
	url: string,
	token: string,
	body: unknown,
): Promise<void> {
	const res = await fetch(url, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(
			`Mail provider error ${res.status}: ${detail.slice(0, 200)}`,
		);
	}
}

function formatMail(message: MailMessage): string {
	const body = (message.html ?? message.text).replace(/\n/g, "\n│ ");
	return [
		"┌─ mail (log driver) ────────────────────────────",
		`│ to:      ${message.to}`,
		`│ subject: ${message.subject}`,
		`│ ${body}`,
		"└────────────────────────────────────────────────",
	].join("\n");
}

// --- Template triggers (Modul 11) ---------------------------------------
// Reusable helpers for rendering email templates and dispatching them on
// events. Mirrors the WhatsApp implementation in whatsapp.ts.

/** Split the stored token string into a clean placeholder list. */
export function parseEmailPlaceholders(raw: string): string[] {
	return (raw ?? "")
		.split(/[,;]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Replace {{ token }} occurrences with values from `data` (missing → ''). */
export function renderEmailTemplate(
	text: string,
	data: Record<string, string>,
): string {
	return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
		const value = data[key.trim()];
		return value === undefined ? "" : value;
	});
}

/** Events that can fire an email template automatically. */
export type EmailTrigger = "on_register" | "on_contact" | "on_order";

/**
 * Send every enabled template bound to `trigger`. `ctx` carries the data
 * available at the event (name, email, …). Recipient resolution:
 *   - customer → ctx.email (the actor's address)
 *   - admin    → the email.admin_notify_address setting
 * Best-effort: a single failed send never blocks the caller or the others.
 */
export async function dispatchEmailTrigger(
	trigger: string,
	ctx: {
		name?: string;
		email?: string;
		phone?: string;
		[k: string]: string | undefined;
	},
): Promise<void> {
	for (const tpl of listEmailTemplatesByTrigger.all(trigger)) {
		let to: string | undefined;
		if (tpl.recipient === "admin") {
			to = getSetting("email.admin_notify_address") || undefined;
		} else {
			to = ctx.email;
		}
		if (!to) continue; // nothing to send to
		const data: Record<string, string> = {};
		for (const key of parseEmailPlaceholders(tpl.placeholders)) {
			data[key] = (ctx as Record<string, string | undefined>)[key] ?? "";
		}
		// Always expose the common tokens for convenience.
		data.name = ctx.name ?? "";
		data.email = to;
		data.phone = ctx.phone ?? "";
		try {
			await sendMail({
				to,
				subject: renderEmailTemplate(tpl.subject, data),
				text: renderEmailTemplate(tpl.body, data),
			});
		} catch (err) {
			console.error(`[mail] trigger ${trigger} send failed:`, err);
		}
	}
}
