/**
 * SQLite online backup (OPS-03): takes a consistent snapshot of the database
 * via `VACUUM INTO` (safe against concurrent writes in WAL mode), runs
 * `PRAGMA integrity_check` on the copy, then mirrors the media and upload
 * directories into the same backup folder.
 *
 * Usage:  bun run scripts/backup.ts [--keep N]
 * Env:    DATABASE_PATH, MEDIA_DIR, UPLOAD_DIR (defaults match config.ts),
 *         BACKUP_DIR (default ./data/backups). --keep N prunes old backups
 *         beyond the N most recent (default 14).
 *
 * Backup/restore contract (see docs/audit/backup-dr.md):
 *   - The DB snapshot is internally consistent (VACUUM INTO + integrity check).
 *   - Media + upload bytes are copied afterwards; files written between the
 *     DB snapshot and the copy are missing from this backup (RPO = window
 *     length). For zero-loss backups stop the app or use filesystem snapshots.
 *   - Restore = stop app, replace DB file, replace media/upload dirs, start.
 */
import { mkdirSync, readdirSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { Database } from "bun:sqlite";

const pick = (value: string | undefined, fallback: string): string =>
	value === undefined || value === "" ? fallback : value;

const dbPath = pick(process.env.DATABASE_PATH, "./data/app.sqlite");
const mediaDir = pick(process.env.MEDIA_DIR, "./data/media");
const uploadDir = pick(process.env.UPLOAD_DIR, "./data/uploads");
const backupDir = pick(process.env.BACKUP_DIR, "./data/backups");

const keepRaw = process.argv.indexOf("--keep");
const keep = keepRaw !== -1 ? Number(process.argv[keepRaw + 1]) : 14;

function nowStamp(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main(): Promise<void> {
	mkdirSync(backupDir, { recursive: true });
	const stamp = nowStamp();
	const target = join(backupDir, `backup-${stamp}`);
	mkdirSync(target, { recursive: true });

	// 1. Consistent DB snapshot + integrity check on the copy.
	// VACUUM INTO needs a string literal (SQLite binds no parameters for
	// VACUUM), so the path is validated against a whitelist first and any
	// single quotes are escaped — belt and braces. The path is derived from
	// operator env (BACKUP_DIR) + a timestamp; no request/user input ever
	// reaches it.
	const snapshotPath = join(target, "app.sqlite");
	if (!/^[\w/\\:.\-~]+$/.test(snapshotPath)) {
		rmSync(target, { recursive: true, force: true });
		throw new Error(`Unsafe backup path: ${snapshotPath}`);
	}
	const db = new Database(dbPath, { readonly: true });
	try {
		db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
	} finally {
		db.close();
	}
	const check = new Database(snapshotPath, { readonly: true });
	const integrity = check
		.query<{ integrity_check: string }, []>(`PRAGMA integrity_check`)
		.get()?.integrity_check;
	check.close();
	if (integrity !== "ok") {
		rmSync(target, { recursive: true, force: true });
		throw new Error(
			`Backup failed: integrity_check on the snapshot returned "${integrity}"`,
		);
	}

	// 2. Mirror media + upload bytes (best-effort for missing dirs).
	for (const [label, dir] of [
		["media", mediaDir],
		["uploads", uploadDir],
	] as const) {
		try {
			cpSync(dir, join(target, label), {
				recursive: true,
				filter: (src) => basename(src) !== ".probe-*",
			});
		} catch {
			// Directory may not exist yet (fresh deployment) — record it.
			writeFileSync(join(target, `${label}.missing`), "");
		}
	}

	// 3. Manifest for the operator: what this backup contains + when.
	writeFileSync(
		join(target, "MANIFEST.txt"),
		[
			`created_at: ${new Date().toISOString()}`,
			`db: ${basename(dbPath)} (VACUUM INTO snapshot, integrity_check ok)`,
			`media: ${mediaDir}`,
			`uploads: ${uploadDir}`,
			`RPO note: media/uploads are copied after the DB snapshot — files written`,
			`in between are not in this backup. See docs/audit/backup-dr.md.`,
			``,
		].join("\n"),
	);

	// 4. Prune old backups beyond --keep (default 14). ISO-timestamped names
	// sort chronologically as strings; newest first.
	const backups = readdirSync(backupDir)
		.filter((name) => /^backup-/.test(name))
		.toSorted((a, b) => a.localeCompare(b))
		.toReversed();
	for (const stale of backups.slice(keep)) {
		rmSync(join(backupDir, stale), { recursive: true, force: true });
		console.log(`[backup] pruned ${stale}`);
	}

	console.log(`[backup] ok → ${target} (integrity ${integrity})`);
}

await main();
