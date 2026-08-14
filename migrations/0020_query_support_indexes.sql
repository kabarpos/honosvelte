-- 0020_query_support_indexes.sql — align common list/order paths with indexes.
CREATE INDEX IF NOT EXISTS idx_users_created_id
ON users (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_media_category_id
ON media (category, id DESC);
CREATE INDEX IF NOT EXISTS idx_media_user_id
ON media (user_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_event_id
ON activity_logs (event, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_id
ON activity_logs (user_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_contact_status_id
ON contact_messages (status, id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_id
ON notifications (user_id, read, id DESC);
