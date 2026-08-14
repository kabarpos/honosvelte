# Backup & Disaster Recovery (OPS-03)

## Current implementation

- **`bun run scripts/backup.ts [--keep N]`** — online backup without stopping the
  app:
  1. Consistent DB snapshot via `VACUUM INTO` (safe against concurrent writes
     in WAL mode — SQLite compacts + copies committed data only).
  2. `PRAGMA integrity_check` on the snapshot copy; a non-`ok` result deletes
     the backup and fails the script.
  3. Media and upload directories are mirrored into the same backup folder
     (`BACKUP_DIR`, default `./data/backups`).
  4. `MANIFEST.txt` records what the backup contains and when it was taken.
  5. Old backups beyond `--keep` (default 14) are pruned.
- Exposed as `bun run backup` in `package.json`.

## RPO / RTO

| Metric | Value | Basis |
| --- | --- | --- |
| RPO (data loss window) | Snapshot duration + copy window | The DB snapshot is taken first; media/uploads are copied afterwards. Files written between the two steps are absent from that backup. |
| RTO (recovery time) | Minutes | Restore = copy files back + start the app; migrations are already applied inside the snapshot. |

For zero-loss backups: stop the app briefly, run the backup, restart — or use
filesystem-level snapshots (btrfs/zfs/cloud volume) that capture DB + dirs
atomically.

## Restore procedure

1. Stop the app (`docker compose down` or SIGTERM; graceful shutdown closes
   the DB cleanly).
2. Replace the database: `cp backup-<stamp>/app.sqlite <DATABASE_PATH>`.
3. Replace the media/uploads directories with the backup copies.
4. Run `PRAGMA integrity_check` on the restored DB once more (or
   `bun -e "const {Database}=require('bun:sqlite'); const db=new Database(process.env.DATABASE_PATH||'./data/app.sqlite'); console.log(db.query('PRAGMA integrity_check').get())"`).
5. Start the app and verify `/health/ready` returns `ok`.

## Scheduled consistency checks

- `PRAGMA integrity_check` runs automatically on every backup (fail-fast).
- A periodic scheduled check (e.g. weekly cron) is recommended:
  `bun -e "const {Database}=require('bun:sqlite');const db=new Database(process.env.DATABASE_PATH||'./data/app.sqlite');const r=db.query('PRAGMA integrity_check').get();if(r&&r.integrity_check!=='ok'){console.error(r);process.exit(1)}console.log('integrity ok')"`.

## WAL checkpoint policy

- The app runs in WAL mode (`PRAGMA journal_mode = WAL`). Checkpoints happen
  automatically when the WAL reaches 1000 pages. `VACUUM INTO` also implies a
  checkpoint of committed data, so backups are always consistent.
- Backing up the raw `app.sqlite` file alone (without `-wal`/`-shm`) is NOT a
  valid backup — always use `scripts/backup.ts` or `VACUUM INTO`.

## Backup encryption & retention

- Backups are written unencrypted to `BACKUP_DIR`. If the filesystem is not
  encrypted, pipe the folder through disk encryption (LUKS/BitLocker/cloud
  SSE) or encrypt `app.sqlite` at rest before moving it off-host.
- Retention: `--keep N` prunes to the N newest backups (default 14). Tune to
  the business retention policy; a weekly off-host copy is recommended.

## Metrics endpoint

- `/health/metrics` exposes aggregate counters + latency percentiles
  (auth failures, webhook accepted/rejected, upload bytes/count, provider
  errors, request status classes). Counters only — no PII. Protect the path
  at the reverse proxy if it should be private.
