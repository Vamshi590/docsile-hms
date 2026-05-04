# Docsile HMS

Docsile HMS is a multi-module Hospital Management System optimised for eye-hospital workflows (built originally around Sri Harsha Eye Hospital, but multi-tenant by header registry). It covers the full clinical and financial workflow — patient registration, refraction workup, doctor consultation, prescriptions, in-patient admissions, insurance claims, pharmacy, optical, labs, expenses, license tracking, call logs (via Exotel), reporting, and analytics.

It is a single Next.js 16 app (App Router + Server Actions) backed by Supabase Postgres. Authentication is custom JWT (no Supabase Auth). The app installs as a PWA.

> **Important:** This README and `CLAUDE.md` must be kept in sync with every meaningful change to the codebase (new module, new table, new route, new env var, new external integration, change in auth/permissions). If you change behaviour, update both files in the same commit.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Database](#database)
6. [Authentication & Authorization](#authentication--authorization)
7. [Modules / Routes](#modules--routes)
8. [External Integrations](#external-integrations)
9. [Receipts & Multi-Hospital Branding](#receipts--multi-hospital-branding)
10. [PWA](#pwa)
11. [Scripts](#scripts)
12. [Deployment](#deployment)
13. [Conventions](#conventions)

---

## Tech Stack

| Layer            | Tooling                                                              |
| ---------------- | -------------------------------------------------------------------- |
| Framework        | Next.js **16.1.6** (App Router, Server Actions, Turbopack dev)       |
| UI               | React **19.2**, TypeScript 5, Tailwind CSS **v4**, shadcn-style Radix primitives, lucide-react, recharts, sonner, cmdk |
| State / Forms    | Zustand v5, React Hook Form v7, Zod v4                               |
| Tables           | TanStack React Table v8                                              |
| Auth             | Custom JWT via `jose`, password hashing via `bcryptjs`               |
| Database         | Supabase Postgres (accessed via `@supabase/supabase-js` v2)          |
| Schema reference | Prisma schema (`prisma/schema.prisma`) — used as the source of truth for the data model. Runtime queries do **not** use Prisma client; they use the Supabase JS client. |
| Dates            | `date-fns` + IST helpers in `src/lib/utils.ts`                       |
| PWA              | `public/manifest.json` + `<InstallPrompt />` component               |
| Deployment       | Vercel                                                               |

---

## Project Structure

```
docsile-hms/
├── prisma/
│   ├── schema.prisma             # Data model source of truth (Postgres)
│   ├── seed.ts                   # Seed script (run with `npm run db:seed`)
│   └── dev.db                    # Legacy SQLite snapshot (not used at runtime)
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── icon.svg / icon-maskable.svg
│   └── ...static assets
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # Login page + server action
│   │   ├── (hospital)/           # Authenticated app shell (sidebar layout)
│   │   │   ├── layout.tsx        # Loads session + hospital profile, renders Sidebar
│   │   │   ├── dashboard/
│   │   │   ├── patients/
│   │   │   ├── workup/           # Eye refraction workup
│   │   │   ├── doctor/           # Doctor consultation queue
│   │   │   ├── inpatients/       # IP admissions, surgery, discharge
│   │   │   ├── insurance/        # Claim lifecycle (preauth → settle)
│   │   │   ├── labs/             # Lab investigations + lab bills
│   │   │   ├── pharmacy/         # Inventory, suppliers, POs, sales
│   │   │   ├── optical/          # Frames/lenses inventory + bills
│   │   │   ├── expenses/         # Operational expense tracking
│   │   │   ├── dues-followups/   # Outstanding dues + WhatsApp follow-ups
│   │   │   ├── call-logs/        # Exotel call history
│   │   │   ├── license-tracker/  # Compliance license expiry tracking
│   │   │   ├── reports/          # Per-patient combined report viewer
│   │   │   ├── analytics/        # Charts/KPIs
│   │   │   ├── data/             # Bulk data export
│   │   │   ├── staff/            # User & role management (ADMIN only)
│   │   │   └── settings/         # Hospital profile + clinical masters
│   │   ├── api/
│   │   │   ├── exotel/webhook/   # Exotel call status webhook
│   │   │   └── logout/           # POST: clears session cookie
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                   # shadcn-style primitives (button, dialog, table, etc.)
│   │   ├── layout/               # Sidebar, header, page skeleton
│   │   ├── pwa/InstallPrompt.tsx
│   │   └── receipts/             # Print receipts (prescription, cash, readings)
│   │       └── headers/          # Per-hospital header components + registry
│   ├── lib/
│   │   ├── auth.ts               # getSession(), requireAuth(), requireAdmin()
│   │   ├── jwt.ts                # signToken(), verifyToken(), COOKIE_NAME
│   │   ├── permissions.ts        # ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS
│   │   ├── db.ts                 # createClient() + cached getHospitalProfile()
│   │   ├── supabase/             # client.ts (browser anon) + server.ts (service role)
│   │   ├── id-generators.ts      # getNextInsClaimNumber()
│   │   ├── workup-options.ts     # Clinical dropdowns (SPH/CYL/AXIS/VA/ADD/IOP/etc.)
│   │   ├── types.ts              # All shared TS types (Patient, Prescription, ...)
│   │   └── utils.ts              # cn(), formatDate, IST helpers, formatCurrency
│   └── middleware.ts             # JWT-based route guard
├── create_call_log_table.sql     # Standalone SQL: CallLog (Exotel)
├── create_inpatient_template_table.sql
├── supabase-migration.sql        # Full Postgres schema for Supabase
├── seed.mjs                      # JS seed (alternative to prisma/seed.ts)
├── components.json               # shadcn config (slate base, RSC, lucide)
├── next.config.ts
├── tsconfig.json                 # paths: @/* → ./src/*
├── eslint.config.mjs
├── postcss.config.mjs            # Tailwind v4
└── vercel.json
```

---

## Getting Started

```bash
# 1. Install
npm install

# 2. Copy env and fill in real values
cp .env.example .env   # if .env.example exists; otherwise create .env (see below)

# 3. Apply database schema to Supabase
#    Run supabase-migration.sql against your Supabase project (SQL editor or psql)
#    Also run create_call_log_table.sql and create_inpatient_template_table.sql

# 4. Seed sample data (optional)
npm run db:seed

# 5. Start dev server (Turbopack)
npm run dev    # → http://localhost:3000
```

First load redirects to `/login`. Seed data should include an ADMIN user; use those credentials to sign in.

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>          # used by client-side helpers
SUPABASE_SERVICE_ROLE_KEY=<service role key>      # used by ALL server actions

# JWT signing secret (generate: openssl rand -base64 32)
AUTH_SECRET=<random secret>

# Hospital config (informational — actual hospital details live in HospitalProfile DB row)
HOSPITAL_NAME=Sri Harsha Eye Hospital
HOSPITAL_SLUG=sri-harsha

# Exotel (call logging webhook)
EXOTEL_SID=<account sid>
EXOTEL_API_KEY=<api key>
EXOTEL_API_TOKEN=<api token>
EXOTEL_WEBHOOK_TOKEN=<shared secret matched in webhook>
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — keep it server-only. It is referenced exclusively from `src/lib/supabase/server.ts`.

---

## Database

The data model is defined in `prisma/schema.prisma` and reified in `supabase-migration.sql`. Prisma Client is **not** used at runtime — the schema file is the single human-readable source of truth, and Supabase JS executes the actual queries.

**Models (37+ tables):**

- **Auth & Org:** `User`, `Role`, `HospitalProfile`
- **Masters:** `ServiceTemplate`, `MedicineMaster`, `InvestigationMaster`, `DropdownOption`, `PredefinedTemplate`, `PredefinedPackage`
- **OPD:** `Patient`, `Prescription` (medical+billing combined), `InvoiceItem`, `Payment`, `EyeReading`
- **Labs:** `Lab`, `LabInvestigation`, `LabBill`, `LabBillItem`, `LabPayment`
- **IPD / Surgery / Insurance:** `InPatient`, `InsuranceCompany`, `InsuranceClaim`
- **Pharmacy:** `PharmacyMedicine`, `PharmacyStock`, `PharmacySupplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PharmacyBill`, `PharmacyBillItem`
- **Optical:** `OpticalProduct`, `OpticalStock`, `OpticalBill`, `OpticalBillItem`
- **Ops:** `ExpenseCategory`, `Expense`, `License`
- **Telephony:** `CallLog` (defined in `create_call_log_table.sql`)

Key conventions:

- IDs are `cuid()` strings.
- Human-friendly identifiers: `Patient.patientId`, `InPatient.ipNumber` (`IP-####`), `InsuranceClaim.claimNumber` (`INS-YYYY-####`), bill numbers (`billNumber`), prescription numbers.
- Timestamps: `createdAt` / `updatedAt` on every mutable table; audit columns `createdBy` / `updatedBy` (string user IDs) on most tables.
- Many "complex" relations are stored as `String @db.Text` JSON (e.g. `medicines`, `investigations`, `clinicalFindings`, `paymentRecords`, `packageInclusions`, `statusHistory`). Always `JSON.parse` after reading and `JSON.stringify` before writing.

---

## Authentication & Authorization

- Login: `src/app/(auth)/login/actions.ts` → `loginAction({ email, password })`
  - Looks up active `User`, `bcrypt.compare`s the password.
  - Loads role permissions from the `Role` table (JSON-encoded array). For `ADMIN` with empty role row, falls back to `getAllPermissionKeys()`.
  - Signs a JWT (`HS256`, 7-day expiry) and writes the `docsile-session` httpOnly cookie.
- Middleware: `src/middleware.ts` redirects unauthenticated traffic to `/login` and authenticated traffic away from `/login`.
- Helpers: `getSession()` (cached, JWT-only, no DB), `getSessionFromDB()` (fresh permissions), `requireAuth()`, `requireAdmin()`, `requirePermission(user, key)`.
- Permissions: format `module:action` (e.g. `patients:create`, `inpatients:discharge`). Defined in `src/lib/permissions.ts` along with default sets for `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `OPTOMETRIST`, `NURSE`. The Sidebar filters `adminOnly` items based on role.

---

## Modules / Routes

All authenticated routes live under the `(hospital)` route group with the shared sidebar layout.

| Route               | Purpose                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `/dashboard`        | KPIs, queue snapshot, financial summary                                                       |
| `/patients`         | Patient registry — register/edit, search, link to history                                     |
| `/workup`           | Eye refraction (auto-refractometer, glasses, present/previous Rx, IOP, clinical findings)     |
| `/doctor`           | Consultation queue (computed status from workup + Rx state); enter vitals, diagnosis, Rx       |
| `/inpatients`       | IP admissions, package billing, multiple payment records, status flow → discharge             |
| `/insurance`        | Claim lifecycle: preauth → enhancement → final bill → settlement; auto-created from IP        |
| `/labs`             | Lab masters, investigation pricing, lab bills (separate billing from Rx)                      |
| `/pharmacy`         | Medicine & supplier masters, batch inventory, purchase orders, sales bills with GST           |
| `/optical`          | Frames/lenses/contact lenses inventory (with power), bills with lens-Rx snapshot, delivery flow |
| `/expenses`         | Operational expense tracking + categories                                                     |
| `/dues-followups`   | Outstanding patient dues + follow-up tasks; WhatsApp button                                   |
| `/call-logs`        | Inbound/outbound calls (Exotel), patient match by phone, call analytics                       |
| `/license-tracker`  | Hospital licenses with expiry/reminder/status                                                 |
| `/analytics`        | Charts: revenue, volumes, claim status, dues                                                  |
| `/reports`          | Per-patient consolidated report (visits, prescriptions, labs, IP records, billing) + print    |
| `/data`             | Bulk data export (CSV) per module                                                             |
| `/staff`            | User & role management — ADMIN only                                                           |
| `/settings`         | Hospital profile + clinical masters (medicines, investigations, templates, dropdowns, …)      |
| `/login`            | Login page                                                                                    |
| `/api/logout`       | POST → clears `docsile-session` cookie                                                        |
| `/api/exotel/webhook` | Exotel passthru/status callback handler                                                     |

---

## External Integrations

### Exotel (Telephony)

`src/app/api/exotel/webhook/route.ts` accepts both passthru (call start) and status callback (call end) events.

- Validates a shared `EXOTEL_WEBHOOK_TOKEN` (header `x-exotel-token` or `?token=` query param).
- For terminal events, fetches `https://api.exotel.com/v1/Accounts/{SID}/Calls/{CallSid}?details=true` (Basic auth with `EXOTEL_API_KEY:EXOTEL_API_TOKEN`) to read **Leg 2** status — that's the leg that tells whether the agent actually answered.
- Maps Leg 2 → `CallLog.status`: `completed`, `missed`, `busy`, `failed`. Falls back to `ConversationDuration` heuristic if the API call fails.
- Matches caller to a `Patient` by the last 10 digits of phone.
- Upserts by `exotelCallSid`; only overwrites when the new status is "final" or the previous one wasn't.

### WhatsApp

The dues/follow-ups module includes a WhatsApp button that opens a chat with the patient (uses standard `wa.me` link composition).

---

## Receipts & Multi-Hospital Branding

Receipt printing lives in `src/components/receipts/`:

- `PrescriptionReceipt`, `ReadingsReceipt`, `ClinicalFindingsReceipt`, `CashReceipt`, `ReadingsAndFindings`
- `ReceiptHeader` selects the correct hospital header via `headers/registry.ts → getHeaderComponent(hospitalName)`
- Default fallback: `headers/DefaultHeader.tsx`
- Hospital-specific overrides: e.g. `headers/SriHarshaEyeHospital.tsx`

To onboard a new hospital, add a header component and one entry to the registry keyed on the lowercased `HospitalProfile.name`.

---

## PWA

`public/manifest.json` declares the app as standalone (`start_url: /dashboard`, landscape orientation). `<InstallPrompt />` is mounted in the hospital layout.

---

## Scripts

```bash
npm run dev      # next dev --turbopack
npm run build    # next build
npm run start    # next start (production server)
npm run lint     # eslint
npm run db:seed  # tsx prisma/seed.ts
```

---

## Deployment

Designed for Vercel. Configure all environment variables in the Vercel project settings. The hospital name, address, logo, etc. live in the `HospitalProfile` DB row (cached server-side for 5 minutes via `getHospitalProfile()` in `src/lib/db.ts`; call `invalidateHospitalCache()` after edits).

> **Note:** `vercel.json` currently has a `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` rule — that's a SPA-style fallback that does **not** belong in a Next.js App Router project and will likely break routing in production. Verify and update before deploying.

---

## Conventions

- **Server actions** live in `src/app/(hospital)/<module>/actions.ts` with `"use server"` at the top. Pattern: `requireAuth()` → Zod validation → Supabase query → `revalidatePath()` → return `{ success, data | error }`.
- **DB access:** always go through `createClient()` from `@/lib/supabase/server` in server code; the browser client is rarely used.
- **Path alias:** `@/*` → `src/*`.
- **Currency:** always render via `formatCurrency()` (₹ INR via `Intl.NumberFormat`).
- **Dates:** persist as ISO/UTC; render via the IST helpers in `src/lib/utils.ts` (`formatDate`, `formatDateTime`, `toLocalDateISO`, `getISTDayBounds`, …).
- **JSON columns:** parse on read, stringify on write — see types in `src/lib/types.ts` for shape.
- **Statuses are string unions** (not Postgres enums) — see `PatientStatus`, `PrescriptionStatus`, `InPatientStatus`, `InsuranceClaimStatus` in `src/lib/types.ts`.

---

## Keeping Docs Current

Whenever you change something material — a route, a table, an env var, an integration, an auth/permissions rule, a deployment step — **update this README and `CLAUDE.md` in the same commit.** They are the canonical reference for both humans and Claude.
