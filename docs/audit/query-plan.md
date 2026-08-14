# Query plan audit (PERF-03)

Run against a 200-user seeded DB with `EXPLAIN QUERY PLAN` (SQLite).
All list queries are bounded by the page cap (max page 1000, perPage ≤ 100 →
max offset 100 000 rows) and use parameterized statements.

| Query | Plan | Verdict |
| --- | --- | --- |
| users search (`name LIKE ? OR email LIKE ?`) | `SCAN users` | Expected — `%term%` cannot use a btree index; acceptable below ~10k rows, FTS5 is the documented upgrade path |
| users list (`ORDER BY id DESC LIMIT ? OFFSET ?`) | `SCAN users` | Reverse primary-key scan — fine |
| media list (optional category/user/search filters) | `SCAN media` | The `(? = '' OR …)` optional-filter pattern defeats index use when filters are empty; with a filter set, `idx_media_category_id` / `idx_media_user_id` serve it. Replacement = dedicated query per filter (tracked in PERF-03) |
| activity list (optional event/search filters) | `SCAN al` + `SEARCH u (PK)` | Same optional-filter tradeoff; `idx_activity_event_id` / `idx_activity_user_id` cover filtered runs |
| contact search | `SCAN contact_messages` | Same optional-filter tradeoff; `idx_contact_messages_status` covers status-filtered runs |
| notifications per user | `SEARCH idx_notifications_user_read` + `USE TEMP B-TREE FOR ORDER BY` | **Fixed in 0021**: new covering `(user_id, id DESC)` index removes the temp sort |
| expired uploads sweep | `SEARCH idx_uploads_expires_at` | Index from 0020 works as intended |

## Index inventory (migrations 0020 + 0021)

users(google_id) UNIQUE, users(created_at DESC, id DESC) · sessions(user_id) ·
password_resets(email) · uploads(user_id), uploads(expires_at) ·
media(user_id), media(category), media(created_at DESC), media(category, id DESC),
media(user_id, id DESC) · activity_logs(created_at DESC), (user_id),
(event), (event, id DESC), (user_id, id DESC) · contact_messages(created_at DESC),
(status) · notifications(user_id, read), (created_at DESC), **(user_id, id DESC)** ·
email_templates(slug), whatsapp_templates(slug), whatsapp_messages(received_at),
whatsapp_messages(wa_id) UNIQUE

## Open items

- `%term%` LIKE searches on users/contacts/activity/media: evaluate SQLite FTS5
  when datasets grow past ~10k rows.
- Dedicated filter queries (drop the `(? = '' OR …)` pattern) for media/activity/
  contact when filtered runs become hot — tracked under PERF-03.
