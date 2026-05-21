# Predefined Discharge Templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the hospital save reusable named discharge templates (4 fields) in Settings, then pick one via typeahead at the top of the InPatient discharge form to auto-fill those 4 fields.

**Architecture:** New `PredefinedDischarge` Postgres table (free-floating, no FK to surgery). Four standard CRUD server actions in `settings/actions.ts`. New Settings tab `DischargesTab` + `DischargeFormDialog` mirroring the existing `PredefinedSurgery` patterns. In `InPatientDetailPage` (client component), a `useEffect` fetches active templates once per session, and a search-card picker at the top of the discharge form overwrites the four field states on click.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres via service role), Tailwind v4, shadcn/Radix.

**Testing approach (read this first):** No test framework configured. Each task substitutes TDD's red→green loop with **verification-driven steps**: implement → `npx tsc --noEmit` → `npx eslint <files>` → manual smoke test of the affected UI path. **No per-task `git commit`** — the user is collecting all branch work into one final commit at the end of the larger development cycle.

**Source spec:** `docs/superpowers/specs/2026-05-21-discharge-templates-design.md`

---

## File structure

**New files:**
- `supabase-migration-predefined-discharge.sql` (repo root)

**Modified files:**
- `prisma/schema.prisma`
- `src/lib/supabase/types.ts`
- `src/app/(hospital)/settings/actions.ts`
- `src/app/(hospital)/settings/components/SettingsPage.tsx`
- `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`

---

## Task 1: Database migration + Prisma schema

**Files:**
- Create: `supabase-migration-predefined-discharge.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the SQL migration file**

Create `supabase-migration-predefined-discharge.sql` at the repo root:

```sql
-- ─── PredefinedDischarge: new table ───────────────────────────
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

- [ ] **Step 2: Run the SQL on the dev Supabase project**

**⚠️ MANUAL USER ACTION — SKIP THIS STEP.** The user runs this themselves in the Supabase SQL editor. Do NOT attempt to execute SQL. Note in your final report that this step is pending user execution.

Verify after the user runs it:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'PredefinedDischarge';
```
Expected: 11 rows (id, name, the 4 templated text fields, isActive, sortOrder, createdBy, createdAt, updatedAt).

- [ ] **Step 3: Update `prisma/schema.prisma`**

Append at the end of the file (after the last existing model). Use this exact block — match the spec verbatim:

```prisma
// ─── PREDEFINED DISCHARGE TEMPLATES ───────────────────
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

- [ ] **Step 4: Verify nothing else broke**

Run from the project root:
```bash
npx tsc --noEmit 2>&1 | head -10
```
Expected: clean (no output) or only pre-existing unrelated errors. The Prisma schema is a descriptive file (no runtime client) — `tsc` won't reference the new model yet, so a clean tsc is the right expectation.

- [ ] **Step 5: Commit — SKIPPED.** Do not commit. The user wants a single final commit at the end of the full branch's work.

---

## Task 2: Supabase TypeScript types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Locate the existing `PredefinedSurgery` block**

Open `src/lib/supabase/types.ts` and search for `PredefinedSurgery:`. The new `PredefinedDischarge` types go immediately after that block (same shape, same Row/Insert/Update pattern).

- [ ] **Step 2: Add the `PredefinedDischarge` table types**

Insert the following table block inside the `public.Tables` object, after the `PredefinedSurgery` closing brace:

```ts
      PredefinedDischarge: {
        Row: {
          id: string
          name: string
          dischargeDiagnosis: string | null
          conditionAtDischarge: string | null
          dischargeMedications: string | null
          followUpInstructions: string | null
          isActive: boolean
          sortOrder: number
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          dischargeDiagnosis?: string | null
          conditionAtDischarge?: string | null
          dischargeMedications?: string | null
          followUpInstructions?: string | null
          isActive?: boolean
          sortOrder?: number
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          dischargeDiagnosis?: string | null
          conditionAtDischarge?: string | null
          dischargeMedications?: string | null
          followUpInstructions?: string | null
          isActive?: boolean
          sortOrder?: number
          createdBy?: string
          updatedAt?: string
        }
      }
```

- [ ] **Step 3: Verify typecheck still passes**

```bash
npx tsc --noEmit 2>&1 | head -10
```
Expected: clean (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit — SKIPPED.**

---

## Task 3: Server actions — PredefinedDischarge CRUD

**Files:**
- Modify: `src/app/(hospital)/settings/actions.ts`

- [ ] **Step 1: Locate the predefined-surgery block**

Open `src/app/(hospital)/settings/actions.ts` and search for `deletePredefinedSurgery`. The four new actions go immediately after that action's closing brace, before any unrelated section, so the file stays organized by concern.

- [ ] **Step 2: Append the four CRUD actions**

```ts
// ─── Predefined Discharges ───────────────────────────────────────────────────

export async function getPredefinedDischarges(includeInactive: boolean = false) {
  const supabase = await createClient()
  let q = supabase
    .from("PredefinedDischarge")
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  if (!includeInactive) q = q.eq("isActive", true)
  const { data, error } = await q
  if (error) {
    console.error("getPredefinedDischarges error:", error)
    return []
  }
  return data ?? []
}

export async function createPredefinedDischarge(data: {
  name: string
  dischargeDiagnosis?: string | null
  conditionAtDischarge?: string | null
  dischargeMedications?: string | null
  followUpInstructions?: string | null
  sortOrder?: number
}) {
  const user = await requireAuth()
  if (!data.name?.trim()) {
    return { success: false as const, error: "Template name is required" }
  }
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: row, error } = await supabase
      .from("PredefinedDischarge")
      .insert({
        name: data.name.trim(),
        dischargeDiagnosis: data.dischargeDiagnosis ?? null,
        conditionAtDischarge: data.conditionAtDischarge ?? null,
        dischargeMedications: data.dischargeMedications ?? null,
        followUpInstructions: data.followUpInstructions ?? null,
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
    console.error("createPredefinedDischarge error:", e)
    return { success: false as const, error: "Failed to create discharge template" }
  }
}

export async function updatePredefinedDischarge(id: string, data: {
  name?: string
  dischargeDiagnosis?: string | null
  conditionAtDischarge?: string | null
  dischargeMedications?: string | null
  followUpInstructions?: string | null
  isActive?: boolean
  sortOrder?: number
}) {
  await requireAuth()
  try {
    const supabase = await createClient()
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined)                 update.name = data.name.trim()
    if (data.dischargeDiagnosis !== undefined)   update.dischargeDiagnosis = data.dischargeDiagnosis
    if (data.conditionAtDischarge !== undefined) update.conditionAtDischarge = data.conditionAtDischarge
    if (data.dischargeMedications !== undefined) update.dischargeMedications = data.dischargeMedications
    if (data.followUpInstructions !== undefined) update.followUpInstructions = data.followUpInstructions
    if (data.isActive !== undefined)             update.isActive = data.isActive
    if (data.sortOrder !== undefined)            update.sortOrder = data.sortOrder
    const { error } = await supabase.from("PredefinedDischarge").update(update).eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true as const }
  } catch (e) {
    console.error("updatePredefinedDischarge error:", e)
    return { success: false as const, error: "Failed to update discharge template" }
  }
}

export async function deletePredefinedDischarge(id: string) {
  await requireAuth()
  // Soft delete: sets isActive=false, mirrors deletePredefinedSurgery behavior.
  const supabase = await createClient()
  const { error } = await supabase
    .from("PredefinedDischarge")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id)
  if (error) {
    console.error("deletePredefinedDischarge error:", error)
    return { success: false as const, error: "Failed to delete discharge template" }
  }
  revalidatePath("/settings")
  return { success: true as const }
}
```

`requireAuth`, `createClient`, and `revalidatePath` are already imported at the top of this file (used by the neighbouring actions). Do not duplicate the imports.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | head -10
npx eslint "src/app/(hospital)/settings/actions.ts" 2>&1 | tail -10
```
Expected: no new errors in `settings/actions.ts`. Pre-existing errors in other files (typically the read-side `onDutyDoctor` warnings if the surgery feature's migration hasn't fully landed in some uncommitted branches) are unrelated and may remain.

- [ ] **Step 4: Commit — SKIPPED.**

---

## Task 4: Settings UI — "Discharge Templates" tab

**Files:**
- Modify: `src/app/(hospital)/settings/components/SettingsPage.tsx`

- [ ] **Step 1: Add the four server-action imports**

Locate the existing import block that pulls actions from `../actions` (search the file for `getPredefinedSurgeries`). Add the four new function imports alongside the existing ones:

```ts
import {
  // ...existing imports — leave them unchanged...
  getPredefinedDischarges,
  createPredefinedDischarge,
  updatePredefinedDischarge,
  deletePredefinedDischarge,
} from "../actions"
```

- [ ] **Step 2: Register the new tab trigger**

Find the tab labels array (search the file for `{ value: "surgeries", label: "Predefined Surgeries" }`). Insert the new entry **between** `surgeries` and `hospital`:

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

Add the matching `<TabsContent>` next to the existing surgeries content:

```tsx
<TabsContent value="discharges"><DischargesTab /></TabsContent>
```

- [ ] **Step 3: Append the `DischargesTab` component**

Append at the end of the file, immediately after the existing `SurgeryFormDialog` component:

```tsx
// ─── Predefined Discharges Tab ───────────────────────────────────────────────

type DischargeRow = {
  id: string
  name: string
  dischargeDiagnosis: string | null
  conditionAtDischarge: string | null
  dischargeMedications: string | null
  followUpInstructions: string | null
  isActive: boolean
  sortOrder: number
}

function DischargesTab() {
  const [discharges, setDischarges] = useState<DischargeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [editItem, setEditItem] = useState<DischargeRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getPredefinedDischarges(showInactive)
    setDischarges(data as DischargeRow[])
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetch() }, [fetch])

  const filtered = discharges.filter(d => {
    if (!search) return true
    const q = search.toLowerCase()
    return d.name.toLowerCase().includes(q)
  })

  async function handleDelete() {
    if (!deleteId) return
    const result = await deletePredefinedDischarge(deleteId)
    if (result.success) {
      toast.success("Discharge template deleted")
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
          placeholder="Search discharge templates..."
          className="max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox checked={showInactive} onCheckedChange={v => setShowInactive(v === true)} />
          Show inactive
        </label>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add Discharge Template</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-center">Diagnosis</TableHead>
              <TableHead className="w-24 text-center">Medications</TableHead>
              <TableHead className="w-24 text-center">Follow-up</TableHead>
              <TableHead className="w-32"></TableHead>
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
                  No discharge templates {search ? "match your search" : "yet"}.
                </TableCell>
              </TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id} className={d.isActive ? "" : "opacity-50"}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-center text-sm">{d.dischargeDiagnosis ? "✓" : "—"}</TableCell>
                <TableCell className="text-center text-sm">{d.dischargeMedications ? "✓" : "—"}</TableCell>
                <TableCell className="text-center text-sm">{d.followUpInstructions ? "✓" : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditItem(d)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(d.id)} className="text-destructive">Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DischargeFormDialog
        open={addOpen || !!editItem}
        onClose={() => { setAddOpen(false); setEditItem(null) }}
        editItem={editItem}
        onSaved={async () => { setAddOpen(false); setEditItem(null); await fetch() }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete discharge template?</AlertDialogTitle>
            <AlertDialogDescription>
              The template will be deactivated. Existing in-patient records that referenced
              this template at discharge time are not affected (the saved discharge text is
              independent — templates are picked at discharge time and the resulting text is
              persisted directly).
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

- [ ] **Step 4: Append the `DischargeFormDialog` component**

Append at the end of the file, immediately after `DischargesTab`:

```tsx
function DischargeFormDialog({
  open, onClose, editItem, onSaved,
}: {
  open: boolean
  onClose: () => void
  editItem: DischargeRow | null
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [dischargeDiagnosis, setDischargeDiagnosis] = useState("")
  const [conditionAtDischarge, setConditionAtDischarge] = useState("")
  const [dischargeMedications, setDischargeMedications] = useState("")
  const [followUpInstructions, setFollowUpInstructions] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editItem) {
      setName(editItem.name)
      setDischargeDiagnosis(editItem.dischargeDiagnosis ?? "")
      setConditionAtDischarge(editItem.conditionAtDischarge ?? "")
      setDischargeMedications(editItem.dischargeMedications ?? "")
      setFollowUpInstructions(editItem.followUpInstructions ?? "")
    } else {
      setName("")
      setDischargeDiagnosis("")
      setConditionAtDischarge("")
      setDischargeMedications("")
      setFollowUpInstructions("")
    }
  }, [open, editItem])

  async function handleSave() {
    if (!name.trim()) { toast.error("Template name is required"); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      dischargeDiagnosis: dischargeDiagnosis.trim() || null,
      conditionAtDischarge: conditionAtDischarge.trim() || null,
      dischargeMedications: dischargeMedications.trim() || null,
      followUpInstructions: followUpInstructions.trim() || null,
    }
    const result = editItem
      ? await updatePredefinedDischarge(editItem.id, payload)
      : await createPredefinedDischarge(payload)
    setSaving(false)
    if (result.success) {
      toast.success(editItem ? "Discharge template updated" : "Discharge template created")
      onSaved()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Discharge Template" : "Add Discharge Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Template name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Phaco standard post-op"
            />
          </div>
          <div>
            <Label>Discharge diagnosis</Label>
            <Textarea
              value={dischargeDiagnosis}
              onChange={e => setDischargeDiagnosis(e.target.value)}
              rows={2}
              placeholder="Final diagnosis at discharge"
            />
          </div>
          <div>
            <Label>Condition at discharge</Label>
            <Textarea
              value={conditionAtDischarge}
              onChange={e => setConditionAtDischarge(e.target.value)}
              rows={2}
              placeholder="Stable / improved / etc."
            />
          </div>
          <div>
            <Label>Discharge medications</Label>
            <Textarea
              value={dischargeMedications}
              onChange={e => setDischargeMedications(e.target.value)}
              rows={4}
              placeholder="Drug names, dosages, durations"
            />
          </div>
          <div>
            <Label>Follow-up instructions</Label>
            <Textarea
              value={followUpInstructions}
              onChange={e => setFollowUpInstructions(e.target.value)}
              rows={3}
              placeholder="Return on X date, watch out for Y, etc."
            />
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

The existing file already imports `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `Input`, `Label`, `Textarea`, `Button`, `Checkbox`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Skeleton`, `AlertDialog`+family, `useState`, `useEffect`, `useCallback`, `Loader2`, and `toast` because they are all used by `SurgeriesTab` / `SurgeryFormDialog` directly above. Do not add duplicate imports.

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | head -10
npx eslint "src/app/(hospital)/settings/components/SettingsPage.tsx" 2>&1 | tail -15
```
Expected: clean tsc, and the only new lint warnings (if any) are `react-hooks/set-state-in-effect` matching the pattern that already exists in every other tab in this file (e.g., `PrescriptionsTab`, `MedicinesTab`, `SurgeriesTab` — those rule violations are pre-existing house style). No new rule violations otherwise.

- [ ] **Step 6: Smoke test**

Start `npm run dev`, log in, navigate to `/settings`. Confirm:
1. A new tab labelled **"Discharge Templates"** appears between **"Predefined Surgeries"** and **"Hospital Profile"**.
2. Clicking the tab shows an empty-state row "No discharge templates yet." plus a search box, a "Show inactive" checkbox, and the "+ Add Discharge Template" button.
3. Click "+ Add Discharge Template" → modal opens with name + 4 textareas.
4. Save with empty name → toast "Template name is required".
5. Save with name "Test Phaco" + a medications paragraph → toast "Discharge template created", row appears in the table with ✓ in the Medications column and — in the others.
6. Click **Edit** → modal pre-fills correctly; change name → Save → row updates.
7. Click **Delete** → AlertDialog opens with the explanatory copy → Cancel works → Delete deactivates the row (it disappears from the default view).
8. Toggle "Show inactive" → deleted row reappears greyed-out.

- [ ] **Step 7: Commit — SKIPPED.**

---

## Task 5: Discharge form picker integration

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`

This task wires the discharge template list into the InPatient detail page's discharge form: one `useEffect` data fetch + a typeahead picker card at the top of the discharge form + an apply handler that overwrites the four state fields + a Reset affordance.

- [ ] **Step 1: Add the imports**

Open `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`. Locate the top-of-file imports. Find an existing import that pulls from `lucide-react` (the file already imports `Loader2`, etc.) and add the two icons we need:

```ts
import { Search, RotateCcw } from "lucide-react"   // if not already present
```

If those icons are already imported via the existing line, merge them into the existing destructured set instead of adding a separate line.

Then add a new server-action import:

```ts
import { getPredefinedDischarges } from "@/app/(hospital)/settings/actions"
```

- [ ] **Step 2: Add a type alias for the template row**

Add this type alias near the top of the file (after the existing imports / type declarations):

```ts
type DischargeTemplate = Awaited<ReturnType<typeof getPredefinedDischarges>>[number]
```

- [ ] **Step 3: Add state for the template fetch + picker**

Inside the `InPatientDetailPage` component body, near the existing discharge state declarations (around the existing `const [dischargeNotes, setDischargeNotes] = useState("")` and friends), add:

```ts
// Discharge template picker state.
const [dischargeTemplates, setDischargeTemplates] = useState<DischargeTemplate[]>([])
const [templateQuery, setTemplateQuery] = useState("")
const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)
const [templateApplied, setTemplateApplied] = useState(false)
const templateBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

`useRef` is already imported (it's used elsewhere in this file — `printRef`). If not, add it to the existing `react` import.

- [ ] **Step 4: Fetch templates on mount**

Add a `useEffect` after the existing state declarations (near the existing `useEffect` that hydrates state from the inpatient prop). Place it in a location that is clearly tied to the discharge state cluster:

```ts
// Fetch active discharge templates once per detail-page session.
useEffect(() => {
  getPredefinedDischarges(false)
    .then(d => setDischargeTemplates(d as DischargeTemplate[]))
    .catch(() => setDischargeTemplates([]))
}, [])
```

- [ ] **Step 5: Add the filter memo + apply / reset handlers**

Just below the `useEffect` you added in Step 4 (still inside the component body):

```ts
const filteredTemplates = useMemo(() => {
  const q = templateQuery.trim().toLowerCase()
  if (!q) return dischargeTemplates.slice(0, 8)
  return dischargeTemplates
    .filter(t => t.name.toLowerCase().includes(q))
    .slice(0, 8)
}, [templateQuery, dischargeTemplates])

function applyDischargeTemplate(t: DischargeTemplate) {
  setDischargeDiagnosis(t.dischargeDiagnosis ?? "")
  setConditionAtDischarge(t.conditionAtDischarge ?? "")
  setDischargeMedications(t.dischargeMedications ?? "")
  setFollowUpInstructions(t.followUpInstructions ?? "")
  setTemplateQuery(t.name)
  setTemplateDropdownOpen(false)
  setTemplateApplied(true)
}

function resetDischargeTemplate() {
  setDischargeDiagnosis("")
  setConditionAtDischarge("")
  setDischargeMedications("")
  setFollowUpInstructions("")
  setTemplateQuery("")
  setTemplateApplied(false)
}
```

`useMemo` is already imported in this file via the existing react import; if not, add it to the destructured react import.

- [ ] **Step 6: Render the picker section at the top of the discharge form**

Locate the JSX that renders the discharge form section. Search the file for the input that binds to `dischargeDate` — the picker section goes **above** that input (and above any heading the discharge form may have), as the **first** child of the discharge form container.

Paste this JSX block at that position. It exactly mirrors the visual structure of the surgery picker in `Step2Hospital.tsx`:

```tsx
{/* ───────── Predefined discharge picker ───────── */}
<section className="mb-4">
  <div className="flex items-baseline justify-between px-1 mb-2">
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      Predefined discharge
    </h3>
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground/70">optional</span>
      {templateApplied && (
        <Button size="sm" variant="ghost" onClick={resetDischargeTemplate} className="h-6 gap-1 px-2 text-[11px]">
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      )}
    </div>
  </div>
  <div className="rounded-xl border border-border bg-white shadow-sm p-4">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={templateQuery}
        onChange={e => { setTemplateQuery(e.target.value); setTemplateDropdownOpen(true); setTemplateApplied(false) }}
        onFocus={() => setTemplateDropdownOpen(true)}
        onBlur={() => { templateBlurTimerRef.current = setTimeout(() => setTemplateDropdownOpen(false), 150) }}
        placeholder="Search discharge templates..."
        className="pl-9 h-9"
      />
      {templateDropdownOpen && filteredTemplates.length > 0 && (
        <div
          onMouseDown={() => { if (templateBlurTimerRef.current) clearTimeout(templateBlurTimerRef.current) }}
          className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto"
        >
          {filteredTemplates.map(t => {
            const meds = (t.dischargeMedications ?? "").split("\n")[0].slice(0, 80)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyDischargeTemplate(t)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
              >
                <div className="text-sm font-medium text-foreground">{t.name}</div>
                {meds && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {meds}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
    <p className="text-[11px] text-muted-foreground mt-2">
      Pick a saved template to auto-fill the discharge fields below, or fill them manually.
    </p>
  </div>
</section>
```

`Input` and `Button` are already imported in this file.

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | head -10
npx eslint "src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx" 2>&1 | tail -15
```
Expected: clean tsc. ESLint may still surface pre-existing warnings — confirm that no NEW errors at the line numbers of the code added in Steps 3–6.

- [ ] **Step 8: Smoke test**

1. With at least one discharge template created in Settings (e.g., "Test Phaco" from Task 4 step 6), open an in-patient's detail page in the dev server.
2. Scroll to the discharge form section. Verify the new **Predefined discharge** card sits at the top of that section, with the search input + helper text + "optional" hint.
3. Click the search input → dropdown shows up to 8 templates with name + one-line medications preview.
4. Type part of a template name → list filters case-insensitively.
5. Click a result → dropdown closes, the four discharge fields below (Diagnosis / Condition / Medications / Follow-up) are immediately filled with the template's values, query input shows the template name, **Reset** chip appears in the section header.
6. Click **Reset** → all four discharge fields are cleared back to empty, query empties, Reset chip disappears.
7. Click outside the dropdown → it closes via the blur timer.
8. Re-pick a template → fields fill again.
9. Save the discharge as you would normally → the saved record uses the final text (template-derived or edited), not a template id. Re-open the patient and confirm the saved text is intact and editable.

- [ ] **Step 9: Commit — SKIPPED.**

---

## Self-review (run after Task 5)

- [ ] **Spec coverage:**
  - Data model + SQL migration → Task 1 ✓
  - Supabase TS types → Task 2 ✓
  - Four CRUD server actions → Task 3 ✓
  - Settings tab UI (`DischargesTab` + `DischargeFormDialog`) → Task 4 ✓
  - Discharge form picker + `useEffect` data load + apply/reset handlers → Task 5 ✓
  - Out-of-scope items honoured: no FK to surgery ✓, no `InPatient` column for template id ✓, no medical-values templating ✓

- [ ] **No remaining onDutyDoctor / patientId / etc. invariants:** this plan doesn't touch any existing model, so no field renames or read-side sweeps.

- [ ] **Manual user actions:** Task 1 Step 2 (run SQL on Supabase) — the only non-code action.

- [ ] **End-to-end check:** create a template in Settings → admit a patient → open detail → discharge form → pick the template → fields fill in → save → re-open → values persisted.

---

## Notes for follow-ups not in scope

- If you decide later that the discharge template should be 1:1-linked to a `PredefinedSurgery` (Option A from the brainstorming), this is an additive change: add `surgeryId` FK column + a "linked surgery" picker in the Settings form + an auto-pick rule on open of the discharge form. The current free-floating model still works.
- If catalogue grows past ~1,000 templates, the `useEffect` load + client-side filter should become a server-side `searchPredefinedDischarges(query, limit)` action.
- Adding analytics ("most-used template") would require persisting which template was applied; the current design intentionally doesn't, because the saved text is the source of truth and templates are mutable.
