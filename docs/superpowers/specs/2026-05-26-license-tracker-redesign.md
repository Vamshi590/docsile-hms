# License Tracker Redesign — Design Spec

**Date:** 2026-05-26
**Status:** Approved

## Overview

Redesign the License Tracker page with improved card UI (Option B — horizontal row cards with coloured left border by status), add Supabase Storage–backed file upload per license, and provide View + Download actions for attached documents.

---

## 1. Data & Storage

### Storage backend
- **Supabase Storage** — already configured in the project (same credentials)
- Bucket name: `license-documents` (public bucket)
- File path pattern: `licenses/{licenseId}/{timestamp}-{originalFilename}`
- Paths are unguessable (CUID licenseId + timestamp prefix)

### Database
- `documentUrl` field already exists on the `License` model — no Prisma migration needed
- After upload: store the public URL in `documentUrl`
- After removal: set `documentUrl` to `null`

### New utility
**File:** `src/lib/storage.ts`

```typescript
export const STORAGE_BUCKET = "license-documents"

export function getLicenseFilePath(licenseId: string, filename: string): string {
  const timestamp = Date.now()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `licenses/${licenseId}/${timestamp}-${safeName}`
}
```

---

## 2. New Server Actions

Added to `src/app/(hospital)/license-tracker/actions.ts`:

### `saveLicenseDocumentUrl(licenseId: string, url: string)`
- Requires auth
- Updates `documentUrl` on the License row
- Calls `revalidatePath("/license-tracker")`
- Returns `{ success: true }` or `{ success: false, error: string }`

### `removeLicenseDocument(licenseId: string, filePath: string)`
- Requires auth
- `filePath` is the storage path (e.g. `licenses/{licenseId}/{timestamp}-{name}`) stored separately from the public URL — the client passes it alongside the licenseId
- Deletes the file from Supabase Storage: `supabase.storage.from(STORAGE_BUCKET).remove([filePath])`
- Clears `documentUrl` (sets to `null`) on the License row
- Calls `revalidatePath("/license-tracker")`
- Returns `{ success: true }` or `{ success: false, error: string }`

> **Implementation note:** To avoid extracting the path from the URL, the component keeps the `filePath` in local state alongside `documentUrl` — set when the upload succeeds (returned by `supabase.storage.upload()`) and used when the remove button is clicked. On page reload, if `documentUrl` is present but `filePath` is not in state, the path can be derived: `new URL(documentUrl).pathname` gives `/storage/v1/object/public/license-documents/licenses/...` — strip the bucket prefix to get the path.

---

## 3. Upload Flow (Client-Side)

Upload happens entirely in the browser — no server roundtrip for file bytes:

1. User clicks "Upload" button on a license card
2. Hidden `<input type="file" accept=".pdf,.jpg,.jpeg,.png">` is triggered via `ref.click()`
3. User selects file → `onChange` fires
4. Validate: max 10 MB, accepted types only
5. Upload via `supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false })`
6. On success: call `saveLicenseDocumentUrl(licenseId, publicUrl)` server action
7. Update local state to reflect new `documentUrl`
8. Show spinner during upload, toast on success/error

The Supabase browser client is imported from `@/lib/supabase/client`.

---

## 4. UI — LicenseTrackerPage Redesign

**File:** `src/app/(hospital)/license-tracker/components/LicenseTrackerPage.tsx` (full rewrite)

### Page header
- Title "License Tracker" + "Add License" button (top right)

### Stats row (4 summary cards)
- Total Licenses
- Active (green)
- Expiring Soon (amber) — within `reminderDays` of expiry
- Expired (red)

### Search + filter bar
- Text search (name, license number, issuing body) — preserved from current
- Status filter buttons: All / Active / Expiring / Expired — preserved from current
- Category filter dropdown — preserved from current

### License cards (Option B style)

Each card is a horizontal `rounded-xl border bg-white shadow-sm` with a `4px` left border coloured by status:
- Active → `border-l-green-500`
- Expiring Soon → `border-l-amber-500`
- Expired → `border-l-red-500`

**Card layout:**

```
[4px border] | [Left section]          | [Middle section]       | [Right section]
             |  Name (bold)            |  Issued  Expires  Remind|  [Status badge]
             |  Number · Body (muted)  |  date    date     days  |  [Doc actions]
             |                         |                          |  [Edit] [Del]
```

**Left section:**
- Category label (uppercase, muted, small)
- License name (bold, `text-sm`)
- License number + issuing body (muted, `text-xs`)

**Middle section:**
- Three info columns: Issued date, Expiry date (coloured by urgency), Remind days
- Days-remaining badge: "X days left" (green/amber) or "X days ago" (red)

**Right section:**
- Status badge (Active / Expiring Soon / Expired)
- Document area:
  - **No file:** "Upload" button (blue) — triggers hidden file input, shows spinner during upload
  - **File attached:** "View" button (opens `documentUrl` in new tab) + "Download" button (anchor with `download` attribute) + "×" remove button (with confirmation)
- Edit icon button + Delete icon button (top-right corner)

### File input
Each card has a hidden `<input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden">` with its own `useRef`. Max file size: 10 MB (validated client-side before upload).

---

## 5. LicenseForm (no changes)

The existing `LicenseForm.tsx` dialog handles add/edit metadata only. No file upload field is added here — upload is inline on the card (Section 3 above).

---

## 6. Out of Scope

- Replace/swap an existing document (user must remove first, then upload)
- Private/signed URLs (public bucket with unguessable paths is sufficient)
- File preview inline in the page (View opens in new tab)
- Bulk upload
- Version history of documents
