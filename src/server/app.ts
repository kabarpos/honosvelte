/**
 * App composition: logging → CSRF origin check → security headers →
 * compression → inertia session → routes → error/not-found handlers.
 * Middleware runs in registration order — global middleware must precede
 * the routes they cover.
 */
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { compress } from "./compress";
import { readFlash, resolveUser, SESSION_COOKIE } from "./auth";
import { serveAsset } from "./assets";
import { config } from "./config";
import { join } from "node:path";
import { migrationCount, pingDb, toPublicUser } from "./db";
import { getSettings } from "./settings";
import { Inertia, type InertiaAssets } from "./inertia";
import { inertiaMiddleware, type AppEnv } from "./inertia-middleware";
import { logError, requestLogger } from "./logger";
import { authRoutes, VALIDATION_MESSAGES } from "./routes/auth.routes";
import { activityRoutes } from "./routes/activity.routes";
import { billingRoutes } from "./routes/billing.routes";
import { googleOauthRoutes } from "./routes/google-oauth.routes";
import { mediaRoutes, MEDIA_VALIDATION_MESSAGES } from "./routes/media.routes";
import { pageRoutes } from "./routes/pages.routes";
import { permissionsRoutes } from "./routes/permissions.routes";
import { settingsRoutes } from "./routes/settings.routes";
import {
	contactRoutes,
	CONTACT_VALIDATION_MESSAGES,
} from "./routes/contact.routes";
import { emailRoutes, EMAIL_VALIDATION_MESSAGES } from "./routes/email.routes";
import {
	whatsappRoutes,
	WHATSAPP_VALIDATION_MESSAGES,
} from "./routes/whatsapp.routes";
import { notificationRoutes } from "./routes/notifications.routes";
import {
	profileRoutes,
	PROFILE_VALIDATION_MESSAGES,
} from "./routes/profile.routes";
import { rolesRoutes } from "./routes/roles.routes";
import { uploadsRoutes } from "./routes/uploads.routes";
import { usersRoutes, USERS_VALIDATION_MESSAGES } from "./routes/users.routes";
import { ROLES_VALIDATION_MESSAGES } from "./routes/roles.routes";
import { PERMISSIONS_VALIDATION_MESSAGES } from "./routes/permissions.routes";
import { checkOrigin } from "./security";
import { safeUrl } from "./url";
import { ValidationFailed } from "./validation";
import type { Context } from "hono";

/** Form routes whose schema-level validation maps back to an Inertia page. */
const COMPONENT_BY_PATH: Record<string, string> = {
	"/register": "Register",
	"/login": "Login",
	"/forgot-password": "ForgotPassword",
	"/reset-password": "ResetPassword",
	"/profile": "Profile",
	"/profile/password": "Profile",
	"/contact": "Contact",
	"/email": "Email",
	"/whatsapp": "WhatsApp",
};

function componentForPath(pathname: string): string | undefined {
	if (pathname === "/users" || pathname.startsWith("/users/")) return "Users";
	if (pathname === "/roles" || pathname.startsWith("/roles/")) return "Roles";
	if (pathname === "/permissions" || pathname.startsWith("/permissions/"))
		return "Permissions";
	if (pathname === "/media" || pathname.startsWith("/media/")) return "Media";
	if (pathname === "/billing" || pathname.startsWith("/billing/"))
		return "Billing";
	if (pathname === "/activity" || pathname.startsWith("/activity/"))
		return "Activity";
	// Exact match only: POST /settings/media is a JSON API (not an Inertia
	// page), so its validation errors must come back as plain JSON, not an
	// Inertia envelope (mirrors /profile/avatar).
	if (pathname === "/settings") return "Settings";
	if (pathname === "/contact") return "Contact";
	if (pathname === "/email" || pathname.startsWith("/email/templates"))
		return "Email";
	if (pathname === "/contact/inbox" || pathname.startsWith("/contact/inbox"))
		return "ContactInbox";
	if (pathname === "/notifications" || pathname.startsWith("/notifications"))
		return "NotificationCenter";
	if (pathname === "/whatsapp" || pathname.startsWith("/whatsapp/templates"))
		return "WhatsApp";
	return undefined;
}

const VALIDATION_MESSAGES_ALL = {
	...VALIDATION_MESSAGES,
	...PROFILE_VALIDATION_MESSAGES,
	...USERS_VALIDATION_MESSAGES,
	...ROLES_VALIDATION_MESSAGES,
	...PERMISSIONS_VALIDATION_MESSAGES,
	...MEDIA_VALIDATION_MESSAGES,
	...EMAIL_VALIDATION_MESSAGES,
	...WHATSAPP_VALIDATION_MESSAGES,
	...CONTACT_VALIDATION_MESSAGES,
};

const isUploadsPath = (pathname: string) =>
	pathname === "/uploads" || pathname.startsWith("/uploads/");

const UPLOADS_RE = /^\/uploads(\/|$)/;

/**
 * Build the Inertia adapter for error/not-found paths. The global
 * inertiaMiddleware has already run for every request, so `c.var.inertia`
 * is normally set; the fallback only covers exotic failures before it ran.
 */
function inertiaFromContext(
	c: Context<AppEnv>,
	assets: InertiaAssets,
): Inertia {
	const existing = c.get("inertia");
	if (existing) return existing;
	const raw = getCookie(c, SESSION_COOKIE);
	const sessionToken = typeof raw === "string" && raw.length > 0 ? raw : null;
	const row = resolveUser(sessionToken);
	return new Inertia(
		{
			request: c.req.raw,
			headers: Object.fromEntries(c.req.raw.headers.entries()),
			user: row ? toPublicUser(row) : null,
			flash: readFlash(sessionToken),
			sessionToken,
			settings: Object.fromEntries(getSettings()),
		},
		assets,
	);
}

export function createApp(assets: InertiaAssets) {
	const app = new Hono<AppEnv>();

	app.use(requestLogger);
	app.use(checkOrigin);
	// gzip-compress compressible responses (HTML/CSS/JS/JSON) above 1KB.
	// Custom zlib-based middleware — hono's built-in needs the CompressionStream
	// Web API, which is not reliably present in every Bun 1.3.14 context.
	app.use(compress());
	app.use(
		secureHeaders({
			xFrameOptions: "DENY",
			referrerPolicy: "strict-origin-when-cross-origin",
			permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
			// script-src/style-src 'unsafe-inline': Inertia embeds the page
			// payload as an inline <script type="application/json"> plus the
			// theme-boot script, and the progress bar injects inline styles.
			// For /uploads responses the content is attacker-controlled bytes
			// (served with a client-declared content-type) — script-src 'none'
			// blocks inline/external script execution there (stored-XSS guard;
			// a sandbox CSP can't be set per-path through secureHeaders).
			contentSecurityPolicy: {
				defaultSrc: ["'self'"],
				// Tracking vendors the admin can embed through the script.*
				// settings (Meta Pixel, TikTok, Google Ads, GA4): the official
				// snippet loaders + beacon/pixel endpoints. Admin-authored
				// snippets are trusted by definition; the allowlist still blocks
				// arbitrary third-party script hosts.
				scriptSrc: [
					(c) =>
						UPLOADS_RE.test(safeUrl(c.req.url).pathname)
							? "'none'"
							: "'self' 'unsafe-inline'" +
								" https://www.googletagmanager.com" +
								" https://connect.facebook.net" +
								" https://www.google-analytics.com" +
								" https://analytics.tiktok.com" +
								" https://www.googleadservices.com" +
								" https://googleads.g.doubleclick.net" +
								" https://td.doubleclick.net",
				],
				styleSrc: ["'self'", "'unsafe-inline'"],
				imgSrc: ["'self'", "data:", "https:"],
				fontSrc: ["'self'"],
				connectSrc: ["'self'", "https:"],
				frameAncestors: ["'none'"],
				baseUri: ["'self'"],
				formAction: ["'self'"],
			},
		}),
	);
	app.use(inertiaMiddleware(assets));

	app.onError(async (err, c) => {
		const pathname = safeUrl(c.req.url).pathname;

		if (err instanceof HTTPException) return err.getResponse();

		// Schema validation (TypeBox) → 422 with field errors, Inertia-aware.
		// Validation failures are expected client errors, not server failures;
		// keep them out of the error stack log.
		if (err instanceof ValidationFailed) {
			const component =
				COMPONENT_BY_PATH[pathname] ?? componentForPath(pathname);
			const errors: Record<string, string> = {};
			for (const item of err.errors) {
				const field = item.path.replace(/^\//, "");
				if (field && !errors[field])
					errors[field] = VALIDATION_MESSAGES_ALL[item.path] ?? item.message;
			}
			if (!component) return c.json({ errors }, 422);
			return inertiaFromContext(c, assets).error(component, errors);
		}

		logError(c, err);
		// tus endpoints speak JSON + tus headers, never Inertia pages.
		if (isUploadsPath(pathname)) {
			c.header("content-type", "application/json");
			c.header("Tus-Resumable", "1.0.0");
			return c.json({ error: "Internal Server Error" }, 500);
		}

		return c.text("Internal Server Error", 500);
	});

	app.notFound((c) => {
		const pathname = safeUrl(c.req.url).pathname;
		// Unmatched /uploads routes (e.g. PUT) stay JSON, not Inertia pages.
		if (isUploadsPath(pathname)) {
			return c.json({ error: "Not found" }, 404);
		}
		return inertiaFromContext(c, assets).render(
			"NotFound",
			{},
			{ status: 404 },
		);
	});

	app.get("/health/live", (c) =>
		c.json({ status: "ok", uptime: process.uptime() }),
	);
	// Readiness (OPS-02): DB reachable, migrations applied, and the upload
	// storage is writable. Returns 503 with the failing check otherwise.
	app.get("/health/ready", async (c) => {
		const checks: Record<string, string> = {};
		try {
			pingDb.get();
			checks.db = "ok";
		} catch {
			checks.db = "down";
		}
		try {
			// Migrations ran at startup (migrations.ts fails fast) — verify
			// the tracking table exists and has applied rows.
			const applied = (migrationCount.get() ?? { n: 0 }).n;
			checks.migrations = applied > 0 ? "ok" : "none";
		} catch {
			checks.migrations = "down";
		}
		try {
			const { mkdirSync, writeFileSync, rmSync } = await import(
				"node:fs"
			);
			mkdirSync(config.upload.dir, { recursive: true });
			const probe = join(config.upload.dir, `.probe-${process.pid}`);
			writeFileSync(probe, "ok");
			rmSync(probe, { force: true });
			checks.storage = "ok";
		} catch {
			checks.storage = "unwritable";
		}
		const ready = Object.values(checks).every((v) => v === "ok");
		return c.json(
			{ status: ready ? "ok" : "unavailable", checks },
			ready ? 200 : 503,
		);
	});
	// Backwards-compatible alias for orchestrators on the old path.
	app.get("/health", (c) => {
		pingDb.get();
		return c.json({ status: "ok", uptime: process.uptime() });
	});
	// Hono's tail wildcard produces no named param — derive the relative
	// path from c.req.path (see uploads.routes.ts for the same pattern).
	app.get("/assets/*", (c) => {
		const relPath = c.req.path.slice("/assets/".length);
		return serveAsset(relPath);
	});
	// Browser/DevTools well-known probes (e.g. Chrome DevTools JSON) —
	// return a plain 404 so they never reach the Inertia not-found handler.
	app.get("/.well-known/*", () => new Response(null, { status: 404 }));

	app.route("/uploads", uploadsRoutes());
	app.route("/", authRoutes());
	app.route("/", googleOauthRoutes());
	app.route("/", pageRoutes());
	app.route("/", profileRoutes());
	app.route("/", usersRoutes());
	app.route("/", rolesRoutes());
	app.route("/", permissionsRoutes());
	app.route("/", mediaRoutes());
	app.route("/", billingRoutes());
	app.route("/", activityRoutes());
	app.route("/", settingsRoutes());
	app.route("/", contactRoutes());
	app.route("/", emailRoutes());
	app.route("/", whatsappRoutes());
	app.route("/", notificationRoutes());

	return app;
}
