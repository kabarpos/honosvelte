-- 0015_whatsapp_triggers.sql — trigger/recipient wiring for WhatsApp templates.
-- Each template can now be dispatched automatically when an event fires
-- (on_register, on_contact, on_order) to a resolved recipient (customer or
-- admin). `manual` (default) preserves the prior manual-only behavior.
-- Existing rows get the defaults filled in by SQLite.

ALTER TABLE whatsapp_templates ADD COLUMN trigger TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE whatsapp_templates ADD COLUMN recipient TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE whatsapp_templates ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
