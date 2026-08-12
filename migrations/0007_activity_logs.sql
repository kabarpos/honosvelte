-- 0007_activity_logs.sql — activity log: who did what, when, from where.
-- One row per meaningful action (login/logout, CRUD, permission changes).
-- user_id is nullable: a failed login has no authenticated user.

CREATE TABLE IF NOT EXISTS activity_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event      TEXT NOT NULL,             -- e.g. 'login', 'users.create', 'media.delete'
  detail     TEXT,                      -- optional human-readable summary
  ip         TEXT,
  url        TEXT,                      -- request path that produced the event
  method     TEXT,                      -- HTTP method
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user    ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event   ON activity_logs(event);

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('activity.read', 'Read activity log', 'View and filter the activity log.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug = 'activity.read'
WHERE r.slug = 'admin';
