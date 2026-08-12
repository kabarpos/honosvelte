/**
 * Types shared between the Elysia server and the Inertia React client.
 * Keep this file free of runtime imports — it must be importable from
 * both `src/server` (Bun runtime) and `src/client` (browser bundle).
 */

export type Role = "user" | "admin" | "super_admin";

export type UserStatus = "active" | "inactive";

export interface User {
	id: number;
	name: string;
	email: string;
	role: Role;
	/** Relative path to the avatar image (served from /uploads), null when unset. */
	avatarUrl: string | null;
	status: UserStatus;
	whatsapp: string | null;
	createdAt: string;
}

export interface Permission {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	createdAt: string;
}

export interface RoleRecord {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	permissionSlugs: string[];
	createdAt: string;
}

export interface RoleWithPermissions {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	permissions: Permission[];
	createdAt: string;
}

/** One-shot session flash messages, persisted in the `sessions` table. */
export interface FlashData {
	success?: string;
	error?: string;
	/** Validation errors for the redirect-back (non-Inertia) flow. */
	errors?: Record<string, string>;
}

/** Props the server merges into every Inertia page response. */
export interface SharedPageProps {
	[key: string]: unknown;
	auth: { user: User | null };
	errors: Record<string, string>;
	/** App-wide settings (PRD Modul 15), merged into every page payload. */
	settings: Record<string, string>;
}

/** Props for the dashboard page. */
export interface DashboardStats {
	userCount: number;
	recentUsers: User[];
	mediaCount: number;
}

/** File categories in the media library, derived from the mime type. */
export type MediaCategory =
	| "image"
	| "video"
	| "audio"
	| "document"
	| "archive"
	| "other";

/** A stored file in the media library (user-visible shape). */
export interface Media {
	id: number;
	userId: number | null;
	originalName: string;
	mimeType: string;
	size: number;
	category: MediaCategory;
	title: string | null;
	altText: string | null;
	description: string | null;
	createdAt: string;
	/** Absolute path this file is served from. */
	url: string;
}

/** Current subscription plan shown on the billing page (Modul 17 placeholder). */
export interface PlanInfo {
	name: string;
	price: string;
	renewsAt: string;
	limits: { label: string; used: number; max: number }[];
}

/** One payment-history row on the billing page (Modul 17 placeholder). */
export interface PaymentRow {
	id: string;
	date: string;
	description: string;
	amount: string;
	status: "paid" | "pending" | "failed";
	invoice: string;
}

/** Generic pagination envelope, mirroring what the server returns. */
export interface Paginated<T> {
	data: T[];
	meta: {
		currentPage: number;
		perPage: number;
		lastPage: number;
		total: number;
	};
}

/** One row of the activity log (Modul 13). */
export interface ActivityLogEntry {
	id: number;
	userId: number | null;
	/** Display name of the acting user, or "Guest" when unauthenticated. */
	userName: string | null;
	event: string;
	detail: string | null;
	ip: string | null;
	url: string | null;
	method: string | null;
	createdAt: string;
}

/** One option of a `select` settings field. */
export interface SettingsSelectOption {
	value: string;
	label: string;
}

/** One settings field as rendered on the Settings page (Modul 15). */
export interface SettingsItem {
	key: string;
	label: string;
	value: string;
	/**
	 * text / textarea — plain inputs; select — options picker;
	 * repeater — multi-value editor (value is a JSON array of strings);
	 * media — tus upload + preview (value is a served /uploads path).
	 */
	kind: "text" | "textarea" | "select" | "repeater" | "media";
	/** Choices for `select` fields. */
	options?: SettingsSelectOption[];
	/** Helper text shown under the field. */
	hint?: string;
}

/** Settings grouped by PRD category (general, contact, regional, footer, script). */
export interface SettingsGroup {
	category: string;
	label: string;
	items: SettingsItem[];
}
