-- 0013_whatsapp.sql — WhatsApp templates + inbound messages (PRD Modul 12).
-- Provider integration is Dripsender.id (see DRIPSENDER.md): outbound sends
-- go through its /send API, inbound messages arrive via its webhook. Templates
-- are reusable message bodies with {{placeholder}} substitution (no native
-- concept in Dripsender, so they live here). Placeholders are stored
-- comma/semicolon-separated and rendered with sample data for preview/test.

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  body       TEXT NOT NULL,
  media_url  TEXT NOT NULL DEFAULT (''),  -- optional attachment link (Dripsender media_url)
  placeholders TEXT NOT NULL DEFAULT (''),  -- comma/semicolon-separated tokens
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_slug ON whatsapp_templates(slug);

-- Inbound messages delivered by the Dripsender webhook (read-only log; an
-- admin inbox can be built on top of this later).
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_id        TEXT,                       -- Dripsender message id ("id")
  phone        TEXT NOT NULL,              -- sender phone (e.g. 62813…)
  jid          TEXT,                       -- WhatsApp jid (…@s.whatsapp.net)
  name         TEXT,                       -- sender display name
  body         TEXT NOT NULL,              -- message text
  wa_timestamp TEXT,                       -- Dripsender unix timestamp
  received_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_received ON whatsapp_messages(received_at);

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('whatsapp.read', 'Read WhatsApp settings', 'View WhatsApp configuration and templates.'),
  ('whatsapp.update', 'Manage WhatsApp', 'Edit provider config and WhatsApp templates.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug = 'whatsapp.read'
WHERE r.slug = 'admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug = 'whatsapp.update'
WHERE r.slug = 'admin';
