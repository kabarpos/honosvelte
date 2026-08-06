/**
 * bun:sqlite layer — synchronous, zero-ORM.
 * Schema comes from migrations/ (see migrations.ts); statements are
 * prepared once, after migrations are applied.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Permission, Role, UserStatus } from "../shared/types";
import { config } from "./config";
import { migrate } from "./migrations";

export interface UserRow {
	id: number;
	name: string;
	email: string;
	passwordHash: string;
	role: Role;
	googleId: string | null;
	avatarUrl: string | null;
	status: UserStatus;
	whatsapp: string | null;
	createdAt: string;
}

export interface SessionRow {
	tokenHash: string;
	userId: number;
	flash: string;
	expiresAt: string;
	createdAt: string;
}

export interface PasswordResetRow {
	email: string;
	tokenHash: string;
	expiresAt: string;
}

/** The user shape that may leave the server (never includes passwordHash). */
export type PublicUser = Omit<UserRow, "passwordHash" | "googleId">;

export const toPublicUser = (row: UserRow): PublicUser => ({
	id: row.id,
	name: row.name,
	email: row.email,
	role: row.role,
	avatarUrl: row.avatarUrl,
	status: row.status,
	whatsapp: row.whatsapp,
	createdAt: row.createdAt,
});

const USER_COLUMNS = `id, name, email, password_hash AS passwordHash, role,
	google_id AS googleId, avatar_url AS avatarUrl, status, whatsapp,
	created_at AS createdAt`;

const dbDir = dirname(config.dbPath);
// Guard against "." / in-memory paths: mkdirSync(".", { recursive: true })
// throws EEXIST on Windows, though it is a no-op on POSIX.
if (dbDir && dbDir !== "." && config.dbPath !== ":memory:") {
	mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL");
// Concurrent writes (e.g. two tus PATCHes) wait up to 5s instead of
// failing with SQLITE_BUSY.
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA foreign_keys = ON");

// Apply pending migrations before any statement is prepared/used.
migrate(db);

/** Cheap liveness probe for the /health endpoint. */
export const pingDb = db.query<{ n: number }, []>(`SELECT 1 AS n`);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const createUser = db.query<{ id: number }, [string, string, string]>(
	`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id`,
);
export const createUserWithRole = db.query<
	{ id: number },
	[string, string, string, Role]
>(
	`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id`,
);
export const createUserFull = db.query<
	{ id: number },
	[string, string, string | null, string | null, Role, UserStatus]
>(
	`INSERT INTO users (name, email, password_hash, whatsapp, role, status)
   VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
);
export const createGoogleUser = db.query<
	{ id: number },
	[string, string, string, string]
>(
	`INSERT INTO users (name, email, password_hash, google_id, avatar_url) VALUES (?, ?, '', ?, ?) RETURNING id`,
);
export const findUserByEmail = db.query<UserRow, [string]>(
	`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`,
);
export const findUserById = db.query<UserRow, [number]>(
	`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`,
);
export const findUserByGoogleId = db.query<UserRow, [string]>(
	`SELECT ${USER_COLUMNS} FROM users WHERE google_id = ?`,
);
export const linkGoogleAccount = db.query<null, [string, number]>(
	`UPDATE users SET google_id = ? WHERE id = ?`,
);
export const updateUserPassword = db.query<null, [string, number]>(
	`UPDATE users SET password_hash = ? WHERE id = ?`,
);
export const updateUserAvatar = db.query<null, [string, number]>(
	`UPDATE users SET avatar_url = ? WHERE id = ?`,
);
export const updateUserProfile = db.query<null, [string, string, number]>(
	`UPDATE users SET name = ?, email = ? WHERE id = ?`,
);
export const updateUserAdmin = db.query<
	null,
	[string, string, string | null, Role, UserStatus, number]
>(
	`UPDATE users SET name = ?, email = ?, whatsapp = ?, role = ?, status = ? WHERE id = ?`,
);
export const setUserStatus = db.query<null, [UserStatus, number]>(
	`UPDATE users SET status = ? WHERE id = ?`,
);
export const deleteUser = db.query<null, [number]>(
	`DELETE FROM users WHERE id = ?`,
);
export const countUsers = db.query<{ n: number }, []>(
	`SELECT COUNT(*) AS n FROM users`,
);
export const listUsers = db.query<UserRow, [number, number]>(
	`SELECT ${USER_COLUMNS} FROM users ORDER BY id DESC LIMIT ? OFFSET ?`,
);
export const searchUsers = db.query<UserRow, [string, number, number]>(
	`SELECT ${USER_COLUMNS} FROM users
   WHERE name LIKE ? OR email LIKE ?
   ORDER BY id DESC LIMIT ? OFFSET ?`,
);
export const countSearchUsers = db.query<{ n: number }, [string]>(
	`SELECT COUNT(*) AS n FROM users WHERE name LIKE ? OR email LIKE ?`,
);
export const recentUsers = db.query<UserRow, [number]>(
	`SELECT ${USER_COLUMNS} FROM users ORDER BY id DESC LIMIT ?`,
);

// ---------------------------------------------------------------------------
// Roles & permissions (RBAC)
// ---------------------------------------------------------------------------

export interface RoleRow {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	createdAt: string;
}

export interface PermissionRow {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	createdAt: string;
}

const ROLE_COLUMNS = `id, slug, name, description, created_at AS createdAt`;
const PERMISSION_COLUMNS = `id, slug, name, description, created_at AS createdAt`;

export const listRoles = db.query<RoleRow, []>(
	`SELECT ${ROLE_COLUMNS} FROM roles ORDER BY id ASC`,
);
export const findRoleById = db.query<RoleRow, [number]>(
	`SELECT ${ROLE_COLUMNS} FROM roles WHERE id = ?`,
);
export const findRoleBySlug = db.query<RoleRow, [string]>(
	`SELECT ${ROLE_COLUMNS} FROM roles WHERE slug = ? COLLATE NOCASE`,
);
export const insertRole = db.query<
	{ id: number },
	[string, string, string | null]
>(`INSERT INTO roles (slug, name, description) VALUES (?, ?, ?) RETURNING id`);
export const updateRole = db.query<null, [string, string, string | null, number]>(
	`UPDATE roles SET slug = ?, name = ?, description = ? WHERE id = ?`,
);
export const deleteRole = db.query<null, [number]>(
	`DELETE FROM roles WHERE id = ?`,
);

export const listPermissions = db.query<PermissionRow, []>(
	`SELECT ${PERMISSION_COLUMNS} FROM permissions ORDER BY slug ASC`,
);
export const findPermissionBySlug = db.query<PermissionRow, [string]>(
	`SELECT ${PERMISSION_COLUMNS} FROM permissions WHERE slug = ? COLLATE NOCASE`,
);
export const findPermissionById = db.query<PermissionRow, [number]>(
	`SELECT ${PERMISSION_COLUMNS} FROM permissions WHERE id = ?`,
);
export const insertPermission = db.query<
	{ id: number },
	[string, string, string | null]
>(
	`INSERT INTO permissions (slug, name, description) VALUES (?, ?, ?) RETURNING id`,
);
export const updatePermission = db.query<
	null,
	[string, string, string | null, number]
>(`UPDATE permissions SET slug = ?, name = ?, description = ? WHERE id = ?`);
export const deletePermission = db.query<null, [number]>(
	`DELETE FROM permissions WHERE id = ?`,
);

export const listRolePermissionSlugs = db.query<{ slug: string }, [number]>(
	`SELECT p.slug FROM role_permissions rp
   JOIN permissions p ON p.id = rp.permission_id
   WHERE rp.role_id = ? ORDER BY p.slug ASC`,
);
export const assignRolePermission = db.query<null, [number, number]>(
	`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
);
export const clearRolePermissions = db.query<null, [number]>(
	`DELETE FROM role_permissions WHERE role_id = ?`,
);

export const listUserPermissionRows = db.query<
	{ slug: string; granted: number },
	[number]
>(
	`SELECT p.slug, up.granted FROM user_permissions up
   JOIN permissions p ON p.id = up.permission_id
   WHERE up.user_id = ?`,
);
export const setUserPermission = db.query<null, [number, number, number]>(
	`INSERT OR REPLACE INTO user_permissions (user_id, permission_id, granted)
   VALUES (?, ?, ?)`,
);
export const clearUserPermissions = db.query<null, [number]>(
	`DELETE FROM user_permissions WHERE user_id = ?`,
);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const insertSession = db.query<null, [string, number, string]>(
	`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
);
export const findSession = db.query<SessionRow, [string]>(
	`SELECT token_hash AS tokenHash, user_id AS userId, flash, expires_at AS expiresAt, created_at AS createdAt FROM sessions WHERE token_hash = ?`,
);
export const deleteSession = db.query<null, [string]>(
	`DELETE FROM sessions WHERE token_hash = ?`,
);
export const deleteOtherSessions = db.query<null, [number, string]>(
	`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`,
);
export const updateSessionFlash = db.query<null, [string, string]>(
	`UPDATE sessions SET flash = ? WHERE token_hash = ?`,
);

// ---------------------------------------------------------------------------
// Password resets
// ---------------------------------------------------------------------------

export const insertPasswordReset = db.query<null, [string, string, string]>(
	`INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?, ?, ?)`,
);
export const findPasswordReset = db.query<PasswordResetRow, [string]>(
	`SELECT email, token_hash AS tokenHash, expires_at AS expiresAt FROM password_resets WHERE token_hash = ?`,
);
export const deletePasswordResetsByEmail = db.query<null, [string]>(
	`DELETE FROM password_resets WHERE email = ?`,
);

// ---------------------------------------------------------------------------
// Uploads (tus)
// ---------------------------------------------------------------------------

export interface UploadRow {
	id: string;
	uploadLength: number;
	offset: number;
	metadata: string;
	userId: number | null;
	path: string;
	createdAt: string;
	expiresAt: string | null;
}

export const insertUpload = db.query<
	null,
	[string, number, string, number | null, string, string | null]
>(
	`INSERT INTO uploads (id, upload_length, metadata, user_id, path, expires_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export const findUpload = db.query<UploadRow, [string]>(
	`SELECT id, upload_length AS uploadLength, offset, metadata, user_id AS userId, path, created_at AS createdAt, expires_at AS expiresAt FROM uploads WHERE id = ?`,
);

/** Atomically advance the offset only if the current offset matches `expected`.
 *  Returns the number of rows updated (1 on success, 0 on conflict). */
export const advanceOffset = db.query<{ n: number }, [number, string, number]>(
	`UPDATE uploads SET offset = offset + ? WHERE id = ? AND offset = ? RETURNING 1 AS n`,
);

export const deleteUpload = db.query<null, [string]>(
	`DELETE FROM uploads WHERE id = ?`,
);

/** Uploads whose expiration has passed (used by the sweep job). Caller passes
 *  `now` (ISO) so tests can control time. */
export const listExpired = db.query<UploadRow, [string]>(
	`SELECT id, upload_length AS uploadLength, offset, metadata, user_id AS userId, path, created_at AS createdAt, expires_at AS expiresAt FROM uploads WHERE expires_at IS NOT NULL AND expires_at < ?`,
);
