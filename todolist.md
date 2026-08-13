# Todo List — PRD Implementation Tracking

Progress tracker for the 23 PRD modules. Updated after each implementation pass.
Legend: ✅ done · 🟡 partial · ⬜ not started

---

## ✅ Done

- [x] **Modul 1 — Landing Page** (Home, About, Services, Contact + Hero/Services/Stats/Process/Testimonials/Team/Marquee)
- [x] **Modul 2 — Authentication** (login, register, reset password, Google OAuth, logout, rate limit)
- [x] **Modul 3 — Dashboard** (admin + client summaries)
- [x] **Modul 4 — User Management** (CRUD, avatar, activate/deactivate)
- [x] **Modul 5 — Role Management** (CRUD, assign permission)
- [x] **Modul 6 — Permission Management** (CRUD)
- [x] **Modul 7 — Profile** (edit profile, password, avatar)
- [x] **Modul 8 — Media Library** (upload, preview, metadata, categorize, search, picker API)
- [x] **Modul 9 — Contact Message** (visitor form + DB store + admin inbox: list, detail/mark-read, reply-by-email, archive, bulk actions, status lifecycle)
- [x] **Modul 13 — Activity Log** (list, filter, search, detail)
- [x] **Modul 15 — Settings** (general, contact, regional, footer, script — cached store)
- [x] **Modul 16 — Notification Center** (admin list + unread count, mark-read / mark-all-read, producer fans out a notification to all admins on new contact message)
- [x] **Modul 17 — Billing** (placeholder plan + history)

## 🟡 Partial

## ⬜ Not Started

- [ ] **Modul 10 — Support Ticket**
  - [ ] User: buat / balas / tutup / riwayat tiket
  - [ ] Admin: list / detail / balas / ubah status / ubah prioritas
  - [ ] Status (Open, In Progress, Resolved, Closed) + Priority (Low/Med/High/Urgent)
- [x] **Modul 11 — Email Management**
  - [x] Email configuration (provider info + test send via active driver)
  - [x] Email template CRUD (list/add/edit/delete/preview/test/placeholder)
  - [x] Email template triggers (auto-send on register/contact to customer/admin)
  - [x] Permissions `email.read` / `email.update` seeded
- [x] **Modul 12 — WhatsApp Management**
  - [x] WhatsApp configuration (Dripsender provider + API key, test send)
  - [x] WhatsApp template CRUD (list/add/edit/delete/preview/test/placeholder)
  - [x] WhatsApp template triggers (auto-send on register/contact to customer/admin)
  - [x] Dripsender inbound webhook receiver (stores messages, optional auto-reply)
  - [x] Lead capture: push new contacts (name + phone) to the Dripsender integration webhook on registration
  - [x] Permissions `whatsapp.read` / `whatsapp.update` seeded
- [ ] **Modul 14 — Audit Log**
  - [ ] Catat login/logout/perubahan data/akses sistem/event penting
  - [ ] List + filter + detail
- [ ] **Modul 18 — Observability**
  - [ ] Dashboard monitoring + system metrics
  - [ ] Health check, alert, queue/storage/database/cache/response-time monitoring
- [ ] **Modul 19 — Security (UI)**
  - [ ] Server-side sudah ada: security headers, CSP, rate limiting, upload validation
  - [ ] UI: security settings page, IP blocking, threat detection, password policy, audit security view
- [ ] **Modul 20 — Global Search**
  - [ ] Pencarian lintas modul: User, Media, Ticket, Contact, Activity
- [ ] **Modul 21 — File Management**
  - [ ] Upload/preview/download/delete/metadata/ownership (overlaps Media — verify gap)
- [ ] **Modul 22 — Design System**
  - [x] Komponen inti sudah ada (Button, Input, Select, Textarea, Card, Modal, Tabs, Table, Accordion, dll.)
  - [ ] Audit kelengkapan vs daftar PRD (Drawer, Dropdown, Pagination, Timeline, Chart, Tooltip, Toast, Loader, Avatar, Progress, Stepper, Date Picker, Command Palette, Empty State, Confirm Dialog, File Upload, Media Picker)
- [ ] **Modul 23 — Layout**
  - [x] Public / Auth / Admin layouts ada
  - [ ] Client layout (dedicated)

---

## How to update

Mark `[ ]` → `[x]` when a module ships. Use 🟡 when only part is done and list the
remaining sub-tasks beneath it. Each new module = 1 migration + `db.ts` statements +
`<feature>.routes.ts` + page(s) + component(s) + nav entry + test (see `AGENTS.md`).
