# Top Navbar — Design Spec

**Date:** 2026-05-23  
**Status:** Approved

## Overview

Add a scrollable tab-strip top navbar as an alternative to the existing sidebar. A per-hospital setting (stored in `HospitalProfile.settings`) controls which nav is shown. The admin configures it once in Settings → Hospital Profile; all users see that nav style.

---

## 1. Data & Storage

### Storage
`navStyle` is added to the existing `HospitalProfile.settings` JSON field — no Prisma schema migration required.

```json
{
  "defaultPrint": { "items": [...] },
  "navStyle": "top"
}
```

- `"side"` — sidebar (default, current behaviour)
- `"top"` — scrollable top tab strip

### Actions
- Extend the existing `getHospitalProfile()` action (in `settings/actions.ts`) to read and return `navStyle` from the settings JSON.
- Add a new `updateNavStyle(style: "side" | "top")` server action that writes `navStyle` into the settings JSON using the same merge pattern as `saveDefaultPrintConfig`.
- The hospital layout (`layout.tsx`) reads `navStyle` by calling `getHospitalProfile()` directly (same function, no new helper needed).

---

## 2. Shared Nav Items

Extract the `NAV_SECTIONS` constant and `NavItem` type out of `Sidebar.tsx` into a new shared file:

```
src/components/layout/nav-items.ts
```

Both `Sidebar.tsx` (updated to import from here) and the new `TopNavBar.tsx` import from this file. This is the single source of truth for module links, icons, and module codes.

---

## 3. TopNavBar Component

**File:** `src/components/layout/TopNavBar.tsx`  
**Type:** Client component (`"use client"`)

### Props
```typescript
interface TopNavBarProps {
  user: { fullName: string; role: string }
  hospitalName: string
  enabledModules: string[]
}
```

### Layout (left → right)
1. **Logo area** — hospital name text (same as sidebar header), fixed width, not scrollable
2. **Tab strip** — horizontally scrollable, hidden scrollbar, contains filtered nav items
3. **User dropdown** — fixed right side

### Tab Strip
- Each tab: icon (16px) + label, `px-4 py-3` padding
- Active tab: bottom border `2px solid` using `hsl(var(--primary))` + subtle `bg-primary/5` background
- Inactive tab: `text-muted-foreground`, `hover:text-foreground hover:bg-muted/50`
- Module gating: same logic as Sidebar — filter by `enabledModules` and `adminOnly` (role check)
- Overflow: `overflow-x-auto` with `scrollbar-none` class, mouse drag scrollable

### User Dropdown (right side)
- Trigger: avatar circle with user initials + small role badge below
- Dropdown items:
  - User full name + role (non-clickable header)
  - Divider
  - Settings (link to `/settings`)
  - Logout (button, same logout action as Sidebar)
- Implemented with the existing `DropdownMenu` component from shadcn/ui

### Full-width bar
- `h-14` fixed height, `border-b border-border/60`, `bg-background`
- Sticky at top (`sticky top-0 z-40`)

---

## 4. Layout Changes

**File:** `src/app/(hospital)/layout.tsx`

### Current flow
1. Fetch `AdminConfig` (for `enabledModules`)
2. Fetch user session
3. Render `<Sidebar>` + main content with `ml-64` left margin

### New flow
1. Fetch `AdminConfig` (via `getAdminConfig()`) + `navStyle` (via `getHospitalProfile()`) in parallel using `Promise.all`
2. If `navStyle === "top"`:
   - Render `<TopNavBar>` above main content
   - Main content: full width, `pt-0`, no left margin
   - No `<Sidebar>`
3. If `"side"` or not set (default):
   - Render `<Sidebar>` exactly as today — zero regression

The main wrapper changes from hardcoded `ml-64` to a conditional class string.

---

## 5. Settings UI

**File:** `src/app/(hospital)/settings/components/SettingsPage.tsx`  
**Location:** Hospital Profile tab, below existing profile fields

### Navigation Style section
```
Navigation Style
[ □ Sidebar ]  [ □ Top Bar ]     ← segmented control (two bordered buttons)

Takes effect on next page load.
```

- Two buttons styled as a segmented control (left button rounded-left, right button rounded-right, no gap)
- Active option: `bg-primary text-primary-foreground`
- Inactive option: `bg-background text-muted-foreground border border-border`
- On click: calls `updateNavStyle()` server action immediately (no separate Save button)
- On success: `toast.success("Navigation style updated")` 
- A `<p className="text-xs text-muted-foreground mt-1.5">Takes effect on next page load.</p>` below the control

---

## 6. Out of Scope

- Per-user nav preferences (hospital-wide only)
- Reordering or hiding individual nav items
- Animated transitions between nav styles
- Mobile/responsive behaviour changes (sidebar already handles mobile; top nav is desktop-focused)
