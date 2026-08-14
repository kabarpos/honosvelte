-- 0021_query_support_indexes2.sql — close the notification pagination gap.
-- The notifications list (ORDER BY id DESC LIMIT ? OFFSET ? per user) used
-- the covering (user_id, read) index and then sorted with a temp B-tree.
-- This covering index serves the sort directly. (PERF-03, EXPLAIN-verified.)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_id
ON notifications (user_id, id DESC);
