-- 0011_contact_messages.sql — visitor contact messages (PRD Modul 9).
-- One row per message submitted through the public contact form. The admin
-- side (list / detail / reply / archive / bulk) reads from this table.

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT ('unread'),  -- unread | read | replied | archived
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status  ON contact_messages(status);

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('contact.read', 'Read contact messages', 'View and manage contact-form submissions.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug = 'contact.read'
WHERE r.slug = 'admin';
