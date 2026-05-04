# CLAUDE.md

This file is your map of the **Docsile HMS** codebase. Read it before making changes. Update it (and `README.md`) whenever a material aspect of the project changes.

> **HARD RULE — keep docs in sync.**
> Whenever you change anything material — a route, a database table or column, an environment variable, an external integration, an auth/permission rule, a server-action contract, the receipt-header registry, or deployment configuration — update **`README.md` AND `CLAUDE.md` in the same commit**. They are the source of truth for future sessions and humans. If a fact in either file is now wrong because of your change, fixing it is part of the task, not optional follow-up.

---

## 1. What this app is

**Docsile HMS** is a Hospital Management System tailored to eye-hospital workflows but multi-hospital ready. It is a single Next.js 16 App-Router project. There is **no separate backend** — server logic lives in Next.js Server Actions and route handlers under `src/app/...`.

Production target: an eye hospital (Sri Harsha Eye Hospital is the seed/demo tenant). Multi-hospital branding is handled via the Receipt Header Registry, not multi-tenancy at the DB level.

---

## 2. Tech stack — what you must know

- **Next.js 16.1.6** App Router. Dev uses Turbopack (`next dev --turbopack`).
- **React 19.2**, **TypeScript 5** (strict).
- **Tailwind CSS v4** via `@tailwindcss/postcss`. Theme tokens are CSS variables; base colour `slate`. Configured by `components.json` (shadcn) — there is no `tailwind.config.ts`.
- **shadcn-style** Radix primitives in `src/components/ui/*`. Use them; do not introduce a second component system.
- **Supabase** Postgres for storage. We use `@supabase/supabase-js` directly — **NOT** Prisma Client at runtime. `prisma/schema.prisma` is documentation/source-of-truth for the schema; runtime queries use Supabase JS.
- **Auth: custom JWT** (`jose` + `bcryptjs`). We do **not** use Supabase Auth.
- **State / forms:** Zustand v5, React Hook Form v7, Zod v4.
- **Tables:** TanStack React Table v8.
- **Charts:** Recharts v3.
- **Toasts:** Sonner.
- **Icons:** lucide-react.
- **Dates:** `date-fns` + IST helpers in `src/lib/utils.ts`.
- **PWA:** `public/manifest.json` and `<InstallPrompt />`.

Path alias: `@/*` → `src/*`.

---

## 3. Common commands

```bash
npm install
npm run dev      # http://localhost:3000 — Turbopack
npm run build
npm run start
npm run lint
npm run db:seed  # tsx prisma/seed.ts
```

There are no tests in this repo today. Don't fabricate "all tests pass" claims; if you write tests, document the runner here in the same commit.

---

## 4. High-level architecture

```
Browser ──▶ Next.js middleware (JWT cookie check)
            │
            ▼
        (auth) /login   ──▶ loginAction (Server Action)
                              │
                              ▼
                    Supabase ↔ User / Role
                              │
                              ▼ sets `docsile-session` cookie
            ┌──────────────────────────────────────────┐
            │              (hospital) layout            │
            │  Sidebar · main · InstallPrompt           │
            └──────────────────────────────────────────┘
                              │
                              ▼
              Each module page is a Server Component
              that calls a Server Action (`actions.ts`)
              and uses Supabase service-role client
                              │
                              ▼
                       Supabase Postgres
```

- **Auth in middleware** (`src/middleware.ts`) only verifies the JWT. It does not hit the DB.
- **Layout** (`src/app/(hospital)/layout.tsx`) loads `getSession()` + `getHospitalProfile()` in parallel.
- **Server actions** are the only place that mutate data. They always run server-side and use the **service role** Supabase client.
- **No API routes** other than `/api/exotel/webhook` and `/api/logout`. Don't add an API route to do something a server action can do.

---

## 5. Directory map (the bits you'll touch most)

```
src/
├── app/
│   ├── (auth)/login/{page.tsx, login-form.tsx, actions.ts}
│   ├── (hospital)/
│   │   ├── layout.tsx
│   │   ├── dashboard/{page.tsx, DashboardClient.tsx}
│   │   ├── patients|workup|doctor|inpatients|insurance|labs|pharmacy|optical|
│   │   │   expenses|dues-followups|call-logs|license-tracker|reports|
│   │   │   analytics|data|staff|settings/
│   │   │     ├── page.tsx                # Server Component, fetches initial data
│   │   │     ├── actions.ts              # Server Actions for the module
│   │   │     └── components/             # Client components for the module
│   ├── api/exotel/webhook/route.ts
│   └── api/logout/route.ts
├── components/
│   ├── ui/             # shadcn primitives — re-use, don't duplicate
│   ├── layout/         # Sidebar, header, PageSkeleton
│   ├── pwa/            # InstallPrompt
│   └── receipts/       # Print receipts + per-hospital headers/registry.ts
├── lib/
│   ├── auth.ts         # session helpers
│   ├── jwt.ts          # signToken/verifyToken
│   ├── permissions.ts  # ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, MODULE_ROUTE_MAP
│   ├── db.ts           # createClient + cached getHospitalProfile()
│   ├── supabase/{client.ts, server.ts}
│   ├── id-generators.ts
│   ├── workup-options.ts
│   ├── types.ts
│   └── utils.ts
└── middleware.ts
```

---

## 6. Database

The schema lives in `prisma/schema.prisma` (Postgres). The same schema is reified for Supabase in `supabase-migration.sql`. There are also two helper SQL files for tables added later: `create_call_log_table.sql` and `create_inpatient_template_table.sql`.

When you change the schema:

1. Edit `prisma/schema.prisma` (the canonical model).
2. Update `supabase-migration.sql` so a fresh Supabase project still works.
3. Apply the change to the live DB (Supabase SQL editor or migration).
4. Update `src/lib/types.ts` to match.
5. Update affected server actions and components.
6. Update `README.md` and this file (model lists, env vars, etc.).

### Models (37+)

Grouped:

- **Auth/Org:** `User`, `Role`, `HospitalProfile`
- **Masters:** `ServiceTemplate`, `MedicineMaster`, `InvestigationMaster`, `DropdownOption`, `PredefinedTemplate`, `PredefinedPackage`
- **OPD:** `Patient`, `Prescription`, `InvoiceItem`, `Payment`, `EyeReading`
- **Labs:** `Lab`, `LabInvestigation`, `LabBill`, `LabBillItem`, `LabPayment`
- **IPD/Insurance:** `InPatient`, `InsuranceCompany`, `InsuranceClaim`
- **Pharmacy:** `PharmacyMedicine`, `PharmacyStock`, `PharmacySupplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PharmacyBill`, `PharmacyBillItem`
- **Optical:** `OpticalProduct`, `OpticalStock`, `OpticalBill`, `OpticalBillItem`
- **Ops:** `ExpenseCategory`, `Expense`, `License`
- **Telephony:** `CallLog` (defined in `create_call_log_table.sql`)

### Conventions

- **IDs:** `cuid()`. Don't switch to UUIDs without a migration.
- **Human IDs:** `Patient.patientId`, `InPatient.ipNumber` (`IP-####`), `InsuranceClaim.claimNumber` (`INS-YYYY-####`), bill numbers, prescription numbers. Use the helpers in `src/lib/id-generators.ts` and the in-module helpers in each `actions.ts`.
- **JSON columns:** many "complex" fields are `String @db.Text` carrying JSON. Examples: `Prescription.medicines`, `Prescription.investigations`, `EyeReading.{autoRefractometer, glassesReading, previousPrescription, presentPrescription, clinicalFindings}`, `InPatient.{paymentRecords, packageInclusions, doctorNames, prescriptions, medicalValues}`, `InsuranceClaim.{statusHistory, packageInclusions}`, `Role.permissions`, `HospitalProfile.settings`. **Always `JSON.parse` after read and `JSON.stringify` before write.** Shape definitions live in `src/lib/types.ts`.
- **Audit columns:** every mutable model has `createdAt`, `updatedAt`, and most have `createdBy` / `updatedBy` (string user IDs). Always populate them.
- **Statuses are string unions, not Postgres enums.** See `PatientStatus`, `PrescriptionStatus`, `InPatientStatus`, `InsuranceClaimStatus` in `src/lib/types.ts`. When introducing a new state, update the type and any switch/case that depends on it.

---

## 7. Auth & permissions

### Files

- `src/lib/jwt.ts` — `signToken`, `verifyToken`, `COOKIE_NAME = "docsile-session"`, 7-day expiry, HS256, signed with `AUTH_SECRET`.
- `src/lib/auth.ts` — `getSession()` (cached, JWT-only, no DB), `getSessionFromDB()` (re-reads role permissions), `requireAuth()`, `requireAdmin()`, `requirePermission(user, key)`.
- `src/lib/permissions.ts` — `ALL_PERMISSIONS`, `getAllPermissionKeys()`, `DEFAULT_ROLE_PERMISSIONS`, `hasPermission`, `hasAnyPermission`, `MODULE_ROUTE_MAP`.
- `src/middleware.ts` — redirects unauthenticated users to `/login`, authenticated away from `/login`. **Does not check permissions** — only authentication.
- `src/app/(auth)/login/actions.ts` — `loginAction({ email, password })`.

### Permission format

`module:action` strings (e.g. `patients:create`, `inpatients:discharge`, `staff:manage_roles`).

Roles defined: `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `OPTOMETRIST`, `NURSE`. Default permission sets are in `DEFAULT_ROLE_PERMISSIONS`. ADMIN always has every permission via `requirePermission()`.

### When to call which

- In a Server Component or Server Action that only needs identity → `requireAuth()`.
- In an admin-only page → `requireAdmin()`.
- For fine-grained checks → `requirePermission(user, "module:action")`.
- Don't trust the client. Server-side checks are mandatory; UI guards (e.g. Sidebar `adminOnly`) are advisory.

### Cookie

Name: `docsile-session`. httpOnly, `sameSite: "lax"`, `secure` in production, 7 days.

---

## 8. Server-action pattern (REQUIRED)

Every module's `actions.ts` follows this contract. Stick to it.

```ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

const Schema = z.object({ /* ... */ })

export async function doThing(input: z.infer<typeof Schema>) {
  const user = await requireAuth()                       // 1. auth
  const parsed = Schema.safeParse(input)                 // 2. validate
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createClient()                  // 3. DB client (service role)

  try {
    const { data, error } = await supabase
      .from("Table")
      .insert({ ...parsed.data, createdBy: user.id })    // 4. write audit columns
      .select()
      .single()
    if (error) throw error

    revalidatePath("/module")                            // 5. bust ISR caches
    return { success: true, data }                       // 6. typed envelope
  } catch (err) {
    console.error("doThing failed:", err)
    return { success: false, error: "Could not do thing" }
  }
}
```

Return type is always `ActionResult<T>` from `src/lib/types.ts`:

```ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Other rules:

- Do **not** throw out of server actions for "expected" failure paths (validation, business rule violations). Return `{ success: false, error }`.
- Do throw / let it bubble for unexpected DB errors so Next.js shows the error boundary.
- After every mutation, `revalidatePath()` for the affected route(s) so the next read is fresh.
- For multi-step writes, prefer multiple sequential Supabase calls within one action over calling actions from actions.

---

## 9. Supabase access

- `src/lib/supabase/server.ts` exports `createClient()` (service role) — use this in **all** server code.
- `src/lib/supabase/client.ts` exports a browser client (anon key). Use only if a client component truly must query directly; prefer round-tripping through a server action.
- `src/lib/db.ts` re-exports `createClient` and adds `getHospitalProfile()` (per-request `cache` + 5-minute in-memory TTL). After updating hospital settings, call `invalidateHospitalCache()` from the same action.

The Supabase JS client uses table names exactly as in Prisma: `User`, `Patient`, `Prescription`, `InPatient`, `InsuranceClaim`, etc. Column names match the Prisma fields verbatim (camelCase). Don't quote them.

---

## 10. Receipts & multi-hospital headers

- Print receipts: `src/components/receipts/{PrescriptionReceipt, ReadingsReceipt, ClinicalFindingsReceipt, CashReceipt, ReadingsAndFindings}.tsx`.
- `ReceiptHeader` chooses the per-hospital component via `src/components/receipts/headers/registry.ts → getHeaderComponent(hospitalName)`.
- Default: `headers/DefaultHeader.tsx`. Custom: `headers/SriHarshaEyeHospital.tsx`.
- Add a hospital: create a new component, add an entry keyed on `hospitalName.trim().toLowerCase()`. The lookup key must match `HospitalProfile.name` (case-insensitive).

---

## 11. Modules / routes (cheat sheet)

| Route                | Notes                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `/dashboard`         | KPIs/queue snapshot                                                                    |
| `/patients`          | OPD/IPD registry; statuses tracked on `Patient.status`                                 |
| `/workup`            | `EyeReading`; uses dropdowns from `src/lib/workup-options.ts`                          |
| `/doctor`            | Consultation queue; computed status combines workup + Rx state                         |
| `/inpatients`        | `InPatient` + IP number generator; complex JSON columns                                |
| `/insurance`         | `InsuranceClaim` lifecycle; auto-created from IP when payment type = "Insurance"       |
| `/labs`              | `Lab`, `LabInvestigation`, `LabBill` (separate billing from `Prescription`)            |
| `/pharmacy`          | Inventory by batch + expiry; GST per medicine; PO workflow                             |
| `/optical`           | Inventory with `power`; lens-Rx snapshot; delivery flow                                |
| `/expenses`          | `Expense` + `ExpenseCategory`                                                          |
| `/dues-followups`    | Outstanding `balanceDue`; WhatsApp button                                              |
| `/call-logs`         | `CallLog` populated by Exotel webhook                                                  |
| `/license-tracker`   | `License` + reminder windows                                                           |
| `/analytics`         | Recharts visuals                                                                       |
| `/reports`           | Per-patient consolidated report viewer + print                                         |
| `/data`              | CSV exports                                                                            |
| `/staff`             | ADMIN-only — User & Role CRUD                                                          |
| `/settings`          | Hospital profile + clinical masters                                                    |
| `/api/exotel/webhook`| Token-validated webhook; calls Exotel API for Leg 2 status                             |
| `/api/logout`        | POST clears `docsile-session`                                                          |

---

## 12. External integrations

### Exotel (`src/app/api/exotel/webhook/route.ts`)

- Validates `EXOTEL_WEBHOOK_TOKEN` via `x-exotel-token` header or `?token=`.
- On terminal events, calls `https://api.exotel.com/v1/Accounts/{SID}/Calls/{CallSid}?details=true` (Basic auth `EXOTEL_API_KEY:EXOTEL_API_TOKEN`) to get **Leg 2** status — that's the agent leg, the only reliable indicator of "did the agent answer".
- Maps Leg 2 status → `CallLog.status`: `completed | missed | busy | failed`. Falls back to `ConversationDuration > 0` if the API call fails.
- Matches the caller to a `Patient` by the last 10 digits of phone.
- Upserts by `exotelCallSid`. Don't overwrite a final status with a non-final one.

### WhatsApp

`wa.me`-style deep link from the dues/follow-ups module. No Business API integration in this repo.

---

## 13. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server-only — never import in a "use client" file
AUTH_SECRET                    # JWT signing
HOSPITAL_NAME                  # informational; real hospital data lives in HospitalProfile
HOSPITAL_SLUG
EXOTEL_SID
EXOTEL_API_KEY
EXOTEL_API_TOKEN
EXOTEL_WEBHOOK_TOKEN
```

If you add a new env var, add it to `.env`, document it in `README.md`, and reference it in this file.

---

## 14. Conventions & gotchas

- **Use `cn()`** from `@/lib/utils` (it's `clsx + tailwind-merge`) for class merging.
- **Currency:** `formatCurrency(n)` (₹ INR via `Intl.NumberFormat`). Don't hand-format.
- **Dates:** persist as ISO/UTC. Display via `formatDate`, `formatDateLong`, `formatDateTime`, `formatTime`, `timeAgo`. For day-bounded queries in IST, use `getISTDayBounds()`. For `<input type="date">` round-trips, use `toLocalDateISO` / `parseISODate`.
- **Patient status is computed** in some places via `computePatientStatus(hasWorkup, hasDoctorPrescription, status)` from `utils.ts`. Use it instead of re-deriving inline.
- **JSON columns:** parse on read, stringify on write. The browser-side type assumes the parsed shape — don't pass raw strings into client components expecting an object.
- **Service role key** is in `src/lib/supabase/server.ts` only. Never import `server.ts` from a `"use client"` component.
- **Cache:** `getHospitalProfile()` is cached for 5 minutes in process memory. After settings updates, call `invalidateHospitalCache()` in the same action.
- **PWA orientation** is `landscape` (manifest). Layouts assume desktop/tablet.
- **`vercel.json`** currently has a SPA-style rewrite to `/index.html`. That is **wrong for Next.js App Router**. If you deploy or touch deployment config, fix or remove this rewrite.
- **There are no automated tests** in the repo. If you add them, document the runner and how to invoke it here.

---

## 15. When you add a new module

1. Create `src/app/(hospital)/<module>/{page.tsx, actions.ts, components/}`.
2. Add the table(s) to `prisma/schema.prisma` and `supabase-migration.sql`.
3. Add types to `src/lib/types.ts`.
4. Add permissions to `src/lib/permissions.ts` (`ALL_PERMISSIONS`, role defaults, `MODULE_ROUTE_MAP`).
5. Add a Sidebar entry in `src/components/layout/Sidebar.tsx` (set `adminOnly` if needed).
6. Document the module in **README.md** (Modules / Routes table) and this file (sections 6, 11, 13 if env vars are added).

---

## 16. Important notes

- This codebase is small enough that "search the repo" usually beats clever abstractions. Prefer a few extra lines of explicit code over premature helpers.
- We do **not** use Prisma Client at runtime. Don't introduce it without a planned migration.
- We do **not** use Supabase Auth. Don't introduce it without explicit instructions.
- Don't add a separate API server — server actions and route handlers cover everything.
- **Always update `README.md` and `CLAUDE.md` together with code changes.** This is not optional.
