# Role-based access control — route → permission mapping (SEC-08)

Source of truth: the guard calls in `src/server/routes/*.routes.ts`
(`requireRole`, `requirePermission`, `requireAuth`) and the client gates in
`src/client/components/Layout.svelte` + `src/client/pages/*.svelte` (via
`can()` / `isAdminSurface()` from `src/client/capabilities.ts`).

## Semantics

- `requireRole("admin")` — admits `admin` **and** `super_admin` (implicitly
  outranks every role).
- `requirePermission("x.read")` — admits users whose **effective** permission
  set (role permissions minus per-user denies plus per-user grants) contains
  the slug, **and** `super_admin` (implicit `*`).
- A redirect to `/login` means "unauthenticated"; a redirect to `/dashboard`
  means "authenticated but not authorized".
- Client capability payload: every Inertia page carries `auth.can` — the
  effective slugs, or `["*"]` for `super_admin`. The client `can()` helper
  gates navigation and page rendering with the **same** data the server
  guards use. There are no hardcoded `role === 'admin'` checks left.

## Public / unauthenticated

| Route | Auth | Notes |
| --- | --- | --- |
| `/` , `/dashboard` | — (guest pages) | public shell |
| `/login` `/register` `/forgot-password` `/reset-password` GET | guest only | guests redirected to `/dashboard` when logged in |
| `/login` `/register` POST | rate limit (IP **and** account) | brute-force protection |
| `/contact` POST | rate limit | public contact form |
| `/whatsapp/webhook` POST | shared secret + replay window + rate limit | provider-authenticated |
| `/auth/google` `/auth/google/callback` | OAuth flow | |
| `/health` `/assets/*` | — | infra (app.ts) |

## Authenticated (any role)

| Route | Guard | Notes |
| --- | --- | --- |
| `/profile` GET/PATCH, `/profile/avatar` POST | `requireAuth` | own account only |
| `/media` GET + `/media/:id` GET | `requireAuth` + `media.read` | owner-scoped (admin sees all) |
| `/media/picker` GET | `requireAuth` + `media.read` | owner-scoped |
| `/uploads/*` (tus) | `requireAuth` + ownership | private, owner-scoped, completed-only |

## Admin surface (requireRole("admin") + permission)

| Route | Permission | Action |
| --- | --- | --- |
| `/users` GET | `users.read` | list/search/pagination |
| `/users` POST | `users.create` | create |
| `/users/:id` PATCH | `users.update` | update (protected-role guarded) |
| `/users/:id/status` POST | `users.activate` | activate/deactivate |
| `/users/:id` DELETE | `users.delete` | delete (last super-admin protected) |
| `/roles` GET / POST | `roles.read` / `roles.create` | list / create |
| `/roles/:id` PATCH | `roles.update` | update (built-ins locked) |
| `/roles/:id/permissions` POST | `roles.assign` | assign permission set |
| `/roles/:id` DELETE | `roles.delete` | delete (built-ins locked) |
| `/permissions` GET / POST | `permissions.read` / `permissions.create` | list / create |
| `/permissions/:id` PATCH / DELETE | `permissions.update` / `permissions.delete` | edit / delete (built-ins locked) |
| `/settings` GET | `settings.read` | admin settings page |
| `/settings` POST (save) | `settings.update` | persist settings |
| `/email` GET | `email.read` | mail config + templates |
| `/email/config` POST | `email.update` | save SMTP/provider config |
| `/email/templates` CRUD | `email.update` | template lifecycle |
| `/email/templates/:id/preview` + `/email/test` | `email.read` / `email.test` | preview / send test |
| `/whatsapp` GET | `whatsapp.read` | WhatsApp config + templates |
| `/whatsapp/config` POST | `whatsapp.update` | save provider/API key |
| `/whatsapp/templates` CRUD | `whatsapp.update` | template lifecycle |
| `/whatsapp/templates/:id/preview` + `/whatsapp/test` | `whatsapp.read` / `whatsapp.test` | preview / send test |
| `/activity` GET | `activity.read` | audit log |
| `/notifications` GET | `notifications.read` | notification center |
| `/notifications/:id/read` POST | `notifications.update` | mark read (ownership/broadcast scoped) |
| `/contact/inbox` GET | `contact.read` | inbox list/search |
| `/contact/inbox/:id` GET | `contact.read` | detail |
| `/contact/inbox/:id/status` POST | `contact.update` | status change |
| `/contact/inbox/:id/reply` POST | `contact.reply` | reply |
| `/contact/inbox` bulk DELETE | `contact.update` + `contact.delete` (combined) | bulk delete (refinement tracked in SEC-08) |
| `/billing` GET | — (page without permission guard) | dashboard/statistics page |

## Navigation parity

`Layout.svelte` nav items declare the same slug as the page's read guard:

| Nav item | `can` slug |
| --- | --- |
| Users / Roles / Permissions | `users.read` / `roles.read` / `permissions.read` |
| WhatsApp / Email / Notifications / Contact | `whatsapp.read` / `email.read` / `notifications.read` / `contact.read` |
| Settings / Activity | `settings.read` / `activity.read` |

A user without the slug sees no nav entry and is server-side redirected from
the page — both gates agree by construction.

## Testing

- `tests/rbac.test.ts` — role/permission matrix incl. capability payload
  (`auth.can`), super_admin `["*"]`, admin-page rendering for super_admin,
  and nav parity for a revoked permission.
- `tests/security/permission-guards.test.ts` — per-surface deny checks.
- `tests/security/protected-role.test.ts` — super_admin mutation protection.
