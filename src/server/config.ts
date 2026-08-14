/**
 * Centralised, validated configuration. Reads process.env once at startup
 * and fails fast with a clear message when the active setup is incomplete
 * (e.g. MAIL_DRIVER=resend without RESEND_API_KEY).
 *
 * Note: tests override env vars before importing modules, so config is
 * always derived fresh per process.
 */
export type MailDriver = "log" | "resend" | "mailtrap" | "smtp";
export type Role = "user" | "admin";

const pick = <T>(value: T | undefined, fallback: T): T =>
	value === undefined || value === "" ? fallback : value;

const problems: string[] = [];

const mailDriver = (
	process.env.MAIL_DRIVER ?? "log"
).toLowerCase() as MailDriver;
if (!["log", "resend", "mailtrap", "smtp"].includes(mailDriver)) {
	problems.push(
		`MAIL_DRIVER must be one of log|smtp|resend|mailtrap (got "${mailDriver}")`,
	);
}
const resendApiKey = process.env.RESEND_API_KEY ?? "";
const mailtrapToken = process.env.MAILTRAP_API_TOKEN ?? "";
const dripsenderApiKey = process.env.DRIPSENDER_API_KEY ?? "";
const dripsenderIntegrationUrl = process.env.DRIPSENDER_INTEGRATION_URL ?? "";
const whatsappWebhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET ?? "";
const isProd = process.env.NODE_ENV === "production";
const smtpInsecureTls = process.env.MAIL_TLS_INSECURE === "true";
if (smtpInsecureTls && isProd) {
	problems.push("MAIL_TLS_INSECURE cannot be enabled in production");
}

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
	problems.push(
		"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together (Google OAuth stays disabled otherwise)",
	);
}

/**
 * Comma-separated proxy networks (IP or IPv4 CIDR) trusted to set
 * `X-Forwarded-For`. Empty (default) = header never trusted; set this when
 * deploying behind a reverse proxy so rate limits key on the real client IP.
 */
const trustedProxyRaw = process.env.TRUSTED_PROXY ?? "";
const trustedProxies = trustedProxyRaw
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
const CIDR_OR_IP =
	/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/;
for (const entry of trustedProxies) {
	if (!CIDR_OR_IP.test(entry)) {
		problems.push(`TRUSTED_PROXY entry "${entry}" is not a valid IP or CIDR`);
	}
}

if (problems.length > 0) {
	throw new Error(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
}

export const config = {
	isProd,
	port: Number(pick(process.env.PORT, "4000")),
	/** Absolute base URL — used for email links and OAuth redirect URIs. */
	appUrl: pick(process.env.APP_URL, "http://localhost:4000").replace(
		/\/+$/,
		"",
	),
	/** Retention window for the activity log in days (0 = keep forever).
	 *  Old entries are purged by the periodic cleanup sweep (PERF-06). */
	activityRetentionDays: Number(
		pick(process.env.ACTIVITY_RETENTION_DAYS, "90"),
	),
	/** Retention window for in-app notifications in days (0 = keep forever).
	 *  Off by default — notification fan-out is a business decision.
	 *  Contact-message retention is intentionally not configurable here:
	 *  inbox data is business-critical and must not be auto-deleted. */
	notificationRetentionDays: Number(
		pick(process.env.NOTIFICATION_RETENTION_DAYS, "0"),
	),
	/** Networks trusted to set X-Forwarded-For (rate-limit client key). */
	trustedProxies,
	/** Bounded JSON body for validated routes (bytes). */
	requestBodyLimit: Number(pick(process.env.REQUEST_BODY_LIMIT, "100000")),
	dbPath: pick(process.env.DATABASE_PATH, "./data/app.sqlite"),
	upload: {
		/** Directory where tus upload chunks are stored on disk. */
		dir: pick(process.env.UPLOAD_DIR, "./data/uploads"),
		/** Maximum total upload size in bytes (Tus-Max-Size). */
		maxSize: Number(pick(process.env.TUS_MAX_SIZE, "52428800")),
		/** Maximum bytes in a single tus PATCH chunk (per-chunk bound). */
		chunkMax: Number(pick(process.env.TUS_CHUNK_MAX, "5242880")),
		/** Seconds after which an unfinished upload may be swept (Expiration). */
		expirationSeconds: Number(
			pick(process.env.TUS_EXPIRATION_SECONDS, "86400"),
		),
	},
	media: {
		/** Directory where media library files are stored on disk. */
		dir: pick(process.env.MEDIA_DIR, "./data/media"),
	},
	mail: {
		driver: mailDriver,
		from: pick(process.env.MAIL_FROM, "no-reply@example.com"),
		resendApiKey,
		mailtrapToken,
		mailtrapInboxId: process.env.MAILTRAP_INBOX_ID ?? "",
		/** Development-only opt-in: allow self-signed SMTP certificates. */
		smtpInsecureTls,
	},
	google: {
		clientId: googleClientId || null,
		clientSecret: googleClientSecret || null,
	},
	rateLimit: {
		authMax: Number(pick(process.env.RATE_LIMIT_AUTH_MAX, "10")),
		authWindow: Number(pick(process.env.RATE_LIMIT_AUTH_WINDOW, "60")),
		webhookMax: Number(pick(process.env.RATE_LIMIT_WEBHOOK_MAX, "60")),
		webhookWindow: Number(pick(process.env.RATE_LIMIT_WEBHOOK_WINDOW, "60")),
		uploadMax: Number(pick(process.env.RATE_LIMIT_UPLOAD_MAX, "60")),
		uploadWindow: Number(pick(process.env.RATE_LIMIT_UPLOAD_WINDOW, "60")),
	},
	whatsapp: {
		apiKey: dripsenderApiKey,
		integrationUrl: dripsenderIntegrationUrl,
		webhookSecret: whatsappWebhookSecret,
	},
};
