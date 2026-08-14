# Audit Remediation Evidence Ledger

| ID | Status | Evidence | Last verified |
| --- | --- | --- | --- |
| GOV-01 | complete | `docs/security/threat-model.md` defines trust boundaries, data classification, security invariants, and abuse cases. | 2026-08-13 |
| GOV-02 | partial | `tests/security/helpers.ts` provides reusable app-call, session-cookie, JSON, redirect, and response-payload assertions. Suite separation and security test files remain pending. | 2026-08-13 |
| GOV-03 | complete | This ledger records remediation status, evidence paths, and verification dates. | 2026-08-13 |
| SEC-01 | partial | `getPublicSettings()` now allowlists public settings; WhatsApp returns `hasApiKey`; `tests/security/secrets.test.ts` verifies public/authenticated/admin payloads omit secret values. Secret rotation and SSR/log/flash audit remain pending. | 2026-08-13 |
| SEC-02 | partial | `countSuperAdmins` and protected-role guards added to create/update/status handlers; role-change activity recorded; `tests/security/protected-role.test.ts` covers ordinary-admin escalation and last-super-admin protection. Existing-data review and full super-admin mutation tests remain pending. | 2026-08-13 |
| SEC-03 | partial | `resolveUser`, password login, Google OAuth, and user status route now enforce inactive state; deactivation deletes sessions; `tests/security/inactive-user.test.ts` covers login/session/reactivation. OAuth integration-flow test remains pending. | 2026-08-13 |
| SEC-04 | partial | Password reset now atomically consumes the token and deletes all user sessions; `tests/security/password-reset-session.test.ts` verifies old session/password rejection, new login, and token reuse rejection. Password-change policy and security event remain pending. | 2026-08-13 |
| SEC-05 | partial | Webhook now requires `WHATSAPP_WEBHOOK_SECRET`, enforces bounded JSON, replay window, rate limit, field limits, idempotency migration, and safe response; `tests/security/webhook.test.ts` covers auth/replay/duplicate/oversize. TypeBox schema, quota/circuit breaker, and rate-limit threshold tests remain pending. | 2026-08-13 |
| SEC-06 | partial | Tus GET is now private owner-scoped, completed-only, non-image content is attachment-only, and responses include `nosniff`/restrictive CSP. `tests/tus.test.ts` covers owner/cross-user/incomplete/HTML/Google-avatar flows. Signature-based MIME validation remains pending. | 2026-08-13 |
| SEC-07 | partial | Unconditional SMTP TLS bypass removed, 10-second timeouts added, and configurable integration URL restricted to Dripsender hosts. DNS/private-IP, redirect/response limits, Google image validation, and production TLS tests remain pending. | 2026-08-13 |
| SEC-08 | partial | Granular permissions/migration `0019_admin_action_permissions.sql` and route guards added; `tests/security/permission-guards.test.ts` verifies revoked access. Mapping docs, bulk exact policy, shared UI policy, and super-admin UI parity remain pending. | 2026-08-13 |
| COR-01 | partial | User search/count placeholder mismatch fixed in `db.ts` and `users.routes.ts`; `tests/correctness/user-search.test.ts` verifies name/email search. Pagination and empty-search edge tests remain pending. | 2026-08-13 |
| COR-02 | partial | Contact search-specific list/count queries added for name/email/subject/message; `tests/correctness/contact-search.test.ts` verifies positive search. Wildcard policy and negative search test remain pending. | 2026-08-13 |
| COR-03 | complete | Media picker now applies the same owner/admin scope as media list; `tests/correctness/media-picker-scope.test.ts` verifies regular-user isolation and admin visibility. | 2026-08-13 |
| COR-04 | complete | Notification read update is owner/broadcast scoped with affected-row check; admin fan-out includes `super_admin`; `tests/security/notification-ownership.test.ts` verifies IDOR rejection and fan-out. | 2026-08-13 |
| COR-05 | partial | Media upload now writes a temporary file, atomically renames, then inserts metadata; cleanup handles failed writes. `tests/media.test.ts` passes; signature validation, failure injection, and reconciliation remain pending. | 2026-08-13 |
| COR-06 | partial | Tus PATCH now serializes operations with an in-process per-upload lock; existing Tus suite passes. Concurrent race/recovery tests and multi-process consistency remain pending. | 2026-08-13 |
| COR-07 | partial | `app.onError` now handles expected `ValidationFailed` before `logError`; JSON/client error contracts and console/logger cleanup remain pending. | 2026-08-13 |
| PERF-01 | partial | Upload defaults changed to 50 MiB max and 24-hour unfinished expiry; quotas, raw JSON/chunk limits, upload rate limiting, and provider timeouts remain pending. | 2026-08-13 |
| PERF-02 | partial | Tus GET now returns `Bun.file()` streaming instead of buffering through `readFile`; Tus suite passes. Media upload buffering/synchronous writes and memory benchmark remain pending. | 2026-08-13 |
| PERF-03 | partial | Migration `0020_query_support_indexes.sql` adds indexes for common user/media/activity/contact/notification filter/order paths. EXPLAIN query-plan evidence, FTS, and query budget remain pending. | 2026-08-13 |
| PERF-04 | partial | Page numbers are capped at 1000 on five paginated routes. Cursor pagination, offset hardening, count optimization, and snapshot consistency remain pending. | 2026-08-13 |
| PERF-06 | partial | `sweepExpired()` is scheduled every 15 minutes from `src/index.ts` and timer cleanup is wired into shutdown. Session/reset cleanup, retention, queue, retry, and dead-letter remain pending. | 2026-08-13 |
| SEC-04 | pending | Not started. | — |
| SEC-05 | pending | Not started. | — |
