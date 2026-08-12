/**
 * Locale/timezone-aware date formatting, driven by the regional.* settings
 * (PRD Modul 15 — /settings → Regional). Pass the `settings` map from
 * `usePage().props.settings`; falls back to en/UTC when unset.
 */

function resolve(
	settings: Record<string, string> | undefined,
): { locale: string; timeZone: string } {
	return {
		locale: settings?.['regional.locale'] || 'en',
		timeZone: settings?.['regional.timezone'] || 'UTC',
	}
}

export function formatDate(
	iso: string,
	settings?: Record<string, string>,
): string {
	const { locale, timeZone } = resolve(settings)
	return new Date(iso).toLocaleDateString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone,
	})
}

export function formatDateTime(
	iso: string,
	settings?: Record<string, string>,
): string {
	const { locale, timeZone } = resolve(settings)
	return new Date(iso).toLocaleString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone,
	})
}
