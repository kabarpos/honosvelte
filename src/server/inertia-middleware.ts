/**
 * Inertia middleware: resolves the session per request and exposes the
 * Inertia adapter as a typed context variable (Hono `Variables`).
 *
 * Registered once on the app instance. Unlike Elysia 1.4 (where plugins
 * without routes dropped their hooks and store population had to be
 * re-registered per route instance), Hono middleware attached with
 * `app.use()` runs for every request — including unmatched routes — so the
 * not-found/error handlers can rely on `c.var.inertia` being populated.
 */
import type { Next } from "hono";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { FlashData, User } from "../shared/types";
import { readFlash, resolveUser, SESSION_COOKIE } from "./auth";
import { countUnreadNotifications, toPublicUser } from "./db";
import { getPublicSettings } from "./settings";
import { safeUrl } from "./url";
import { Inertia, type InertiaAssets } from "./inertia";

/** Context variables shared by every route/middleware. */
export interface AppEnv {
	Variables: {
		user: User | null;
		flash: FlashData;
		sessionToken: string | null;
		inertia: Inertia;
		requestId: string;
		/** Effective permission slugs, memoized per request (PERF-05: guards
		 *  must not re-resolve the user / re-query role+override sets). */
		permissions: Set<string> | null;
	};
}

export const inertiaMiddleware =
	(assets: InertiaAssets) => async (c: Context<AppEnv>, next: Next) => {
		const { pathname } = safeUrl(c.req.url);
		// PERF-05: static assets and health probes never need the session —
		// skip the user/session/settings DB work entirely. The Inertia
		// adapter is still populated (empty settings) so onError/notFound
		// handlers can rely on c.var.inertia for these paths too.
		if (
			pathname === "/health" ||
			pathname.startsWith("/health/") ||
			pathname.startsWith("/assets/")
		) {
			c.set("user", null);
			c.set("flash", {});
			c.set("sessionToken", null);
			c.set("permissions", null);
			c.set(
				"inertia",
				new Inertia(
					{
						request: c.req.raw,
						headers: Object.fromEntries(c.req.raw.headers.entries()),
						user: null,
						flash: {},
						sessionToken: null,
						settings: {},
						unreadNotifications: 0,
					},
					assets,
				),
			);
			await next();
			return;
		}

		const raw = getCookie(c, SESSION_COOKIE);
		const sessionToken = typeof raw === "string" && raw.length > 0 ? raw : null;
		const row = resolveUser(sessionToken);
		const user = row ? toPublicUser(row) : null;
		const flash = readFlash(sessionToken);
		c.set("user", user);
		c.set("flash", flash);
		c.set("sessionToken", sessionToken);
		c.set("permissions", null); // computed lazily by the first guard (PERF-05)
		// UX-04: the header bell badge needs a real unread count. Only admins
		// see the bell (notifications.read), so the extra indexed COUNT query
		// is bounded to admin traffic only — regular users and guests pay
		// nothing.
		const isAdminSurface =
			user !== null && (user.role === "super_admin" || user.role === "admin");
		const unreadNotifications = isAdminSurface
			? (countUnreadNotifications.get(user.id)?.n ?? 0)
			: 0;
		c.set(
			"inertia",
			new Inertia(
				{
					request: c.req.raw,
					headers: Object.fromEntries(c.req.raw.headers.entries()),
					user,
					flash,
					sessionToken,
					// App-wide settings for the shared props + HTML shell (cached).
					settings: Object.fromEntries(getPublicSettings()),
					unreadNotifications,
				},
				assets,
			),
		);
		await next();
	};
