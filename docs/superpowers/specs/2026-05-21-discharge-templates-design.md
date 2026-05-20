# Predefined Discharge Templates

**Date:** 2026-05-21
**Status:** Approved (pending user spec review)
**Scope:** New Settings tab for predefined discharge templates, picker integrated into the In-Patient detail page's discharge form.

## Context

The In-Patient detail page already has a discharge form that captures four free-text fields per patient:

- `dischargeDiagnosis`
- `conditionAtDischarge`
- `dischargeMedications`
- `followUpInstructions`

These four fields are typically the same across patients who had the same surgery (e.g., "continue Moxifloxacin 4× daily for 2 weeks, follow up in 7 days"). Doctors re-typing the same paragraphs slows down discharge and introduces typos.

We will:

1. Add a new `PredefinedDischarge` Postgres model storing reusable named discharge templates.
2. Add a "Discharge Templates" tab in Settings (Configurations) for CRUD on these templates.
3. At discharge time, let the doctor pick a template via a typeahead picker at the top of the discharge form; selecting one overwrites the four fields. Doctor can edit any field after.

Medical examination values (IOP / BP / A-Scan / etc.) are **not** templated — those are per-patient measurements and templating them would invite errors.

## Decisions log

- **Field set:** templated fields are the four discharge fields only (Option A in brainstorming). Medical examination values stay per-patient.
- **Model + linking:** free-floating named templates with no FK to `PredefinedSurgery` (Option B). The doctor picks a template manually at discharge time — the system does not auto-pick based on operation name.
- **Picker style:** typeahead with results list (mirrors the existing surgery / package pickers in the IPD admission wizard).
- **Apply behavior:** clicking a template overwrites the four discharge fields. A Reset affordance clears them back to empty. No confirmation prompt.
- **Persistence on the InPatient:** saved discharge data is the final text the doctor saved; we do **not** store which template was used.

## Data model

### New: `PredefinedDischarge`

```prisma
model PredefinedDischarge {
  id                   String   @id @default(cuid())
  name                 String   @unique
  dischargeDiagnosis   String?  @db.Text
  conditionAtDischarge String?  @db.Text
  dischargeMedications String?  @db.Text
  followUpInstructions String?  @db.Text
  isActive             Boolean  @default(true)
  sortOrder            Int      @default(0)
  createdBy            String
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([isActive])
  @@index([sortOrder])
}
```

### SQL migration (single file `supabase-migration-predefined-discharge.sql`)

Follows the same idiom as `supabase-migration-predefined-surgery.sql`:

```sql
CREATE TABLE IF NOT EXISTS "PredefinedDischarge" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT UNIQUE NOT NULL,
  "dischargeDiagnosis" TEXT,
  "conditionAtDischarge" TEXT,
  "dischargeMedications" TEXT,
  "followUpInstructions" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "PredefinedDischarge_isActive_idx"  ON "PredefinedDischarge" ("isActive");
CREATE INDEX IF NOT EXISTS "PredefinedDischarge_sortOrder_idx" ON "PredefinedDischarge" ("sortOrder");

CREATE TRIGGER trg_predefined_discharge_updated_at BEFORE UPDATE ON "PredefinedDischarge"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

The `gen_random_uuid()` default is a safety net only — server actions generate cuid-style IDs in code like the other models do.

### Supabase TypeScript types

Add `PredefinedDischarge` Row / Insert / Update types to `src/lib/supabase/types.ts` next to `PredefinedSurgery` (also added in a recent feature). No changes to other tables.

## Server actions

Four functions appended to `src/app/(hospital)/settings/actions.ts`, immediately after the existing predefined-surgery block. They mirror the surgery CRUD signatures exactly.

- `getPredefinedDischarges(includeInactive: boolean = false)` — list ordered by `sortOrder` then `name`; filtered by `isActive = true` when `!includeInactive`. Returns `[]` on error.
- `createPredefinedDischarge(data)` — `requireAuth()`, validates `name.trim()` non-empty, `null`-coalesces optional text fields, stamps `createdBy / createdAt / updatedAt`. Calls `revalidatePath("/settings")` on success.
- `updatePredefinedDischarge(id, data)` — `requireAuth()`, conditional partial update via `if (data.X !== undefined) update.X = data.X`, always bumps `updatedAt`. Calls `revalidatePath` on success.
- `deletePredefinedDischarge(id)` — soft delete via `.update({ isActive: false, updatedAt })`, never `.delete()`. Calls `revalidatePath` on success.

No separate `searchPredefinedDischarges` action — the Settings tab and the discharge-form picker both filter the full list client-side (same pattern as predefined surgeries). If the catalogue ever grows past ~1,000 rows the bundled fetch should be revisited.

## Settings UI — "Discharge Templates" tab

### Tab registration

Tab list update in `SettingsPage.tsx` — inserted between "Predefined Surgeries" and "Hospital Profile":

```ts
[
  { value: "services",      label: "Service Templates" },
  { value: "prescriptions", label: "Prescription Templates" },
  { value: "inpatient",     label: "Inpatient Templates" },
  { value: "medicines",     label: "Medicine Templates" },
  { value: "packages",      label: "IPD Packages" },
  { value: "surgeries",     label: "Predefined Surgeries" },
  { value: "discharges",    label: "Discharge Templates" },   // NEW
  { value: "hospital",      label: "Hospital Profile" },
  { value: "users",         label: "Users" },
]
```

### Components

- **`DischargesTab()`** — list view with search input, "Show inactive" checkbox, "+ Add Discharge Template" button, table with columns: Name / Has diagnosis (✓/—) / Has medications (✓/—) / Has follow-up (✓/—) / Edit / Delete. Same skeleton, empty-state, soft-delete-confirm patterns as `SurgeriesTab`.
- **`DischargeFormDialog({ open, onClose, editItem, onSaved })`** — modal with five fields:
  - `Name *` (single-line `Input`)
  - `Discharge diagnosis` (Textarea, 2 rows)
  - `Condition at discharge` (Textarea, 2 rows)
  - `Discharge medications` (Textarea, 4 rows)
  - `Follow-up instructions` (Textarea, 3 rows)

  Validates that name is non-empty; everything else optional. Save dispatches `create` or `update` based on `editItem`.

## Integration — discharge form in `InPatientDetailPage`

The discharge form already lives in `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx` (state declared near line 126; UI rendered further down). The integration adds one new section at the top of that form and a small data load.

### Data load

`InPatientDetailPage` is a client component embedded in two different parent surfaces (the standalone `/inpatients` page **and** the IPD tab inside `/patients`). Rather than thread an `initialDischarges` prop through both parents, the detail component fetches the templates **on mount** via a `useEffect`:

```ts
const [discharges, setDischarges] = useState<PredefinedDischarge[]>([])
useEffect(() => {
  getPredefinedDischarges(false).then(setDischarges).catch(() => setDischarges([]))
}, [])
```

This costs one server-action round-trip the first time a discharge is opened in a given page session. The discharge picker filters this list **client-side**; no additional round-trip when the doctor opens the picker or types in it.

### Picker UI

A new section card rendered at the very top of the discharge form (above the existing date / diagnosis / condition / medications / follow-up fields):

```
┌─ PREDEFINED DISCHARGE                       optional · [↺ Reset] ─┐
│  🔍 Search discharge templates…                                    │
│   ↓ filtered list (client-side over prefetched array):             │
│   ┌────────────────────────────────────────────────────────────┐  │
│   │ Phaco standard post-op                                     │  │
│   │ ICL post-op                                                │  │
│   │ Pterygium excision discharge                               │  │
│   └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

Same visual treatment as the surgery / package pickers in the IPD admission wizard:
- Bordered card with uppercase section header.
- Search input with `Search` icon and dropdown of results.
- Each result row shows the template name and a one-line preview of medications (truncated).
- Clicking a result closes the dropdown, sets `applied = true`, and reveals the Reset button in the section header.
- The Reset button clears the four discharge state fields back to empty and clears the search.

### Apply behavior

Clicking a template runs:

```ts
setDischargeDiagnosis(t.dischargeDiagnosis ?? "")
setConditionAtDischarge(t.conditionAtDischarge ?? "")
setDischargeMedications(t.dischargeMedications ?? "")
setFollowUpInstructions(t.followUpInstructions ?? "")
```

No confirmation prompt before overwriting — same as the other template pickers.

`dischargeDate` is untouched (per-patient).

### What does NOT change

- The save path. The existing discharge save (`dischargeInPatient` action) is untouched — it persists the final text in `dischargeNotes` JSON exactly as before.
- The InPatient schema. No new columns on `InPatient`; we don't record which template was applied.
- The insurance / payment / receipt logic. Discharge templates are display-side only.

## Migration plan

### Deploy order

1. Run `supabase-migration-predefined-discharge.sql` against Supabase **before** deploying code.
2. Update `prisma/schema.prisma` (descriptive only — no runtime Prisma client).
3. Update `src/lib/supabase/types.ts`.
4. Add server actions in `src/app/(hospital)/settings/actions.ts`.
5. Add `DischargesTab` + `DischargeFormDialog` + tab trigger in `SettingsPage.tsx`.
6. Add the picker section + the `useEffect` data load + apply / reset handlers in `InPatientDetailPage.tsx`.

### Touchpoints

- `prisma/schema.prisma` — new model.
- `supabase-migration-predefined-discharge.sql` — new file at repo root.
- `src/lib/supabase/types.ts` — add table types.
- `src/app/(hospital)/settings/actions.ts` — 4 new actions.
- `src/app/(hospital)/settings/components/SettingsPage.tsx` — new tab + components.
- `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx` — picker section, `useEffect` data load, apply / reset handlers.

## Out of scope (deferred)

- Foreign key from `InPatient` → `PredefinedDischarge` recording which template was used. The saved record is the final text only.
- Automatic match-by-surgery (e.g., look up template by `operationName`). User picks manually.
- Multi-variant templates per surgery (e.g., "Phaco standard" vs "Phaco with complications" as variants of the same surgery). Each is just a separate row in the flat list.
- Templating of medical examination values, vitals, or any other per-patient measurement.
- Bulk import / CSV upload.
- Versioning / history of template edits.

## Open questions

None at the time of writing. Anything raised during plan-writing will round-trip back to this spec.
