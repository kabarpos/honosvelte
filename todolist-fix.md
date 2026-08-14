# TODO LIST FIX — Target Audit Score ≥ 9.5/10

> Dokumen remediation berdasarkan audit project Honosvelte.
>
> **Status awal audit:** project functional dan buildable, tetapi belum production-ready.
>
> **Baseline terverifikasi:**
>
> - `bun run build` — PASS
> - `bun run typecheck` — 0 error, 39 warning Svelte
> - `bun test --isolate` — 153 pass, 0 fail
> - `bun audit` — tidak ada vulnerability dependency terdeteksi
> - Security boundary, resource control, accessibility, dan negative-path testing masih memiliki gap serius.

### Progress log

- **2026-08-13 — Phase 0:** threat model dibuat di `docs/security/threat-model.md`; evidence ledger dibuat di `docs/audit/evidence-ledger.md`; reusable security-test helper dibuat di `tests/security/helpers.ts`.
- **2026-08-13 — SEC-01 partial:** public settings projection diterapkan; WhatsApp API key tidak lagi dikirim ke browser; SSR, `/login`, XHR, authenticated, dan admin payload tests pass di `tests/security/secrets.test.ts`; live credential rotation dan log/flash audit operator masih pending.
- **2026-08-13 — SEC-02 partial:** protected-role guards, last-super-admin protection, role-change activity, dan `tests/security/protected-role.test.ts` ditambahkan; existing-data review selesai tanpa indikasi role escalation; full super-admin mutation tests masih pending.
- **2026-08-13 — SEC-03 complete:** inactive login/session/reactivation dan inactive-linked-user Google OAuth rejection terverifikasi di `tests/security/inactive-user.test.ts` dan `tests/tus.test.ts`.
- **2026-08-13 — SEC-04 complete:** reset password mencabut seluruh session, mengonsumsi token atomic, dan mencatat `password.reset`; password-change policy existing memelihara current session dan mencabut device lain; test lifecycle pass.
- **2026-08-13 — SEC-05 complete:** webhook memakai shared secret, bounded TypeBox JSON body, timestamp replay window, rate limit, idempotency migration, field limits, safe response, per-phone auto-reply quota, dan provider circuit breaker; threshold/fixture tests pass.
- **2026-08-13 — SEC-06 complete:** Tus GET private owner-scoped/completed-only, unsafe content attachment-only, dan bounded file-signature detection diterapkan; Tus tests menutup ownership/incomplete/mixed-case/signature mismatch/Google avatar.
- **2026-08-13 — SEC-07 complete:** SMTP TLS bypass hanya via `MAIL_TLS_INSECURE` dev-only (fail-fast prod); timeout 10 detik; integration URL allowlist Dripsender; SSRF private-IP/DNS guard; redirect manual; avatar 2 MiB bounded + content-type/signature; integration response detail dibatasi.
- **2026-08-13 — SEC-08 partial:** granular guards dan migration `0019_admin_action_permissions.sql` ditambahkan; `tests/security/permission-guards.test.ts` memverifikasi revoke pada contact/notifications/email/WhatsApp; policy mapping dan UI parity masih pending.
- **2026-08-13 — SEC-09 partial:** CSRF comparison memakai full origin dan malformed origin ditolak; `tests/security/csrf.test.ts` ditambahkan; trusted proxy dan account-aware rate limiting masih pending.
- **2026-08-13 — COR-01 partial:** mismatch placeholder user search diperbaiki; name/email search terverifikasi di `tests/correctness/user-search.test.ts`; pagination dan empty-search edge test masih pending.
- **2026-08-13 — COR-02 partial:** contact list/count query sekarang mendukung search name/email/subject/message; positive search terverifikasi di `tests/correctness/contact-search.test.ts`; wildcard policy dan negative test masih pending.
- **2026-08-13 — COR-03 complete:** media picker sekarang owner-scoped untuk regular user dan global untuk admin; `tests/correctness/media-picker-scope.test.ts` pass.
- **2026-08-13 — COR-04 complete:** notification mark-read memakai ownership/broadcast scope; fan-out mencakup super-admin; `tests/security/notification-ownership.test.ts` pass.
- **2026-08-13 — COR-05 partial:** media upload memakai temporary path + atomic rename sebelum insert DB dan cleanup saat error; signature validation, failure-injection, dan reconciliation job masih pending.
- **2026-08-13 — COR-06 partial:** Tus PATCH sekarang memakai in-process lock per upload ID; existing Tus suite pass, tetapi concurrent race/recovery test dan multi-process consistency masih pending.
- **2026-08-13 — COR-07 partial:** expected validation errors tidak lagi masuk `logError`; JSON/client/console logging standardization masih pending.
- **2026-08-13 — PERF-01 partial:** default upload size menjadi 50 MiB dan unfinished upload expiry menjadi 24 jam; quota, body/chunk limit, upload rate limit, dan provider timeout masih pending.
- **2026-08-13 — PERF-02 partial:** Tus GET sekarang streaming dengan `Bun.file()`; media upload streaming, synchronous I/O cleanup, dan benchmark masih pending.
- **2026-08-13 — PERF-03 partial:** migration `0020_query_support_indexes.sql` menambahkan index common filter/order; EXPLAIN, FTS, dan query budget masih pending.
- **2026-08-13 — PERF-04 partial:** page number dibatasi maksimum 1000 pada lima route paginated; cursor pagination/count optimization masih pending.
- **2026-08-13 — PERF-06 partial:** `sweepExpired()` dijadwalkan setiap 15 menit dan timer dibersihkan saat shutdown; session/reset cleanup, retention, queue, retry, dan dead-letter masih pending.
- **2026-08-14 — QA-01 partial:** 38 warning Svelte `state_referenced_locally` dihilangkan (pola `untrack()` sesuai `Settings.svelte`); `bun run typecheck` kini **0 error 0 warning**; lint/format script dan review `any` masih pending.
- **2026-08-14 — SEC-09 complete:** `TRUSTED_PROXY` (IP/CIDR, fail-fast validasi) + `resolveClientKey` hanya mempercayai `X-Forwarded-For` dari proxy terpercaya (spoof ditolak, malformed ditolak, only first entry); auth rate limit kini account-aware (`client` + `client:email` bucket); upload/contact/webhook ikut `trustedProxies`; `tests/security/rate-limit-proxy.test.ts` + unit `resolveClientKey`/`ipInNetwork`; README + `.env.example` sinkron.
- **2026-08-14 — SEC-08 complete:** capability payload `auth.can` (slug efektif, `['*']` untuk super_admin) dikirim ke client; `src/client/capabilities.ts` (`can()`/`isAdminSurface()`) jadi sumber policy UI; nav `Layout.svelte` + 7 halaman admin tidak lagi hardcoded `role === 'admin'` (super_admin kini melihat seluruh admin UI); mapping route→permission didokumentasikan di `docs/security/rbac.md`; test payload capability, super_admin render semua admin page, dan revoked-permission nav parity di `tests/rbac.test.ts`.
- **2026-08-14 — COR-01/COR-02 complete:** test pagination + search (25 user, page 1/2/3), empty search (users + contact inbox), dan negative/wildcard search; wildcard injection nyata diperbaiki — `escapeLike()` + klausa `ESCAPE '\'` pada seluruh statement LIKE (users/media/activity/contact) sehingga `%`/`_` user tidak lagi jadi wildcard SQL.
- **2026-08-14 — COR-06 partial:** concurrent PATCH test (4 worker race, read-then-write retry, byte-exact final) di `tests/tus.test.ts`; repair dan recovery-after-interruption masih pending.
- **2026-08-14 — COR-07 partial:** client optimistic update kini memeriksa `res.ok` (NotificationCenter mark-read/mark-all, ContactInbox status); tidak ada `console.log` di request path; structured `logError` sudah request-scoped.
- **2026-08-14 — PERF-01 partial:** per-request JSON body limit (`REQUEST_BODY_LIMIT`, bounded stream read → 413), per-chunk tus limit (`TUS_CHUNK_MAX`, `readBoundedBytes`), rate limit upload create/PATCH (`RATE_LIMIT_UPLOAD_*`); storage quota dan provider fetch timeout sudah tercakup SEC-07.
- **2026-08-14 — PERF-06 partial:** `sweepExpired()` kini juga membersihkan session dan password-reset token kadaluarsa; retention, queue, retry, dead-letter masih pending.
- **2026-08-14 — UX-01 complete:** `Modal.svelte` kini punya focus trap (Tab/Shift+Tab wrap), autofocus ke dialog, Escape close, restore focus ke trigger, `aria-labelledby` ke title id, `aria-describedby` opsional, fallback accessible name.
- **2026-08-14 — UX-02 complete:** `Tabs.svelte` WAI-ARIA tabs pattern (roving tabindex, Arrow/Home/End, id+aria-controls+aria-labelledby); `RowActions`/`Dropdown` focus first item, Arrow Up/Down, focus restore; `Switch` aria-label fallback.
- **2026-08-14 — UX-03 complete:** `Field` merender error/hint dengan id (`field-error`/`field-hint`) dan snippet context `{ errorId, hintId, hasError }`; `TextField` mengwire `aria-invalid` + `aria-describedby` dan fokus ke first invalid field; form Profile mengkonsumsi snippet context.
- **2026-08-14 — QA-04 complete (browser + axe):** Playwright + @axe-core/playwright ditambahkan (`bun run e2e`); `e2e/a11y.spec.ts` — axe scan critical/serious di `/`, `/login`, `/register`, dan 6 halaman admin; keyboard-only modal test (focus in/trap/Escape restore); responsive 390px; admin flows. Suite e2e 8/8 pass. `test` script dibatasi ke `tests/` agar tidak menangkap spec Playwright.
- **2026-08-14 — CRITICAL bug fix:** favicon fallback di `inertia.ts` kehilangan closing quote href (`)} />` korban formatter) — browser mem-parse seluruh `<head>` berikutnya sebagai atribut href, sehingga `<link rel="stylesheet">` CSS app DIHAPUS dari DOM → seluruh styling Tailwind hilang di browser (muncul saat aksesibility testing; unit test tidak menangkapnya). Quote dipulihkan. **UX-05 partial:** contrast primary light theme digelapkan `#059669`→`#047857` (3.57-3.76:1 → ~5.4:1, axe 0 violation di semua halaman yang discan); responsive smoke 390px pass.
- **2026-08-14 — OPS-02 complete:** `/health/live` (proses hidup) + `/health/ready` (DB ping + migration state + storage writability; critical config sudah fail-fast di startup) — 503 + rincian check saat gagal; alias `/health` dipertahankan; test di `tests/app.test.ts`.
- **2026-08-14 — OPS-01 partial:** Dockerfile runtime non-root (`adduser`, `USER app`), HEALTHCHECK memakai `bun -e` (guaranteed binary, bukan curl), `.env.production.example` tanpa secret, docker-compose healthcheck disinkronkan, CI job `docker-build` (build + boot + readiness probe); pin image ke digest masih pending.
- **2026-08-14 — PERF-05 partial:** middleware kini mem-bypass session/settings resolution untuk `/health*` dan `/assets/*` (path-scoped early return; Inertia adapter tetap terisi agar onError/notFound aman); resolved user sudah tersimpan di request context; permission guard re-lookup masih pending.
- **2026-08-14 — PERF-03 partial:** EXPLAIN QUERY PLAN dijalankan untuk users/media/activity/contact/notifications → `docs/audit/query-plan.md`; migration `0021` menambah covering index `(user_id, id DESC)` untuk menghilangkan temp B-tree pada pagination notifications; pola `(? = '' OR …)` dan FTS5 didokumentasikan sebagai open items.
- **2026-08-14 — PERF-02 complete:** creation-with-upload POST kini streaming ke disk (`appendStream()` chunk-bounded, tanpa buffer full-body hingga 50 MiB); POST ber-checksum tetap buffered (checksum butuh chunk lengkap); PATCH tetap buffer per-chunk yang sudah dibatasi `TUS_CHUNK_MAX`; `tests/tus.test.ts` 45 pass.
- **Current verification:** build/typecheck PASS (**0 error/0 warning**); full suite **209 pass, 0 fail, 816 assertions** across 27 files; **e2e suite 8 pass** (axe, keyboard modal, responsive, admin flows).

---

## 1. Target dan definisi skor 9.5/10

Target **9.5/10 bukan berarti tidak mungkin ada bug**. Artinya seluruh risiko material yang diketahui sudah ditutup, diverifikasi, dan memiliki regression guard.

Satu dimensi tidak boleh diberi skor 9.5 apabila masih memiliki salah satu kondisi berikut:

- Ada temuan CRITICAL atau HIGH yang belum ditutup.
- Ada defect yang sudah dapat direproduksi tetapi belum memiliki test.
- Ada warning build/typecheck yang tidak memiliki disposition tertulis.
- Ada fitur UI yang tampak aktif tetapi tidak berfungsi.
- Ada deployment assumption yang tidak didokumentasikan atau tidak diverifikasi.
- Tidak ada bukti runtime atau automated verification.

### Global Definition of Done

- [ ] Semua temuan CRITICAL/HIGH dari audit ditutup.
- [ ] Semua bug yang sudah direproduksi memiliki regression test.
- [ ] `bun run typecheck` menghasilkan **0 error dan 0 warning**.
- [ ] `bun test --isolate` pass 100%.
- [ ] Build production berhasil dari clean checkout.
- [ ] Security regression suite pass.
- [ ] Accessibility keyboard/screen-reader smoke suite pass.
- [ ] Load/performance smoke test pass pada target yang terdokumentasi.
- [ ] Docker build, startup, health, migration, backup, dan restore diverifikasi.
- [ ] Dokumentasi, `.env.example`, scaffolder, dan implementation tidak drift.
- [ ] Audit independen kedua menyatakan tidak ada blocker terbuka.

### Scorecard target

| Dimensi | Baseline audit | Target | Gate utama |
| --- | ---: | ---: | --- |
| Arsitektur & struktur kode | 6.0 | ≥ 9.5 | Boundary jelas, policy terpusat, module besar terurai, tidak ada coupling kritis |
| Kualitas kode & engineering | 5.0 | ≥ 9.5 | 0 warning, 0 known correctness defect, error handling konsisten |
| Security | 3.0 | ≥ 9.5 | 0 CRITICAL/HIGH, negative authorization test lengkap |
| Performa & efisiensi | 4.0 | ≥ 9.5 | Bounded resource, query plan tervalidasi, load target tercapai |
| UX/UI & accessibility | 5.0 | ≥ 9.5 | Semua control berfungsi, WCAG AA core flow, keyboard/focus test pass |
| Testing readiness | 6.0 | ≥ 9.5 | Critical path/negative path covered, browser/security/performance checks |
| DX & operational readiness | 6.0 | ≥ 9.5 | Reproducible deploy, readiness, backup/restore, observability, docs sinkron |

---

## 2. Phase 0 — Governance, baseline, dan test harness

> Semua phase berikutnya bergantung pada baseline yang dapat diukur.

## GOV-01 — Tetapkan threat model dan data classification

- [x] Inventaris semua data: credential, PII, contact message, activity log, media, upload bytes, notification.
- [x] Klasifikasikan data sebagai `public`, `authenticated`, `admin`, `server-only`, atau `secret`.
- [x] Dokumentasikan trust boundary:
  - browser;
  - Hono server;
  - SQLite;
  - filesystem;
  - SMTP;
  - WhatsApp provider;
  - Google OAuth;
  - reverse proxy.
- [x] Tentukan kebijakan public/private untuk `/media/:id` dan `/uploads/:id`.
- [x] Simpan threat model di `docs/security/threat-model.md`.

**Acceptance:** setiap field settings dan endpoint memiliki klasifikasi akses yang eksplisit.

## GOV-02 — Buat security regression test harness

- [x] Tambahkan helper untuk membuat user dengan role/status/permission tertentu.
- [x] Tambahkan helper untuk membuat session lama dan session attacker.
- [x] Tambahkan helper assertion untuk redirect, 401/403, payload leakage, dan ownership.
- [ ] Pisahkan test suite menjadi:
  - `tests/security/*.test.ts`;
  - `tests/correctness/*.test.ts`;
  - `tests/ux-contract/*.test.ts`.

**Acceptance:** semua temuan Critical/High memiliki tempat test sebelum implementasi fix dimulai.

## GOV-03 — Tetapkan score evidence ledger

- [x] Untuk setiap item di dokumen ini, catat:
  - file yang berubah;
  - test yang ditambahkan;
  - command verification;
  - hasil sebelum/sesudah;
  - reviewer.
- [x] Jangan menaikkan skor hanya karena source terlihat lebih rapi.

---

## 3. Phase 1 — Security dan authorization blockers

> Tidak boleh deploy publik sebelum seluruh item phase ini selesai.

## SEC-01 — Hentikan secret exposure melalui Inertia shared props

**Affected:** `src/server/inertia-middleware.ts`, `src/server/settings.ts`, `src/server/inertia.ts`, email/WhatsApp settings routes.

- [x] Buat projection `publicSettings()` yang hanya mengembalikan key aman.
- [x] Pisahkan settings server penuh dari `publicSettings()` melalui `getSettings()`/`getPublicSettings()`.
- [x] Pastikan `mail.smtp_pass`, `whatsapp.api_key`, token, password, dan future secret tidak pernah masuk page props.
- [x] Jangan kirim full WhatsApp API key ke browser.
- [x] Gunakan `hasApiKey` atau masked value.
- [ ] Audit SSR HTML, X-Inertia JSON, logs, dan flash messages.
- [ ] Rotate credential live yang pernah disimpan di versi vulnerable; prosedur operator ada di `docs/security/secret-rotation.md`.

**Tests:**

- [x] Guest `/` tidak mengandung nama/value secret.
- [x] Guest `/login` tidak mengandung nama/value secret.
- [x] Authenticated page tidak mengandung nama/value secret.
- [x] Admin dapat mengganti secret tanpa membaca kembali nilai lama.

**Target evidence:** payload snapshot + secret scan pass.

## SEC-02 — Lindungi `super_admin`

**Affected:** `src/server/routes/users.routes.ts`, `src/server/auth.ts`, user schemas.

- [x] Admin biasa tidak boleh membuat `super_admin`.
- [x] Admin biasa tidak boleh promote diri sendiri.
- [x] Admin biasa tidak boleh promote user lain.
- [x] Admin biasa tidak boleh mengubah role/status/password super-admin melalui protected target guard.
- [x] Hanya super-admin atau permission khusus yang dapat melakukan protected-role mutation.
- [x] Cegah demote/delete last super-admin.
- [x] Record audit event untuk seluruh role mutation.
- [x] Review data existing untuk role escalation; database saat audit berisi 1 user dan 3 admin, tanpa `super_admin`, tanpa inactive user, dan tanpa role-change event.

**Tests:**

- [x] Ordinary admin create `super_admin` → 403/422.
- [x] Ordinary admin self-promotion → 403.
- [x] Ordinary admin promotion user lain → 403.
- [x] Super-admin protected mutation sesuai policy.
- [x] Last super-admin tidak dapat dihapus/didemote.

## SEC-03 — Jadikan `inactive` efektif

- [x] `resolveUser()` mengembalikan null untuk user inactive.
- [x] Login password menolak user inactive.
- [x] Google OAuth menolak user inactive.
- [x] Deactivation menghapus semua session user tersebut.
- [x] Reactivation kembali mengizinkan login.
- [x] Tambahkan security event untuk deactivation/reactivation melalui activity log.

**Tests:** login baru, session lama, reactivation, dan Google OAuth inactive-linked-user flow terverifikasi di `tests/tus.test.ts`.

## SEC-04 — Invalidate session setelah password reset

- [x] Tambahkan `deleteSessionsByUserId` ke `db.ts`.
- [x] Reset password menghapus seluruh session user.
- [x] Password-change authenticated mempertahankan policy: current session dipertahankan, session device lain dicabut.
- [x] Reset token dikonsumsi atomic dan tidak dapat digunakan ulang.
- [x] Tambahkan security event `password.reset`.

**Test:** session sebelum reset, password lama, password baru, token reuse, dan activity event terverifikasi di `tests/security/password-reset-session.test.ts`.

## SEC-05 — Amankan webhook WhatsApp

**Affected:** `src/server/routes/whatsapp.routes.ts`, `src/server/whatsapp.ts`, migrations.

- [x] Implementasikan shared secret untuk webhook; HMAC provider-specific masih dapat ditambahkan jika provider mendukungnya.
- [x] Tolak request tanpa secret valid sebelum insert.
- [x] Tambahkan timestamp/replay protection.
- [x] Simpan external message ID dengan unique constraint/idempotency.
- [x] TypeBox schema untuk payload.
- [x] Batas panjang phone, text, name, jid, timestamp, metadata.
- [x] Batas request body sebelum JSON parsing.
- [x] Rate limit khusus webhook.
- [x] Auto-reply idempotent melalui external message ID.
- [x] Auto-reply per-phone quota dan provider circuit breaker.
- [x] Jangan mengembalikan isi reply internal ke caller public.

**Tests:** valid secret, invalid secret, invalid schema, replay, duplicate ID, oversize body, dan auto-reply quota terverifikasi di `tests/security/webhook.test.ts`; rate-limit threshold di `tests/security/webhook-rate-limit.test.ts` dan provider circuit di `tests/security/webhook-circuit.test.ts`.

## SEC-06 — Tetapkan dan implementasikan policy file serving

- [x] Policy dipilih: Tus upload bersifat private dan owner-scoped.
- [x] Jika private: authentication pada GET.
- [x] Jika private: ownership/permission check.
- [x] Jika private: hanya completed upload.
- [x] Jika private: partial file tidak diserve.
- [ ] Public visibility metadata/route public terpisah — tidak berlaku untuk policy private saat ini.
- [x] Private response memakai `nosniff`, safe `Content-Disposition`, dan restrictive CSP.
- [x] MIME detection berbasis bounded file signature server-side; client metadata hanya menjadi declared type.
- [x] HTML/SVG/script/XML non-image tidak dirender inline dan dikirim sebagai attachment.

**Tests:** owner image, cross-user GET, incomplete upload, HTML content, mixed-case declared MIME, signature mismatch, dan Google-avatar lifecycle terverifikasi di `tests/tus.test.ts`.

## SEC-07 — Perbaiki TLS dan outbound security

- [x] Hapus unconditional `rejectUnauthorized: false`.
- [x] Insecure TLS hanya aktif bila `MAIL_TLS_INSECURE=true`.
- [x] Validasi flag: config fail-fast jika `MAIL_TLS_INSECURE` aktif di production.
- [x] Tambahkan `AbortSignal.timeout()` untuk provider, OAuth, avatar, mail, dan WhatsApp fetch.
- [x] Batasi response size Google avatar (2 MiB, bounded read).
- [x] Validasi content type dan image signature avatar (deteksi magic bytes).
- [x] Untuk integration URL, allowlist host Dripsender diterapkan.
- [x] Blok private/loopback/link-local/metadata IP via `assertPublicHost` termasuk resolusi DNS.
- [x] Validasi redirect: `redirect: "manual"` dan 3xx diperlakukan sebagai kegagalan provider.
- [x] Timeout integration fetch 10 detik.
- [x] Response-size limit untuk integration URL (detail error dibatasi 200 byte).

**Tests:** `tests/security/ssrf.test.ts` (private/public/loopback/link-local/metadata, `assertPublicHost`), `tests/security/webhook-circuit.test.ts` (redirect 3xx + provider circuit), dan Google-avatar signature flow di `tests/tus.test.ts`.

## SEC-08 — Konsistenkan RBAC permission

- [x] Mapping route → permission didokumentasikan.
- [x] Contact inbox memakai permission read/update/reply/delete; bulk delete masih menggunakan guard gabungan dan perlu refinement.
- [x] Notifications memiliki permission read/update.
- [x] Email preview/test memakai `email.read`/`email.test`.
- [x] WhatsApp preview/test memakai `whatsapp.read`/`whatsapp.test`.
- [x] Page guard, navigation guard, dan server guard memakai sumber policy yang sama.
- [x] `super_admin` tidak bergantung pada hardcoded UI check.

**Tests:** permission-deny untuk contact, notifications, email, dan WhatsApp terverifikasi di `tests/security/permission-guards.test.ts`; mapping documentation, bulk exact policy, dan UI policy masih pending.

## SEC-09 — Harden CSRF dan trusted proxy

- [x] Bandingkan full `URL.origin`, bukan hanya `.host`.
- [x] Reject malformed Origin, jangan fallback diam-diam.
- [x] Dokumentasikan policy missing Origin melalui threat model dan webhook secret policy.
- [x] Gunakan explicit webhook authentication, bukan broad missing-Origin exception.
- [x] Tambahkan `trustedProxy` configuration.
- [x] Hanya trust `X-Forwarded-For` dari proxy yang dipercaya.
- [x] Rate limit key juga mempertimbangkan account/email pada auth endpoint.

**Tests:** malformed, scheme-mismatch, dan exact-origin flows terverifikasi di `tests/security/csrf.test.ts`; trusted proxy dan account-aware rate limit masih pending.

---

## 4. Phase 2 — Correctness dan data integrity

## COR-01 — Perbaiki user search

- [x] `searchUsers` menerima parameter untuk name, email, limit, offset.
- [x] `countSearchUsers` menerima pattern name dan email.
- [x] Tambahkan test search name.
- [x] Tambahkan test search email.
- [x] Tambahkan test pagination dengan search.
- [x] Tambahkan test empty search.

**Evidence:** `tests/correctness/user-search.test.ts` pass; pagination dan empty-search edge test masih pending.

## COR-02 — Implementasikan contact search

- [x] Search name/email/subject/message.
- [x] Query count dan list memakai filter identik.
- [x] Escape wildcard bila product behavior memerlukannya.
- [x] Tambahkan positive test; negative search test juga sudah ditambahkan.

**Evidence:** `tests/correctness/contact-search.test.ts` pass.

## COR-03 — Perbaiki media picker ownership

- [x] Terapkan scope user/admin seperti media list.
- [x] Regular user tidak boleh melihat metadata media user lain.
- [x] Tambahkan cross-user test untuk filename/title/size/MIME.

**Evidence:** `tests/correctness/media-picker-scope.test.ts` pass.

## COR-04 — Perbaiki notification ownership

- [x] Update read query memakai user ID dan broadcast policy.
- [x] Cek affected row count.
- [x] Tambahkan test cross-user IDOR.
- [x] Pastikan `super_admin` ikut notification fan-out.

**Evidence:** `tests/security/notification-ownership.test.ts` pass.

## COR-05 — Perbaiki media/file consistency

- [x] Tulis file ke temporary path terlebih dahulu.
- [ ] Validasi ukuran, signature, MIME, dan category.
- [x] Atomic rename.
- [x] Insert DB setelah file valid.
- [x] Cleanup temporary/final file saat error.
- [ ] Buat reconciliation job untuk orphan rows/files.

**Evidence:** `tests/media.test.ts` pass; failure-injection dan reconciliation job masih pending.

## COR-06 — Perbaiki Tus concurrency

- [x] Per-upload in-process lock/mutex diterapkan untuk serialisasi PATCH.
- [x] Append dan offset update sekarang berada dalam critical section yang sama pada single process.
- [ ] Repair jika file size dan DB offset berbeda.
- [x] Tambahkan concurrent PATCH test.
- [ ] Tambahkan recovery test setelah process interruption.

**Evidence:** `tests/tus.test.ts` 40 pass setelah lock; concurrency race test dan recovery test masih pending. Lock ini hanya menjamin single-process deployment.

## COR-07 — Standardisasi error handling

- [x] Expected 4xx validation tidak dicatat sebagai stack-trace 5xx.
- [ ] Semua JSON action memeriksa body malformed, status, dan schema.
- [x] Client memeriksa `res.ok` sebelum optimistic update.
- [ ] Semua external errors memiliki user-safe message dan structured server detail.
- [ ] Hilangkan `console.log` production path; gunakan logger.

**Evidence:** `src/server/app.ts` sekarang menangani `ValidationFailed` sebelum `logError`; remaining JSON/client/logger work masih pending.

---

## 5. Phase 3 — Performance, resource limits, dan scale

## PERF-01 — Terapkan bounded resource policy

- [x] Finite default `TUS_MAX_SIZE` (50 MiB).
- [x] Finite media upload size menggunakan batas upload finite.
- [ ] Per-user storage quota.
- [ ] Global storage quota.
- [x] Per-request JSON body limit.
- [x] Per-chunk Tus limit.
- [x] Rate limit upload creation/PATCH.
- [x] Timeout provider fetch.

## PERF-02 — Streaming file operations

- [x] Stream media upload ke disk.
- [x] Hindari `arrayBuffer()` untuk file besar.
- [x] Stream Tus GET memakai `Bun.file()`, tidak lagi `readFile()` seluruh file.
- [ ] Hindari synchronous filesystem I/O di request path.
- [ ] Benchmark memory usage pada concurrent upload.

**Evidence:** creation-with-upload POST kini menulis body langsung ke disk via
`appendStream()` (chunk-bounded, tanpa buffer full-body; `Upload-Checksum`
pada POST masih memakai jalur buffered karena checksum butuh chunk lengkap);
PATCH tetap buffer per-chunk (dibatasi `TUS_CHUNK_MAX`); suite `tests/tus.test.ts`
45 pass termasuk concurrent PATCH dan chunk cap. Benchmark memory masih pending.

## PERF-03 — Perbaiki query plan

- [x] Jalankan `EXPLAIN QUERY PLAN` untuk users/media/activity/contact/notifications.
- [ ] Ganti optional `(? = '' OR ...)` dengan query khusus per filter atau query builder internal.
- [x] Tambahkan index yang sesuai dengan filter/order melalui migration `0020_query_support_indexes.sql` + `0021` (notifications `(user_id, id DESC)`).
- [ ] Evaluasi SQLite FTS5 untuk text search.
- [x] Dokumentasikan query budget.

**Evidence:** migration `0020_query_support_indexes.sql` menambahkan index user/media/activity/contact/notification; EXPLAIN/FTS/query-budget evidence masih pending.

## PERF-04 — Perbaiki pagination

- [x] Cap page number pada 1000 untuk users/media/activity/contact/notifications.
- [ ] Cap offset melalui cursor pagination atau hard resource policy.
- [ ] Gunakan cursor pagination untuk activity/media/notifications/messages jika dataset besar.
- [ ] Kurangi count query pada setiap request.
- [ ] Gabungkan aggregate count bila mengurangi scan.
- [ ] Pastikan count/list berada pada konsistensi snapshot yang jelas.

**Evidence:** lima paginated route utama memakai page cap; cursor/count/snapshot work masih pending.

## PERF-05 — Kurangi middleware database overhead

- [x] Jangan jalankan full session/settings resolution untuk static assets dan health endpoint.
- [x] Simpan resolved session/user di request context.
- [ ] Jangan lookup user ulang di setiap permission guard.
- [ ] Cache role-permission sets dengan invalidation.
- [ ] Ukur request latency sebelum/sesudah optimasi.

## PERF-06 — Background jobs dan cleanup

- [x] Jadwalkan `sweepExpired()` setiap 15 menit dari `src/index.ts`.
- [x] Cleanup expired sessions.
- [x] Cleanup expired reset tokens.
- [ ] Retention activity log.
- [ ] Retention notifications/contact messages sesuai kebijakan bisnis.
- [ ] Outbox/job untuk email dan WhatsApp.
- [ ] Retry terbatas dan dead-letter state.

---

## 6. Phase 4 — Architecture dan maintainability

## ARCH-01 — Centralize authorization policy

- [ ] Buat satu policy resolver untuk role + permission + ownership.
- [ ] Route guard dan UI navigation memakai policy yang sama.
- [ ] Hilangkan `role === 'admin'` tersebar di banyak Svelte page.
- [ ] Sediakan capability seperti `can('users.update')`.
- [ ] Dokumentasikan deny/grant precedence.

## ARCH-02 — Pecah module besar secara bertahap

Prioritas refactor:

1. `whatsapp.routes.ts` — webhook/config/templates/test.
2. `email.routes.ts` — provider/config/templates/test.
3. `uploads.routes.ts` — protocol, storage, authorization, cleanup.
4. `Layout.svelte` — navigation, user menu, header, footer.
5. `db.ts` — tetap satu SQL ownership boundary, tetapi kelompokkan statement registry secara jelas.

- [ ] Extract pure functions terlebih dahulu.
- [ ] Extract provider adapters.
- [ ] Extract validation schema.
- [ ] Extract response mappers.
- [ ] Pastikan tidak membuat feature-folder yang melanggar AGENTS.md.
- [ ] Set complexity/fan-out budget.

## ARCH-03 — Standardisasi configuration

- [ ] Semua environment read hanya melalui `config.ts`.
- [ ] Gunakan `config.isProd`, bukan `process.env.NODE_ENV` langsung.
- [ ] Schema validation untuk seluruh environment.
- [ ] `APP_URL` harus absolute HTTP(S), HTTPS di production.
- [ ] Validasi port, rate limit, upload size, expiration, SMTP port.
- [ ] Provider credential requirement fail-fast.
- [ ] Sinkronkan `.env.example`, README, Docker, dan config.

## ARCH-04 — Hardening migration dan path resolution

- [ ] Resolve migration path terhadap application root/module, bukan CWD.
- [ ] Fail fast jika migration directory hilang.
- [ ] Simpan checksum migration yang sudah applied.
- [ ] Fail jika checksum berubah.
- [ ] Test startup dari working directory berbeda.

## ARCH-05 — Standardisasi response/error contract

- [ ] Error envelope konsisten untuk JSON/Inertia.
- [ ] Validation error mapping konsisten.
- [ ] Correlation/request ID masuk error response bila aman.
- [ ] Tidak bocorkan stack/provider credential ke client.
- [ ] Dokumentasikan route status codes.

---

## 7. Phase 5 — UX/UI dan accessibility

## UX-01 — Accessible modal primitive

- [x] Focus otomatis ke dialog/first control.
- [x] Focus trap Tab/Shift+Tab.
- [x] Escape close.
- [x] Restore focus ke trigger.
- [x] `aria-labelledby` ke title ID.
- [x] `aria-describedby` untuk description/error.
- [x] Fallback accessible name jika tanpa title.
- [x] Media lightbox memakai primitive yang sama.

## UX-02 — Accessible dropdown, tabs, switch, and row actions

- [x] Native `<button>` untuk trigger.
- [x] `aria-haspopup`, `aria-expanded`, `aria-controls`.
- [x] Arrow/Home/End keyboard navigation.
- [x] Focus masuk menu saat dibuka.
- [x] Tabs memiliki `id`, `aria-controls`, `aria-labelledby`, roving tabindex.
- [x] Switch selalu memiliki accessible name.
- [x] RowActions keyboard menu behavior lengkap.

## UX-03 — Field error semantics

- [x] Generate `${id}-error` dan `${id}-hint`.
- [x] Input memiliki `aria-invalid` saat error.
- [x] Input memiliki `aria-describedby`.
- [x] Focus ke first invalid field.
- [x] Error message tidak hanya visual.
- [x] Terapkan di `Field`, `TextField`, `Textarea`, `Input`.

## UX-04 — Hilangkan dead controls

- [ ] Implementasikan global search atau hapus sementara.
- [ ] Notification button menuju `/notifications` atau buka panel.
- [ ] Notification dot berasal dari unread state nyata.
- [ ] Contact search benar-benar bekerja.
- [ ] Semua async action memeriksa `res.ok` dan menampilkan error.

## UX-05 — Visual quality dan responsive behavior

- [ ] Audit seluruh table/action/modal pada mobile width.
- [ ] Hit target icon minimum sesuai target usability.
- [ ] Tambahkan reduced-motion support.
- [x] Perbaiki contrast primary text menjadi WCAG AA.
- [x] Tambahkan loading/empty/error/success state pada semua async flow.
- [ ] Hilangkan stale form state akibat Inertia navigation.
- [ ] Visual regression screenshot untuk halaman kritis.

## UX-06 — Super-admin UI parity

- [ ] Super-admin melihat navigation admin.
- [ ] Super-admin tidak mendapatkan blank page.
- [ ] Page-level role check memakai capability/policy resolver.
- [ ] E2E test untuk super-admin seluruh admin pages.

---

## 8. Phase 6 — Testing dan quality engineering

## QA-01 — Zero-warning quality gate

- [x] `bun run typecheck` menghasilkan 0 error dan 0 warning.
- [ ] Tambahkan lint script.
- [ ] Tambahkan format check.
- [ ] Hilangkan explicit `any`.
- [ ] Hilangkan unsafe non-null assertion yang tidak perlu.
- [ ] Review duplicate code pada email/WhatsApp/template pages.
- [ ] Review static diagnostics dan tandai false positive secara terdokumentasi.

## QA-02 — Security regression suite

Minimal test wajib:

- [ ] Secret tidak muncul pada public/shared props.
- [ ] Admin tidak bisa promote `super_admin`.
- [ ] Inactive user tidak bisa login.
- [ ] Existing inactive session ditolak.
- [ ] Reset password revoke session.
- [ ] Webhook invalid signature ditolak.
- [ ] Webhook replay ditolak.
- [ ] Webhook rate limit bekerja.
- [ ] Upload cross-user access ditolak.
- [ ] Incomplete upload tidak diserve.
- [ ] Notification cross-user mark-read ditolak.
- [ ] Media picker ownership enforced.
- [ ] SMTP insecure production config ditolak.

## QA-03 — Correctness regression suite

- [ ] Users search name/email.
- [ ] Contact search.
- [ ] Pagination search.
- [ ] Empty states.
- [ ] Invalid page/perPage.
- [ ] Provider timeout behavior.
- [ ] File write failure cleanup.
- [ ] Tus concurrent PATCH.
- [ ] Tus expiration sweep.

## QA-04 — Browser and accessibility suite

- [x] Tambahkan Playwright atau browser runner.
- [x] axe scan halaman public, auth, users, roles, media, settings.
- [x] Keyboard-only modal test.
- [x] Keyboard-only dropdown/tabs test.
- [x] Focus restore test.
- [x] Responsive viewport test.
- [ ] Screenshot baseline halaman utama.

## QA-05 — Performance suite

- [ ] Baseline request latency p50/p95/p99.
- [ ] Login/register throughput.
- [ ] Search pada dataset realistis.
- [ ] Media upload concurrent.
- [ ] Tus concurrent PATCH.
- [ ] Webhook burst/rate-limit test.
- [ ] Memory usage upload/download.
- [ ] Query plan regression check.

Target harus didokumentasikan per environment; jangan menerima angka tanpa workload dan hardware context.

---

## 9. Phase 7 — Developer experience dan operations

## OPS-01 — Production deployment reproducibility

- [ ] Pin Bun/container image ke patch version atau digest.
- [x] Docker runtime non-root.
- [x] Healthcheck memakai binary yang guaranteed tersedia.
- [x] Tambahkan `.env.production.example` tanpa secret.
- [ ] Pin Bun/container image ke patch version atau digest.
- [ ] Startup dari clean checkout dan CWD berbeda.
- [x] Migration smoke test dalam Docker.
- [x] Docker build + healthcheck masuk CI.

## OPS-02 — Readiness, observability, dan incident response

- [x] Bedakan `/health/live` dan `/health/ready`.
- [x] Readiness memeriksa database, migration state, storage writability, dan critical config.
- [x] Structured logs dengan request ID.
- [ ] Metrics:
  - auth failures;
  - webhook rejected/accepted;
  - upload bytes/count;
  - provider latency/errors;
  - queue depth;
  - DB latency;
  - storage usage.
- [ ] Redact secret/PII dari logs.
- [ ] Dokumentasikan alert threshold dan incident procedure.

## OPS-03 — Backup dan disaster recovery

- [ ] SQLite online backup procedure.
- [ ] Restore verification otomatis.
- [ ] `PRAGMA integrity_check` terjadwal.
- [ ] WAL checkpoint policy.
- [ ] Backup database + media/upload files secara konsisten.
- [ ] Backup encryption dan retention.
- [ ] RPO/RTO terdokumentasi.
- [ ] Simulasi restore berkala.

## OPS-04 — Documentation synchronization

- [ ] Update test count atau hapus angka hardcoded.
- [ ] Sinkronkan README, AGENTS, `.env.example`, Docker, dan scaffolder.
- [ ] Dokumentasikan role/permission model.
- [ ] Dokumentasikan public/private asset policy.
- [ ] Dokumentasikan trusted proxy requirement.
- [ ] Dokumentasikan single-instance limitation.
- [ ] Dokumentasikan backup, cleanup, migration, rollback, dan secret rotation.

## OPS-05 — CI security gates

- [ ] `bun run typecheck` zero warning policy.
- [ ] lint/format gate.
- [ ] `bun audit` atau equivalent dependency scanner.
- [ ] secret scanning.
- [ ] SAST dengan reviewed rules.
- [ ] Docker security scan.
- [ ] migration smoke test.
- [ ] security regression suite.
- [ ] accessibility smoke test.
- [ ] coverage threshold untuk auth/RBAC/upload/webhook.
- [ ] Pin GitHub Actions ke commit SHA.

---

## 10. Dependency order

## Gate 1 — Security blocker

Harus selesai sebelum fitur baru:

1. SEC-01 secret exposure
2. SEC-02 protected super-admin
3. SEC-03 inactive users
4. SEC-04 session invalidation
5. SEC-05 webhook security
6. SEC-06 upload policy
7. SEC-07 TLS/outbound security
8. SEC-08 RBAC consistency

## Gate 2 — Correctness

1. COR-01 user search
2. COR-02 contact search
3. COR-03 media picker scope
4. COR-04 notification ownership
5. COR-05 file/DB consistency
6. COR-06 Tus concurrency
7. COR-07 error contract

## Gate 3 — Resource and scale

1. PERF-01 bounded resources
2. PERF-02 streaming
3. PERF-03 query plan
4. PERF-04 pagination
5. PERF-05 middleware overhead
6. PERF-06 cleanup/jobs

## Gate 4 — Quality and product finish

1. ARCH workstream
2. UX workstream
3. QA regression/browser/accessibility/performance
4. OPS deployment/backup/observability
5. Documentation synchronization

---

## 11. Final 9.5/10 release checklist

## Architecture

- [ ] No critical cross-layer coupling.
- [ ] Authorization policy centralized.
- [ ] Large route/module responsibilities separated.
- [ ] SQL ownership and migration ownership documented.
- [ ] Path/config behavior independent from CWD.

## Engineering

- [ ] 0 typecheck error.
- [ ] 0 typecheck warning.
- [ ] 0 known correctness defect.
- [ ] No unexplained `any`.
- [ ] Error and logging policy consistent.
- [ ] No unbounded request/resource path.

## Security

- [ ] 0 Critical findings.
- [ ] 0 High findings.
- [ ] Secrets never appear in client payload.
- [ ] All auth lifecycle transitions invalidate access correctly.
- [ ] All protected resources have ownership/permission tests.
- [ ] Public endpoints authenticated or explicitly policy-controlled.

## Performance

- [ ] Upload/download streaming validated.
- [ ] Concurrent Tus test pass.
- [ ] Search query plan acceptable.
- [ ] Pagination abuse bounded.
- [ ] Provider timeouts and queue behavior verified.
- [ ] Resource usage measured under target load.

## UX/accessibility

- [ ] All visible controls function.
- [ ] Modal focus behavior pass.
- [ ] Dropdown/tabs/switch keyboard behavior pass.
- [ ] Field errors announced and associated.
- [ ] WCAG AA core flows verified.
- [ ] Mobile/responsive screenshot review pass.
- [ ] No stale state warnings.

## Testing

- [ ] Full test suite pass.
- [ ] Security regression suite pass.
- [ ] Browser/accessibility suite pass.
- [ ] Performance smoke suite pass.
- [ ] Coverage threshold met for critical code.
- [ ] Independent reviewer signs off.

## Operations

- [ ] Docker non-root.
- [ ] Docker health/readiness verified.
- [ ] Backup and restore tested.
- [ ] Logs/metrics/alerts available.
- [ ] Secret rotation procedure documented.
- [ ] Rollback/migration procedure documented.
- [ ] CI includes security and quality gates.

---

## Final rule

Jangan menyatakan skor 9.5/10 hanya karena:

- test suite hijau;
- build sukses;
- UI terlihat rapi;
- tidak ada vulnerability dependency;
- audit scanner tidak menemukan issue baru.

Skor 9.5/10 hanya valid jika **security, correctness, performance, UX, testing, dan operations memiliki bukti verifikasi yang sesuai**, bukan sekadar source code terlihat masuk akal.
