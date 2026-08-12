-- 0009_settings_media_and_selects.sql — Settings upgrade (PRD Modul 15).
-- Adds: website description, logo uploads (light/dark) + favicon (values are
-- /uploads/<id> paths, set via POST /settings/media after a tus upload),
-- multi-number WhatsApp (value is a JSON array of strings), and the analytics
-- / pixel script keys (Meta Pixel, TikTok, Google Ads, Google Analytics).
-- Replaces the single-text `app.logo` with the two uploadable logo keys.
-- Seeds are INSERT OR IGNORE so existing databases pick up new keys without
-- overwriting admin-edited values.

INSERT OR IGNORE INTO settings (key, category, value) VALUES
  ('app.description',    'general', ''),
  ('app.logo_light',     'general', ''),
  ('app.logo_dark',      'general', ''),
  ('app.favicon',        'general', ''),
  ('script.meta_pixel',       'script', ''),
  ('script.tiktok',           'script', ''),
  ('script.google_ads',       'script', ''),
  ('script.google_analytics', 'script', '');

-- app.logo (plain text) is superseded by app.logo_light / app.logo_dark.
DELETE FROM settings WHERE key = 'app.logo';
