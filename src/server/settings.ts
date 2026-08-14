/**
 * Settings store (PRD Modul 15). Reads the `settings` table through an
 * in-process read cache — PRD NFR "Caching konfigurasi global" — so hot
 * paths (page shell, footer, script tags) don't hit SQLite per request.
 * Writes go straight to the DB and update the cache in place. All SQL
 * lives in db.ts (see AGENTS.md).
 */
import { allSettings, upsertSetting } from "./db";

let cache: Map<string, string> | null = null;

const PUBLIC_SETTING_KEYS = new Set([
	"app.name",
	"app.tagline",
	"app.description",
	"app.logo_light",
	"app.logo_dark",
	"app.favicon",
	"app.thumbnail",
	"contact.email",
	"contact.whatsapp",
	"contact.address",
	"regional.locale",
	"regional.timezone",
	"footer.copyright",
	"footer.text",
	"script.head",
	"script.body",
	"script.meta_pixel",
	"script.tiktok",
	"script.google_ads",
	"script.google_analytics",
]);

/** All settings as a key → value map, cached after the first read. */
export function getSettings(): Map<string, string> {
	if (!cache) {
		cache = new Map(allSettings.all().map((r) => [r.key, r.value]));
	}
	return cache;
}

/** Only settings that are intentionally safe to expose to rendered pages. */
export function getPublicSettings(): Map<string, string> {
	return new Map(
		[...getSettings()].filter(([key]) => PUBLIC_SETTING_KEYS.has(key)),
	);
}

/** One setting with a fallback when the key is absent. */
export function getSetting(key: string, fallback = ""): string {
	return getSettings().get(key) ?? fallback;
}

/** Persist one setting and keep the cache coherent. */
export function setSetting(key: string, value: string): void {
	upsertSetting.run(key, value);
	if (cache) cache.set(key, value);
}
