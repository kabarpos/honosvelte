-- 0006_media.sql — media library: stored files + metadata + permissions.
-- category is derived from the mime type at upload time.

CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,          -- stored name under MEDIA_DIR
  original_name TEXT NOT NULL,          -- user-visible file name
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,
  category      TEXT NOT NULL DEFAULT 'other',  -- image|video|audio|document|archive|other
  title         TEXT,
  alt_text      TEXT,
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('media.read',   'Read media',   'View and search the media library.'),
  ('media.create', 'Upload media', 'Upload files to the media library.'),
  ('media.update', 'Update media', 'Edit media metadata.'),
  ('media.delete', 'Delete media', 'Delete files from the media library.');

-- super_admin keeps the implicit everything (insert is idempotent).
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

-- admin manages the whole library; user manages their own files.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug IN (
  'media.read', 'media.create', 'media.update', 'media.delete'
)
WHERE r.slug IN ('admin', 'user');
