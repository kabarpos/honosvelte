-- 0012_email_templates.sql — email templates (PRD Modul 11).
-- Reusable message templates with {{placeholder}} substitution, used by the
-- admin for notifications, onboarding, etc. Placeholders are stored
-- comma/semicolon-separated and rendered with sample data for preview/test.

CREATE TABLE IF NOT EXISTS email_templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  placeholders TEXT NOT NULL DEFAULT (''),  -- comma/semicolon-separated tokens
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('email.read', 'Read email settings', 'View email configuration and templates.'),
  ('email.update', 'Manage email', 'Edit provider config and email templates.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug = 'email.read'
WHERE r.slug = 'admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug = 'email.update'
WHERE r.slug = 'admin';
