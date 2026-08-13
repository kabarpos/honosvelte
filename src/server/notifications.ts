/**
 * Notification helpers (PRD Modul 16). A small fan-out helper used by event
 * producers (e.g. a new contact message) to push a notification to every admin.
 * Each admin gets their own row so the read state is per-user; the
 * Notification Center page reads the current user's rows.
 */
import { adminUserIds, insertNotification } from "./db";

export type NotificationType = "info" | "contact" | "whatsapp";

/** Create one notification per admin (and a broadcast row for future use). */
export function notifyAdmins(
	type: NotificationType,
	title: string,
	body: string,
): void {
	for (const { id } of adminUserIds.all()) {
		insertNotification.run(id, type, title, body);
	}
}
