# Default Print Configuration — Design Spec

**Date:** 2026-05-20
**Scope:** Doctor page quick-print button + Configurations tab for default receipt set

## Problem

On the Doctor page queue, each row has a printer icon. Clicking it opens `PrintReceiptsModal` with four tabs (Cash Receipt, Prescription, Readings & Findings, Report) — the user must pick one and click Print. For repetitive workflows (e.g., "every patient needs Cash + Prescription + Readings printed"), this is two extra clicks per patient.

## Goal

Add a one-click "quick print" button that prints a pre-configured, ordered set of receipts directly — bypassing the modal. The set is configured once by an admin in the Configurations page.

## Non-goals

- No per-user configuration (hospital-wide only).
- No new printable receipt types — only the four that already exist.
- No silent printing without the browser's native print dialog — we still rely on `window.print()`.
- No change to how individual receipts are rendered.

## User stories

1. As a doctor/receptionist, I click the quick-print button on a queue row and the system print dialog opens with my configured receipts already laid out in pages, in the order I configured.
2. As an admin, I open Configurations → Print Defaults, add receipts to the list, reorder them, and pick a sub-mode for "Readings & Findings". Save persists for the whole hospital.
3. As an admin, on the Doctor page I click a gear icon in the sub-header and land directly on the Print Defaults tab.
4. If no defaults are configured, the quick-print button is disabled with a tooltip pointing me to Settings.

## Data model

No schema migration. Use the existing `HospitalProfile.settings` JSON text field with a new top-level key:

```json
{
  "defaultPrint": {
    "items": [
      { "type": "cash" },
      { "type": "prescription" },
      { "type": "readings", "subMode": "both" }
    ]
  }
}
```

### Type definition

```ts
type DefaultPrintItem =
  | { type: "cash" }
  | { type: "prescription" }
  | { type: "readings"; subMode: "readings" | "clinical" | "both" }
  | { type: "report" }

type DefaultPrintConfig = {
  items: DefaultPrintItem[]
}
```

### Constraints

- `items` order is the print order (page 1, page 2, page 3…).
- Each `type` may appear at most once in `items`. Enforced in the UI (the "Add receipt" picker hides types already present) and in the save action (server-side validation, rejects duplicates).
- `subMode` is required when `type === "readings"`; absent for other types.
- Missing `defaultPrint` key or empty `items` array = "no defaults configured" (button disabled).

## Architecture

### New shared utility — `src/lib/print-receipts.ts`

Extracts the existing `handlePrint` logic from `PrintReceiptsModal` so both the modal's Print button and the new quick-print button use the same code path.

```ts
export async function printReceipts(opts: {
  patientName: string
  contentHtml: string  // pre-rendered receipt pages in order
}): Promise<void>
```

The function opens a hidden `window.open(...)`, writes the same boilerplate currently in `PrintReceiptsModal.handlePrint` (tailwind CDN, `@page A4` styles, `.receipt-page` page-break rules), then calls `printWindow.print()` and closes.

### Server actions — `src/app/(hospital)/settings/actions.ts`

Two new actions:

```ts
"use server"
export async function getDefaultPrintConfig(): Promise<DefaultPrintConfig>
export async function saveDefaultPrintConfig(config: DefaultPrintConfig): Promise<void>
```

Implementation:
- `getDefaultPrintConfig` — load `HospitalProfile.settings`, parse as JSON, return `defaultPrint` key or `{ items: [] }` if absent.
- `saveDefaultPrintConfig` — load current `settings`, set the `defaultPrint` key, validate (no duplicate types, required `subMode` for readings, only valid types), `prisma.hospitalProfile.update` with the merged JSON.

Validation errors throw; the client surfaces them as a toast.

### Doctor page changes — `src/app/(hospital)/doctor/page.tsx`

The page component (server) currently fetches the queue and reference data. Add a third parallel fetch for `getDefaultPrintConfig()` and pass it to `DoctorPage` as `initialDefaultPrint: DefaultPrintConfig`.

### Doctor page UI — `src/app/(hospital)/doctor/components/DoctorPage.tsx`

Two additions:

**1. Sub-header gear icon.** Inside the sticky header (the `<div>` starting at line 175 of `DoctorPage.tsx`), add a button beside the existing refresh icon button:

```tsx
<button onClick={() => router.push("/settings?tab=print-defaults")} title="Print settings">
  <Settings className="h-3.5 w-3.5" />
</button>
```

Only rendered when `!selectedRow` (matches existing pattern — header is replaced by `BreadcrumbHeader` when a patient is open).

**2. Quick-print button per row.** In the print column cell (around line 582), render a second button **immediately to the left** of the existing printer icon:

```tsx
<TableCell>
  <div className="flex items-center gap-0.5">
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={defaultPrintItems.length === 0}
      title={defaultPrintItems.length === 0
        ? "Configure defaults in Settings → Print Defaults"
        : "Quick print (default receipts)"}
      onClick={e => { e.stopPropagation(); handleQuickPrint(patient) }}
    >
      <Printer className="h-4 w-4 fill-current" />   {/* filled to distinguish */}
    </Button>
    <Button ...existing print modal button.../>
  </div>
</TableCell>
```

**Quick-print handler:**

```ts
async function handleQuickPrint(patient: QueueItem) {
  const data = await getReceiptData(patient.patientId)
  const html = renderReceiptsToHtml(data, defaultPrintItems)
  await printReceipts({ patientName: fullName, contentHtml: html })
}
```

`renderReceiptsToHtml` uses React's `renderToString` (or a hidden React tree + `innerHTML` snapshot, matching how `PrintReceiptsModal` does it today) to produce the HTML for the configured items in order.

### Settings page changes — `src/app/(hospital)/settings/components/SettingsPage.tsx`

**1. New tab.** Add to the tab list array (currently lines ~239–249), placed between `hospital` and `users`:

```ts
{ value: "print-defaults", label: "Print Defaults" },
```

And a corresponding `<TabsContent value="print-defaults"><PrintDefaultsTab /></TabsContent>`.

**2. Honour `?tab=` query.** Change `<Tabs defaultValue="services">` to read the initial tab from the URL search params (`useSearchParams` — requires turning the page client-side at the tab boundary, or using a small client wrapper). On tab change, optionally update the URL with `router.replace`.

**3. New component — `PrintDefaultsTab`** (in the same file or as a new sibling file):

- Loads config via `getDefaultPrintConfig()` in a `useEffect`.
- Renders an ordered list of `<PrintItemRow>` components:
  - Drag handle (left) for reordering.
  - Label (Cash Receipt / Prescription / Readings & Findings / Report).
  - Sub-mode `<Select>` only for "Readings & Findings" with three options.
  - Trash icon to remove.
- Below the list: an "Add receipt" dropdown showing only the types not yet present. Disabled when all four are added.
- "Save" button (bottom) that calls `saveDefaultPrintConfig`. Disabled until the local state diverges from the loaded state.
- Empty state copy: "No default receipts configured. Add one above to enable the quick-print button on the Doctor page."

For the drag-and-drop reorder, use the same library already in the codebase if any (check `package.json` during implementation — `@dnd-kit/*` if present, otherwise fall back to simple up/down arrow buttons to keep dependencies stable).

### Refactor — `PrintReceiptsModal.handlePrint`

Replace the body of `handlePrint` with a call to `printReceipts(...)` using the existing rendered DOM as the source HTML. No behavioral change.

## Data flow — quick print

```
[Doctor page load]
  ├─ getDoctorQueue(date)
  ├─ getDoctorReferenceData()
  └─ getDefaultPrintConfig()          ← new
                                         │
                                         ▼
                              DoctorPage(initialDefaultPrint)
                                         │
                              (user clicks quick-print)
                                         │
                                         ▼
                              handleQuickPrint(patient)
                                ├─ getReceiptData(patientId)
                                ├─ renderReceiptsToHtml(data, items)
                                └─ printReceipts({ html })
                                         │
                                         ▼
                              window.open → write HTML → print()
```

## Edge cases

- **Patient missing data for a configured receipt** (e.g., no prescription yet, but config includes "Prescription"): render an empty placeholder page reusing the existing `PrintReceiptsModal` empty-state messages ("No billing data available", "No eye reading data"). Doesn't block the print — other configured pages still come out.
- **Config drift** (e.g., a future receipt type is added but old configs reference an unknown type): skip unknown types silently. Logged to console for debugging.
- **Two admins editing simultaneously**: last save wins. The settings JSON is small and human-friction is low; no optimistic locking needed.
- **Patient detail open** (a patient is selected and the detail view is showing): the gear icon and quick-print buttons aren't visible because the queue table isn't rendered in that mode. No change needed.

## Testing

- Unit: validation in `saveDefaultPrintConfig` — reject duplicates, require subMode for readings, reject unknown types.
- Manual: configure a 3-item default, click quick-print on a queue row, confirm 3 pages render in the correct order; reorder and re-verify; remove all items, confirm button disables with tooltip; click gear icon, confirm it lands on the Print Defaults tab.

## Out of scope (future work)

- Per-user default print config.
- Configuring which fields appear within each receipt (e.g., toggling vitals section in the Prescription).
- Saved "print presets" (multiple named configs the user can switch between).
- Printing across multiple patients in batch.
