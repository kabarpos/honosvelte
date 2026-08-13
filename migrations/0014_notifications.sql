-- 0014_notifications.sql — in-app notifications (PRD Modul 16).
-- Per-user feed for admins; user_id NULL marks an admin broadcast. `read` is
-- a 0/1 flag so the unread count is a cheap COUNT. Producers (e.g. a new
-- contact message) call notifyAdmins() to fan a notification out to all admins.

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,                       -- NULL = broadcast to all admins
  type       TEXT NOT NULL DEFAULT ('info'),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT (''),
  read       INTEGER NOT NULL DEFAULT (0),  -- 0 = unread, 1 = read
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
