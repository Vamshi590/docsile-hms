# Responsive Design — docsile-hms

**Date:** 2026-05-24  
**Status:** Approved  
**Approach:** Layer-by-layer (infrastructure → grids → tables → forms)

---

## Goal

Make the hospital management system fully usable on phones and tablets. The app currently runs desktop-only with ~98 responsive class uses across 166 TSX files. The foundation (Tailwind v4, shadcn/ui, Radix UI) is solid; the gap is in applying responsive patterns consistently.

---

## Breakpoints

Standard Tailwind v4 defaults — no changes needed:

| Prefix | Min-width | Target |
|--------|-----------|--------|
| (none) | 0px | Phone |
| `sm:` | 640px | Large phone |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Desktop |

---

## Layer 1 — Navigation

**Problem:** Sidebar uses `clientX <= 6` edge-detection (broken on touch). Top tab bar has no mobile fallback.

**Solution:** Hamburger + slide-in drawer on mobile using the existing shadcn `Sheet` component.

### Phone (< `md` / 768px)
- Sidebar and top-tab-bar both hidden
- Top bar shows: `☰` hamburger left · hospital name center · user avatar right
- Tapping `☰` opens a `Sheet` drawer from the left
- Drawer lists all nav items; active item highlighted
- Tapping a nav item navigates and closes the drawer
- Dark overlay behind drawer; tapping overlay closes it

### Tablet (`md` – `lg`)
- `navStyle = "top"`: top tab bar visible, horizontally scrollable
- `navStyle = "side"`: sidebar visible in icon-only collapsed state, expands on hover (current desktop behavior)

### Desktop (≥ `lg`)
- No change from current behavior

### Files
- `src/components/layout/Sidebar.tsx` — replace edge-detection with `useState` toggle wired to hamburger button
- `src/components/layout/TopNavBar.tsx` — add hamburger button visible only on mobile; hide tab bar on mobile
- `src/app/(hospital)/layout.tsx` — pass open/close state between TopNavBar and Sidebar

---

## Layer 2 — Layout Shell

**Problem:** `(hospital)/layout.tsx` has fixed `px-4 pt-6 pb-8` with no breakpoints.

**Solution:** Responsive padding and content area adjustments.

### Content padding
- Phone: `px-3 py-4`
- Tablet: `md:px-4 md:py-6`
- Desktop: `lg:px-6 lg:pt-6 lg:pb-8` (current values)

### Content width
- Full-width at all sizes — no `max-width` cap

### Layout grid
- Phone: sidebar/drawer hidden, content fills 100% width
- Tablet/Desktop: sidebar or top-nav present, content shifts accordingly (already handled by existing layout structure)

### Files
- `src/app/(hospital)/layout.tsx`

---

## Layer 3 — Data Patterns

### Dashboard grids & stat cards
- Replace hardcoded `grid-cols-3` with `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Stat cards get `w-full` to prevent overflow on mobile
- Files: `src/app/(hospital)/dashboard/DashboardClient.tsx` and any other grid layouts in module pages

### Table → Card Stack
Every data table switches to a card list on mobile:

- **Phone (< `md`):** Table hidden (`hidden md:table`), card list shown (`md:hidden`)
- **Tablet/Desktop (≥ `md`):** Table shown, card list hidden

**Card structure per row:**
```
┌─────────────────────────────────┐
│ Primary field (bold)    [Badge] │
│ Secondary field · Secondary     │
│ Tertiary field                  │
│                    [Action btn] │
└─────────────────────────────────┘
```

Applies to: patients, inpatients, labs, billing, insurance, dues/followups, optical, analytics tables.

**Implementation:** Each page gets a mobile card list alongside its existing `<DataTable>`. The DataTable component itself is not modified.

### Charts (Recharts)
- Replace fixed pixel `width` props with `width="100%"` + `aspect` ratio
- Files: `src/app/(hospital)/analytics/components/AnalyticsPage.tsx` and any other chart components

---

## Layer 4 — Forms

### Multi-step wizards
Applies to: patient registration, inpatient admission, prescription, insurance, optical billing.

**Phone (< `md`):**
- All field grids collapse to `grid-cols-1`
- Labels always above inputs
- Step indicator: compact progress bar + "Step N of M — Title" text
- Next/Back buttons: full-width, stacked vertically

**Tablet (≥ `md`):**
- 2-column grid for related field pairs
- Step indicator shows step labels horizontally
- Next/Back buttons: side-by-side

**Desktop (≥ `lg`):**
- Current layout unchanged

### Input sizing
- All `<input>`, `<select>`, `<textarea>`: add `text-base` on mobile to prevent iOS auto-zoom (iOS zooms in when font-size < 16px)
- All interactive elements: minimum `h-10` (40px) touch target

### Dialogs used as forms
- On phone: dialogs become full-screen (`max-w-full h-full rounded-none sm:max-w-lg sm:h-auto sm:rounded-lg`)
- Consistent application across all edit/add dialogs in every module

### Files
- `src/app/(hospital)/patients/components/PatientRegistrationStepper.tsx`
- `src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx` + step components
- `src/app/(hospital)/doctor/components/PrescriptionForm.tsx`
- `src/app/(hospital)/insurance/components/*.tsx`
- `src/app/(hospital)/optical/components/*.tsx`
- `src/app/(hospital)/labs/components/LabForm.tsx`

---

## What Is Not Changing

- Viewport meta tag — already correct in `src/app/layout.tsx`
- Tailwind breakpoints — using defaults, no `tailwind.config` changes needed
- shadcn/ui primitive components (`button.tsx`, `dialog.tsx`, `sheet.tsx`) — already responsive
- Desktop experience — all changes are additive mobile/tablet breakpoints; desktop layout untouched
- The DataTable component itself — card lists are added alongside, not replacing

---

## Success Criteria

- App is fully navigable on a 375px-wide phone (iPhone SE)
- All data tables readable on mobile without horizontal scrolling of the page
- All forms completable on mobile without zoom or horizontal overflow
- Desktop experience identical to current
