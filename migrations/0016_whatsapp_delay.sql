-- 0016_whatsapp_delay.sql — delay_minutes hook for the future job scheduler.
-- Each template can carry a per-message delay (minutes) so a follow-up message
-- in a sequence fires later. The scheduler (not yet built) will honor this
-- column; immediate dispatch today ignores it.

ALTER TABLE whatsapp_templates ADD COLUMN delay_minutes INTEGER NOT NULL DEFAULT 0;
