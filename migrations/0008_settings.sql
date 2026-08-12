-- 0008_settings.sql — application settings (PRD Modul 15).
-- A key-value store grouped by category (general, contact, regional, footer,
-- script). Values are TEXT; the Settings admin page edits them per category.
-- Seeds are INSERT OR IGNORE so an existing database picks up new keys
-- without overwriting values the admin already changed.

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO settings (key, category, value) VALUES
  ('app.name',        'general',  'Honosvelte'),
  ('app.logo',        'general',  ''),
  ('app.tagline',     'general',  'Full-stack starter: Hono + Svelte 5 + bun:sqlite.'),
  ('contact.email',   'contact',  ''),
  ('contact.whatsapp','contact',  ''),
  ('contact.address', 'contact',  ''),
  ('regional.timezone','regional','UTC'),
  ('regional.locale', 'regional', 'en'),
  ('footer.copyright','footer',   '© 2026 Honosvelte. All rights reserved.'),
  ('footer.text',     'footer',   ''),
  ('script.head',     'script',   ''),
  ('script.body',     'script',   '');

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('settings.read',   'Read settings',   'View application settings.'),
  ('settings.update', 'Update settings', 'Change application settings.');

-- super_admin keeps the implicit everything (insert is idempotent).
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug IN ('settings.read', 'settings.update')
WHERE r.slug = 'admin';
