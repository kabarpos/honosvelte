# Honosvelte Threat Model

## Scope

Application stack:

- Hono HTTP server on Bun
- Inertia v3 + Svelte 5 SSR/client
- `bun:sqlite` database
- Local filesystem for media and Tus uploads
- SMTP/email providers
- WhatsApp provider/webhook
- Google OAuth
- Optional reverse proxy and Docker deployment

## Trust boundaries

| Boundary | Trusted by | Main risks |
| --- | --- | --- |
| Browser/client | Never trusted | XSS, tampered requests, leaked page props, forged form data |
| Hono server | Application boundary | Auth, authorization, validation, response security |
| SQLite | Server-local persistence | Secret exposure, IDOR, backup theft, schema drift |
| Filesystem | Server-local persistence | Orphan files, path/ownership errors, disk exhaustion |
| SMTP provider | External dependency | Credential theft, timeout, TLS/MITM, delivery abuse |
| WhatsApp provider/webhook | External dependency | Forged events, replay, outbound cost abuse |
| Google OAuth/avatar URLs | External dependency | OAuth state errors, SSRF, oversized/untrusted images |
| Reverse proxy | Conditionally trusted | Forwarded IP spoofing, TLS termination, body limits |

## Data classification

### Public

- Landing/about/services content
- Explicitly approved public branding assets
- Health/liveness response without sensitive internals

### Authenticated user

- Own profile and avatar
- Own media and upload resources
- Own notifications
- Session-scoped account information

### Admin

- User management
- Roles and permissions
- Contact inbox
- Activity logs
- Messaging templates/configuration
- Site settings

### Server-only

- SMTP password
- WhatsApp API key
- Provider tokens
- OAuth client secret
- Session token hashes
- Password-reset token hashes
- Database and filesystem paths

### Sensitive persisted data

- Contact message bodies and email addresses
- Activity IP addresses, URLs, methods, actor names, and details
- Uploaded file bytes and metadata
- Notification bodies
- Provider credentials stored in settings

## Security invariants

1. Server-only secrets never appear in Inertia props, SSR HTML, client bundles, logs, or error responses.
2. Every state-changing operation requires authentication, CSRF protection where browser-based, validation, and authorization.
3. A user can access only resources allowed by ownership, role, and effective permission policy.
4. Inactive users cannot create or continue authenticated sessions.
5. Password reset and account deactivation revoke sessions according to the documented policy.
6. Public webhooks require provider authentication, replay protection, validation, rate limits, and bounded payloads.
7. Uploads have explicit public/private policy, bounded size, safe content handling, and lifecycle cleanup.
8. External network calls have destination controls, timeouts, response limits, and observable failures.
9. File and database state remains recoverable and reconciled after partial failure or process interruption.
10. Every critical invariant has an automated regression test.

## Abuse cases to test

- Ordinary admin promotes itself or another account to `super_admin`.
- Inactive user logs in or reuses an old session.
- Password-reset victim retains a stolen session.
- Public visitor extracts secrets from shared page props.
- Attacker replays or forges a WhatsApp webhook.
- Attacker submits oversized upload/webhook bodies.
- User accesses another user's upload, media metadata, or notification state.
- Concurrent Tus PATCH requests write the same offset.
- Admin configures an internal/private integration URL.
- External provider hangs indefinitely.
