-- 0010_settings_thumbnail.sql — app thumbnail / social preview (PRD Modul 15).
-- Value is a served media path (/media/<id>), set via POST /settings/media;
-- consumed as the Open Graph image (og:image) in the HTML shell.
INSERT OR IGNORE INTO settings (key, category, value) VALUES
  ('app.thumbnail', 'general', '');
