# In-Patient Admission Wizard + Predefined Surgeries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long single-page IPD admission form with a 3-step wizard, add a new "Predefined Surgeries" configuration tab, and promote `InPatient.onDutyDoctor` to a multi-value `onDutyDoctors` JSON array.

**Architecture:** Mirror the existing OPD `PatientRegistrationStepper` for the wizard UI. Add a new `PredefinedSurgery` Postgres table managed through Supabase. The wizard pre-fetches its data on button click (same pattern shipped for OPD), so steps 2 and 3 filter the prefetched arrays client-side with zero round-trips.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres via service role), Tailwind v4, shadcn/Radix, zod, react-hook-form (where used), date-fns.

**Testing approach (read this first):** this project has **no test framework configured** — no jest/vitest, no `*.test.*` files, no testing dependencies. Adding one is out of scope for this feature. Every task below substitutes TDD's red→green loop with **verification-driven steps**: implement → `npx tsc --noEmit` → `npx eslint <files>` → manual smoke test of the affected UI path → commit. Where a step is purely additive (new file, no consumers yet), the smoke test is "page still renders / build still passes".

**Source spec:** `docs/superpowers/specs/2026-05-19-inpatient-admission-wizard-design.md`

---

## File structure

**New files:**
- `supabase-migration-predefined-surgery.sql` (repo root, follows existing convention)
- `src/app/(hospital)/inpatients/components/_wizard-types.ts`
- `src/app/(hospital)/inpatients/components/Step1Patient.tsx`
- `src/app/(hospital)/inpatients/components/Step2Hospital.tsx`
- `src/app/(hospital)/inpatients/components/Step3Payment.tsx`

**Modified files:**
- `prisma/schema.prisma`
- `src/lib/types.ts`
- `src/lib/supabase/types.ts`
- `src/app/(hospital)/settings/actions.ts`
- `src/app/(hospital)/settings/components/SettingsPage.tsx`
- `src/app/(hospital)/inpatients/actions.ts`
- `src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx` (rewritten internally; same default export, same `Props`)
- `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`
- `src/app/(hospital)/inpatients/components/InPatientDetailDrawer.tsx`
- `src/app/(hospital)/insurance/components/InsuranceCashReceipt.tsx`
- `src/app/(hospital)/insurance/components/InsuranceBillPreview.tsx`
- `src/app/(hospital)/insurance/receipt/[id]/ReceiptRenderer.tsx`
- `src/app/(hospital)/patients/components/PatientsPage.tsx`

---

## Task 1: Database migration + Prisma schema + lib types

**Files:**
- Create: `supabase-migration-predefined-surgery.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write the migration SQL file**

Create `supabase-migration-predefined-surgery.sql` at the repo root:

```sql
-- ─── PredefinedSurgery: new table ───────────────────────────
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

-- ─── InPatient.onDutyDoctor → onDutyDoctors (JSON array) ────
ALTER TABLE "InPatient" ADD COLUMN IF NOT EXISTS "onDutyDoctors" TEXT NOT NULL DEFAULT '[]';
UPDATE "InPatient"
   SET "onDutyDoctors" = CASE
     WHEN "onDutyDoctor" IS NULL OR "onDutyDoctor" = '' THEN '[]'
     ELSE to_jsonb(ARRAY["onDutyDoctor"])::text
   END
 WHERE "onDutyDoctors" = '[]';
ALTER TABLE "InPatient" DROP COLUMN IF EXISTS "onDutyDoctor";
```

- [ ] **Step 2: Run the SQL on the dev Supabase project**

Manual step — the user must execute this in the Supabase SQL editor (or via `psql` if they have a direct connection). The migration is idempotent thanks to `IF NOT EXISTS` / `IF EXISTS` guards and the conditional `UPDATE`.

Verify with:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'InPatient' AND column_name LIKE 'onDuty%';
```
Expected: one row, `onDutyDoctors`. No `onDutyDoctor`.

```sql
SELECT COUNT(*) FROM "PredefinedSurgery";
```
Expected: `0`.

- [ ] **Step 3: Update `prisma/schema.prisma`**

Locate the `InPatient` model and replace the `onDutyDoctor` line:

```prisma
  // BEFORE:
  onDutyDoctor   String?

  // AFTER:
  onDutyDoctors  String   @default("[]") @db.Text
```

At the end of the file (after the existing `OpticalBillItem` model), append the new model:

```prisma
// ─── PREDEFINED SURGERIES ───────────────────────────
model PredefinedSurgery {
  id                 String   @id @default(cuid())
  name               String   @unique
  department         String?
  doctorNames        String   @default("[]") @db.Text
  onDutyDoctors      String   @default("[]") @db.Text
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

- [ ] **Step 4: Update `src/lib/types.ts` for the InPatient type**

Find the line `onDutyDoctor: string | null` (around line 286) inside the `InPatient` type and replace it:

```ts
  // BEFORE:
  onDutyDoctor: string | null

  // AFTER:
  onDutyDoctors: string   // JSON-encoded string[]
```

- [ ] **Step 5: Verify nothing else broke yet**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: errors at the read-side sites (`InPatientDetailPage`, `InPatientDetailDrawer`, insurance receipts, `inpatients/actions.ts`, `supabase/types.ts`). These are expected — Tasks 2, 5, 6 fix them. Do NOT try to fix them in this task.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/types.ts supabase-migration-predefined-surgery.sql
git commit -m "$(cat <<'EOF'
db: add PredefinedSurgery model, rename InPatient.onDutyDoctor to onDutyDoctors

- New PredefinedSurgery Postgres table for surgery templates.
- Migrates InPatient.onDutyDoctor (single string) to onDutyDoctors (JSON array).
- prisma/schema.prisma and src/lib/types.ts updated to match.
- SQL is idempotent and must be run against Supabase before deploying code.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Supabase TypeScript types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Update the `InPatient` table types**

Find the `InPatient:` table section (around line 700-830). In all three sub-objects (`Row`, `Insert`, `Update`), replace `onDutyDoctor: string | null` (or `onDutyDoctor?: string | null`) with `onDutyDoctors: string` for Row and `onDutyDoctors?: string` for Insert/Update.

The exact lines (per the grep we already ran):
- Line 741: `Row.onDutyDoctor: string | null` → `Row.onDutyDoctors: string`
- Line 783: `Insert.onDutyDoctor?: string | null` → `Insert.onDutyDoctors?: string`
- Line 825: `Update.onDutyDoctor?: string | null` → `Update.onDutyDoctors?: string`

- [ ] **Step 2: Add the `PredefinedSurgery` table types**

Add a new section under the `public.Tables` object. Insert it next to `PredefinedPackage` (which already exists in the same file — search for it to find the right neighborhood). Append:

```ts
      PredefinedSurgery: {
        Row: {
          id: string
          name: string
          department: string | null
          doctorNames: string         // JSON-encoded string[]
          onDutyDoctors: string       // JSON-encoded string[]
          provisionDiagnosis: string | null
          operationProcedure: string | null
          operationDetails: string | null
          isActive: boolean
          sortOrder: number
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          department?: string | null
          doctorNames?: string
          onDutyDoctors?: string
          provisionDiagnosis?: string | null
          operationProcedure?: string | null
          operationDetails?: string | null
          isActive?: boolean
          sortOrder?: number
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          department?: string | null
          doctorNames?: string
          onDutyDoctors?: string
          provisionDiagnosis?: string | null
          operationProcedure?: string | null
          operationDetails?: string | null
          isActive?: boolean
          sortOrder?: number
          createdBy?: string
          updatedAt?: string
        }
      }
```

- [ ] **Step 3: Verify only existing-callers errors remain**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: errors still at the read-sites (insurance receipts, detail pages, inpatients/actions.ts, the existing AdmissionForm). NOT in supabase/types.ts itself or lib/types.ts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "$(cat <<'EOF'
db: update Supabase TS types for PredefinedSurgery + onDutyDoctors

- Adds PredefinedSurgery Row/Insert/Update types.
- Renames InPatient.onDutyDoctor (string | null) to onDutyDoctors (string).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server actions — Predefined Surgery CRUD

**Files:**
- Modify: `src/app/(hospital)/settings/actions.ts`

- [ ] **Step 1: Locate the predefined-package action block**

Open `src/app/(hospital)/settings/actions.ts` and search for `getPredefinedPackages` — the new actions go *immediately after* that block, before any unrelated sections, so the file remains organized by concern.

- [ ] **Step 2: Add the four predefined-surgery actions**

Append (after the last `deletePredefinedPackage` action):

```ts
// ─── Predefined Surgeries ────────────────────────────────────────────────────

export async function getPredefinedSurgeries(includeInactive: boolean = false) {
  const supabase = await createClient()
  let q = supabase
    .from("PredefinedSurgery")
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  if (!includeInactive) q = q.eq("isActive", true)
  const { data, error } = await q
  if (error) {
    console.error("getPredefinedSurgeries error:", error)
    return []
  }
  return data ?? []
}

export async function createPredefinedSurgery(data: {
  name: string
  department?: string | null
  doctorNames?: string[]
  onDutyDoctors?: string[]
  provisionDiagnosis?: string | null
  operationProcedure?: string | null
  operationDetails?: string | null
  sortOrder?: number
}) {
  const user = await requireAuth()
  if (!data.name?.trim()) {
    return { success: false as const, error: "Surgery name is required" }
  }
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: row, error } = await supabase
      .from("PredefinedSurgery")
      .insert({
        name: data.name.trim(),
        department: data.department ?? null,
        doctorNames: JSON.stringify(data.doctorNames ?? []),
        onDutyDoctors: JSON.stringify(data.onDutyDoctors ?? []),
        provisionDiagnosis: data.provisionDiagnosis ?? null,
        operationProcedure: data.operationProcedure ?? null,
        operationDetails: data.operationDetails ?? null,
        isActive: true,
        sortOrder: data.sortOrder ?? 0,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true as const, data: row }
  } catch (e) {
    console.error("createPredefinedSurgery error:", e)
    return { success: false as const, error: "Failed to create surgery template" }
  }
}

export async function updatePredefinedSurgery(id: string, data: {
  name?: string
  department?: string | null
  doctorNames?: string[]
  onDutyDoctors?: string[]
  provisionDiagnosis?: string | null
  operationProcedure?: string | null
  operationDetails?: string | null
  isActive?: boolean
  sortOrder?: number
}) {
  await requireAuth()
  try {
    const supabase = await createClient()
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined)               update.name = data.name.trim()
    if (data.department !== undefined)         update.department = data.department
    if (data.doctorNames !== undefined)        update.doctorNames = JSON.stringify(data.doctorNames)
    if (data.onDutyDoctors !== undefined)      update.onDutyDoctors = JSON.stringify(data.onDutyDoctors)
    if (data.provisionDiagnosis !== undefined) update.provisionDiagnosis = data.provisionDiagnosis
    if (data.operationProcedure !== undefined) update.operationProcedure = data.operationProcedure
    if (data.operationDetails !== undefined)   update.operationDetails = data.operationDetails
    if (data.isActive !== undefined)           update.isActive = data.isActive
    if (data.sortOrder !== undefined)          update.sortOrder = data.sortOrder
    const { error } = await supabase.from("PredefinedSurgery").update(update).eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true as const }
  } catch (e) {
    console.error("updatePredefinedSurgery error:", e)
    return { success: false as const, error: "Failed to update surgery template" }
  }
}

export async function deletePredefinedSurgery(id: string) {
  await requireAuth()
  // Soft-delete: same pattern as deletePredefinedPackage
  const supabase = await createClient()
  const { error } = await supabase
    .from("PredefinedSurgery")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id)
  if (error) {
    console.error("deletePredefinedSurgery error:", error)
    return { success: false as const, error: "Failed to delete surgery template" }
  }
  revalidatePath("/settings")
  return { success: true as const }
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint "src/app/(hospital)/settings/actions.ts" 2>&1 | tail -10
```
Expected: no new errors in `settings/actions.ts`. Errors in unrelated files remain.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(hospital\)/settings/actions.ts
git commit -m "$(cat <<'EOF'
settings: add CRUD actions for PredefinedSurgery

- getPredefinedSurgeries, createPredefinedSurgery, updatePredefinedSurgery
- deletePredefinedSurgery (soft-delete, mirrors PredefinedPackage)
- doctorNames and onDutyDoctors persist as JSON-encoded string[]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Settings UI — Predefined Surgeries tab

**Files:**
- Modify: `src/app/(hospital)/settings/components/SettingsPage.tsx`

- [ ] **Step 1: Add the imports**

At the top of `SettingsPage.tsx`, in the import block that already pulls actions, add the four new functions:

```ts
import {
  // ...existing imports...
  getPredefinedSurgeries,
  createPredefinedSurgery,
  updatePredefinedSurgery,
  deletePredefinedSurgery,
} from "../actions"
```

- [ ] **Step 2: Register the new tab trigger**

Find the tab list (around line 215) and add a new entry between `packages` and `hospital`:

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

Then add the corresponding `<TabsContent value="surgeries"><SurgeriesTab /></TabsContent>` next to the existing `packages` content.

- [ ] **Step 3: Add the `SurgeriesTab` component**

Append at the end of the file (after `MedicineFormDialog`):

```tsx
// ─── Predefined Surgeries Tab ────────────────────────────────────────────────

type SurgeryRow = {
  id: string
  name: string
  department: string | null
  doctorNames: string         // JSON
  onDutyDoctors: string       // JSON
  provisionDiagnosis: string | null
  operationProcedure: string | null
  operationDetails: string | null
  isActive: boolean
  sortOrder: number
}

function SurgeriesTab() {
  const [surgeries, setSurgeries] = useState<SurgeryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [editItem, setEditItem] = useState<SurgeryRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getPredefinedSurgeries(showInactive)
    setSurgeries(data as SurgeryRow[])
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetch() }, [fetch])

  const filtered = surgeries.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.department?.toLowerCase().includes(q) ?? false)
  })

  async function handleDelete() {
    if (!deleteId) return
    const result = await deletePredefinedSurgery(deleteId)
    if (result.success) {
      toast.success("Surgery template deleted")
      setDeleteId(null)
      await fetch()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search surgeries..."
          className="max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox checked={showInactive} onCheckedChange={v => setShowInactive(v === true)} />
          Show inactive
        </label>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add Surgery</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Doctors</TableHead>
              <TableHead>On-Duty</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                  No surgery templates {search ? "match your search" : "yet"}.
                </TableCell>
              </TableRow>
            ) : filtered.map(s => {
              let doctors: string[] = []
              let onDuty: string[] = []
              try { doctors = JSON.parse(s.doctorNames) } catch {}
              try { onDuty   = JSON.parse(s.onDutyDoctors) } catch {}
              return (
                <TableRow key={s.id} className={s.isActive ? "" : "opacity-50"}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.department ?? "—"}</TableCell>
                  <TableCell className="text-sm">{doctors.join(", ") || "—"}</TableCell>
                  <TableCell className="text-sm">{onDuty.join(", ") || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditItem(s)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(s.id)} className="text-destructive">Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <SurgeryFormDialog
        open={addOpen || !!editItem}
        onClose={() => { setAddOpen(false); setEditItem(null) }}
        editItem={editItem}
        onSaved={async () => { setAddOpen(false); setEditItem(null); await fetch() }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete surgery template?</AlertDialogTitle>
            <AlertDialogDescription>
              The template will be deactivated. Existing in-patient records that reference this
              operation are not affected (they store a snapshot of the values at admission time).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 4: Add the `SurgeryFormDialog` component**

Append at the end of the file (after `SurgeriesTab`):

```tsx
function SurgeryFormDialog({
  open, onClose, editItem, onSaved,
}: {
  open: boolean
  onClose: () => void
  editItem: SurgeryRow | null
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [department, setDepartment] = useState("")
  const [doctorNames, setDoctorNames] = useState<string[]>([""])
  const [onDutyDoctors, setOnDutyDoctors] = useState<string[]>([""])
  const [provisionDiagnosis, setProvisionDiagnosis] = useState("")
  const [operationProcedure, setOperationProcedure] = useState("")
  const [operationDetails, setOperationDetails] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editItem) {
      setName(editItem.name)
      setDepartment(editItem.department ?? "")
      try { setDoctorNames(JSON.parse(editItem.doctorNames) as string[]) } catch { setDoctorNames([""]) }
      try { setOnDutyDoctors(JSON.parse(editItem.onDutyDoctors) as string[]) } catch { setOnDutyDoctors([""]) }
      setProvisionDiagnosis(editItem.provisionDiagnosis ?? "")
      setOperationProcedure(editItem.operationProcedure ?? "")
      setOperationDetails(editItem.operationDetails ?? "")
    } else {
      setName(""); setDepartment("")
      setDoctorNames([""]); setOnDutyDoctors([""])
      setProvisionDiagnosis(""); setOperationProcedure(""); setOperationDetails("")
    }
  }, [open, editItem])

  function updateRow(rows: string[], setter: (v: string[]) => void, i: number, v: string) {
    setter(rows.map((x, j) => (j === i ? v : x)))
  }
  function addRow(rows: string[], setter: (v: string[]) => void) { setter([...rows, ""]) }
  function removeRow(rows: string[], setter: (v: string[]) => void, i: number) {
    if (rows.length > 1) setter(rows.filter((_, j) => j !== i))
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Surgery name is required"); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      department: department.trim() || null,
      doctorNames: doctorNames.map(d => d.trim()).filter(Boolean),
      onDutyDoctors: onDutyDoctors.map(d => d.trim()).filter(Boolean),
      provisionDiagnosis: provisionDiagnosis.trim() || null,
      operationProcedure: operationProcedure.trim() || null,
      operationDetails: operationDetails.trim() || null,
    }
    const result = editItem
      ? await updatePredefinedSurgery(editItem.id, payload)
      : await createPredefinedSurgery(payload)
    setSaving(false)
    if (result.success) {
      toast.success(editItem ? "Surgery template updated" : "Surgery template created")
      onSaved()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Surgery Template" : "Add Surgery Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Operation name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Phacoemulsification + IOL" />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Ophthalmology" />
          </div>

          <div>
            <Label>Doctor names</Label>
            <div className="space-y-2 mt-1">
              {doctorNames.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={d} onChange={e => updateRow(doctorNames, setDoctorNames, i, e.target.value)} placeholder={`Doctor ${i + 1}`} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(doctorNames, setDoctorNames, i)} disabled={doctorNames.length === 1}>−</Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addRow(doctorNames, setDoctorNames)}>+ Add doctor</Button>
            </div>
          </div>

          <div>
            <Label>On-duty doctors</Label>
            <div className="space-y-2 mt-1">
              {onDutyDoctors.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={d} onChange={e => updateRow(onDutyDoctors, setOnDutyDoctors, i, e.target.value)} placeholder={`On-duty doctor ${i + 1}`} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(onDutyDoctors, setOnDutyDoctors, i)} disabled={onDutyDoctors.length === 1}>−</Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addRow(onDutyDoctors, setOnDutyDoctors)}>+ Add on-duty doctor</Button>
            </div>
          </div>

          <div>
            <Label>Provision diagnosis</Label>
            <Input value={provisionDiagnosis} onChange={e => setProvisionDiagnosis(e.target.value)} />
          </div>
          <div>
            <Label>Operation procedure</Label>
            <Textarea value={operationProcedure} onChange={e => setOperationProcedure(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Operation details</Label>
            <Textarea value={operationDetails} onChange={e => setOperationDetails(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

If `Loader2` isn't already imported at the top of the file, add it: `import { Loader2 } from "lucide-react"` (or extend the existing lucide import line).

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint "src/app/(hospital)/settings/components/SettingsPage.tsx" 2>&1 | tail -10
```
Expected: no new errors in SettingsPage.tsx. Pre-existing lint warnings in unrelated parts of the file (PackageDialog, MedicineFormDialog) may still appear — leave them.

- [ ] **Step 6: Smoke test**

Start the dev server (`npm run dev`), visit `/settings`, click the "Predefined Surgeries" tab.
- Expect: empty-state row "No surgery templates yet".
- Click "+ Add Surgery" → fill name "Test Phaco", department "Ophthalmology", one doctor "Dr. A", one on-duty "Dr. B", any procedure text → Save → row appears in the table.
- Click "Edit" on that row → modal pre-fills correctly → change name → Save → updated.
- Click "Delete" → confirms → row disappears.
- Toggle "Show inactive" → row reappears greyed-out.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(hospital\)/settings/components/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
settings: add Predefined Surgeries tab

- SurgeriesTab list view with search and show-inactive toggle.
- SurgeryFormDialog supporting all 7 template fields, including
  multi-row inputs for doctorNames and onDutyDoctors.
- New tab inserted between IPD Packages and Hospital Profile.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Inpatients backend — onDutyDoctors rename + bundled prefetch

**Files:**
- Modify: `src/app/(hospital)/inpatients/actions.ts`

- [ ] **Step 1: Update the InPatient zod schema**

Find the `InPatientSchema` (near the top of the file) and replace the `onDutyDoctor` field:

```ts
// BEFORE:
  onDutyDoctor: z.string().optional(),

// AFTER:
  onDutyDoctors: z.array(z.string()).default([]),
```

- [ ] **Step 2: Update `createInPatient` insertion**

Find the `createInPatient` action (around line 158-220). In the `.insert({...})` payload, replace:

```ts
// BEFORE:
        onDutyDoctor: pd.onDutyDoctor ?? null,

// AFTER:
        onDutyDoctors: JSON.stringify(pd.onDutyDoctors ?? []),
```

- [ ] **Step 3: Update `updateInPatientDetails` argument shape**

Find `updateInPatientDetails(...)` (around line 455-500). Replace the `onDutyDoctor?: string` parameter and the corresponding update body:

```ts
// In the data type:
// BEFORE:
  onDutyDoctor?: string

// AFTER:
  onDutyDoctors?: string[]

// In the body, BEFORE:
    if (data.onDutyDoctor !== undefined) updateData.onDutyDoctor = data.onDutyDoctor

// AFTER:
    if (data.onDutyDoctors !== undefined) updateData.onDutyDoctors = JSON.stringify(data.onDutyDoctors)
```

- [ ] **Step 4: Update `updateInPatient`**

Find the second insertion site at around line 587 (the `updateInPatient` action). Replace:

```ts
// BEFORE:
        onDutyDoctor: pd.onDutyDoctor ?? null,

// AFTER:
        onDutyDoctors: JSON.stringify(pd.onDutyDoctors ?? []),
```

- [ ] **Step 5: Add the bundled `getInPatientAdmissionFormData` action**

At an appropriate spot (after the existing `getInPatients` action), add:

```ts
/**
 * Bundled fetch for the IPD admission wizard. Replaces 5+ separate calls
 * (hospital profile + next IP number + dropdown options + predefined surgeries +
 * predefined packages) with a single server-action round-trip.
 *
 * Mirrors `getPatientRegistrationFormData` (OPD).
 */
export async function getInPatientAdmissionFormData() {
  await requireAuth()
  const supabase = await createClient()

  // Dynamic imports to avoid hard cross-module deps at the top of the file.
  const { getHospitalProfile: getCachedHospitalProfile } = await import("@/lib/db")
  const { getPredefinedSurgeries } = await import("../settings/actions")
  const { getPredefinedPackages }  = await import("../settings/actions")

  const [hospitalCached, nextIpNumber, dropdownRes, surgeries, packages] = await Promise.all([
    getCachedHospitalProfile(),
    getNextIpNumber(),
    supabase
      .from("DropdownOption")
      .select("fieldName, value")
      .in("fieldName", ["doctorName", "department", "referredBy"])
      .order("value", { ascending: true }),
    getPredefinedSurgeries(false),
    getPredefinedPackages(false),
  ])

  const grouped: { doctorName: string[]; department: string[]; referredBy: string[] } = {
    doctorName: [], department: [], referredBy: [],
  }
  for (const row of dropdownRes.data ?? []) {
    if (row.fieldName === "doctorName") grouped.doctorName.push(row.value)
    else if (row.fieldName === "department") grouped.department.push(row.value)
    else if (row.fieldName === "referredBy") grouped.referredBy.push(row.value)
  }

  return {
    hospitalProfile: hospitalCached.hospital,
    nextIpNumber,
    doctorOptions: grouped.doctorName,
    departmentOptions: grouped.department,
    referralOptions: grouped.referredBy,
    predefinedSurgeries: surgeries,
    predefinedPackages: packages,
  }
}
```

If `getNextIpNumber` doesn't already exist as a helper in this file, search the file — it may be inlined inside `createInPatient`. If it's not extractable cleanly, copy the inline logic into a private `async function getNextIpNumber()` helper inside the file and call it from both `createInPatient` and the new bundled action.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: errors **only** at the read-side sites: `InPatientDetailPage.tsx`, `InPatientDetailDrawer.tsx`, insurance receipts, and the still-unchanged `InPatientAdmissionForm.tsx`. Task 6 and Tasks 7-10 fix those.

- [ ] **Step 7: Lint**

```bash
npx eslint "src/app/(hospital)/inpatients/actions.ts" 2>&1 | tail -10
```
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(hospital\)/inpatients/actions.ts
git commit -m "$(cat <<'EOF'
inpatients: migrate onDutyDoctor to onDutyDoctors[], add wizard prefetch

- InPatientSchema now expects onDutyDoctors: string[].
- createInPatient/updateInPatient/updateInPatientDetails serialize as JSON.
- New getInPatientAdmissionFormData() bundles hospital profile, next IP
  number, dropdown options, predefined surgeries, and predefined packages
  into a single server-action call for the admission wizard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Read-side sweep — every old `onDutyDoctor` reader

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`
- Modify: `src/app/(hospital)/inpatients/components/InPatientDetailDrawer.tsx`
- Modify: `src/app/(hospital)/insurance/components/InsuranceCashReceipt.tsx`
- Modify: `src/app/(hospital)/insurance/components/InsuranceBillPreview.tsx`
- Modify: `src/app/(hospital)/insurance/receipt/[id]/ReceiptRenderer.tsx`

**Strategy:** every site that read a single `onDutyDoctor` string now parses an `onDutyDoctors` JSON array and joins it with `", "` for display. The receipt prop stays `onDutyDoctor: string` so the receipt's internals don't need to change — only callers do.

- [ ] **Step 1: Fix `InPatientDetailPage.tsx`**

Around line 48, in the local `InPatient` type (or the `inpatient` prop type), replace `onDutyDoctor: string | null` with `onDutyDoctors: string`.

Around line 547, in the detail-info table where the page displays the on-duty doctor:

```tsx
// BEFORE:
                  ["On Duty Doctor", inpatient.onDutyDoctor ?? "—"],

// AFTER:
                  ["On Duty Doctors", (() => {
                    try { return (JSON.parse(inpatient.onDutyDoctors) as string[]).join(", ") || "—" }
                    catch { return "—" }
                  })()],
```

- [ ] **Step 2: Fix `InPatientDetailDrawer.tsx`**

Same change — line 39 (type) and line 323 (display) follow the exact same pattern as Step 1.

- [ ] **Step 3: Fix `InsuranceCashReceipt.tsx` (no change to receipt internals)**

The prop is `onDutyDoctor: string` (line 23). Display is `{patientData.onDutyDoctor}` (line 145). Leave both as-is. The receipt receives a pre-joined string.

- [ ] **Step 4: Fix `InsuranceBillPreview.tsx` (caller of receipt)**

Around line 451, where `patientData` is built for the receipt, currently passes `onDutyDoctor: ""`. After this work the IP record stores an array, so build the joined string from the actual data. Locate where `inpatient` is in scope and replace:

```tsx
// BEFORE (line 451 area):
                    onDutyDoctor: "",

// AFTER (in the same object literal, replace the empty value with a
// joined string derived from the in-patient's array):
                    onDutyDoctor: (() => {
                      try { return (JSON.parse(inpatient.onDutyDoctors) as string[]).join(", ") }
                      catch { return "" }
                    })(),
```

If `inpatient` is not the variable name in scope at that location, search up a few lines to find the correct binding (it may be `ip`, `claimData`, or similar).

- [ ] **Step 5: Fix `ReceiptRenderer.tsx`**

Around line 123, same pattern as Step 4 — replace `onDutyDoctor: ""` with the joined-string derivation from the in-scope IP record.

- [ ] **Step 6: Verify no callers of `onDutyDoctor` remain**

```bash
grep -rn "onDutyDoctor[^s]" src --include="*.ts" --include="*.tsx" | grep -v "onDutyDoctors"
```
Expected: matches **only** inside `InsuranceCashReceipt.tsx` (the prop name, which we kept) and inside `InPatientAdmissionForm.tsx` (the old form, which is rewritten in Task 7). All other references should be gone.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: only errors inside `InPatientAdmissionForm.tsx` (it still references the old field — gets fixed by the wizard rewrite). No errors in detail pages or receipts.

- [ ] **Step 8: Smoke test**

Run dev server. Existing admin should still be able to:
- Open an in-patient detail page → "On Duty Doctors" row shows comma-joined names (or "—" for none).
- Open an insurance claim → bill preview → receipt rendering: no crash, on-duty field shows joined string.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/InPatientDetailPage.tsx \
        src/app/\(hospital\)/inpatients/components/InPatientDetailDrawer.tsx \
        src/app/\(hospital\)/insurance/components/InsuranceBillPreview.tsx \
        src/app/\(hospital\)/insurance/receipt/\[id\]/ReceiptRenderer.tsx
git commit -m "$(cat <<'EOF'
inpatients: read-side sweep for onDutyDoctor → onDutyDoctors[]

- InPatientDetailPage and InPatientDetailDrawer parse the JSON array
  and display as a comma-joined string.
- Insurance bill preview and receipt renderer derive the joined string
  from inpatient.onDutyDoctors and pass it to the receipt component
  (whose prop stays a single string for now).
- InPatientAdmissionForm.tsx is intentionally left for the next task,
  which rewrites it as a 3-step wizard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wizard scaffold — parent shell + step indicators + stub step files

**Files:**
- Create: `src/app/(hospital)/inpatients/components/_wizard-types.ts`
- Create: `src/app/(hospital)/inpatients/components/Step1Patient.tsx`
- Create: `src/app/(hospital)/inpatients/components/Step2Hospital.tsx`
- Create: `src/app/(hospital)/inpatients/components/Step3Payment.tsx`
- Modify (rewrite): `src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx`

This task replaces the 980-line form with a wizard shell. The three step files are intentionally **stubs** — they render placeholder content. Tasks 8/9/10 fill them in. After this task the dialog opens, the user can move Back/Next, click step indicators in edit mode, and click Cancel/Save — but the step bodies are empty.

- [ ] **Step 1: Create `_wizard-types.ts` (shared state shape)**

```ts
// src/app/(hospital)/inpatients/components/_wizard-types.ts
import type { PackageInclusion, PaymentRecord } from "@/lib/types"
import type { getInPatientAdmissionFormData } from "../actions"

export type WizardBundledData = Awaited<ReturnType<typeof getInPatientAdmissionFormData>>

export type WizardState = {
  // Step 1
  opPatientId: string         // empty if not linked to an existing OPD patient
  ipNumber: string
  admissionDate: string       // datetime-local string
  name: string
  age: string
  gender: string
  dateOfBirth: string
  phone: string
  address: string
  guardianName: string
  referredBy: string
  admissionNotes: string

  // Step 2
  operationDate: string
  operationName: string
  department: string
  doctorNames: string[]
  onDutyDoctors: string[]
  provisionDiagnosis: string
  operationProcedure: string
  operationDetails: string

  // Step 3
  packageInclusions: PackageInclusion[]
  discount: number
  paymentRecords: PaymentRecord[]
}

export type StepProps = {
  state: WizardState
  setState: (updater: (prev: WizardState) => WizardState) => void
  data: WizardBundledData
  isEditMode: boolean
}
```

- [ ] **Step 2: Create stub `Step1Patient.tsx`**

```tsx
// src/app/(hospital)/inpatients/components/Step1Patient.tsx
"use client"
import type { StepProps } from "./_wizard-types"

export function Step1Patient(_props: StepProps) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Step 1 (Patient Details) — implemented in next task.
    </div>
  )
}
```

- [ ] **Step 3: Create stub `Step2Hospital.tsx`**

```tsx
// src/app/(hospital)/inpatients/components/Step2Hospital.tsx
"use client"
import type { StepProps } from "./_wizard-types"

export function Step2Hospital(_props: StepProps) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Step 2 (Hospital Information) — implemented in next task.
    </div>
  )
}
```

- [ ] **Step 4: Create stub `Step3Payment.tsx`**

```tsx
// src/app/(hospital)/inpatients/components/Step3Payment.tsx
"use client"
import type { StepProps } from "./_wizard-types"

export function Step3Payment(_props: StepProps) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Step 3 (Payment & Package) — implemented in next task.
    </div>
  )
}
```

- [ ] **Step 5: Rewrite `InPatientAdmissionForm.tsx` as the wizard parent**

Replace the **entire file contents** with the new wizard. Keep the file path and `export default function InPatientAdmissionForm(...)` signature exactly so the call sites in `PatientsPage` need no import changes.

```tsx
// src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  getInPatientAdmissionFormData,
  createInPatient,
  updateInPatient,
} from "../actions"
import { Step1Patient } from "./Step1Patient"
import { Step2Hospital } from "./Step2Hospital"
import { Step3Payment } from "./Step3Payment"
import type { WizardState, WizardBundledData } from "./_wizard-types"
import type { InPatient, PackageInclusion, PaymentRecord } from "@/lib/types"

const NOW = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
const TOMORROW = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const EMPTY_STATE: WizardState = {
  opPatientId: "",
  ipNumber: "",
  admissionDate: NOW(),
  name: "", age: "", gender: "", dateOfBirth: "", phone: "",
  address: "", guardianName: "", referredBy: "Self", admissionNotes: "",
  operationDate: TOMORROW(),
  operationName: "", department: "Ophthalmology",
  doctorNames: [""], onDutyDoctors: [""],
  provisionDiagnosis: "", operationProcedure: "", operationDetails: "",
  packageInclusions: [{ name: "", amount: 0 }],
  discount: 0,
  paymentRecords: [],
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editInpatient?: InPatient | null
  initialData?: WizardBundledData | null
}

export default function InPatientAdmissionForm({ open, onClose, onSuccess, editInpatient, initialData }: Props) {
  const isEditMode = !!editInpatient
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [state, setState] = useState<WizardState>(EMPTY_STATE)
  const [data, setData] = useState<WizardBundledData | null>(initialData ?? null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load data when the modal opens. If parent already prefetched (admit flow),
  // skip the fetch — no in-dialog loader flicker.
  useEffect(() => {
    if (!open) return
    setStep(1)
    if (initialData) {
      setData(initialData)
      return
    }
    let cancelled = false
    setLoading(true)
    getInPatientAdmissionFormData()
      .then(d => { if (!cancelled) setData(d) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, initialData])

  // Seed state when data + editInpatient are known.
  useEffect(() => {
    if (!open || !data) return
    if (editInpatient) {
      setState(stateFromInpatient(editInpatient))
    } else {
      setState({ ...EMPTY_STATE, ipNumber: data.nextIpNumber })
    }
  }, [open, data, editInpatient])

  // Net amount memo (used in step 3 + submit)
  const packageAmount = useMemo(
    () => state.packageInclusions.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [state.packageInclusions],
  )
  const netAmount = packageAmount - (Number(state.discount) || 0)
  const totalReceived = useMemo(
    () => state.paymentRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [state.paymentRecords],
  )

  function validStep1(): boolean {
    return (
      state.name.trim() !== "" &&
      state.age.trim() !== "" &&
      state.gender !== "" &&
      state.phone.trim() !== "" &&
      state.admissionDate !== ""
    )
  }
  function validStep2(): boolean {
    return state.operationName.trim() !== "" && state.doctorNames.some(d => d.trim() !== "")
  }
  function validStep3(): boolean {
    return state.packageInclusions.length > 0 && state.packageInclusions.some(i => i.name.trim() !== "")
  }

  async function handleSubmit() {
    if (!validStep1()) { toast.error("Please complete Step 1"); setStep(1); return }
    if (!validStep2()) { toast.error("Please complete Step 2"); setStep(2); return }
    if (!validStep3()) { toast.error("Please add at least one package inclusion"); setStep(3); return }
    setSubmitting(true)
    const payload = {
      opPatientId: state.opPatientId || undefined,
      ipNumber: state.ipNumber,
      admissionDate: state.admissionDate,
      admissionNotes: state.admissionNotes.trim() || undefined,
      name: state.name.trim(),
      age: parseInt(state.age, 10),
      gender: state.gender,
      phone: state.phone.trim(),
      dateOfBirth: state.dateOfBirth || undefined,
      address: state.address.trim() || undefined,
      guardianName: state.guardianName.trim() || undefined,
      referredBy: state.referredBy.trim() || undefined,
      department: state.department.trim() || undefined,
      doctorNames: state.doctorNames.map(d => d.trim()).filter(Boolean),
      onDutyDoctors: state.onDutyDoctors.map(d => d.trim()).filter(Boolean),
      operationName: state.operationName.trim() || undefined,
      operationDate: state.operationDate || undefined,
      operationProcedure: state.operationProcedure.trim() || undefined,
      operationDetails: state.operationDetails.trim() || undefined,
      provisionDiagnosis: state.provisionDiagnosis.trim() || undefined,
      packageInclusions: state.packageInclusions.filter(i => i.name.trim()),
      packageAmount,
      discount: Number(state.discount) || 0,
      netAmount,
      paymentRecords: state.paymentRecords,
      totalReceivedAmount: totalReceived,
      balanceAmount: netAmount - totalReceived,
    }
    const result = isEditMode
      ? await updateInPatient(editInpatient!.id, payload)
      : await createInPatient(payload)
    setSubmitting(false)
    if (result.success) {
      toast.success(isEditMode ? "In-patient updated" : "Patient admitted")
      onSuccess()
      onClose()
    } else {
      toast.error(result.error)
    }
  }

  const stepLabels: { n: 1 | 2 | 3; label: string; valid: () => boolean }[] = [
    { n: 1, label: "Patient Details", valid: validStep1 },
    { n: 2, label: "Hospital Information", valid: validStep2 },
    { n: 3, label: "Payment & Package", valid: validStep3 },
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? `Edit In-Patient: ${editInpatient?.name ?? ""}` : "Admit In-Patient"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-3 border-b border-border/60">
          {stepLabels.map((s, idx) => {
            const active = step === s.n
            const complete = s.n < step || (isEditMode && s.valid())
            const clickable = isEditMode
            return (
              <div key={s.n} className="flex items-center">
                <button
                  type="button"
                  onClick={() => clickable && setStep(s.n)}
                  disabled={!clickable && !active}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                    active && "bg-primary/10 text-primary font-medium",
                    !active && complete && "text-foreground",
                    !active && !complete && "text-muted-foreground",
                    clickable && "cursor-pointer hover:bg-muted/60",
                  )}
                >
                  <span className={cn(
                    "h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center",
                    active && "bg-primary text-white",
                    !active && complete && "bg-primary/20 text-primary",
                    !active && !complete && "bg-muted text-muted-foreground",
                  )}>
                    {complete && !active ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                </button>
                {idx < stepLabels.length - 1 && (
                  <span className={cn("w-8 h-px mx-1", step > s.n ? "bg-primary/40" : "bg-border")} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading || !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {step === 1 && <Step1Patient state={state} setState={setState} data={data} isEditMode={isEditMode} />}
              {step === 2 && <Step2Hospital state={state} setState={setState} data={data} isEditMode={isEditMode} />}
              {step === 3 && <Step3Payment  state={state} setState={setState} data={data} isEditMode={isEditMode} />}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border/60 px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <div className="flex-1" />
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={submitting}>
              Back
            </Button>
          )}
          {step < 3 && !isEditMode && (
            <Button onClick={() => setStep((step + 1) as 1 | 2 | 3)} disabled={submitting}>
              Next
            </Button>
          )}
          {(step === 3 || isEditMode) && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditMode ? "Save" : "Admit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateTimeString(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 16)
}

function stateFromInpatient(ip: InPatient): WizardState {
  const doctorNames = (() => {
    try { const v = JSON.parse(ip.doctorNames) as string[]; return v.length ? v : [""] }
    catch { return [""] }
  })()
  const onDutyDoctors = (() => {
    try { const v = JSON.parse(ip.onDutyDoctors) as string[]; return v.length ? v : [""] }
    catch { return [""] }
  })()
  const packageInclusions = (() => {
    try { return JSON.parse(ip.packageInclusions ?? "[]") as PackageInclusion[] }
    catch { return [{ name: "", amount: 0 }] }
  })()
  const paymentRecords = (() => {
    try { return JSON.parse(ip.paymentRecords ?? "[]") as PaymentRecord[] }
    catch { return [] }
  })()
  return {
    opPatientId: "",
    ipNumber: ip.ipNumber,
    admissionDate: toLocalDateTimeString(ip.admissionDate),
    name: ip.name,
    age: String(ip.age ?? ""),
    gender: ip.gender ?? "",
    dateOfBirth: ip.dateOfBirth ? toLocalDateTimeString(ip.dateOfBirth).slice(0, 10) : "",
    phone: ip.phone ?? "",
    address: ip.address ?? "",
    guardianName: ip.guardianName ?? "",
    referredBy: ip.referredBy ?? "Self",
    admissionNotes: ip.admissionNotes ?? "",
    operationDate: ip.operationDate ? toLocalDateTimeString(ip.operationDate) : "",
    operationName: ip.operationName ?? "",
    department: ip.department ?? "Ophthalmology",
    doctorNames,
    onDutyDoctors,
    provisionDiagnosis: ip.provisionDiagnosis ?? "",
    operationProcedure: ip.operationProcedure ?? "",
    operationDetails: ip.operationDetails ?? "",
    packageInclusions: packageInclusions.length ? packageInclusions : [{ name: "", amount: 0 }],
    discount: ip.discount ?? 0,
    paymentRecords,
  }
}
```

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | head -30
npx eslint "src/app/(hospital)/inpatients/components/*.tsx" 2>&1 | tail -20
```
Expected: **clean** — every prior error should now be resolved since the rewrite uses `onDutyDoctors` and the read-side files are already fixed.

- [ ] **Step 7: Smoke test**

Run dev server. On the Patients page, switch to the In-Patients tab and click "Admit Patient":
- Dialog opens with "Admit In-Patient" header.
- Step indicator shows 3 chips: Patient Details (active), Hospital Information, Payment & Package.
- Body shows the placeholder text "Step 1 (Patient Details) — implemented in next task."
- Next → step 2 placeholder.
- Next → step 3, button changes to **Admit**.
- Back works.
- Cancel closes.

Then click Edit on an existing IP record:
- Dialog header shows "Edit In-Patient: <name>".
- Step indicators are now clickable.
- Bottom button shows **Save**.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/_wizard-types.ts \
        src/app/\(hospital\)/inpatients/components/Step1Patient.tsx \
        src/app/\(hospital\)/inpatients/components/Step2Hospital.tsx \
        src/app/\(hospital\)/inpatients/components/Step3Payment.tsx \
        src/app/\(hospital\)/inpatients/components/InPatientAdmissionForm.tsx
git commit -m "$(cat <<'EOF'
inpatients: scaffold 3-step admission wizard

Replaces the 980-line single-page InPatientAdmissionForm with a wizard
parent and three step files. Step bodies are placeholders; subsequent
tasks fill them in.

- _wizard-types.ts owns WizardState and StepProps shared types.
- Parent handles dialog chrome, step indicator (clickable in edit mode),
  Back/Next/Save buttons, state initialisation from editInpatient,
  loading state, and submit (create or update).
- Step files render placeholders.

The default export name and signature are preserved so PatientsPage
needs no import changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Step 1 — Patient Details

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/Step1Patient.tsx`

- [ ] **Step 1: Replace the stub with the full Step 1 implementation**

```tsx
// src/app/(hospital)/inpatients/components/Step1Patient.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { EditableCombobox } from "@/components/ui/combobox"
import { Loader2, Search } from "lucide-react"
import { calculateAge } from "@/lib/utils"
import { searchExistingPatients } from "@/app/(hospital)/patients/actions"
import type { StepProps } from "./_wizard-types"

type SearchResult = Awaited<ReturnType<typeof searchExistingPatients>>[0]

export function Step1Patient({ state, setState, data, isEditMode }: StepProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const data = await searchExistingPatients(trimmed)
      setResults(data.slice(0, 8))
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 200)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function pickResult(r: SearchResult) {
    const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ")
    setState(prev => ({
      ...prev,
      opPatientId: r.patientId,
      name: fullName,
      age: r.age != null ? String(r.age) : prev.age,
      gender: r.gender ?? prev.gender,
      phone: r.phone ?? prev.phone,
      address: r.address ?? prev.address,
      guardianName: r.guardianName ?? prev.guardianName,
      dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().slice(0, 10) : prev.dateOfBirth,
    }))
    setQuery(`${fullName} · ${r.patientId}`)
    setOpenDropdown(false)
  }

  return (
    <div className="space-y-5">
      {/* Existing-patient search (admit mode only) */}
      {!isEditMode && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Existing patient (optional)
          </Label>
          <div className="relative mt-1.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setOpenDropdown(true) }}
              onFocus={() => setOpenDropdown(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
              placeholder="Search by name, phone, or patient ID..."
              className="pl-9"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            {openDropdown && results.length > 0 && (
              <div
                onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
                className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
              >
                {results.map(r => (
                  <button
                    key={r.patientId}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                  >
                    <div className="text-sm font-medium">{[r.firstName, r.lastName].filter(Boolean).join(" ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.patientId} · {r.phone ?? "—"} {r.age != null && `· ${r.age}y`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* IP number + admission date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>IP Number</Label>
          <Input value={state.ipNumber} readOnly className="bg-muted/30 font-mono" />
        </div>
        <div>
          <Label>Admission date *</Label>
          <Input
            type="datetime-local"
            value={state.admissionDate}
            onChange={e => setState(p => ({ ...p, admissionDate: e.target.value }))}
          />
        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Full name *</Label>
          <Input value={state.name} onChange={e => setState(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <Label>Age *</Label>
          <Input
            type="number"
            value={state.age}
            onChange={e => setState(p => ({ ...p, age: e.target.value }))}
          />
        </div>
        <div>
          <Label>Gender *</Label>
          <RadioGroup
            value={state.gender}
            onValueChange={v => setState(p => ({ ...p, gender: v }))}
            className="flex gap-4 pt-2"
          >
            {["MALE", "FEMALE", "OTHER"].map(g => (
              <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <RadioGroupItem value={g} /> {g.charAt(0) + g.slice(1).toLowerCase()}
              </label>
            ))}
          </RadioGroup>
        </div>
        <div>
          <Label>Date of birth</Label>
          <Input
            type="date"
            value={state.dateOfBirth}
            onChange={e => {
              const dob = e.target.value
              setState(p => ({ ...p, dateOfBirth: dob, age: dob ? String(calculateAge(dob) ?? p.age) : p.age }))
            }}
          />
        </div>
        <div>
          <Label>Phone *</Label>
          <Input value={state.phone} onChange={e => setState(p => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Address</Label>
          <Textarea
            value={state.address}
            onChange={e => setState(p => ({ ...p, address: e.target.value }))}
            rows={2}
          />
        </div>
        <div>
          <Label>Guardian name</Label>
          <Input value={state.guardianName} onChange={e => setState(p => ({ ...p, guardianName: e.target.value }))} />
        </div>
        <div>
          <Label>Referred by</Label>
          <EditableCombobox
            options={data.referralOptions}
            value={state.referredBy}
            onChange={v => setState(p => ({ ...p, referredBy: v }))}
            placeholder="Self, Dr. X, ..."
          />
        </div>
        <div className="col-span-2">
          <Label>Admission notes</Label>
          <Textarea
            value={state.admissionNotes}
            onChange={e => setState(p => ({ ...p, admissionNotes: e.target.value }))}
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}
```

If `searchExistingPatients` does not exist at the import path shown, verify with: `grep -n "searchExistingPatients" src/app/\(hospital\)/patients/actions.ts` — it already exists at around line 759 of `patients/actions.ts`. Adjust the import only if its location has changed.

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint "src/app/(hospital)/inpatients/components/Step1Patient.tsx" 2>&1 | tail -10
```

- [ ] **Step 3: Smoke test**

Reload `/patients` → IPD tab → Admit Patient:
- Step 1 now renders the search input, IP number, admission date, and all demographic fields.
- Type "test" in the search → spinner shows briefly → dropdown lists up to 8 matches → clicking one prefills name/age/gender/phone/dob/address/guardian.
- Edit mode: open Edit on an existing IP → search input is hidden; demographic fields are prefilled and editable.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/Step1Patient.tsx
git commit -m "$(cat <<'EOF'
inpatients(wizard): step 1 — patient details

- Existing-patient search using searchExistingPatients (200ms debounce).
- Selecting a result fills demographics and stashes opPatientId.
- IP number is read-only; admission date defaults to now.
- Search is hidden in edit mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Step 2 — Hospital Information + Predefined Surgery search

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/Step2Hospital.tsx`

- [ ] **Step 1: Replace the stub with the full Step 2 implementation**

```tsx
// src/app/(hospital)/inpatients/components/Step2Hospital.tsx
"use client"

import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { EditableCombobox } from "@/components/ui/combobox"
import { Search, RotateCcw } from "lucide-react"
import type { StepProps } from "./_wizard-types"

type Surgery = StepProps["data"]["predefinedSurgeries"][number]

export function Step2Hospital({ state, setState, data }: StepProps) {
  const [query, setQuery] = useState("")
  const [openDropdown, setOpenDropdown] = useState(false)
  const [applied, setApplied] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered: Surgery[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.predefinedSurgeries.slice(0, 8)
    return data.predefinedSurgeries
      .filter(s => s.name.toLowerCase().includes(q) || (s.department?.toLowerCase().includes(q) ?? false))
      .slice(0, 8)
  }, [query, data.predefinedSurgeries])

  function applyTemplate(t: Surgery) {
    let docs: string[] = []
    let onDuty: string[] = []
    try { docs = JSON.parse(t.doctorNames) } catch {}
    try { onDuty = JSON.parse(t.onDutyDoctors) } catch {}
    setState(prev => ({
      ...prev,
      operationName: t.name,
      department: t.department ?? prev.department,
      doctorNames: docs.length ? docs : [""],
      onDutyDoctors: onDuty.length ? onDuty : [""],
      provisionDiagnosis: t.provisionDiagnosis ?? "",
      operationProcedure: t.operationProcedure ?? "",
      operationDetails: t.operationDetails ?? "",
    }))
    setQuery(t.name)
    setOpenDropdown(false)
    setApplied(true)
  }

  function resetOperationFields() {
    setState(prev => ({
      ...prev,
      operationName: "",
      department: "Ophthalmology",
      doctorNames: [""],
      onDutyDoctors: [""],
      provisionDiagnosis: "",
      operationProcedure: "",
      operationDetails: "",
    }))
    setQuery("")
    setApplied(false)
  }

  function updateDoctorRow(i: number, v: string) {
    setState(p => ({ ...p, doctorNames: p.doctorNames.map((x, j) => j === i ? v : x) }))
  }
  function addDoctorRow() { setState(p => ({ ...p, doctorNames: [...p.doctorNames, ""] })) }
  function removeDoctorRow(i: number) {
    setState(p => p.doctorNames.length > 1 ? { ...p, doctorNames: p.doctorNames.filter((_, j) => j !== i) } : p)
  }
  function updateOnDutyRow(i: number, v: string) {
    setState(p => ({ ...p, onDutyDoctors: p.onDutyDoctors.map((x, j) => j === i ? v : x) }))
  }
  function addOnDutyRow() { setState(p => ({ ...p, onDutyDoctors: [...p.onDutyDoctors, ""] })) }
  function removeOnDutyRow(i: number) {
    setState(p => p.onDutyDoctors.length > 1 ? { ...p, onDutyDoctors: p.onDutyDoctors.filter((_, j) => j !== i) } : p)
  }

  return (
    <div className="space-y-5">
      {/* Predefined surgery search */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Predefined surgery (optional)
          </Label>
          {applied && (
            <Button size="sm" variant="ghost" onClick={resetOperationFields} className="h-7 gap-1 text-xs">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpenDropdown(true); setApplied(false) }}
            onFocus={() => setOpenDropdown(true)}
            onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
            placeholder="Search predefined operations..."
            className="pl-9"
          />
          {openDropdown && filtered.length > 0 && (
            <div
              onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
              className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
            >
              {filtered.map(t => {
                let docCount = 0; try { docCount = (JSON.parse(t.doctorNames) as string[]).length } catch {}
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.department ?? "—"} · {docCount} doctor{docCount !== 1 ? "s" : ""}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Operation fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Operation name *</Label>
          <EditableCombobox
            options={[]}
            value={state.operationName}
            onChange={v => setState(p => ({ ...p, operationName: v }))}
            placeholder="e.g. Phaco + IOL"
          />
        </div>
        <div>
          <Label>Operation date</Label>
          <Input
            type="datetime-local"
            value={state.operationDate}
            onChange={e => setState(p => ({ ...p, operationDate: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <Label>Department</Label>
          <EditableCombobox
            options={data.departmentOptions}
            value={state.department}
            onChange={v => setState(p => ({ ...p, department: v }))}
            placeholder="e.g. Ophthalmology"
          />
        </div>
      </div>

      {/* Doctor names */}
      <div>
        <Label>Doctor names *</Label>
        <div className="space-y-2 mt-1">
          {state.doctorNames.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <EditableCombobox
                options={data.doctorOptions}
                value={d}
                onChange={v => updateDoctorRow(i, v)}
                placeholder={`Doctor ${i + 1}`}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeDoctorRow(i)} disabled={state.doctorNames.length === 1}>−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addDoctorRow}>+ Add doctor</Button>
        </div>
      </div>

      {/* On-duty doctors */}
      <div>
        <Label>On-duty doctors</Label>
        <div className="space-y-2 mt-1">
          {state.onDutyDoctors.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <EditableCombobox
                options={data.doctorOptions}
                value={d}
                onChange={v => updateOnDutyRow(i, v)}
                placeholder={`On-duty doctor ${i + 1}`}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeOnDutyRow(i)} disabled={state.onDutyDoctors.length === 1}>−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addOnDutyRow}>+ Add on-duty doctor</Button>
        </div>
      </div>

      <div>
        <Label>Provision diagnosis</Label>
        <Input value={state.provisionDiagnosis} onChange={e => setState(p => ({ ...p, provisionDiagnosis: e.target.value }))} />
      </div>
      <div>
        <Label>Operation procedure</Label>
        <Textarea value={state.operationProcedure} onChange={e => setState(p => ({ ...p, operationProcedure: e.target.value }))} rows={3} />
      </div>
      <div>
        <Label>Operation details</Label>
        <Textarea value={state.operationDetails} onChange={e => setState(p => ({ ...p, operationDetails: e.target.value }))} rows={3} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint "src/app/(hospital)/inpatients/components/Step2Hospital.tsx" 2>&1 | tail -10
```

- [ ] **Step 3: Smoke test**

Visit the admission wizard, navigate to step 2:
- All 7 operation fields render.
- With at least one Predefined Surgery created via Settings (Task 4 smoke test should have left one): click in the search → dropdown shows the template → click → all 7 fields fill in.
- A small **Reset** button appears next to the search label after applying; clicking it clears the fields back to defaults and clears the search.
- Doctor names and on-duty doctors support add/remove rows.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/Step2Hospital.tsx
git commit -m "$(cat <<'EOF'
inpatients(wizard): step 2 — hospital information + surgery search

- Inline search filters the prefetched predefinedSurgeries list
  client-side; selecting a template overwrites the 7 operation fields.
- Reset affordance clears those fields back to defaults.
- doctorNames and onDutyDoctors are multi-row combobox inputs that
  reuse the prefetched doctorOptions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Step 3 — Payment & Package + Predefined Package search

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/Step3Payment.tsx`

- [ ] **Step 1: Replace the stub with the full Step 3 implementation**

```tsx
// src/app/(hospital)/inpatients/components/Step3Payment.tsx
"use client"

import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Search, RotateCcw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { StepProps } from "./_wizard-types"
import type { PackageInclusion, PaymentRecord } from "@/lib/types"

type Package = StepProps["data"]["predefinedPackages"][number]

const NOW = () => new Date().toISOString().slice(0, 10)

export function Step3Payment({ state, setState, data }: StepProps) {
  const [query, setQuery] = useState("")
  const [openDropdown, setOpenDropdown] = useState(false)
  const [applied, setApplied] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered: Package[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.predefinedPackages.slice(0, 8)
    return data.predefinedPackages
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, data.predefinedPackages])

  function applyPackage(t: Package) {
    let inclusions: PackageInclusion[] = []
    try { inclusions = JSON.parse(t.inclusions) as PackageInclusion[] } catch {}
    setState(prev => ({
      ...prev,
      packageInclusions: inclusions.length ? inclusions : [{ name: "", amount: 0 }],
      discount: t.discount ?? 0,
    }))
    setQuery(t.name)
    setOpenDropdown(false)
    setApplied(true)
  }

  function resetPackage() {
    setState(prev => ({
      ...prev,
      packageInclusions: [{ name: "", amount: 0 }],
      discount: 0,
    }))
    setQuery("")
    setApplied(false)
  }

  const packageAmount = state.packageInclusions.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const netAmount = packageAmount - (Number(state.discount) || 0)
  const totalReceived = state.paymentRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const balance = netAmount - totalReceived

  function updateInclusion(i: number, patch: Partial<PackageInclusion>) {
    setState(p => ({
      ...p,
      packageInclusions: p.packageInclusions.map((x, j) => j === i ? { ...x, ...patch } : x),
    }))
  }
  function addInclusion() {
    setState(p => ({ ...p, packageInclusions: [...p.packageInclusions, { name: "", amount: 0 }] }))
  }
  function removeInclusion(i: number) {
    setState(p => p.packageInclusions.length > 1
      ? { ...p, packageInclusions: p.packageInclusions.filter((_, j) => j !== i) }
      : p)
  }

  function updatePayment(i: number, patch: Partial<PaymentRecord>) {
    setState(p => ({
      ...p,
      paymentRecords: p.paymentRecords.map((r, j) => j === i ? { ...r, ...patch } : r),
    }))
  }
  function addPayment() {
    setState(p => ({
      ...p,
      paymentRecords: [...p.paymentRecords, { date: NOW(), amountType: "advance", paymentMode: "Cash", amount: 0 }],
    }))
  }
  function removePayment(i: number) {
    setState(p => ({ ...p, paymentRecords: p.paymentRecords.filter((_, j) => j !== i) }))
  }

  return (
    <div className="space-y-5">
      {/* Predefined package search */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Predefined package (optional)
          </Label>
          {applied && (
            <Button size="sm" variant="ghost" onClick={resetPackage} className="h-7 gap-1 text-xs">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpenDropdown(true); setApplied(false) }}
            onFocus={() => setOpenDropdown(true)}
            onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
            placeholder="Search predefined packages..."
            className="pl-9"
          />
          {openDropdown && filtered.length > 0 && (
            <div
              onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
              className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
            >
              {filtered.map(t => {
                let count = 0; try { count = (JSON.parse(t.inclusions) as unknown[]).length } catch {}
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyPackage(t)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(t.totalAmount)} · {count} item{count !== 1 ? "s" : ""}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inclusions */}
      <div>
        <Label>Package inclusions</Label>
        <div className="space-y-2 mt-1">
          {state.packageInclusions.map((inc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={inc.name}
                onChange={e => updateInclusion(i, { name: e.target.value })}
                placeholder="Item name"
                className="flex-1"
              />
              <Input
                type="number"
                value={inc.amount}
                onChange={e => updateInclusion(i, { amount: parseFloat(e.target.value) || 0 })}
                placeholder="Amount"
                className="w-32"
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeInclusion(i)} disabled={state.packageInclusions.length === 1}>−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addInclusion}>+ Add inclusion</Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 px-4 py-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Package amount</span>
          <span className="font-mono font-medium">{formatCurrency(packageAmount)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Discount</span>
          <Input
            type="number"
            value={state.discount}
            onChange={e => setState(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
            className="w-32 h-7 text-right font-mono"
          />
        </div>
        <div className="flex justify-between text-sm mt-1 border-t border-border/60 pt-1.5">
          <span className="font-medium">Net amount</span>
          <span className="font-mono font-semibold">{formatCurrency(netAmount)}</span>
        </div>
      </div>

      {/* Payments */}
      <div>
        <Label>Payments</Label>
        <div className="space-y-2 mt-1">
          {state.paymentRecords.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                type="date"
                value={r.date}
                onChange={e => updatePayment(i, { date: e.target.value })}
                className="col-span-3"
              />
              <Input
                value={r.amountType}
                onChange={e => updatePayment(i, { amountType: e.target.value })}
                placeholder="Type"
                className="col-span-3"
              />
              <Input
                value={r.paymentMode}
                onChange={e => updatePayment(i, { paymentMode: e.target.value })}
                placeholder="Mode"
                className="col-span-2"
              />
              <Input
                type="number"
                value={r.amount}
                onChange={e => updatePayment(i, { amount: parseFloat(e.target.value) || 0 })}
                placeholder="Amount"
                className="col-span-3 text-right"
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removePayment(i)} className="col-span-1">−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addPayment}>+ Add payment</Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 px-4 py-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total received</span>
          <span className="font-mono">{formatCurrency(totalReceived)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1 border-t border-border/60 pt-1.5">
          <span className="font-medium">Balance</span>
          <span className={`font-mono font-semibold ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
            {formatCurrency(balance)}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint "src/app/(hospital)/inpatients/components/Step3Payment.tsx" 2>&1 | tail -10
```

- [ ] **Step 3: Smoke test (full end-to-end admit + edit)**

Admit flow:
- Open wizard → step 1 → fill name "Test Patient", age "40", phone "9999999999", gender Male → Next.
- Step 2 → operation name "Phaco" (or pick template) → Next.
- Step 3 → search a predefined package (or fill one inclusion manually) → Add a payment row → click **Admit**.
- Toast "Patient admitted"; dialog closes; new row appears in the IPD table.

Edit flow:
- Click Edit on the new row → wizard opens with all fields prefilled.
- Click step 2 indicator directly → land on step 2 without going through step 1.
- Modify operation name → click **Save** → toast "In-patient updated".

- [ ] **Step 4: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/Step3Payment.tsx
git commit -m "$(cat <<'EOF'
inpatients(wizard): step 3 — package + payments

- Predefined-package search filters prefetched list; selecting fills
  inclusions and discount.
- Reset affordance returns to empty inclusion and zero discount.
- Inclusions and payments use the same multi-row pattern as the
  operation fields.
- Live-computed totals: package amount, net amount, total received,
  balance (red if positive).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: PatientsPage IPD button — prefetch + spinner + initialData

**Files:**
- Modify: `src/app/(hospital)/patients/components/PatientsPage.tsx`

This task mirrors what we shipped for the OPD "Add Patient" button: prefetch the bundled data on click, show a spinner on the button, and open the wizard with `initialData` so there's no in-dialog loader flicker.

- [ ] **Step 1: Add imports + bundled data type**

Open `src/app/(hospital)/patients/components/PatientsPage.tsx`. Near the existing import of `getPatientRegistrationFormData`, add a sibling import for the IPD bundle (from the inpatients actions):

```ts
import { getInPatientAdmissionFormData } from "@/app/(hospital)/inpatients/actions"

type IpdAddFormData = Awaited<ReturnType<typeof getInPatientAdmissionFormData>>
```

- [ ] **Step 2: Add state for the IPD prefetch**

In the existing state block (near `addLoading` / `addFormData` for OPD), add:

```ts
  const [ipdAddLoading, setIpdAddLoading] = useState(false)
  const [ipdAddFormData, setIpdAddFormData] = useState<IpdAddFormData | null>(null)
```

- [ ] **Step 3: Update the click handler**

Find the existing `handleAddPatientClick` function. Replace the IPD branch (currently `setShowAdd(true); return`) with a prefetch path:

```ts
  async function handleAddPatientClick() {
    if (tab === "OPD") {
      if (addLoading) return
      setAddLoading(true)
      try {
        const data = await getPatientRegistrationFormData()
        setAddFormData(data)
        setShowAdd(true)
      } finally {
        setAddLoading(false)
      }
      return
    }
    // IPD
    if (ipdAddLoading) return
    setIpdAddLoading(true)
    try {
      const data = await getInPatientAdmissionFormData()
      setIpdAddFormData(data)
      setShowAdd(true)
    } finally {
      setIpdAddLoading(false)
    }
  }
```

- [ ] **Step 4: Update the button to reflect the active tab's loading state**

Find the existing "Add Patient" button (currently uses `addLoading`). Switch it to OR both tabs' loading flags so the spinner shows regardless of which tab the user is on:

```tsx
              <Button
                onClick={handleAddPatientClick}
                disabled={addLoading || ipdAddLoading}
                size="sm"
                className="gap-1.5 h-9"
              >
                {(addLoading || ipdAddLoading) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Patient
              </Button>
```

- [ ] **Step 5: Pass `initialData` to the IPD admission form and reset on close**

Find the existing `<InPatientAdmissionForm ... />` render. Replace it with:

```tsx
        <InPatientAdmissionForm
          open={showAdd}
          onClose={() => { setShowAdd(false); setIpdAddFormData(null) }}
          onSuccess={() => { setShowAdd(false); setIpdAddFormData(null); loadPatients() }}
          initialData={ipdAddFormData}
        />
```

- [ ] **Step 6: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint "src/app/(hospital)/patients/components/PatientsPage.tsx" 2>&1 | tail -10
```

- [ ] **Step 7: Smoke test (network panel)**

`npm run dev`, open `/patients`, switch to IPD tab, open Chrome DevTools → Network panel, click **Add Patient**:
- Button shows a spinner (Plus icon → Loader2) and is disabled.
- **Exactly ONE** POST fires to `/patients` (the bundled action).
- When the POST resolves, the wizard opens already populated. No in-dialog loader flicker.
- Then open the search in step 2 → no additional POST fires (client-side filter).
- Same for step 3's package search.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(hospital\)/patients/components/PatientsPage.tsx
git commit -m "$(cat <<'EOF'
patients: prefetch IPD admission data on Add Patient click

- Mirrors the OPD prefetch pattern: click the IPD-tab Add Patient
  button, button shows a spinner while the bundled action runs,
  then the wizard opens already populated.
- Six legacy round-trips collapse to one bundled server-action call.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (run after final commit)

- [ ] **Spec coverage:** every section in `docs/superpowers/specs/2026-05-19-inpatient-admission-wizard-design.md` maps to one of Tasks 1–11. Verified.
- [ ] **No-onDutyDoctor invariant:** `grep -rn "onDutyDoctor[^s]" src --include="*.ts" --include="*.tsx" | grep -v "onDutyDoctors"` returns at most the prop name in `InsuranceCashReceipt.tsx` (intentionally kept).
- [ ] **Wizard works end-to-end:** admit a fresh patient → IP record created with `onDutyDoctors` as a JSON array; edit it → same wizard, all fields prefill; click step indicators in edit mode → direct jumps work.
- [ ] **No round-trip waste on the wizard:** step 2 and step 3 searches filter the prefetched arrays only.

---

## Notes for follow-ups not in scope

- A FK from `InPatient.operationName` to `PredefinedSurgery.id` is intentionally NOT added; the IP record stores a snapshot of values at admission time, mirroring how `PredefinedPackage` already works.
- If the surgery catalogue ever grows past ~1,000 rows, the bundled action should return a search-scoped subset rather than the full list. Today it's bounded.
- No tests are added; this codebase has no test infrastructure. Each task's verification relies on typecheck + lint + manual smoke test.
