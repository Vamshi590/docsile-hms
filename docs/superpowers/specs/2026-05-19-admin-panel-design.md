# Docsile Admin Panel — Design Spec

**Status**: Approved design, ready for implementation planning
**Date**: 2026-05-19
**Owner**: Vamshidhar (gowtham@campx.in)
**Companion repo (to be created)**: `docsile-admin`
**Consumer repo (existing)**: `docsile-hms`

---

## 1. Problem & Goals

Docsile sells per-hospital HMS deployments. Each hospital gets its own application
instance and its own Supabase Postgres database. Today this is managed informally:
connection strings, env vars, plan terms, and billing live in scattered notes and
people's heads. As the number of hospitals grows, this breaks down.

### What the admin panel must do

1. **Tenant registry** — single source of truth for every hospital, including
   connection URLs, env values, GSTIN, contact info, deployment URL, status.
2. **Plan-based module access** — each hospital is on a plan (e.g. Basic, Pro,
   Enterprise) that determines which of the 17 HMS modules they can use. Changing
   a plan must propagate to the hospital app without a redeploy.
3. **Dev-team login + authorization** — internal users (SUPER_ADMIN / ADMIN /
   VIEWER) authenticate to manage hospitals.
4. **GST-compliant invoicing in INR** — generate invoices, record manually-received
   payments (bank transfer / UPI / cheque), track overdue.
5. **Visibility** — see which hospitals are healthy, what plan they're on, whether
   they owe money, and a history of who-changed-what.

### What the admin panel explicitly does NOT do (MVP)

- Customer-facing self-serve portal (hospital owners do not log in)
- Payment gateway integration (no Razorpay/Stripe in MVP)
- Automated provisioning (no Supabase / Vercel API calls — manual ops)
- Per-feature flags inside a module (granularity is module-level only)
- Usage metering or per-patient billing
- Auto-suspend on non-payment (overdue is banner-only)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  docsile-admin (NEW repo, new Vercel project)               │
│  • Next.js 16 + Prisma + Supabase Postgres                  │
│  • Domain: admin.docsile.in                                 │
│  • Internal-only login (dev team)                           │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │ Admin Postgres  │    │ Admin UI         │               │
│  │ (its own DB)    │◄──►│ - Hospitals      │               │
│  │  9 tables       │    │ - Plans          │               │
│  │                 │    │ - Invoices       │               │
│  │                 │    │ - Payments       │               │
│  │                 │    │ - Dev users      │               │
│  │                 │    │ - Audit log      │               │
│  └─────────────────┘    └──────────────────┘               │
│                                                             │
│  Public API (versioned, frozen contract)                    │
│   GET  /api/v1/config     (header: X-Hospital-Key)          │
│   POST /api/v1/heartbeat  (header: X-Hospital-Key)          │
└──────────────────────────▲──────────────────────────────────┘
                           │ HTTPS, API key auth
                           │ cold-boot fetch + 15-min refresh
┌──────────────────────────┴──────────────────────────────────┐
│  docsile-hms (existing) — one deploy per hospital           │
│  • Each hospital: own Vercel project + own Supabase DB      │
│  • ENV: ADMIN_API_URL, ADMIN_API_KEY (per-hospital)         │
│  • On boot → fetch config → in-memory cache                 │
│  • Middleware reads cache to gate modules                   │
└─────────────────────────────────────────────────────────────┘
```

### Architectural decisions (locked in during brainstorming)

| Decision | Choice | Reason |
|---|---|---|
| Coupling | Active control plane | Plan changes flip modules without redeploy |
| Audience | Dev team only | Smaller scope, fewer UX surfaces |
| Plan granularity | Module-level | Coarse business concept; user roles handle finer grain |
| Repo | Separate from `docsile-hms` | Zero schema overlap, smaller hospital bundle, independent iteration |
| Hospital → admin auth | Per-hospital API key (bcrypt-hashed at rest) | Simple, secure enough |
| Cache strategy | Cold-boot fetch + 15-min background refresh + 24h stale-tolerance | Admin downtime invisible to hospitals for hours |
| Overdue behavior | Banner-only, modules stay enabled | Indian B2B convention; preserves relationship |
| Billing | Invoice generator + manual payment recording, GST/INR | No payment gateway in MVP |
| Dev-user scope | Global (not per-hospital scoped) | Defer scoping until contractors are real |

---

## 3. Data Model — Admin DB Schema

Nine tables. Plain Prisma + Postgres.

### `hospitals`
```
id (cuid)
name                       -- "KIMS Hospital, Hyderabad"
code (slug, unique)        -- "kims-hyd"
owner_name, owner_email, owner_phone
billing_address (text)
gstin                      -- hospital's GST number (for invoicing)
deployment_url             -- "https://kims-hyd.docsile.in"
supabase_db_url            ┐
supabase_anon_key          │ app-level encrypted; never logged;
supabase_service_key       │ revealed via re-auth UI only
hms_jwt_secret             ┘
timezone (default "Asia/Kolkata")
status                     -- PROVISIONING | ACTIVE | SUSPENDED | PAUSED | CANCELLED
last_heartbeat_at, last_heartbeat_version
created_at, activated_at, cancelled_at
```

### `plans`
```
id, code (unique), name, description
price_inr                  -- default price
billing_cycle              -- MONTHLY | QUARTERLY | YEARLY
module_codes string[]      -- e.g. ["patients","doctor","pharmacy"]
is_active                  -- retire old plans without deleting
created_at
```

### `subscriptions`
```
id, hospital_id (FK), plan_id (FK)
started_at, current_period_start, current_period_end, next_billing_date
custom_price_inr           -- nullable; overrides plan price
extra_modules string[]     -- add-ons beyond plan default
excluded_modules string[]  -- subtract from plan default
status                     -- ACTIVE | PAUSED | CANCELLED
```

`enabledModules` for a hospital is computed:
```
(plan.module_codes ∪ subscription.extra_modules) − subscription.excluded_modules
```

Always-on modules (dashboard, staff, settings, login) are NOT in this list —
they're gate-exempt at the HMS middleware level.

### `invoices`
```
id, invoice_number         -- "DOCSILE/2526/00037" (FY-prefixed monotonic)
hospital_id, subscription_id
period_start, period_end
issue_date, due_date
subtotal_inr
place_of_supply            -- state code; determines IGST vs CGST+SGST
tax_breakdown JSON         -- { cgst: 9, sgst: 9, igst: null } at the rates in force
gst_inr                    -- computed total tax
total_inr
status                     -- DRAFT | ISSUED | PAID | OVERDUE | CANCELLED
line_items JSON            -- [{description, qty, unitInr, amountInr}]
notes, terms
created_at, issued_at, paid_at, cancelled_at
```

### `invoice_sequences`
```
fy_code (PK)               -- "FY2526"
last_serial                -- atomic increment in tx on issue
```

### `payments`
```
id, invoice_id, hospital_id
amount_inr                 -- can be negative (refunds)
received_on                -- date the money actually arrived
method                     -- BANK_TRANSFER | UPI | CHEQUE | CASH | REFUND | OTHER
reference                  -- UTR / cheque number / etc.
recorded_by (dev_user FK)
notes
created_at
```

Invoice status = `PAID` iff `sum(payments.amount_inr) ≥ invoices.total_inr`.
No `PARTIALLY_PAID` status — balance is always computed.

### `dev_users`
```
id, email (unique), name
password_hash              -- bcrypt cost 12
role                       -- SUPER_ADMIN | ADMIN | VIEWER
totp_secret                -- nullable; required for SUPER_ADMIN
is_active
last_login_at, created_at
```

### `api_keys`
```
id, hospital_id
key_prefix                 -- "dsk_live_a8f3..." (shown in UI; first 16 chars)
key_hash                   -- bcrypt of full key
label                      -- "production", "staging"
last_used_at, created_at, revoked_at
expires_at (nullable)
created_by (dev_user FK)
```

Multiple keys per hospital → supports rotation without downtime.

### `audit_log`
```
id, dev_user_id
action                     -- HOSPITAL_CREATE | PLAN_CHANGE | INVOICE_ISSUE |
                              API_KEY_ROTATE | SECRET_REVEAL | PAYMENT_RECORD | …
entity_type, entity_id
changes JSON               -- { before, after } for state changes;
                              { fields: ["supabase_db_url"] } for reveals
ip_address, user_agent
created_at
```

App-level append-only (no edit/delete UI). Future: DB-level grants to enforce.

### Not stored in DB

The **canonical module list** lives in `lib/modules.ts` in the admin repo as a
TypeScript constant. New modules ship with new HMS deploys; no reason for them
to be runtime-editable.

```ts
// lib/modules.ts (admin)
export const MODULES = [
  { code: "patients",       name: "Patients (OPD)" },
  { code: "doctor",         name: "Doctor Consultation" },
  { code: "workup",         name: "Workup / Eye Readings" },
  { code: "pharmacy",       name: "Pharmacy" },
  { code: "optical",        name: "Optical" },
  { code: "labs",           name: "Labs" },
  { code: "inpatients",     name: "In-Patients (IPD)" },
  { code: "insurance",      name: "Insurance" },
  { code: "expenses",       name: "Expenses" },
  { code: "license-tracker",name: "License Tracker" },
  { code: "call-logs",      name: "Call Logs" },
  { code: "analytics",      name: "Analytics" },
  { code: "reports",        name: "Reports" },
  // Always-on (not gated, not in plans):
  // dashboard, staff, settings, dues-followups, data
] as const;
```

---

## 4. Public API Contract (`/api/v1`)

The only surface the hospital app sees. Frozen once first hospital is live —
breaking changes go to `/api/v2`.

### `GET /api/v1/config`
**Headers**: `X-Hospital-Key: dsk_live_<...>`

**Response 200**:
```json
{
  "hospital": {
    "id": "hsp_abc123",
    "code": "kims-hyd",
    "name": "KIMS Hospital, Hyderabad",
    "timezone": "Asia/Kolkata"
  },
  "subscription": {
    "planCode": "pro",
    "planName": "Pro",
    "status": "ACTIVE",
    "periodEnd": "2026-06-30"
  },
  "enabledModules": [
    "patients","doctor","pharmacy","labs","optical","insurance"
  ],
  "billing": {
    "status": "current",
    "overdueInvoiceCount": 0,
    "oldestOverdueDate": null,
    "bannerMessage": null
  },
  "fetchedAt": "2026-05-19T10:23:00Z",
  "cacheMaxAgeSec": 900
}
```

**Errors**:
- `401 invalid_key` — hospital app shows "configuration error"
- `403 hospital_suspended` — hospital app shows "account suspended" login screen
- `429 rate_limit` — per-key, 60 req/min

### `POST /api/v1/heartbeat`
**Headers**: `X-Hospital-Key: dsk_live_<...>`
**Body**: `{ "appVersion": "0.1.4", "userCount": 12 }`
**Response**: `204`

Optional; failure is ignored by hospital app. Updates `hospitals.last_heartbeat_at`.

### Not in v1 (deferred)

- Push from admin → hospital (e.g. force-refresh webhook)
- Usage metering endpoints
- Secret retrieval endpoint (secrets stay in Vercel env; admin storage is for ops only)

---

## 5. Hospital-side Integration (`docsile-hms` changes)

### New files

```
src/lib/admin-client.ts                     -- fetch + in-memory cache
src/lib/module-gate.ts                      -- isModuleEnabled, route→module map
src/components/layout/BillingBanner.tsx     -- renders billing.bannerMessage
src/app/(hospital)/_module-disabled/page.tsx -- "not in your plan" screen
```

### Modified files

- `src/middleware.ts` — after existing JWT check, look up the requested route's
  module in `ROUTE_MODULES`. If module is not in cached `enabledModules`, redirect
  to `/_module-disabled?module=<code>`.
- `src/components/layout/header.tsx` — hide nav items for disabled modules;
  render `<BillingBanner />` at the top of the layout.
- `.env.example` — document `ADMIN_API_URL` and `ADMIN_API_KEY`.

### `admin-client.ts` cache semantics

```
- In-memory cache held in module-level state of `admin-client.ts`:
    { config, fetchedAt, expiresAt }
- getAdminConfig():
    - if cache fresh, return synchronously
    - if cache stale (>15 min) but <24h old, return cached AND trigger background refetch
    - if no cache (cold boot), fetch synchronously; if fetch fails, throw
- Background refresh: setInterval every 15 min on server start
- After 24h with no successful fetch: getAdminConfig() throws; middleware
  renders a "service unavailable" page
- Per-process cache (each Vercel instance has its own); eventually consistent
  within 15 min across instances
```

### Route → module map

```ts
// src/lib/module-gate.ts
export const ROUTE_MODULES: Record<string, string> = {
  "/patients": "patients",
  "/doctor": "doctor",
  "/workup": "workup",
  "/pharmacy": "pharmacy",
  "/optical": "optical",
  "/labs": "labs",
  "/inpatients": "inpatients",
  "/insurance": "insurance",
  "/expenses": "expenses",
  "/license-tracker": "license-tracker",
  "/call-logs": "call-logs",
  "/analytics": "analytics",
  "/reports": "reports",
  // dashboard, staff, settings, dues-followups, data → always on
};
```

### Failure mode summary

| Situation | Hospital app behavior |
|---|---|
| Cold boot, admin reachable | Fetch config, app starts normally |
| Cold boot, admin unreachable | App fails to start (logs); previous deploy kept |
| Running, admin briefly unreachable | Cached config served; background refetches |
| Running, admin down >24h | Middleware blocks with "service unavailable" |
| Invalid API key | Same as admin down >24h — human attention |
| Hospital suspended (admin returns 403) | Login page shows "account suspended" |
| Billing overdue | Banner shown, all modules functional |

### Gate ordering (three independent layers)

1. Authenticated? (existing JWT middleware)
2. Is this module in the hospital's plan? (new admin-controlled gate)
3. Does this user have permission for this action? (existing role-permission)

Each layer gives a distinct error message → easier support.

---

## 6. Admin UI

### Sidebar nav

```
🏥  Hospitals          (default landing)
📋  Plans
🧾  Invoices
💰  Payments
👤  Dev Users           [SUPER_ADMIN only]
📜  Audit Log           [SUPER_ADMIN only]
⚙️   Settings           [SUPER_ADMIN only]
```

### Screens

1. **Hospitals list** — table: name, code, plan, status, last heartbeat, MRR,
   overdue ₹. Search + filter by status/plan. "New Hospital" CTA.

2. **Hospital detail** (tabs):
   - **Overview** — owner contact, GSTIN, deployment URL, status,
     subscription summary, last heartbeat
   - **Plan & Modules** — current plan, change-plan flow with effective date,
     `extra_modules` / `excluded_modules`, custom price override, view computed
     `enabledModules`
   - **API Keys** — list (prefix + label + last used), generate (shows full key
     once with copy + "I've saved this" gate), revoke (confirm)
   - **Secrets** — DB URL + anon/service keys + JWT secret. Hidden by default,
     "Reveal" requires re-auth, revealed for 30 s, every reveal audit-logged.
     Edit also requires re-auth.
   - **Invoices** — invoices filtered to this hospital, "Generate next invoice"
   - **Activity** — heartbeats, config fetches, audit log filtered to hospital

3. **New Hospital wizard** (3 steps):
   1. Details (name, code, owner contact, GSTIN, deployment URL, timezone)
   2. Plan + module overrides + price override
   3. Confirm → create row, generate API key + JWT_SECRET, **show env-var bundle
      ONCE** with copy button: `ADMIN_API_URL`, `ADMIN_API_KEY`, `JWT_SECRET`.
      Includes "Next steps: paste these into Vercel" guidance.

4. **Plans list + edit** — table with name/code/price/cycle/module count/active
   subs. Edit form has module checkboxes from canonical list. **Editing a plan
   does NOT retroactively change existing subscriptions** — only new ones.

5. **Invoices list** — filter by status/hospital/date/FY. Bulk: issue drafts,
   mark overdue, export PDF zip. Sum bar: total issued / paid / overdue.

6. **Invoice detail** — header (number, hospital, status, dates, amount), body
   (line items, GST breakdown, payments + running balance, notes). Actions:
   Issue (DRAFT→ISSUED, assigns number atomically), Record payment, Download
   PDF (print-to-PDF in MVP), Cancel, Send email (phase 3).

7. **Payments list + record** — table: date / hospital / invoice / amount /
   method / reference / recorded-by. "Record payment" dialog: hospital → open
   invoice(s) → amount → method → reference → notes. Supports partial / over /
   refund (negative amount). "Move payment" action.

8. **Dev Users** — list (name/email/role/last login/active), invite by email
   (one-time setup link), roles: SUPER_ADMIN / ADMIN / VIEWER.

9. **Audit Log** — filterable feed, expandable JSON for before/after diffs,
   CSV export.

10. **Settings** — your company info (business name, GSTIN, address — *from*
    side of invoices), bank details (for invoice footer), invoice defaults
    (terms, due-days, GST rate, FY start month = April), email (phase 3).

### Two reusable patterns

- **Sensitive-reveal component**: any secret display follows the same pattern —
  hidden → re-auth → revealed 30 s → audit-logged. One component, reused.
- **Status color convention**: 🟢 ACTIVE/PAID/current · 🟡 OVERDUE/PROVISIONING/DRAFT ·
  🔴 SUSPENDED/CANCELLED · ⚪ PAUSED/archived.

---

## 7. Billing & Invoicing

### Invoice state machine

```
DRAFT ──issue──▶ ISSUED ──payments cover total──▶ PAID
                    │
                    └──past due_date, balance > 0──▶ OVERDUE ──payments──▶ PAID
                    │
                    └──cancel──▶ CANCELLED   (terminal)
```

No `PARTIALLY_PAID` state — balance is computed.

### GST-compliant numbering

- Format: `DOCSILE/{YY}{YY+1}/{NNNNN}` — e.g. `DOCSILE/2526/00037`
- Per-FY sequence stored in `invoice_sequences`; atomic increment in DB
  transaction on issue (DRAFT → ISSUED).
- Drafts have no number — only `id`.
- Cancelled invoices retain their number (gaps not allowed under Indian GST);
  status flips to CANCELLED but the row stays.
- FY rollover (April 1): new sequence row, starts at `00001`.

### GST tax handling

- `invoices.place_of_supply` (state code, defaults from hospital billing address,
  overridable per invoice).
- Same state as your business: CGST 9% + SGST 9% (= 18% total).
- Different state: IGST 18%.
- `tax_breakdown` column stores the rates *as of issue* — historical invoices
  don't change if rates change later.
- HSN/SAC code **998314** (IT consulting and support services) hardcoded in
  the invoice template footer.

### Line items

Single-line for flat-plan invoices is normal. Schema supports multiple lines
including negative amounts for discounts. GST computed on subtotal *after*
discounts.

### Generation

**MVP**: manual per-hospital "Generate next invoice" button on hospital detail.
You review the draft, click Issue.

**Phase 3**: daily cron at 6 am IST drafts invoices for subscriptions where
`next_billing_date <= today`. Still human-Issued. Never auto-issue.

### Payment recording

UI handles these from day one:
- **Over-payment** → records normally; excess shows as credit balance on the
  hospital. Next invoice can apply credit (manual checkbox).
- **Wrong invoice** → "Move payment" action; both invoices' statuses recompute.
- **Refund** → negative-amount payment, method `REFUND`, reference required.

### Overdue pipeline

```
Nightly job (+ on-read fallback):
  if invoice.status == ISSUED and today > due_date and balance > 0:
    invoice.status = OVERDUE

API /v1/config response when any overdue exists:
  billing.status = "overdue"
  billing.bannerMessage = "Payment overdue since 12 May. Contact accounts@docsile.in"

Hospital app caches → banner renders top of every page → modules stay enabled

Payment recorded → invoice flips PAID → next config refresh (≤15 min) clears banner
```

### PDF generation (MVP)

Server-rendered HTML invoice + browser print-to-PDF. Admin route renders the
invoice, `?print=1` triggers print-friendly CSS, you save as PDF and email it.
**No PDF library in MVP** (deferred to phase 3 if needed — likely Puppeteer or
`react-pdf`).

---

## 8. Hospital Onboarding (Provisioning) Flow

### End-to-end

```
[Admin]                              [Manual ops]
1. "New Hospital" wizard
   → creates row
   → generates API key + JWT_SECRET
   → shows env-var bundle ONCE

                                     2. Create new Supabase project
                                     3. Run supabase-migration.sql + seed
                                     4. Grab DB URL + anon + service keys
5. Paste keys into Hospital
   → Secrets tab (audit-logged)

                                     6. Create new Vercel project
                                     7. Set env vars (copy block from admin)
                                     8. Deploy

[Hospital app boots]
9. /api/v1/heartbeat received
   → admin marks heartbeat ✓ in checklist

10. All 5 checklist items ✓ → "Mark Active" button → status = ACTIVE
11. Issue first invoice (pro-rated if mid-cycle)
```

### MVP scope: steps 2-8 are manual

The admin panel stores credentials and provides copy-button conveniences. Steps
4-9 of the actual provisioning chain (Supabase project create, migrations, Vercel
project create, env-set) happen outside the admin panel. Automating this is
**phase 4**, after stable patterns are established.

### Onboarding aids built in MVP

- **Onboarding checklist** on hospital detail when status = PROVISIONING:
  - ☐ Supabase project created — paste DB URL
  - ☐ Schema migrated — paste anon + service keys
  - ☐ Vercel project created — paste deployment URL
  - ☐ Env vars set — copy-button per var
  - ☐ First heartbeat received (auto-checks on ping)
  All 5 ✓ → "Mark Active" enables.

- **Env-var bundle export** on hospital detail (the only place the API key is
  shown after creation):
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_KEY=...
  JWT_SECRET=<64-char random, generated by admin at provisioning>
  ADMIN_API_URL=https://admin.docsile.in
  ADMIN_API_KEY=dsk_live_...
  ```
  Copy action is audit-logged.

### JWT_SECRET per hospital

Admin generates a fresh 64-char random `JWT_SECRET` for each hospital and
includes it in the env bundle. A leak in one hospital doesn't compromise others.

### Lifecycle states

```
PROVISIONING ──checklist complete──▶ ACTIVE
ACTIVE       ──pause action────────▶ PAUSED      (modules load but read-only; rare)
ACTIVE       ──suspend action──────▶ SUSPENDED   (config API returns 403)
SUSPENDED    ──reactivate──────────▶ ACTIVE
ANY          ──cancel + confirm────▶ CANCELLED   (terminal)
```

**Cancellation**: text-match hospital name confirm → status flips → all API
keys auto-revoked → final invoice drafted for any unpaid balance → admin
shows offboarding checklist (archive Supabase project, archive Vercel project,
final DB backup). All offboarding steps are manual in MVP.

---

## 9. Security Model

### Authentication (dev users)

- Email + password, bcrypt cost 12. Custom JWT (same `jose`-based stack as HMS).
- **TOTP 2FA mandatory for SUPER_ADMIN, optional for ADMIN**. `otpauth` library,
  standard QR enrollment.
- Sessions: 12-hour expiry (shorter than HMS's 7 days).
- Secret reveals require fresh re-auth regardless of session age.
- Failed-login lockout: 5 attempts → 15-min lock, audit-logged.

### Authorization matrix

| Action | SUPER_ADMIN | ADMIN | VIEWER |
|---|---|---|---|
| View hospitals / plans / invoices | ✅ | ✅ | ✅ |
| Create/edit hospital, change plan | ✅ | ✅ | ❌ |
| Generate/revoke API keys | ✅ | ✅ | ❌ |
| Reveal hospital secrets | ✅ (re-auth) | ❌ | ❌ |
| Edit hospital secrets | ✅ (re-auth) | ❌ | ❌ |
| Issue invoices, record payments | ✅ | ✅ | ❌ |
| Cancel hospital | ✅ (re-auth + name confirm) | ❌ | ❌ |
| Manage dev users | ✅ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ |

### Public API security

- API key in `X-Hospital-Key`, compared against `bcrypt(key_hash)`.
- Rate limit per key: 60 req/min.
- TLS-only; HSTS; no HTTP redirect.
- Optional phase-2: per-hospital IP allow-list (Vercel egress).

### Sensitive data at rest

- Supabase at-rest encryption (baseline).
- **App-level encryption** for `supabase_db_url`, `supabase_service_key`, and
  `hms_jwt_secret`. Key in Vercel env. Key rotation = re-encrypt all rows
  (phase 2 concern).
- API keys stored as `bcrypt(key)` only. Full key shown once on creation.

### Audit log — what gets logged

- Hospital create / edit / status change / cancel
- Plan change on a hospital
- API key generate / revoke
- Secret reveal (DB URL / JWT / service key)
- Invoice issue / cancel
- Payment record / move / refund
- Dev user invite / role change / disable
- Failed logins (rate-limited to avoid flooding)

App-level append-only (no edit/delete UI). DB-level INSERT-only grants are
post-MVP.

### Out of MVP scope (security)

- SSO (Google/Microsoft) — defer until 5+ devs
- IP allow-listing — Vercel IPs aren't stable enough
- HSM-backed key storage — overkill at this scale
- Pen test — schedule *before* hospital #10, not before hospital #1

---

## 10. Phasing

### Phase 0 — Repo + Infra Setup (1-2 days)
- New `docsile-admin` repo (Next.js 16, Prisma, Tailwind v4, Radix UI)
- Supabase project for admin DB
- Auth shell: email/password JWT, role-gated routes, sidebar
- Deploy to `admin.docsile.in`

### Phase 1 — MVP: Tenant Management
*Goal: onboard first hospital end-to-end.*

1. Hospitals CRUD (list, detail, new wizard)
2. Plans CRUD
3. Subscriptions (create on hospital, change plan, overrides)
4. API key generation + revoke + bcrypt storage
5. Secret storage with app-level encryption + re-auth reveal
6. Onboarding checklist UI + env-var bundle export
7. `GET /api/v1/config` + `POST /api/v1/heartbeat`
8. HMS-side: `admin-client.ts`, `module-gate.ts`, `BillingBanner`, middleware integration
9. Dev users (invite, role, disable; no 2FA yet)
10. Audit log (write everywhere, read-only screen)

### Phase 2 — Billing
*Goal: start invoicing properly.*

1. Invoices CRUD with GST (CGST/SGST/IGST split, HSN, FY-numbering)
2. Payments (record, partial, over, move, refund)
3. Manual "generate next invoice" per hospital
4. Print-to-PDF invoice template
5. Settings: business info, bank details, default GST rate
6. Overdue auto-flip nightly job + banner in config response
7. **TOTP 2FA for SUPER_ADMIN** (before charging real money)

### Phase 3 — Quality of Life
*Goal: scale past ~10 hospitals.*

1. Email invoices via SMTP (Resend or similar)
2. Scheduled draft-invoice cron (human-issued)
3. Bulk invoice operations
4. Heartbeat / activity dashboard
5. Credit balance tracking UI

### Phase 4 — Automation
*Goal: scale past ~25 hospitals.*

1. Provisioning automation (Supabase + Vercel Management APIs)
2. Optional: Razorpay integration for self-serve renewal
3. Optional: hospital-owner read-only portal
4. SSO for dev users
5. DB-enforced append-only audit log

### MVP estimate

Phase 0 + 1 ≈ **3 weeks of focused work for one developer**. Lands "I can take
on hospital #1 today."

### Order discipline

- Don't do phase 2 before phase 1 is solid. Manual email-and-bank-transfer
  billing of 1–2 hospitals is fine in the interim.
- Don't build per-feature flags, customer portal, payment gateway, email
  automation, or provisioning APIs in MVP — all defer.

---

## 11. Open Questions / Future Decisions

These are deferred from MVP and should be revisited at the noted milestone:

- **Email provider** (Resend / Postmark / Mailgun) — decide at start of phase 3.
- **PDF library** (Puppeteer vs `react-pdf`) — decide at end of phase 2 based
  on what print-to-PDF actually looks like.
- **Payment gateway** (Razorpay vs Stripe Atlas) — decide at start of phase 4
  based on what fraction of hospitals want self-serve payment.
- **Provisioning automation tooling** — decide at start of phase 4 based on
  patterns observed in first ~20 manual onboardings.
- **Encryption key rotation procedure** — design at end of phase 2.

---

## 12. Glossary

- **Hospital** — a tenant; one Vercel deployment + one Supabase DB.
- **Plan** — a named bundle of modules at a price (e.g. "Pro").
- **Subscription** — a hospital's current plan assignment, including any per-deal
  overrides (`extra_modules`, `excluded_modules`, `custom_price_inr`).
- **Enabled modules** — the computed final module list for a hospital, sent to
  the hospital app via `/api/v1/config`.
- **Always-on modules** — modules every hospital gets regardless of plan
  (dashboard, staff, settings, dues-followups, data, login).
- **Heartbeat** — periodic `POST /api/v1/heartbeat` from a hospital app; used to
  flag inactive deployments and verify the app is wired correctly.
- **Reveal** — UI action that decrypts and displays a hospital secret; requires
  re-auth and is audit-logged.
- **FY** — Indian financial year, April–March. Invoice numbering is FY-scoped.
