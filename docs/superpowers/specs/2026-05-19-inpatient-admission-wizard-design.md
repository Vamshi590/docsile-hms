# In-Patient Admission Wizard + Predefined Surgeries

**Date:** 2026-05-19
**Status:** Approved (pending user spec review)
**Scope:** Patients page → In-Patient tab → "Add Patient" flow, plus a new Configurations tab.

## Context

The current `InPatientAdmissionForm.tsx` is a single 980-line form covering patient demographics, hospital information, package definition, and payments all on one screen. It is used for both admit and edit. Users describe it as clumsy.

We will:

1. Split the form into a 3-step wizard (Patient Details → Hospital Information → Payment & Package), mirroring the existing OPD `PatientRegistrationStepper` pattern.
2. Add a new **Predefined Surgeries** configuration tab so common operations can be templated.
3. Add an inline search at the top of Step 2 (predefined surgeries) and Step 3 (predefined packages, already in place) that one-click applies a template to the current form.
4. Promote `InPatient.onDutyDoctor` (single string) to `onDutyDoctors` (JSON array of strings) so multiple on-duty doctors can be tracked faithfully.

## Decisions log

- **Template search UX:** inline search at the top of each step (Option A). Filters a prefetched list client-side; one click applies the template.
- **Wizard scope:** one component for both admit and edit (Option C). In edit mode the step indicators are clickable so the user can jump directly to the section they want to change. Admit mode is linear Next/Back.
- **Step 1 layout:** unified screen with an existing-patient search at the top (Option A); fields prefill on selection but remain editable. The IP record always links to a `Patient.patientId` — existing if found, new otherwise.
- **`onDutyDoctor`:** rename and retype to `onDutyDoctors: JSON[]` everywhere (Option A) — single source of truth, no joined-on-save string compromise.

## Data model

### New: `PredefinedSurgery`

```prisma
model PredefinedSurgery {
  id                 String   @id @default(cuid())
  name               String   @unique
  department         String?
  doctorNames        String   @default("[]") @db.Text  // JSON array
  onDutyDoctors      String   @default("[]") @db.Text  // JSON array
  provisionDiagnosis String?
  operationProcedure String?  @db.Text
  operationDetails   String?  @db.Text
  isActive           Boolean  @default(true)
  sortOrder          Int      @default(0)
  createdBy          String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([isActive])
  @@index([sortOrder])
}
```

### Change: `InPatient.onDutyDoctor` → `onDutyDoctors`

Type changes from `String?` (single string) to `String @default("[]") @db.Text` (JSON-encoded array). Existing values become a one-element array; nulls/empties become `[]`.

### Supabase types

Add the new table row/insert/update types to `src/lib/supabase/types.ts`. Update `InPatient` types to drop `onDutyDoctor` and add `onDutyDoctors: string`.

## Settings: "Predefined Surgeries" tab

Inserted into `SettingsPage.tsx` next to "IPD Packages":

```ts
[
  { value: "services",      label: "Service Templates" },
  { value: "prescriptions", label: "Prescription Templates" },
  { value: "inpatient",     label: "Inpatient Templates" },
  { value: "medicines",     label: "Medicine Templates" },
  { value: "packages",      label: "IPD Packages" },
  { value: "surgeries",     label: "Predefined Surgeries" },   // NEW
  { value: "hospital",      label: "Hospital Profile" },
  { value: "users",         label: "Users" },
]
```

### New components (in `SettingsPage.tsx`)

- **`SurgeriesTab()`** — list view: search, "Add Surgery" button, table of name / department / doctors-count / actions. Same skeleton, empty-state, soft-delete, and admin-only-delete patterns as `PackagesTab`.
- **`SurgeryFormDialog({ open, onClose, editItem, onSaved })`** — modal with all 7 fields. `doctorNames` and `onDutyDoctors` are multi-row inputs (add/remove rows), reusing the same UX pattern as the inpatient form.

### New server actions (in `src/app/(hospital)/settings/actions.ts`)

- `getPredefinedSurgeries(includeInactive = false)` — list (used by both the Settings tab and the wizard's bundled prefetch)
- `createPredefinedSurgery(data)`
- `updatePredefinedSurgery(id, data)`
- `deletePredefinedSurgery(id)` — soft delete (`isActive = false`)

Note: no separate `searchPredefinedSurgeries` action. The Settings tab filters the full list client-side (same as `PackagesTab` does today), and the wizard filters its prefetched array. If the catalogue ever grows past ~1000 rows, revisit this.

## Wizard structure (`InPatientAdmissionForm.tsx`, rewritten)

Keep the file path and default export name unchanged so the call sites (`PatientsPage.tsx`, IPD edit triggers) need no import changes. Rewrite internals into a wizard whose UX mirrors the existing OPD `PatientRegistrationStepper`.

```
┌─ Dialog header: "Admit In-Patient" / "Edit In-Patient: <name>" ─┐
│                                                                  │
│  ●────────────────●────────────────●                             │
│  Patient        Hospital        Payment                          │
│  Details        Information     & Package                        │
│   (1)             (2)             (3)                            │
│                                                                  │
│  ┌─ step content (varies) ──────────────────────────────────┐    │
│  │ ...                                                       │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Cancel]                            [Back]  [Next] / [Save]    │
└──────────────────────────────────────────────────────────────────┘
```

### Step indicator behavior

- **Admit mode** (no `editInpatient`): indicators are visual only; user moves with Next/Back. Step 3 button is **Admit**.
- **Edit mode** (`editInpatient` provided): every indicator is clickable; user can jump to any step. Every step's primary button is **Save** and submits the whole record via `updateInPatient`.
- Steps with empty required fields show a small validation dot, but the indicator stays clickable in edit mode.

### State and submit

- All form state lives in the wizard parent. Step panels are conditionally rendered on `currentStep`, but values persist across step changes because the parent owns them.
- Admit mode: a single `createInPatient(...)` call on step 3's Admit button.
- Edit mode: every Save button calls `updateInPatient(...)` with the full state. No partial updates.

### Prefetch on the IPD "Admit Patient" button

Mirror the OPD pattern (already shipped). On click of "Admit Patient" in `PatientsPage`:

1. Button shows a spinner and becomes disabled.
2. Parent calls a new bundled action `getInPatientAdmissionFormData()` which returns:
   - hospital profile (from cached `getHospitalProfile` in `lib/db.ts`)
   - next IP number
   - doctor / department / referredBy dropdown options (one combined `DropdownOption` query, grouped server-side)
   - all active predefined surgeries (small list, ~20–100)
   - all active predefined packages (small list)
3. When the promise resolves, the wizard opens already populated. Search fields in step 2 and step 3 filter the prefetched arrays **client-side** — zero additional round-trips during the wizard's lifetime.

## Step 1 — Patient Details

```
Existing patient (optional)
  🔍 Search by name, phone, or patient ID...           [⌄]
   ↓ up to 8 matches in dropdown
   ↓ click one → autofills fields below

IP Number       [auto-generated, read-only]
Admission date  [datetime-local, default = now]

Full name *     [          ]
Age *           [    ]     Gender * ( ) M ( ) F ( ) O
Date of birth   [yyyy-mm-dd]
Phone *         [          ]
Address         [textarea]
Guardian name   [          ]
Referred by     [combobox]
Admission notes [textarea]
```

### Behaviors

- The existing-patient search uses the existing `searchExistingPatients()` action (already handles name/phone/patientId match).
- Selecting a result prefills demographic fields and stashes `opPatientId` on the wizard state. `createInPatient` already supports linking via this id.
- Fields stay editable after a match is selected.
- **Required for Next:** `name`, `age`, `gender`, `phone`, `admissionDate`.
- **Edit mode:** the search input is hidden; IP Number is shown read-only; everything else is editable.

## Step 2 — Hospital Information

```
Predefined surgery (optional)
  🔍 Search predefined operations...                  [⌄]
   ↓ filtered from prefetched list
   ┌────────────────────────────────────────────────────┐
   │ Phaco + IOL — Ophthalmology · 2 doctors            │
   │ ICL Implant — Ophthalmology · 1 doctor             │
   └────────────────────────────────────────────────────┘
   ↓ click → fills 7 operation fields

Operation name *      [combobox / free text]
Operation date        [datetime-local]
Department            [combobox]
Doctor names *        [+ Add row] [Dr. A  ❌]
                                  [Dr. B  ❌]
On-duty doctors       [+ Add row] [Dr. C  ❌]
Provision diagnosis   [          ]
Operation procedure   [textarea]
Operation details     [textarea]
```

### Behaviors

- Search filters the prefetched `predefinedSurgeries` array case-insensitively against `name` and `department`. Up to 8 results.
- **Selecting a template** overwrites all 7 fields:
  - `operationName ← template.name`
  - `department ← template.department`
  - `doctorNames ← JSON.parse(template.doctorNames)`
  - `onDutyDoctors ← JSON.parse(template.onDutyDoctors)`
  - `provisionDiagnosis ← template.provisionDiagnosis`
  - `operationProcedure ← template.operationProcedure`
  - `operationDetails ← template.operationDetails`
- `operationDate` is **not** affected by the template — date-of-surgery is per-patient.
- No confirmation prompt before applying. The user can edit any field afterwards or pick a different template (the new one overwrites again).
- A small **Reset** affordance appears next to the search after a template has been applied; it clears the 7 fields back to empty/default for manual entry.
- `doctorNames` and `onDutyDoctors` are multi-row inputs (add/remove). At least one `doctorNames` entry is required.
- **Required for Next:** `operationName`, at least one `doctorNames` entry.
- **Edit mode:** the search remains available; picking a template overwrites the existing operation fields, which is the expected behavior when explicitly selecting one.

## Step 3 — Payment & Package

```
Predefined package (optional)
  🔍 Search predefined packages...                    [⌄]
   ↓ filtered from prefetched list
   ┌────────────────────────────────────────────────────┐
   │ Phaco Package — ₹35,000 · 5 items                  │
   │ ICL Package — ₹80,000 · 3 items                    │
   └────────────────────────────────────────────────────┘

Package inclusions
  [Item name | Amount | Sub-items? | -]   [+ Add inclusion]
Package amount    ₹ 35,000   (auto-summed)
Discount          ₹ [    ]
Net amount        ₹ 35,000   (auto)

Payments
  [Date | Type | Mode | Amount | Notes | -]   [+ Add payment]
Total received    ₹ 10,000   (auto)
Balance           ₹ 25,000   (auto)
```

### Behaviors

- Search filters the prefetched `predefinedPackages` array client-side; click → applies.
- **Selecting a package** overwrites:
  - `packageInclusions ← JSON.parse(template.inclusions)`
  - `discount ← template.discount`
  - `packageAmount` auto-recomputes from new inclusions
- `paymentRecords` are never templated; they remain whatever the user entered.
- A Reset affordance clears inclusions and discount back to defaults.
- This step's behavior already exists in the current form (lines 102–110 of `InPatientAdmissionForm.tsx` today). We preserve the logic and re-skin the picker to match Step 2's search pattern.
- **Validation gate for Save (admit mode):** at least one inclusion (consistent with the existing `InPatientSchema`).
- **Submit button:** "Admit" in admit mode → `createInPatient(...)`; "Save" in edit mode → `updateInPatient(...)`.

## Migration plan

### SQL migration (single file `supabase-migration-predefined-surgery.sql`)

```sql
-- 1. New table
CREATE TABLE IF NOT EXISTS "PredefinedSurgery" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  department TEXT,
  "doctorNames" TEXT NOT NULL DEFAULT '[]',
  "onDutyDoctors" TEXT NOT NULL DEFAULT '[]',
  "provisionDiagnosis" TEXT,
  "operationProcedure" TEXT,
  "operationDetails" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "PredefinedSurgery_isActive_idx"  ON "PredefinedSurgery" ("isActive");
CREATE INDEX IF NOT EXISTS "PredefinedSurgery_sortOrder_idx" ON "PredefinedSurgery" ("sortOrder");

-- 2. InPatient.onDutyDoctor (single string) → onDutyDoctors (JSON array text)
ALTER TABLE "InPatient" ADD COLUMN "onDutyDoctors" TEXT NOT NULL DEFAULT '[]';
UPDATE "InPatient"
   SET "onDutyDoctors" = CASE
     WHEN "onDutyDoctor" IS NULL OR "onDutyDoctor" = '' THEN '[]'
     ELSE to_jsonb(ARRAY["onDutyDoctor"])::text
   END;
ALTER TABLE "InPatient" DROP COLUMN "onDutyDoctor";
```

The `gen_random_uuid()` default is a safety net only — server actions generate cuid-style IDs in code like the other models do.

### Deploy order

The column drop is destructive, so the SQL must run **before** the code is deployed. For a single-tenant app this is acceptable. If a two-phase deploy is wanted later (read from either column → drop), the spec can be revisited; the design does not require it.

### Code touchpoints (in deploy order)

1. `prisma/schema.prisma` — add `PredefinedSurgery`, rename `onDutyDoctor` to `onDutyDoctors` on `InPatient`.
2. `src/lib/supabase/types.ts` — add new table types; update `InPatient` types.
3. `src/app/(hospital)/settings/actions.ts` — five new server actions for predefined surgeries.
4. `src/app/(hospital)/settings/components/SettingsPage.tsx` — add `SurgeriesTab`, `SurgeryFormDialog`, and the tab trigger.
5. `src/app/(hospital)/inpatients/actions.ts` — add `getInPatientAdmissionFormData()` bundle; update `createInPatient`, `updateInPatient`, and `InPatientSchema` to accept `onDutyDoctors: string[]` instead of `onDutyDoctor: string`, stringifying on write.
6. `src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx` — rewrite into a wizard. Same default export, same `Props`. Internal split: `Step1Patient.tsx`, `Step2Hospital.tsx`, `Step3Payment.tsx` (sibling files).
7. **Read-side sweep for the rename** — every `onDutyDoctor` reader must now parse the JSON array. Known callers: `InPatientDetailPage.tsx` (line 145 and any display row), the old `InPatientAdmissionForm.tsx` (subsumed), and any reports/receipts/data-export columns that mention on-duty doctor. Grep before merging.
8. `src/app/(hospital)/patients/components/PatientsPage.tsx` — add prefetch state + spinner on the IPD-tab "Admit Patient" button, same pattern shipped for OPD.

### Risk callouts

- Existing IPD records will hold `onDutyDoctors = ["Dr. X"]` after the migration. UI must handle the empty-array case (no on-duty doctor assigned) without crashing.
- The prefetched surgery/package arrays are small today but bounded behavior: if a hospital grows to thousands of templates, the bundled action should be revised to fetch a search-scoped subset instead.

## Out of scope (deferred)

- Foreign key from `InPatient.operationName` → `PredefinedSurgery.id`. Today the surgery is a template; once applied, the IP record stores a snapshot — same model as `PredefinedPackage`.
- Bulk import of surgeries from CSV.
- Surgery analytics (counts per surgery type).

## Open questions

None at the time of writing. Anything raised during plan-writing will round-trip back to this spec.
