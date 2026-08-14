/**
 * Auth routes: register / login / logout / forgot-password / reset-password —
 * page renders (GET) and form actions (POST) for the auth flow live together.
 * Schema validation maps to 422 page payloads (see server/app.ts).
 * Auth endpoints are rate-limited (brute-force protection).
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import {
	clearSessionCookie,
	createPasswordReset,
	createSession,
	deleteSessionByToken,
	guestOnly,
	hashPassword,
	requireAuth,
	setFlash,
	setSessionCookie,
	verifyPassword,
	consumePasswordReset,
} from "../auth";
import { config } from "../config";
import {
	createUser,
	deleteSessionsByUserId,
	findUserByEmail,
	updateUserPassword,
} from "../db";
import { recordActivity } from "../activity";
import type { AppEnv } from "../inertia-middleware";
import { sendMail } from "../mailer";
import { pushLead, dispatchTrigger } from "../whatsapp";
import { dispatchEmailTrigger } from "../mailer";
import { rateLimit } from "../rate-limit";
import { validateJson } from "../validation";

// `additionalProperties: false` keeps the strict-by-default behavior Elysia's
// TypeBox wrapper had (plain @sinclair/typebox allows extra props).
const registerBody = t.Object(
	{
		name: t.String({ minLength: 2, maxLength: 80 }),
		email: t.String({ format: "email" }),
		password: t.String({ minLength: 8, maxLength: 72 }),
		whatsapp: t.Optional(t.String({ maxLength: 20 })),
	},
	{ additionalProperties: false },
);
const loginBody = t.Object(
	{
		email: t.String({ format: "email" }),
		password: t.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);
const forgotPasswordBody = t.Object(
	{ email: t.String({ format: "email" }) },
	{ additionalProperties: false },
);
const resetPasswordBody = t.Object(
	{
		email: t.String({ format: "email" }),
		token: t.String({ minLength: 1 }),
		password: t.String({ minLength: 8, maxLength: 72 }),
		passwordConfirmation: t.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

type RegisterBody = Static<typeof registerBody>;
type LoginBody = Static<typeof loginBody>;
type ForgotPasswordBody = Static<typeof forgotPasswordBody>;
type ResetPasswordBody = Static<typeof resetPasswordBody>;

/** One-shot notice shown on the login page after redirects with ?notice=. */
const LOGIN_NOTICES: Record<string, string> = {
	password_reset: "Your password has been updated. Please sign in.",
	google_failed: "Google sign-in failed. Please try again or use email.",
};

/**
 * Friendly per-field messages. TypeBox surfaces raw messages (e.g. "Expected
 * string length greater or equal to 2"), so we map by the failing field path.
 */
export const VALIDATION_MESSAGES: Record<string, string> = {
	"/name": "Name must be at least 2 characters.",
	"/email": "Enter a valid email address.",
	"/password": "Password must be at least 8 characters.",
	"/passwordConfirmation": "Confirm your password.",
	"/token": "The reset token is missing.",
	"/whatsapp": "WhatsApp number must be at most 20 characters.",
};

export const authRoutes = () => {
	const app = new Hono<AppEnv>();

	// Brute-force protection on credential SUBMISSION only. Path-scoped AND
	// attached to the POST handlers: the app is mounted at "/", so an
	// unscoped app.use() would rate-limit EVERY request in the app
	// (settings, media, pages…) to 10/60s per IP, and a path-scoped
	// app.use() would also throttle GET page views.
	const limitAuth = rateLimit({
		max: config.rateLimit.authMax,
		windowSeconds: config.rateLimit.authWindow,
	});

	app.get("/login", guestOnly, (c) => {
		const noticeParam = c.req.query("notice");
		return c.var.inertia.render("Login", {
			googleEnabled: Boolean(config.google.clientId),
			notice: noticeParam ? (LOGIN_NOTICES[noticeParam] ?? null) : null,
		});
	});
	app.get("/register", guestOnly, (c) =>
		c.var.inertia.render("Register", {
			googleEnabled: Boolean(config.google.clientId),
		}),
	);
	app.get("/forgot-password", guestOnly, (c) =>
		c.var.inertia.render("ForgotPassword"),
	);
	app.get("/reset-password", guestOnly, (c) =>
		c.var.inertia.render("ResetPassword", {
			email: c.req.query("email") ?? "",
			token: c.req.query("token") ?? "",
		}),
	);

	app.post("/register", limitAuth, validateJson(registerBody), async (c) => {
		const body = c.req.valid("json") as RegisterBody;
		const page = c.var.inertia;
		if (findUserByEmail.get(body.email)) {
			return page.error("Register", {
				email: "That email is already registered.",
			});
		}
		const passwordHash = await hashPassword(body.password);
		const user = createUser.get(
			body.name,
			body.email,
			passwordHash,
			body.whatsapp?.trim() || null,
		);
		if (!user)
			return page.error("Register", {
				email: "Could not create your account.",
			});
		// Rotate the session cookie if one exists (session fixation defense).
		if (c.var.sessionToken) deleteSessionByToken(c.var.sessionToken);
		const session = createSession(user.id);
		setSessionCookie(c, session.token, session.expiresAt);
		recordActivity(c, user.id, "register", `Account created`);
		// Best-effort: feed the new contact into the Dripsender WhatsApp audience
		// via its integration webhook (Modul 12 lead capture). Never blocks or
		// fails registration if Dripsender is unreachable.
		if (body.whatsapp?.trim()) {
			pushLead({ name: body.name, phone: body.whatsapp.trim() }).catch(
				() => {},
			);
		}
		// Best-effort: fire any WhatsApp templates bound to registration.
		await dispatchTrigger("on_register", {
			name: body.name,
			phone: body.whatsapp?.trim() || undefined,
			email: body.email,
		}).catch(() => {});
		// Best-effort: fire any email templates bound to registration.
		await dispatchEmailTrigger("on_register", {
			name: body.name,
			email: body.email,
		}).catch(() => {});
		return page.redirect("/dashboard");
	});

	app.post("/login", limitAuth, validateJson(loginBody), async (c) => {
		const body = c.req.valid("json") as LoginBody;
		const page = c.var.inertia;
		const user = findUserByEmail.get(body.email);
		const passwordValid = user
			? await verifyPassword(body.password, user.passwordHash)
			: false;
		if (!user || !passwordValid || user.status !== "active") {
			return page.error("Login", {
				email: "These credentials do not match our records.",
			});
		}
		// Rotate the session cookie if one exists (session fixation defense).
		if (c.var.sessionToken) deleteSessionByToken(c.var.sessionToken);
		const session = createSession(user.id);
		setSessionCookie(c, session.token, session.expiresAt);
		setFlash(session.token, { success: `Welcome back, ${user.name}!` });
		recordActivity(c, user.id, "login", `Signed in as ${user.name}`);
		return page.redirect("/dashboard");
	});

	app.post("/logout", requireAuth, (c) => {
		const user = c.var.user;
		if (user) recordActivity(c, user.id, "logout", `Signed out`);
		if (c.var.sessionToken) deleteSessionByToken(c.var.sessionToken);
		clearSessionCookie(c);
		return c.var.inertia.redirect("/login");
	});

	app.post(
		"/forgot-password",
		limitAuth,
		validateJson(forgotPasswordBody),
		async (c) => {
			const body = c.req.valid("json") as ForgotPasswordBody;
			// Always answer the same way (no user enumeration); the reset email
			// is only sent when the account exists.
			const user = findUserByEmail.get(body.email);
			if (user) {
				const token = createPasswordReset(user.email);
				const link = `${config.appUrl}/reset-password?email=${encodeURIComponent(user.email)}&token=${token}`;
				await sendMail({
					to: user.email,
					subject: "Reset your password",
					text: `Reset your password:\n${link}\n\nThis link expires in 60 minutes.`,
					html: `<p>We received a request to reset your password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 60 minutes. If you did not request this, you can ignore this email.</p>`,
				}).catch((err) =>
					console.error("[mail] failed to send reset email:", err),
				);
			}
			return c.var.inertia.render("ForgotPassword", { status: "sent" });
		},
	);

	app.post(
		"/reset-password",
		limitAuth,
		validateJson(resetPasswordBody),
		async (c) => {
			const body = c.req.valid("json") as ResetPasswordBody;
			const page = c.var.inertia;
			if (body.password !== body.passwordConfirmation) {
				return page.error("ResetPassword", {
					password: "Password confirmation does not match.",
				});
			}
			const user = findUserByEmail.get(body.email);
			const valid = user ? consumePasswordReset(user.email, body.token) : false;
			if (!user || !valid) {
				return page.error("ResetPassword", {
					token: "This reset link is invalid or has expired.",
				});
			}
			const passwordHash = await hashPassword(body.password);
			updateUserPassword.run(passwordHash, user.id);
			deleteSessionsByUserId.run(user.id);
			recordActivity(c, user.id, "password.reset", "Password reset completed");

			return page.redirect("/login?notice=password_reset");
		},
	);

	return app;
};
