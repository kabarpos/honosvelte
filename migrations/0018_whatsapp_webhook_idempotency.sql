-- 0018_whatsapp_webhook_idempotency.sql — reject replayed external message IDs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id
  ON whatsapp_messages(wa_id)
  WHERE wa_id IS NOT NULL;
