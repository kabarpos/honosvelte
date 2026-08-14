/**
 * Client-side capability checks — the single source of truth for UI gating,
 * fed by the same data the server guards use (`auth.can` from the shared
 * Inertia props, computed by `permissionsForUser`).
 *
 * super_admin implicitly holds every capability (`'*'`), exactly like
 * `requireRole` / `requirePermission` on the server — no hardcoded
 * `role === 'admin'` checks (SEC-08 / UX-06).
 */
import { usePage } from "@inertiajs/svelte";
import type { SharedPageProps } from "../shared/types";

type PageProps = SharedPageProps & Record<string, unknown>;

function currentProps(): PageProps {
	return usePage().props as unknown as PageProps;
}

/** Whether the current user holds `permission` (super_admin: always). */
export function can(permission: string): boolean {
	const list = currentProps().auth?.can;
	if (!list) return false;
	return list.includes("*") || list.includes(permission);
}

/** Whether the current user may access the admin surface at all
 *  (super_admin outranks admin, mirroring requireRole). */
export function isAdminSurface(): boolean {
	const role = currentProps().auth?.user?.role;
	return role === "super_admin" || role === "admin";
}
