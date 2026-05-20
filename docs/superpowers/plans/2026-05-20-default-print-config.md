# Default Print Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hospital-wide "default print" config (set in Configurations → Print Defaults) and a one-click quick-print button on the Doctor queue rows that prints the configured set of receipts in order.

**Architecture:** Reuse the existing `HospitalProfile.settings` JSON field to store an ordered array of receipt items. Add a new tab in `/settings` to manage it. On the Doctor page, fetch the config server-side and pass to the client; clicking the new button fetches receipt data and prints via a shared utility extracted from `PrintReceiptsModal`.

**Tech Stack:** Next.js 16 (App Router, React Server Components), Supabase, TailwindCSS, shadcn/ui, sonner, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-20-default-print-config-design.md`

**Notes for the implementer:**
- The repo has **no test framework configured** (no Jest/Vitest/Playwright). Each task ends with a manual verification step (typecheck + dev-server smoke test where relevant) instead of TDD.
- **Do NOT run `git commit` during implementation.** The user batches all commits at the end. Steps say "stage files" only.
- The codebase uses Supabase via `@/lib/supabase/server` (`createClient`), not Prisma client directly — even though there's a Prisma schema file. Follow the existing pattern in `src/app/(hospital)/settings/actions.ts`.
- After hospital settings change, call `invalidateHospitalCache()` from `@/lib/db` so the new config propagates.

---

## File structure

**New files:**
- `src/lib/print-receipts.ts` — shared print utility (opens hidden window, writes HTML, prints).
- `src/lib/default-print.ts` — shared types + helpers for parsing/validating `defaultPrint` config.
- `src/app/(hospital)/doctor/components/QuickPrintRenderer.tsx` — client component that builds the multi-page receipt HTML for quick-print.
- `src/app/(hospital)/settings/components/PrintDefaultsTab.tsx` — the new tab UI.

**Modified files:**
- `src/app/(hospital)/settings/actions.ts` — add `getDefaultPrintConfig` and `saveDefaultPrintConfig`.
- `src/app/(hospital)/settings/components/SettingsPage.tsx` — wire new tab, honour `?tab=` query param.
- `src/app/(hospital)/doctor/page.tsx` — server-side fetch of `defaultPrint`, pass to client.
- `src/app/(hospital)/doctor/components/DoctorPage.tsx` — gear icon in sub-header, quick-print button per row, click handler.
- `src/app/(hospital)/doctor/components/PrintReceiptsModal.tsx` — refactor `handlePrint` to use shared utility (small change).

---

## Task 1: Shared types and validator for the default print config

**Files:**
- Create: `src/lib/default-print.ts`

- [ ] **Step 1: Create the types and helpers file**

```ts
// src/lib/default-print.ts

export type DefaultPrintItemType = "cash" | "prescription" | "readings" | "report"
export type ReadingsSubMode = "readings" | "clinical" | "both"

export type DefaultPrintItem =
  | { type: "cash" }
  | { type: "prescription" }
  | { type: "readings"; subMode: ReadingsSubMode }
  | { type: "report" }

export type DefaultPrintConfig = {
  items: DefaultPrintItem[]
}

export const EMPTY_DEFAULT_PRINT_CONFIG: DefaultPrintConfig = { items: [] }

export const DEFAULT_PRINT_LABELS: Record<DefaultPrintItemType, string> = {
  cash: "Cash Receipt",
  prescription: "Prescription",
  readings: "Readings & Findings",
  report: "Full Report",
}

export const READINGS_SUBMODE_LABELS: Record<ReadingsSubMode, string> = {
  readings: "Readings only",
  clinical: "Clinical Findings only",
  both: "Both",
}

const VALID_TYPES: DefaultPrintItemType[] = ["cash", "prescription", "readings", "report"]
const VALID_SUBMODES: ReadingsSubMode[] = ["readings", "clinical", "both"]

/**
 * Parse the raw `settings` JSON string from HospitalProfile and extract the
 * defaultPrint config. Returns the empty config on any parse error or missing key.
 * Unknown item types are silently dropped (forward-compatibility).
 */
export function parseDefaultPrintConfig(settingsRaw: string | null | undefined): DefaultPrintConfig {
  if (!settingsRaw) return EMPTY_DEFAULT_PRINT_CONFIG
  try {
    const parsed = JSON.parse(settingsRaw) as { defaultPrint?: unknown }
    const dp = parsed?.defaultPrint
    if (!dp || typeof dp !== "object" || !Array.isArray((dp as { items?: unknown }).items)) {
      return EMPTY_DEFAULT_PRINT_CONFIG
    }
    const rawItems = (dp as { items: unknown[] }).items
    const seen = new Set<string>()
    const items: DefaultPrintItem[] = []
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") continue
      const t = (raw as { type?: unknown }).type
      if (typeof t !== "string" || !VALID_TYPES.includes(t as DefaultPrintItemType)) continue
      if (seen.has(t)) continue
      if (t === "readings") {
        const sm = (raw as { subMode?: unknown }).subMode
        if (typeof sm !== "string" || !VALID_SUBMODES.includes(sm as ReadingsSubMode)) continue
        items.push({ type: "readings", subMode: sm as ReadingsSubMode })
      } else {
        items.push({ type: t as Exclude<DefaultPrintItemType, "readings"> })
      }
      seen.add(t)
    }
    return { items }
  } catch {
    return EMPTY_DEFAULT_PRINT_CONFIG
  }
}

/**
 * Validate a config that came from the client. Throws a descriptive Error if invalid.
 * Returns the normalized config.
 */
export function validateDefaultPrintConfig(input: unknown): DefaultPrintConfig {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid config: expected an object")
  }
  const items = (input as { items?: unknown }).items
  if (!Array.isArray(items)) {
    throw new Error("Invalid config: items must be an array")
  }
  const seen = new Set<string>()
  const out: DefaultPrintItem[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid item: expected an object")
    }
    const t = (raw as { type?: unknown }).type
    if (typeof t !== "string" || !VALID_TYPES.includes(t as DefaultPrintItemType)) {
      throw new Error(`Invalid item type: ${String(t)}`)
    }
    if (seen.has(t)) {
      throw new Error(`Duplicate item type: ${t}`)
    }
    if (t === "readings") {
      const sm = (raw as { subMode?: unknown }).subMode
      if (typeof sm !== "string" || !VALID_SUBMODES.includes(sm as ReadingsSubMode)) {
        throw new Error("Readings & Findings requires a subMode (readings, clinical, or both)")
      }
      out.push({ type: "readings", subMode: sm as ReadingsSubMode })
    } else {
      out.push({ type: t as Exclude<DefaultPrintItemType, "readings"> })
    }
    seen.add(t)
  }
  return { items: out }
}

/**
 * Merge a defaultPrint config into the existing settings JSON string.
 * Preserves other top-level keys.
 */
export function mergeDefaultPrintIntoSettings(
  settingsRaw: string | null | undefined,
  config: DefaultPrintConfig,
): string {
  let base: Record<string, unknown> = {}
  if (settingsRaw) {
    try {
      const parsed = JSON.parse(settingsRaw)
      if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>
    } catch {
      // ignore — start fresh
    }
  }
  base.defaultPrint = config
  return JSON.stringify(base)
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/lib/default-print.ts`.

- [ ] **Step 3: Stage the file** (do not commit)

```bash
git add src/lib/default-print.ts
```

---

## Task 2: Server actions — load/save default print config

**Files:**
- Modify: `src/app/(hospital)/settings/actions.ts`

- [ ] **Step 1: Add the two new actions at the bottom of `settings/actions.ts`**

Append below the existing exports (after the last function, around line 772). Imports needed at the top of the file if not already present: ensure `import { ... } from "@/lib/default-print"` is added.

At the top of the file, add the import:

```ts
import {
  parseDefaultPrintConfig,
  validateDefaultPrintConfig,
  mergeDefaultPrintIntoSettings,
  type DefaultPrintConfig,
  EMPTY_DEFAULT_PRINT_CONFIG,
} from "@/lib/default-print"
```

At the bottom of the file, add:

```ts
// ─── Default Print Config ─────────────────────────────────────────────────────

export async function getDefaultPrintConfig(): Promise<DefaultPrintConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("HospitalProfile")
    .select("settings")
    .limit(1)
    .single()
  return parseDefaultPrintConfig(data?.settings)
}

export async function saveDefaultPrintConfig(input: DefaultPrintConfig) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const config = validateDefaultPrintConfig(input)
    const { data: existing } = await supabase
      .from("HospitalProfile")
      .select("id, settings")
      .limit(1)
      .single()
    const nextSettings = mergeDefaultPrintIntoSettings(existing?.settings, config)
    const now = new Date().toISOString()
    if (!existing) {
      await supabase.from("HospitalProfile").insert({
        name: "My Hospital",
        settings: nextSettings,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await supabase
        .from("HospitalProfile")
        .update({ settings: nextSettings, updatedAt: now })
        .eq("id", existing.id)
    }
    const { invalidateHospitalCache } = await import("@/lib/db")
    invalidateHospitalCache()
    revalidatePath("/settings")
    revalidatePath("/doctor")
    return { success: true as const }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save default print config"
    return { success: false as const, error: msg }
  }
}

// Re-export the empty constant so client components don't have to import from two places.
export { EMPTY_DEFAULT_PRINT_CONFIG } from "@/lib/default-print"
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Stage the file**

```bash
git add src/app/\(hospital\)/settings/actions.ts
```

---

## Task 3: Shared print utility

**Files:**
- Create: `src/lib/print-receipts.ts`

- [ ] **Step 1: Create the print utility**

```ts
// src/lib/print-receipts.ts

/**
 * Open a hidden window, write the given HTML inside an A4-styled boilerplate,
 * and trigger the browser print dialog. Closes the window after print.
 *
 * The HTML should consist of one or more elements with class `receipt-page`,
 * each of which becomes a separate printed page.
 */
export function printReceiptsHtml(opts: {
  title: string
  contentHtml: string
}): void {
  const { title, contentHtml } = opts
  const printWindow = window.open("", "_blank", "width=800,height=1000")
  if (!printWindow) {
    console.error("Failed to open print window (popup blocked?)")
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: A4 portrait; margin: 0; }
          .receipt-page {
            width: 210mm;
            min-height: 297mm;
            padding: 8mm;
            page-break-after: always;
          }
          .receipt-page:last-child { page-break-after: auto; }
          .no-break { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      ${contentHtml}
    </body>
    </html>
  `)
  printWindow.document.close()

  // Wait for tailwind CDN to load, then print.
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 1000)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Refactor PrintReceiptsModal.handlePrint to use the new utility**

In `src/app/(hospital)/doctor/components/PrintReceiptsModal.tsx`, add the import near the top:

```ts
import { printReceiptsHtml } from "@/lib/print-receipts"
```

Replace the entire `handlePrint` function (currently around lines 47–87) with:

```ts
function handlePrint() {
  if (!printRef.current) return
  printReceiptsHtml({
    title: `Print - ${patientName}`,
    contentHtml: printRef.current.innerHTML,
  })
}
```

- [ ] **Step 4: Verify the modal still prints correctly**

Run: `pnpm dev` (or `npm run dev`)
Manual check: open `/doctor`, click any row's printer icon, click "Print" in the modal — a print dialog should open with the active tab's contents. Same behavior as before.

- [ ] **Step 5: Stage the files**

```bash
git add src/lib/print-receipts.ts src/app/\(hospital\)/doctor/components/PrintReceiptsModal.tsx
```

---

## Task 4: PrintDefaultsTab — Configurations UI

**Files:**
- Create: `src/app/(hospital)/settings/components/PrintDefaultsTab.tsx`

- [ ] **Step 1: Create the tab component**

```tsx
// src/app/(hospital)/settings/components/PrintDefaultsTab.tsx
"use client"

import { useState, useEffect } from "react"
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  DEFAULT_PRINT_LABELS,
  READINGS_SUBMODE_LABELS,
  type DefaultPrintItem,
  type DefaultPrintItemType,
  type ReadingsSubMode,
} from "@/lib/default-print"
import { getDefaultPrintConfig, saveDefaultPrintConfig } from "../actions"

const ALL_TYPES: DefaultPrintItemType[] = ["cash", "prescription", "readings", "report"]

export function PrintDefaultsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<DefaultPrintItem[]>([])
  const [loaded, setLoaded] = useState<DefaultPrintItem[]>([])

  useEffect(() => {
    let cancelled = false
    getDefaultPrintConfig()
      .then(cfg => {
        if (cancelled) return
        setItems(cfg.items)
        setLoaded(cfg.items)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error("Failed to load print defaults")
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const usedTypes = new Set(items.map(i => i.type))
  const addableTypes = ALL_TYPES.filter(t => !usedTypes.has(t))
  const dirty = JSON.stringify(items) !== JSON.stringify(loaded)

  function addItem(type: DefaultPrintItemType) {
    if (usedTypes.has(type)) return
    const newItem: DefaultPrintItem = type === "readings"
      ? { type: "readings", subMode: "both" }
      : { type }
    setItems(prev => [...prev, newItem])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function moveItem(index: number, delta: -1 | 1) {
    setItems(prev => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  function updateSubMode(index: number, subMode: ReadingsSubMode) {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it
      if (it.type !== "readings") return it
      return { ...it, subMode }
    }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await saveDefaultPrintConfig({ items })
    setSaving(false)
    if (res.success) {
      setLoaded(items)
      toast.success("Print defaults saved")
    } else {
      toast.error(res.error || "Failed to save")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Quick Print — Default Receipts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which receipts are printed when the quick-print button is clicked on the
          Doctor page. The order below is the print order — each item produces one page.
        </p>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No default receipts configured. Add one below to enable the quick-print button
              on the Doctor page.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.type}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2"
            >
              <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">
                {DEFAULT_PRINT_LABELS[item.type]}
              </span>
              {item.type === "readings" && (
                <Select
                  value={item.subMode}
                  onValueChange={(v) => updateSubMode(index, v as ReadingsSubMode)}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["readings", "clinical", "both"] as const).map(sm => (
                      <SelectItem key={sm} value={sm}>{READINGS_SUBMODE_LABELS[sm]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                title="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                title="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => removeItem(index)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add receipt dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={addableTypes.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add receipt
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {addableTypes.map(t => (
            <DropdownMenuItem key={t} onClick={() => addItem(t)}>
              {DEFAULT_PRINT_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setItems(loaded)}
          disabled={!dirty || saving}
        >
          Reset
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save changes
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Stage the file**

```bash
git add src/app/\(hospital\)/settings/components/PrintDefaultsTab.tsx
```

---

## Task 5: Wire new tab into SettingsPage + honour `?tab=` query

**Files:**
- Modify: `src/app/(hospital)/settings/components/SettingsPage.tsx`

- [ ] **Step 1: Add the imports at the top of `SettingsPage.tsx`**

Add to the existing `next/navigation` import section (or create it). Near the top after the existing imports, add:

```ts
import { useRouter, useSearchParams } from "next/navigation"
import { PrintDefaultsTab } from "./PrintDefaultsTab"
```

- [ ] **Step 2: Replace the SettingsPage component body with the URL-aware version**

Find the existing `export default function SettingsPage(...)` (around line 223). Replace the function body:

```tsx
export default function SettingsPage({
  initialServices,
}: {
  initialServices: ServiceTemplate[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") || "services"
  const [tab, setTab] = useState(initialTab)

  function handleTabChange(next: string) {
    setTab(next)
    // Update URL without scroll/reload, so refresh keeps the tab.
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="Configurations"
        description="Configurations"
      />

      <div className="pt-5">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <div className="border-b border-border mb-6">
            <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 -mb-px">
              {(
                [
                  { value: "services",       label: "Service Templates" },
                  { value: "prescriptions",  label: "Prescription Templates" },
                  { value: "inpatient",      label: "Inpatient Templates" },
                  { value: "medicines",      label: "Medicine Templates" },
                  { value: "packages",       label: "IPD Packages" },
                  { value: "surgeries",      label: "Predefined Surgeries" },
                  { value: "hospital",       label: "Hospital Profile" },
                  { value: "print-defaults", label: "Print Defaults" },
                  { value: "users",          label: "Users" },
                ] as const
              ).map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-none px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="services"><ServicesTab initialServices={initialServices} /></TabsContent>
          <TabsContent value="prescriptions"><PrescriptionsTab /></TabsContent>
          <TabsContent value="inpatient"><InpatientTemplatesTab /></TabsContent>
          <TabsContent value="medicines"><MedicinesTab /></TabsContent>
          <TabsContent value="packages"><PackagesTab /></TabsContent>
          <TabsContent value="surgeries"><SurgeriesTab /></TabsContent>
          <TabsContent value="hospital"><HospitalTab /></TabsContent>
          <TabsContent value="print-defaults"><PrintDefaultsTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

Note: the file already has `useState` imported (it's used inside the existing tab components). If for some reason it's not in the top-level import on `SettingsPage`, ensure `import { useState } from "react"` is present at the top.

- [ ] **Step 3: Verify the page compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke test the tab**

Run: `pnpm dev`
Manual check:
1. Navigate to `/settings` → confirm a "Print Defaults" tab appears between Hospital Profile and Users.
2. Click the tab → see the empty state.
3. Click "Add receipt" → add Cash Receipt and Prescription. Reorder them with the arrow buttons. Add "Readings & Findings" → confirm the sub-mode select appears with default "Both".
4. Click Save → toast "Print defaults saved". Refresh the page → items persist and the same tab is active (URL contains `?tab=print-defaults`).
5. Add a fourth item → "Add receipt" button disables (all four types added).
6. Remove an item → button re-enables.

- [ ] **Step 5: Stage the file**

```bash
git add src/app/\(hospital\)/settings/components/SettingsPage.tsx
```

---

## Task 6: QuickPrintRenderer — render configured items to HTML

**Files:**
- Create: `src/app/(hospital)/doctor/components/QuickPrintRenderer.tsx`

This component takes the receipt data + items list and returns a hidden `<div>` containing each receipt component in order. The parent reads `innerHTML` from it and passes that to `printReceiptsHtml`.

We piggyback on the same data extraction code that `PrintReceiptsModal` already does — to avoid duplicating ~50 lines of JSON parsing, we extract that into a helper inside this file.

- [ ] **Step 1: Create the renderer component**

```tsx
// src/app/(hospital)/doctor/components/QuickPrintRenderer.tsx
"use client"

import { forwardRef } from "react"
import { CashReceipt } from "@/components/receipts/CashReceipt"
import { PrescriptionReceipt } from "@/components/receipts/PrescriptionReceipt"
import { ReadingsReceipt } from "@/components/receipts/ReadingsReceipt"
import { ClinicalFindingsReceipt } from "@/components/receipts/ClinicalFindingsReceipt"
import { ReadingsAndFindings } from "@/components/receipts/ReadingsAndFindings"
import type { getReceiptData } from "../actions"
import { formatDate, calculateAge } from "@/lib/utils"
import type { DefaultPrintItem } from "@/lib/default-print"

type ReceiptData = Awaited<ReturnType<typeof getReceiptData>>

interface Props {
  data: ReceiptData
  items: DefaultPrintItem[]
}

/**
 * Hidden renderer used by the quick-print button. The parent reads .innerHTML
 * from the forwarded ref and passes it to printReceiptsHtml. Visually hidden
 * (positioned off-screen) so the user never sees it.
 */
export const QuickPrintRenderer = forwardRef<HTMLDivElement, Props>(function QuickPrintRenderer(
  { data, items },
  ref,
) {
  const patient = data?.patient
  const hospital = data?.hospital
  const prescription = data?.prescription
  const eyeReading = data?.eyeReading

  if (!patient) return <div ref={ref} style={hiddenStyle} />

  const patientInfo = {
    patientName: `${patient.firstName} ${patient.lastName ?? ""}`.trim(),
    patientId: patient.patientId,
    date: formatDate(prescription?.prescriptionDate ?? patient.appointmentDate),
    mobile: patient.phone || "—",
    gender: patient.gender,
    age: String(patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"),
    address: patient.address || "—",
    referredBy: patient.referredBy || undefined,
    receiptNo: prescription?.prescriptionNumber || undefined,
    doctorName: prescription?.doctorName || patient.doctorName || "—",
    department: prescription?.department || patient.department || undefined,
  }

  const hospitalInfo = hospital ? {
    name: hospital.name,
    displayName: hospital.displayName,
    address: hospital.address,
    phone: hospital.phone,
    email: hospital.email,
    website: hospital.website,
    registrationNo: hospital.registrationNo,
    logoUrl: hospital.logoUrl,
  } : { name: "Hospital" }

  // ── Parse prescription fields ───────────────────────────────────────────────
  let medicines: { name: string; timing: string; days: string; note?: string }[] = []
  if (prescription?.medicines) {
    try { medicines = JSON.parse(prescription.medicines) } catch { /* empty */ }
  }
  let investigations: string[] = []
  if (prescription?.investigations) {
    try {
      const parsed = JSON.parse(prescription.investigations)
      investigations = parsed.map((i: { name: string }) => i.name)
    } catch { /* empty */ }
  }

  // ── Parse eye reading fields ────────────────────────────────────────────────
  let arReading: { rightEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string }; leftEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string } } | undefined
  let previousGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let presentGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let clinicalFindings: { rightEye: any; leftEye: any } | undefined

  if (eyeReading) {
    if (eyeReading.autoRefractometer) {
      try {
        const ar = JSON.parse(eyeReading.autoRefractometer)
        arReading = {
          rightEye: { sph: ar.re?.sph || "", cyl: ar.re?.cyl || "", axis: ar.re?.axis || "", va: ar.re?.va || "", vacPh: ar.re?.vacPh || "" },
          leftEye:  { sph: ar.le?.sph || "", cyl: ar.le?.cyl || "", axis: ar.le?.axis || "", va: ar.le?.va || "", vacPh: ar.le?.vacPh || "" },
        }
      } catch { /* empty */ }
    }
    if (eyeReading.previousPrescription) {
      try {
        const pg = JSON.parse(eyeReading.previousPrescription)
        previousGlass = {
          dist: {
            rightEye: { sph: pg.re?.sph || "", cyl: pg.re?.cyl || "", axis: pg.re?.axis || "", va: pg.re?.va || "" },
            leftEye:  { sph: pg.le?.sph || "", cyl: pg.le?.cyl || "", axis: pg.le?.axis || "", va: pg.le?.va || "" },
          },
          near: {
            rightEye: { sph: pg.reNear?.sph || "", cyl: pg.reNear?.cyl || "", axis: pg.reNear?.axis || "", va: pg.reNear?.va || "" },
            leftEye:  { sph: pg.leNear?.sph || "", cyl: pg.leNear?.cyl || "", axis: pg.leNear?.axis || "", va: pg.leNear?.va || "" },
          },
        }
      } catch { /* empty */ }
    }
    if (eyeReading.presentPrescription) {
      try {
        const pp = JSON.parse(eyeReading.presentPrescription)
        presentGlass = {
          dist: {
            rightEye: { sph: pp.re?.sph || "", cyl: pp.re?.cyl || "", axis: pp.re?.axis || "", va: pp.re?.va || "" },
            leftEye:  { sph: pp.le?.sph || "", cyl: pp.le?.cyl || "", axis: pp.le?.axis || "", va: pp.le?.va || "" },
          },
          near: {
            rightEye: { sph: pp.reNear?.sph || "", cyl: pp.reNear?.cyl || "", axis: pp.reNear?.axis || "", va: pp.reNear?.va || "" },
            leftEye:  { sph: pp.leNear?.sph || "", cyl: pp.leNear?.cyl || "", axis: pp.leNear?.axis || "", va: pp.leNear?.va || "" },
          },
        }
      } catch { /* empty */ }
    }
    if (eyeReading.clinicalFindings) {
      try {
        const cf = JSON.parse(eyeReading.clinicalFindings)
        const defaultEye = {
          lids: "Normal", conjunctiva: "Normal", cornea: "Clear", ac: "Normal",
          iris: "Normal", pupil: "Normal", lens: "Clear", tension: "—",
          fundus: "—", opticDisk: "Normal", macula: "—", vessels: "—",
          peripheralRetina: "—", retinoscopy: "—", retino1: "—", retino2: "—", retino3: "—", retino4: "—",
        }
        clinicalFindings = {
          rightEye: { ...defaultEye, ...cf.re },
          leftEye:  { ...defaultEye, ...cf.le },
        }
      } catch { /* empty */ }
    }
  }

  // ── Render each configured item in order ────────────────────────────────────
  return (
    <div ref={ref} style={hiddenStyle}>
      {items.map((item, idx) => {
        const key = `${item.type}-${idx}`
        switch (item.type) {
          case "cash":
            if (!prescription) return <EmptyPage key={key} message="No billing data available for this patient" />
            return (
              <CashReceipt
                key={key}
                hospital={hospitalInfo}
                patient={patientInfo}
                payment={{
                  mode: prescription.paymentMode || "Cash",
                  totalAmount: prescription.subtotal ?? prescription.total ?? 0,
                  discount: prescription.discount ?? 0,
                  amountReceived: prescription.amountPaid ?? 0,
                  amountDue: prescription.balanceDue ?? 0,
                  paidFor: prescription.items?.map((i: any) => i.description).join(", ") || undefined,
                }}
                items={prescription.items?.map((i: any) => ({ description: i.description, amount: i.amount })) || undefined}
              />
            )

          case "prescription":
            return (
              <PrescriptionReceipt
                key={key}
                hospital={hospitalInfo}
                patient={patientInfo}
                vitals={prescription ? {
                  temperature: prescription.temperature ? String(prescription.temperature) : undefined,
                  pulseRate: prescription.pulseRate ? String(prescription.pulseRate) : undefined,
                  spo2: prescription.spo2 ? String(prescription.spo2) : undefined,
                } : undefined}
                history={prescription ? {
                  presentComplaint: prescription.presentComplaint || undefined,
                  previousHistory: prescription.previousHistory || undefined,
                  diagnosis: prescription.diagnosis || undefined,
                } : undefined}
                medicines={medicines}
                investigations={investigations}
                advice={prescription?.additionalNotes || undefined}
                followUpDate={prescription?.followUpDate ? formatDate(prescription.followUpDate) : undefined}
                notes={prescription?.notes || undefined}
              />
            )

          case "readings": {
            if (!eyeReading) return <EmptyPage key={key} message="No eye reading data available for this patient" />
            if (item.subMode === "readings") {
              return (
                <ReadingsReceipt
                  key={key}
                  hospital={hospitalInfo}
                  patient={patientInfo}
                  arReading={arReading}
                  previousGlass={previousGlass}
                  presentGlass={presentGlass}
                />
              )
            }
            if (item.subMode === "clinical") {
              if (!clinicalFindings) return <EmptyPage key={key} message="No clinical findings available for this patient" />
              return (
                <ClinicalFindingsReceipt
                  key={key}
                  hospital={hospitalInfo}
                  rightEye={clinicalFindings.rightEye}
                  leftEye={clinicalFindings.leftEye}
                />
              )
            }
            // both
            return (
              <ReadingsAndFindings
                key={key}
                hospital={hospitalInfo}
                patient={patientInfo}
                arReading={arReading}
                previousGlass={previousGlass}
                presentGlass={presentGlass}
                clinicalFindings={clinicalFindings}
              />
            )
          }

          case "report":
            return (
              <div key={key}>
                <PrescriptionReceipt
                  hospital={hospitalInfo}
                  patient={patientInfo}
                  vitals={prescription ? {
                    temperature: prescription.temperature ? String(prescription.temperature) : undefined,
                    pulseRate: prescription.pulseRate ? String(prescription.pulseRate) : undefined,
                    spo2: prescription.spo2 ? String(prescription.spo2) : undefined,
                  } : undefined}
                  history={prescription ? {
                    presentComplaint: prescription.presentComplaint || undefined,
                    previousHistory: prescription.previousHistory || undefined,
                    diagnosis: prescription.diagnosis || undefined,
                  } : undefined}
                  medicines={medicines}
                  investigations={investigations}
                  advice={prescription?.additionalNotes || undefined}
                  followUpDate={prescription?.followUpDate ? formatDate(prescription.followUpDate) : undefined}
                  notes={prescription?.notes || undefined}
                />
                {eyeReading && (
                  <ReadingsAndFindings
                    hospital={hospitalInfo}
                    patient={patientInfo}
                    arReading={arReading}
                    previousGlass={previousGlass}
                    presentGlass={presentGlass}
                    clinicalFindings={clinicalFindings}
                  />
                )}
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
})

const hiddenStyle: React.CSSProperties = {
  position: "absolute",
  left: "-99999px",
  top: 0,
  width: 0,
  height: 0,
  overflow: "hidden",
}

function EmptyPage({ message }: { message: string }) {
  return (
    <div className="receipt-page">
      <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
        {message}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Stage the file**

```bash
git add src/app/\(hospital\)/doctor/components/QuickPrintRenderer.tsx
```

---

## Task 7: Doctor page server component — fetch default print config

**Files:**
- Modify: `src/app/(hospital)/doctor/page.tsx`

- [ ] **Step 1: Inspect the current file**

```bash
cat src/app/\(hospital\)/doctor/page.tsx
```

Note the existing data-fetching pattern (likely `Promise.all` of `getDoctorQueue` and `getDoctorReferenceData`). The change below assumes that pattern — adapt locally if the file uses a different shape.

- [ ] **Step 2: Add `getDefaultPrintConfig` to the parallel fetch**

Modify the imports at the top to include:

```ts
import { getDefaultPrintConfig } from "../settings/actions"
```

Modify the data-fetching block (the `Promise.all` that loads queue + reference data) to also fetch the default print config, and pass it to `DoctorPage` as a new prop:

```ts
const [queue, referenceData, defaultPrintConfig] = await Promise.all([
  getDoctorQueue(date),
  getDoctorReferenceData(),
  getDefaultPrintConfig(),
])

return (
  <DoctorPage
    initialQueue={queue}
    initialDate={date}
    initialReferenceData={referenceData}
    initialDefaultPrint={defaultPrintConfig}
  />
)
```

The exact prop and function names depend on the current file — preserve existing names, just add `initialDefaultPrint`.

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: one new error in `DoctorPage.tsx` because the prop isn't declared yet. That's expected; Task 8 fixes it.

- [ ] **Step 4: Stage the file**

```bash
git add src/app/\(hospital\)/doctor/page.tsx
```

---

## Task 8: Doctor page client — gear icon, quick-print button, click handler

**Files:**
- Modify: `src/app/(hospital)/doctor/components/DoctorPage.tsx`

- [ ] **Step 1: Update imports at the top of `DoctorPage.tsx`**

Replace the existing `lucide-react` import to add `Settings` and `Zap` icons (Zap is the visual differentiator for the quick-print button — alternatively use `PrinterCheck` if you prefer):

```ts
import { Loader2, Printer, Settings2, Settings, RefreshCw, Zap } from "lucide-react"
```

Add the router and new imports just below the existing imports:

```ts
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { printReceiptsHtml } from "@/lib/print-receipts"
import { QuickPrintRenderer } from "./QuickPrintRenderer"
import { getReceiptData } from "../actions"
import type { DefaultPrintConfig } from "@/lib/default-print"
```

(Note: `getReceiptData` is already imported by `PrintReceiptsModal` — confirm it's exported from `../actions`; if not, expose it.)

- [ ] **Step 2: Add the new prop to the component signature**

Find the `DoctorPage` function signature (around line 46). Update it to:

```tsx
export function DoctorPage({
  initialQueue,
  initialDate,
  initialReferenceData,
  initialDefaultPrint,
}: {
  initialQueue: QueueItem[]
  initialDate: string
  initialReferenceData: PrescriptionReferenceData
  initialDefaultPrint: DefaultPrintConfig
}) {
```

- [ ] **Step 3: Add state for the default-print config, router, and quick-print transient data**

Inside `DoctorPage` (after the existing `useState` calls, around line 65), add:

```ts
const router = useRouter()
const [defaultPrint] = useState<DefaultPrintConfig>(initialDefaultPrint)
const [quickPrintData, setQuickPrintData] = useState<{
  data: Awaited<ReturnType<typeof getReceiptData>>
  patientName: string
} | null>(null)
const [quickPrinting, setQuickPrinting] = useState<string | null>(null)  // patientId currently printing
const quickPrintRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 4: Add the quick-print handler**

Add this function inside `DoctorPage` (before the `return`), right after `handleSaveAll`:

```ts
async function handleQuickPrint(patient: QueueItem) {
  if (defaultPrint.items.length === 0) return
  const patientName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
  setQuickPrinting(patient.patientId)
  try {
    const data = await getReceiptData(patient.patientId)
    setQuickPrintData({ data, patientName })
    // Wait one tick for the hidden renderer to mount, then snapshot HTML and print.
    setTimeout(() => {
      const html = quickPrintRef.current?.innerHTML ?? ""
      if (!html) {
        toast.error("Nothing to print")
        return
      }
      printReceiptsHtml({ title: `Print - ${patientName}`, contentHtml: html })
      // Tear down after the print window has had time to read the HTML.
      setTimeout(() => setQuickPrintData(null), 1500)
    }, 50)
  } catch (err) {
    console.error("Quick print error:", err)
    toast.error("Failed to load receipt data")
  } finally {
    setQuickPrinting(null)
  }
}
```

- [ ] **Step 5: Add the gear icon in the sub-header**

In the sticky header `<div>` block (currently lines 175–191), beside the existing refresh button, add the settings button. Replace the inner content of that `<div>` (the two children — left-side title block and right-side `StatBadge`) so the left block also includes the gear:

Find this section:

```tsx
<div className="flex items-center gap-2.5 min-w-0">
  <div className="min-w-0">
    <h1 className="text-lg font-semibold ...">Doctor Console</h1>
    <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Patient queue & consultation</p>
  </div>
  <button
    onClick={loadQueue}
    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
    title="Refresh"
  >
    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
  </button>
</div>
```

Add the settings button immediately after the refresh button (still inside the same flex container):

```tsx
<button
  onClick={() => router.push("/settings?tab=print-defaults")}
  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
  title="Print settings"
>
  <Settings className="h-3.5 w-3.5" />
</button>
```

- [ ] **Step 6: Add the quick-print button in the per-row print cell**

Find the `{isColumnVisible("print") && (...)}` block in the table body (around line 582). Replace its `<TableCell>` body with a two-button cluster — quick-print on the left, existing modal-print on the right:

```tsx
{isColumnVisible("print") && (
  <TableCell>
    <div className="flex items-center gap-0.5">
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={defaultPrint.items.length === 0 || quickPrinting === patient.patientId}
        className={
          defaultPrint.items.length === 0
            ? "text-muted-foreground/40"
            : "text-primary opacity-70 group-hover:opacity-100 transition-opacity"
        }
        title={
          defaultPrint.items.length === 0
            ? "Configure defaults in Settings → Print Defaults"
            : "Quick print (default receipts)"
        }
        onClick={e => {
          e.stopPropagation()
          handleQuickPrint(patient)
        }}
      >
        {quickPrinting === patient.patientId
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Zap className="h-4 w-4" />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity"
        onClick={e => {
          e.stopPropagation()
          setPrintPatient({ patientId: patient.patientId, name: fullName })
        }}
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  </TableCell>
)}
```

- [ ] **Step 7: Mount the hidden QuickPrintRenderer when data is loaded**

Just before the closing `</>` of the component (right after the `PrintReceiptsModal` block at line 612-620), add:

```tsx
{quickPrintData && (
  <QuickPrintRenderer
    ref={quickPrintRef}
    data={quickPrintData.data}
    items={defaultPrint.items}
  />
)}
```

- [ ] **Step 8: Verify the page compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Confirm `getReceiptData` is exported**

Run:

```bash
grep -n "export async function getReceiptData\|export { .*getReceiptData" src/app/\(hospital\)/doctor/actions.ts
```

Expected: a matching line. If not (it's used by `PrintReceiptsModal` so it should already be exported), expose it by adding `export` to its declaration.

- [ ] **Step 10: Stage the file**

```bash
git add src/app/\(hospital\)/doctor/components/DoctorPage.tsx
```

---

## Task 9: End-to-end manual verification

**Files:** none — testing only.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev` (or `npm run dev`)

- [ ] **Step 2: Configure a default print set**

1. Navigate to `/settings` → confirm the "Print Defaults" tab is between Hospital Profile and Users.
2. On the Print Defaults tab, add three items in this order: **Cash Receipt**, **Prescription**, **Readings & Findings (Both)**.
3. Click **Save changes**. Toast confirms.

- [ ] **Step 3: Quick-print from the Doctor page**

1. Navigate to `/doctor`. Confirm a gear icon appears in the sub-header next to the refresh icon. Tooltip: "Print settings".
2. Confirm each row in the queue now has **two** buttons in the print column — a quick-print (Zap) button and the existing printer button. The quick-print button should be enabled and primary-coloured.
3. Click the quick-print button on a row that has a prescription saved.
4. A browser print dialog opens. The preview shows three pages: Cash Receipt, Prescription, Readings & Findings (Both) — in that order.
5. Cancel the dialog.

- [ ] **Step 4: Gear icon navigation**

1. Click the gear icon in the sub-header.
2. Confirm you land on `/settings?tab=print-defaults` with the Print Defaults tab active.

- [ ] **Step 5: Empty config disables the button**

1. Back in Print Defaults, remove all items and save.
2. Navigate to `/doctor`.
3. Confirm the quick-print button on every row is disabled and shows the tooltip "Configure defaults in Settings → Print Defaults".

- [ ] **Step 6: Reorder works**

1. Re-add Cash + Prescription. Click the down arrow on Cash so order becomes Prescription, Cash. Save.
2. Quick-print from a row. Preview should now show Prescription first, then Cash.

- [ ] **Step 7: Readings sub-mode works**

1. Add Readings & Findings only. Change sub-mode to "Clinical Findings only". Save.
2. Quick-print on a row that has clinical findings recorded.
3. Confirm only the clinical findings page is in the print preview.
4. Repeat with sub-mode "Readings only" → confirm only the readings page appears.

- [ ] **Step 8: Existing modal print still works**

1. Click the existing (outline) printer icon on a row.
2. The `PrintReceiptsModal` opens. Click "Print" — confirm a print dialog opens with the active tab's content (no regression).

- [ ] **Step 9: Stage any pending files**

```bash
git status
git add -p  # review and stage anything missed
```

Leave committing to the user.

---

## Self-review checklist (already executed by the author of this plan)

- **Spec coverage:**
  - Data model (`HospitalProfile.settings.defaultPrint`, ordered items, sub-mode for readings, unique types) → Task 1 (types) + Task 2 (persistence + validation).
  - Configurations tab "Print Defaults" with ordered list, add/remove/reorder, sub-mode select, save → Task 4 + Task 5.
  - Doctor page gear icon → Task 8 step 5.
  - Doctor page quick-print button + disabled state → Task 8 step 6.
  - Quick-print mechanism (multi-page print via shared utility) → Task 3 + Task 6 + Task 8 steps 4 & 7.
  - Refactor existing modal print to use the shared utility → Task 3 step 3.
  - Empty / missing-data edge cases → Task 6 (`EmptyPage` component).
  - Unknown-type forward-compat → Task 1 (silently skipped).
  - `?tab=` query-driven default tab → Task 5 step 2.

- **Placeholder scan:** no TBDs, no "implement later", no "similar to Task N" without code, every code step shows the actual code.

- **Type consistency:** `DefaultPrintConfig`, `DefaultPrintItem`, `ReadingsSubMode`, `DEFAULT_PRINT_LABELS`, `EMPTY_DEFAULT_PRINT_CONFIG` are all introduced in Task 1 and referenced consistently in Tasks 2, 4, 5, 6, 8. Function name `printReceiptsHtml` consistent across Task 3 (def), Task 8 (call), Task 3 step 3 (refactor caller).
