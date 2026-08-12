/**
 * Settings routes at /settings (PRD Modul 15): admin page that edits the
 * app-wide key-value settings grouped by category. Admin-only (role +
 * permission guards). Only keys listed in FIELD_META are rendered or
 * applied — the client cannot inject arbitrary keys.
 *
 * Media-valued settings (logos, favicon) travel through the tus protocol at
 * /uploads (see uploads.routes.ts): the client uploads the file, then POSTs
 * the upload id to /settings/media, which validates ownership + type and
 * stores the served path (`/uploads/<id>`) as the setting value.
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requirePermission, requireRole, setFlash } from "../auth";
import { allSettings, findUpload } from "../db";
import type { AppEnv } from "../inertia-middleware";
import type {
	SettingsGroup,
	SettingsItem,
	SettingsSelectOption,
} from "../../shared/types";
import { validateJson } from "../validation";
import { recordActivity } from "../activity";
import { setSetting } from "../settings";

/** Value limit covers script snippets (pixels/analytics can be a few KB). */
const settingsBody = t.Record(t.String(), t.String({ maxLength: 10000 }), {
	additionalProperties: false,
});

type SettingsBody = Static<typeof settingsBody>;

/** Keys whose value is a served media path, set via POST /settings/media. */
const MEDIA_KEYS = ["app.logo_light", "app.logo_dark", "app.favicon"] as const;

/** Raster-only like avatars: SVG can carry inline scripts, ico cannot. */
const MEDIA_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/x-icon",
	"image/vnd.microsoft.icon",
];

const CATEGORIES: { category: string; label: string }[] = [
	{ category: "general", label: "General" },
	{ category: "contact", label: "Contact" },
	{ category: "regional", label: "Regional" },
	{ category: "footer", label: "Footer" },
	{ category: "script", label: "Script" },
];

const LOCALE_OPTIONS: SettingsSelectOption[] = [
	{ value: "en", label: "English" },
	{ value: "id", label: "Indonesia" },
];

/** Real IANA timezone names (V8/Bun ship the full CLDR list). */
function timezoneOptions(): SettingsSelectOption[] {
	return Intl.supportedValuesOf("timeZone").map((tz) => ({
		value: tz,
		label: tz,
	}));
}

interface FieldMeta {
	category: string;
	label: string;
	kind: SettingsItem["kind"];
	options?: SettingsSelectOption[];
	hint?: string;
}

/** Display whitelist + shape per key (unknown keys never render or save). */
const FIELD_META: Record<string, FieldMeta> = {
	// General
	"app.name": { category: "general", label: "Application name", kind: "text" },
	"app.tagline": { category: "general", label: "Tagline", kind: "text" },
	"app.description": {
		category: "general",
		label: "Description",
		kind: "textarea",
		hint: "Short website description used by the landing page and meta tags.",
	},
	"app.logo_light": {
		category: "general",
		label: "Logo (light mode)",
		kind: "media",
		hint: "Used on light backgrounds. PNG, JPEG, GIF, WebP or ICO.",
	},
	"app.logo_dark": {
		category: "general",
		label: "Logo (dark mode)",
		kind: "media",
		hint: "Used on dark backgrounds. PNG, JPEG, GIF, WebP or ICO.",
	},
	"app.favicon": {
		category: "general",
		label: "Favicon",
		kind: "media",
		hint: "Browser tab icon. PNG, WebP or ICO.",
	},
	// Contact
	"contact.email": { category: "contact", label: "Email", kind: "text" },
	"contact.whatsapp": {
		category: "contact",
		label: "WhatsApp numbers",
		kind: "repeater",
		hint: "Every admin number — visitors can reach any of them.",
	},
	"contact.address": { category: "contact", label: "Address", kind: "text" },
	// Regional
	"regional.locale": {
		category: "regional",
		label: "Locale",
		kind: "select",
		options: LOCALE_OPTIONS,
	},
	"regional.timezone": {
		category: "regional",
		label: "Timezone",
		kind: "select",
		options: timezoneOptions(),
	},
	// Footer
	"footer.copyright": { category: "footer", label: "Copyright", kind: "text" },
	"footer.text": { category: "footer", label: "Footer text", kind: "textarea" },
	// Script
	"script.head": {
		category: "script",
		label: "Head script",
		kind: "textarea",
	},
	"script.body": {
		category: "script",
		label: "Body script",
		kind: "textarea",
	},
	"script.meta_pixel": {
		category: "script",
		label: "Meta Pixel",
		kind: "textarea",
		hint: "Meta/Facebook Pixel snippet — inserted in the page head.",
	},
	"script.tiktok": {
		category: "script",
		label: "TikTok Pixel",
		kind: "textarea",
		hint: "TikTok Pixel snippet — inserted in the page head.",
	},
	"script.google_ads": {
		category: "script",
		label: "Google Ads",
		kind: "textarea",
		hint: "Google Ads conversion tracking snippet — inserted in the page head.",
	},
	"script.google_analytics": {
		category: "script",
		label: "Google Analytics",
		kind: "textarea",
		hint: "GA4 measurement snippet — inserted in the page head.",
	},
};

function settingsGroups(): SettingsGroup[] {
	const values = new Map(allSettings.all().map((r) => [r.key, r.value]));
	return CATEGORIES.map(({ category, label }) => {
		const items: SettingsItem[] = [];
		for (const [key, meta] of Object.entries(FIELD_META)) {
			if (meta.category !== category) continue;
			items.push({
				key,
				label: meta.label,
				value: values.get(key) ?? "",
				kind: meta.kind,
				options: meta.options,
				hint: meta.hint,
			});
		}
		return { category, label, items };
	});
}

function flash(c: import("hono").Context<AppEnv>, message: string): void {
	if (c.var.sessionToken) setFlash(c.var.sessionToken, { success: message });
}

export const settingsRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get(
		"/settings",
		requireRole("admin"),
		requirePermission("settings.read"),
		(c) => c.var.inertia.render("Settings", { groups: settingsGroups() }),
	);

	app.post(
		"/settings",
		requireRole("admin"),
		requirePermission("settings.update"),
		validateJson(settingsBody),
		(c) => {
			const body = c.req.valid("json") as SettingsBody;
			// Apply whitelisted keys only; unknown keys in the body are ignored.
			for (const key of Object.keys(FIELD_META)) {
				const value = body[key];
				if (value !== undefined) setSetting(key, value);
			}
			const acting = c.var.user;
			if (acting)
				recordActivity(
					c,
					acting.id,
					"settings.update",
					"Updated application settings",
				);
			flash(c, "Settings saved.");
			return c.var.inertia.redirect("/settings");
		},
	);

	// Link a completed tus upload to a media-valued setting. Returns plain
	// JSON (this is a fetch call, not an Inertia request).
	app.post(
		"/settings/media",
		requireRole("admin"),
		requirePermission("settings.update"),
		async (c) => {
			const user = c.var.user;
			if (!user) return c.json({ error: "Unauthorized." }, 401);

			const raw = (await c.req.json().catch(() => null)) as unknown;
			if (!raw || typeof raw !== "object")
				return c.json({ error: "Malformed JSON body." }, 400);
			const { key, uploadId } = raw as Record<string, unknown>;
			if (
				typeof key !== "string" ||
				typeof uploadId !== "string" ||
				uploadId.length === 0
			)
				return c.json({ error: "key and uploadId are required." }, 422);
			if (!(MEDIA_KEYS as readonly string[]).includes(key))
				return c.json({ error: "Unknown media setting key." }, 422);

			const upload = findUpload.get(uploadId);
			if (!upload || upload.userId !== user.id)
				return c.json({ error: "Upload not found." }, 404);
			if (upload.offset < upload.uploadLength)
				return c.json({ error: "Upload is not complete." }, 400);

			let filetype = "";
			try {
				const meta = JSON.parse(upload.metadata) as Record<string, string>;
				filetype = typeof meta.filetype === "string" ? meta.filetype : "";
			} catch {
				/* metadata may be empty or malformed */
			}
			if (!MEDIA_IMAGE_TYPES.includes(filetype)) {
				return c.json(
					{ error: "Only image uploads can be used as a logo or favicon." },
					422,
				);
			}

			const url = `/uploads/${upload.id}`;
			setSetting(key, url);
			recordActivity(
				c,
				user.id,
				"settings.update",
				`Set ${key} to a new upload`,
			);
			return c.json({ ok: true, url });
		},
	);

	return app;
};
