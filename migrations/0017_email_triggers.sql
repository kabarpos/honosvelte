-- 0017_email_triggers.sql — trigger/recipient/enabled/delay for email templates
-- (mirrors 0015_whatsapp_triggers.sql). Lets each email template auto-send on
-- an event (on_register, on_contact, on_order) to a resolved recipient
-- (customer or admin). delay_minutes is reserved for the future scheduler.

ALTER TABLE email_templates ADD COLUMN trigger TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE email_templates ADD COLUMN recipient TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE email_templates ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE email_templates ADD COLUMN delay_minutes INTEGER NOT NULL DEFAULT 0;
