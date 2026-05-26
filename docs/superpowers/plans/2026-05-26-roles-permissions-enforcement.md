# Roles & Permissions Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the existing role/permission system so each role only sees and can use what they're permitted to — in the sidebar, on page load, in action buttons, and in server actions.

**Architecture:** Three independent enforcement layers — (1) sidebar/nav hides links by permission, (2) page server components redirect unauthorized direct URL access, (3) server actions reject unauthorized calls. A React context makes permissions available to client components for button visibility.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase, React Context, existing `src/lib/permissions.ts` + `src/lib/auth.ts`

---

## File Map

**Modified:**
- `src/lib/auth.ts` — add `requireServerPermission(permission)` async guard
- `src/components/layout/nav-items.ts` — add `permission` field to `NavItem` type + each item
- `src/components/layout/Sidebar.tsx` — filter nav by `user.permissions`; accept `permissions` prop
- `src/components/layout/TopNavBar.tsx` — filter nav by `user.permissions`; accept `permissions` prop
- `src/app/(hospital)/layout.tsx` — pass `permissions` to nav components + wrap with `UserProvider`
- `src/app/(hospital)/dashboard/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/patients/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/workup/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/doctor/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/labs/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/pharmacy/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/optical/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/inpatients/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/insurance/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/dues-followups/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/expenses/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/reports/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/analytics/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/data/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/license-tracker/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/settings/page.tsx` — add `requireServerPermission`
- `src/app/(hospital)/staff/page.tsx` — keep `requireAdmin()` + add `requireServerPermission`
- `src/app/(hospital)/patients/actions.ts` — add permission guards
- `src/app/(hospital)/workup/actions.ts` — add permission guards
- `src/app/(hospital)/doctor/actions.ts` — add permission guards
- `src/app/(hospital)/doctor/ai-actions.ts` — add permission guards
- `src/app/(hospital)/labs/actions.ts` — add permission guards
- `src/app/(hospital)/pharmacy/actions.ts` — add permission guards
- `src/app/(hospital)/optical/actions.ts` — add permission guards
- `src/app/(hospital)/inpatients/actions.ts` — add permission guards
- `src/app/(hospital)/insurance/actions.ts` — add permission guards
- `src/app/(hospital)/expenses/actions.ts` — add permission guards
- `src/app/(hospital)/reports/actions.ts` — add permission guards
- `src/app/(hospital)/analytics/actions.ts` — add permission guards
- `src/app/(hospital)/license-tracker/actions.ts` — add permission guards
- `src/app/(hospital)/staff/actions.ts` — add per-action permission guards (keep `requireAdmin()`)
- `src/app/(hospital)/dues-followups/actions.ts` — add permission guards
- `src/app/(hospital)/settings/actions.ts` — add permission guards
- `src/app/(hospital)/expenses/components/ExpensesPage.tsx` — gate create/edit/delete buttons
- `src/app/(hospital)/license-tracker/components/LicenseTrackerPage.tsx` — gate create/edit/delete buttons
- `src/app/(hospital)/patients/components/PatientsPage.tsx` — gate create/edit/delete buttons
- `src/app/(hospital)/labs/components/LabsPage.tsx` — gate create/config buttons
- `src/app/(hospital)/pharmacy/components/BillingTab.tsx` — gate create bill button
- `src/app/(hospital)/pharmacy/components/InventoryTab.tsx` — gate stock management buttons
- `src/app/(hospital)/optical/components/OpticalPage.tsx` — gate create/stock buttons
- `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx` — gate edit/discharge buttons
- `src/app/(hospital)/insurance/components/InsurancePage.tsx` (if exists) — gate create/edit buttons

**Created:**
- `src/contexts/UserContext.tsx` — React context providing `SessionUser` to client components
- `src/hooks/usePermissions.ts` — `usePermissions()` hook returning `can(permission)` helper
- `src/app/(hospital)/unauthorized/page.tsx` — "You don't have permission" screen

---

## Task 1: Add `requireServerPermission` to auth.ts

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add the async permission guard function**

Open `src/lib/auth.ts`. After the existing `requireAdmin()` function (line 96), add:

```typescript
export async function requireServerPermission(permission: string): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role === "ADMIN") return session
  if (!session.permissions.includes(permission)) {
    redirect("/unauthorized")
  }
  return session
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to auth.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(permissions): add requireServerPermission async guard to auth"
```

---

## Task 2: Create /unauthorized page

**Files:**
- Create: `src/app/(hospital)/unauthorized/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// src/app/(hospital)/unauthorized/page.tsx
import Link from "next/link"
import { ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <ShieldX className="h-8 w-8 text-red-600" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Access Denied</h1>
        <p className="mt-1 text-sm text-gray-500">
          You don&apos;t have permission to access this page.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(hospital)/unauthorized/page.tsx"
git commit -m "feat(permissions): add /unauthorized page"
```

---

## Task 3: Add permission field to NavItem + update Sidebar + TopNavBar

**Files:**
- Modify: `src/components/layout/nav-items.ts`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/TopNavBar.tsx`

- [ ] **Step 1: Add `permission` field to NavItem type and all nav items**

Replace the entire content of `src/components/layout/nav-items.ts` with:

```typescript
import type { ElementType } from "react"
import {
  Users, Eye, Stethoscope, BedDouble, Shield, ClipboardList,
  FlaskConical, FileBarChart, Wallet, Pill, Glasses, ScrollText,
  DatabaseZap, BarChart3, UserCog, LayoutDashboard, Phone,
} from "lucide-react"

export type NavItem = {
  href: string
  icon: ElementType
  label: string
  exact?: boolean
  moduleCode?: string
  permission?: string
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true, permission: "dashboard:view" },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/patients", icon: Users, label: "Patients", moduleCode: "patients", permission: "patients:view" },
      { href: "/workup", icon: Eye, label: "Refraction", moduleCode: "workup", permission: "workup:view" },
      { href: "/doctor", icon: Stethoscope, label: "Doctor", moduleCode: "doctor", permission: "doctor:view" },
      { href: "/inpatients", icon: BedDouble, label: "In-Patients", moduleCode: "inpatients", permission: "inpatients:view" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/pharmacy", icon: Pill, label: "Pharmacy", moduleCode: "pharmacy", permission: "pharmacy:view" },
      { href: "/optical", icon: Glasses, label: "Optical", moduleCode: "optical", permission: "optical:view" },
      { href: "/labs", icon: FlaskConical, label: "Labs", moduleCode: "labs", permission: "labs:view" },
      { href: "/call-logs", icon: Phone, label: "Call Logs", moduleCode: "call-logs" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/insurance", icon: Shield, label: "Insurance", moduleCode: "insurance", permission: "insurance:view" },
      { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups", permission: "dues:view" },
      { href: "/expenses", icon: Wallet, label: "Expenses", moduleCode: "expenses", permission: "expenses:view" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Analytics", moduleCode: "analytics", permission: "reports:view" },
      { href: "/reports", icon: FileBarChart, label: "Reports", moduleCode: "reports", permission: "reports:view" },
      { href: "/data", icon: DatabaseZap, label: "Data Export", permission: "data:export" },
      { href: "/license-tracker", icon: ScrollText, label: "Licenses", moduleCode: "license-tracker", permission: "licenses:view" },
      { href: "/staff", icon: UserCog, label: "Staff", permission: "staff:view" },
    ],
  },
]
```

- [ ] **Step 2: Update Sidebar to accept permissions and filter by them**

In `src/components/layout/Sidebar.tsx`:

Change the `SidebarProps` interface (line 13-16) to:
```typescript
interface SidebarProps {
  user: { fullName: string; role: string; permissions: string[] }
  hospitalName?: string
  enabledModules?: string[]
}
```

Change the `visibleItems` filter (lines 107-112) to:
```typescript
const visibleItems = section.items.filter((item) => {
  if (item.permission && !user.permissions.includes(item.permission)) return false
  if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
  return true
})
```

- [ ] **Step 3: Update TopNavBar to accept permissions and filter by them**

In `src/components/layout/TopNavBar.tsx`:

Change the `TopNavBarProps` interface (lines 21-25) to:
```typescript
interface TopNavBarProps {
  user: { fullName: string; role: string; permissions: string[] }
  hospitalName: string
  enabledModules: string[]
}
```

Change the `allItems` filter (lines 37-41) to:
```typescript
const allItems = NAV_SECTIONS.flatMap((s) => s.items).filter((item) => {
  if (item.permission && !user.permissions.includes(item.permission)) return false
  if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
  return true
})
```

Also find any reference to `item.adminOnly` in TopNavBar and remove it (it's replaced by permission checks).

- [ ] **Step 4: Update layout.tsx navProps to include permissions**

In `src/app/(hospital)/layout.tsx`, the `navProps` object (around line 59-63) currently passes `user` which already has `permissions` from `getSession()`. The nav components now expect `user.permissions` — but the `user` object from `getSession()` is a full `SessionUser` which already includes `permissions: string[]`. So passing `user` directly works as long as TypeScript is happy with the prop type.

Verify the `navProps` shape matches. The `user` from `getSession()` is `SessionUser`:
```typescript
// SessionUser already has permissions: string[]
const navProps = {
  user,           // { id, email, fullName, role, permissions }
  hospitalName,
  enabledModules: config.enabledModules,
}
```

This already works — `SessionUser` has `permissions`. No change needed to layout.tsx for this step.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in nav-items.ts, Sidebar.tsx, TopNavBar.tsx

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/nav-items.ts src/components/layout/Sidebar.tsx src/components/layout/TopNavBar.tsx
git commit -m "feat(permissions): filter sidebar and top nav by user permissions"
```

---

## Task 4: Create UserContext and usePermissions hook

**Files:**
- Create: `src/contexts/UserContext.tsx`
- Create: `src/hooks/usePermissions.ts`

- [ ] **Step 1: Create UserContext**

```typescript
// src/contexts/UserContext.tsx
"use client"

import { createContext, useContext } from "react"
import type { SessionUser } from "@/lib/auth"

const UserContext = createContext<SessionUser | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser(): SessionUser {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used inside UserProvider")
  return ctx
}
```

- [ ] **Step 2: Create usePermissions hook**

```typescript
// src/hooks/usePermissions.ts
"use client"

import { useUser } from "@/contexts/UserContext"

export function usePermissions() {
  const user = useUser()
  return {
    can: (permission: string): boolean => {
      if (user.role === "ADMIN") return true
      return user.permissions.includes(permission)
    },
    canAny: (permissions: string[]): boolean => {
      if (user.role === "ADMIN") return true
      return permissions.some((p) => user.permissions.includes(p))
    },
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/contexts/UserContext.tsx src/hooks/usePermissions.ts
git commit -m "feat(permissions): add UserContext and usePermissions hook"
```

---

## Task 5: Wrap hospital layout with UserProvider

**Files:**
- Modify: `src/app/(hospital)/layout.tsx`

- [ ] **Step 1: Add UserProvider to layout**

In `src/app/(hospital)/layout.tsx`:

Add import at the top:
```typescript
import { UserProvider } from "@/contexts/UserContext"
```

Wrap the `children` with `UserProvider`. The return JSX currently looks like:
```typescript
return (
  <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
    <BillingBanner message={config.billing.bannerMessage} />
    {navStyle === "top" ? (
      <TopNavBar {...navProps} />
    ) : (
      <Sidebar {...navProps} />
    )}
    <main className="h-full overflow-y-auto flex-1">
      <div className="min-h-full px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:pt-6 lg:pb-8">{children}</div>
    </main>
    <InstallPrompt />
  </div>
)
```

Change it to:
```typescript
return (
  <UserProvider user={user}>
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <BillingBanner message={config.billing.bannerMessage} />
      {navStyle === "top" ? (
        <TopNavBar {...navProps} />
      ) : (
        <Sidebar {...navProps} />
      )}
      <main className="h-full overflow-y-auto flex-1">
        <div className="min-h-full px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:pt-6 lg:pb-8">{children}</div>
      </main>
      <InstallPrompt />
    </div>
  </UserProvider>
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(hospital)/layout.tsx"
git commit -m "feat(permissions): wrap hospital layout with UserProvider"
```

---

## Task 6: Add page guards to all page.tsx files

**Files:**
- Modify: 17 page.tsx files under `src/app/(hospital)/`

- [ ] **Step 1: Add guards to dashboard, patients, workup, doctor pages**

`src/app/(hospital)/dashboard/page.tsx` — replace `await getSession()` with:
```typescript
import { requireServerPermission } from "@/lib/auth"
// ...
export default async function DashboardPage() {
  await requireServerPermission("dashboard:view")
  // rest unchanged
```

`src/app/(hospital)/patients/page.tsx` — add at the top of the default export function (before the parallel fetch):
```typescript
import { requireServerPermission } from "@/lib/auth"
// ...
export default async function Page({ searchParams }: ...) {
  await requireServerPermission("patients:view")
  // rest unchanged
```

`src/app/(hospital)/workup/page.tsx` — add at top of default export:
```typescript
import { requireServerPermission } from "@/lib/auth"
// ...
await requireServerPermission("workup:view")
```

`src/app/(hospital)/doctor/page.tsx` — add at top of default export:
```typescript
import { requireServerPermission } from "@/lib/auth"
// ...
await requireServerPermission("doctor:view")
```

- [ ] **Step 2: Add guards to labs, pharmacy, optical, inpatients pages**

`src/app/(hospital)/labs/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
// add as first line in default export:
await requireServerPermission("labs:view")
```

`src/app/(hospital)/pharmacy/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("pharmacy:view")
```

`src/app/(hospital)/optical/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("optical:view")
```

`src/app/(hospital)/inpatients/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("inpatients:view")
```

- [ ] **Step 3: Add guards to insurance, dues-followups, expenses, reports, analytics pages**

`src/app/(hospital)/insurance/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("insurance:view")
```

`src/app/(hospital)/dues-followups/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
// The page currently just returns <DuesFollowupsPage />
// Wrap in async function:
export default async function Page() {
  await requireServerPermission("dues:view")
  return <DuesFollowupsPage />
}
```

`src/app/(hospital)/expenses/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
// add as first line in default export:
await requireServerPermission("expenses:view")
```

`src/app/(hospital)/reports/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
// The page currently returns <ReportsPage /> in an async function
// Add as first line:
await requireServerPermission("reports:view")
```

`src/app/(hospital)/analytics/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("reports:view")
```

- [ ] **Step 4: Add guards to data, license-tracker, settings, staff pages**

`src/app/(hospital)/data/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
// Page currently calls: export default function Page() { return <DataExportPage /> }
// Change to async:
export default async function Page() {
  await requireServerPermission("data:export")
  return <DataExportPage />
}
```

`src/app/(hospital)/license-tracker/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("licenses:view")
```

`src/app/(hospital)/settings/page.tsx`:
```typescript
import { requireServerPermission } from "@/lib/auth"
await requireServerPermission("settings:view")
```

`src/app/(hospital)/staff/page.tsx` — keep existing `requireAdmin()`, add permission guard after it:
```typescript
import { requireAdmin, requireServerPermission } from "@/lib/auth"
// existing:
await requireAdmin()
// add:
await requireServerPermission("staff:view")
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/(hospital)/dashboard/page.tsx" \
  "src/app/(hospital)/patients/page.tsx" \
  "src/app/(hospital)/workup/page.tsx" \
  "src/app/(hospital)/doctor/page.tsx" \
  "src/app/(hospital)/labs/page.tsx" \
  "src/app/(hospital)/pharmacy/page.tsx" \
  "src/app/(hospital)/optical/page.tsx" \
  "src/app/(hospital)/inpatients/page.tsx" \
  "src/app/(hospital)/insurance/page.tsx" \
  "src/app/(hospital)/dues-followups/page.tsx" \
  "src/app/(hospital)/expenses/page.tsx" \
  "src/app/(hospital)/reports/page.tsx" \
  "src/app/(hospital)/analytics/page.tsx" \
  "src/app/(hospital)/data/page.tsx" \
  "src/app/(hospital)/license-tracker/page.tsx" \
  "src/app/(hospital)/settings/page.tsx" \
  "src/app/(hospital)/staff/page.tsx"
git commit -m "feat(permissions): add requireServerPermission guards to all page routes"
```

---

## Task 7: Add permission guards to patients, workup, doctor actions

**Files:**
- Modify: `src/app/(hospital)/patients/actions.ts`
- Modify: `src/app/(hospital)/workup/actions.ts`
- Modify: `src/app/(hospital)/doctor/actions.ts`
- Modify: `src/app/(hospital)/doctor/ai-actions.ts`

- [ ] **Step 1: Update patients/actions.ts imports and read actions**

In `src/app/(hospital)/patients/actions.ts`, change the import line from:
```typescript
import { requireAuth } from "@/lib/auth"
```
to:
```typescript
import { requireAuth, requireServerPermission } from "@/lib/auth"
```

For read/list actions, replace `await requireAuth()` with `await requireServerPermission("patients:view")`:
- `getNextPatientId` → `await requireServerPermission("patients:view")`  
  *(Note: currently has no auth check — add one)*
- `getPatients` → add `await requireServerPermission("patients:view")` as first line
- `getPatientById` → add `await requireServerPermission("patients:view")` as first line
- `searchExistingPatients` → add `await requireServerPermission("patients:view")` as first line
- `getPatientWithLastVisit` → add `await requireServerPermission("patients:view")` as first line
- `getPatientReceiptData` → add `await requireServerPermission("patients:view")` as first line
- `getCurrentUserRole` → keep `requireAuth()` (identity check, not data access)
- `getPatientRegistrationFormData` → add `await requireServerPermission("patients:create")` as first line
- `getDropdownOptions` → add `await requireServerPermission("patients:view")` as first line

For write actions, replace `await requireAuth()` with the appropriate permission:
- `createPatient` → `await requireServerPermission("patients:create")`
- `updatePatientInfo` → `await requireServerPermission("patients:edit")`
- `updatePatientStatus` → `await requireServerPermission("patients:edit")`
- `movePatientToDate` → `await requireServerPermission("patients:edit")`
- `addServiceToPatient` → `await requireServerPermission("patients:edit")`
- `deletePatient` → `await requireServerPermission("patients:delete")`
- `createPrescriptionWithBilling` → `await requireServerPermission("doctor:consult")`
- `createServiceTemplate` → `await requireServerPermission("settings:edit")`
- `updateServiceTemplate` → `await requireServerPermission("settings:edit")`
- `deleteServiceTemplate` → `await requireServerPermission("settings:edit")`
- `getServiceTemplates` → add `await requireServerPermission("patients:view")` as first line
- `addDropdownOption` → `await requireServerPermission("patients:create")`

- [ ] **Step 2: Update workup/actions.ts**

In `src/app/(hospital)/workup/actions.ts`, change import to include `requireServerPermission`:
```typescript
import { requireAuth, requireServerPermission } from "@/lib/auth"
```

- `getWorkupQueue` → add `await requireServerPermission("workup:view")` as first line
- `getPatientForWorkup` → add `await requireServerPermission("workup:view")` as first line
- `startWorkup` → replace `await requireAuth()` with `await requireServerPermission("workup:create")`
- `saveEyeReading` → replace `await requireAuth()` with `await requireServerPermission("workup:create")`

- [ ] **Step 3: Update doctor/actions.ts**

In `src/app/(hospital)/doctor/actions.ts`, change import to include `requireServerPermission`:
```typescript
import { requireAuth, requireServerPermission } from "@/lib/auth"
```

- `getDoctorQueue` → add `await requireServerPermission("doctor:view")` as first line
- `getPatientForConsultation` → add `await requireServerPermission("doctor:view")` as first line
- `savePrescription` → replace `await requireAuth()` with `await requireServerPermission("doctor:consult")`
- `getPrescriptionReferenceData` → add `await requireServerPermission("doctor:view")` as first line
- `getMedicineMaster` → add `await requireServerPermission("doctor:view")` as first line
- `getInvestigationMaster` → add `await requireServerPermission("doctor:view")` as first line
- `getPredefinedTemplates` → add `await requireServerPermission("doctor:view")` as first line
- `getDropdownOptions` → add `await requireServerPermission("doctor:view")` as first line
- `addDropdownOption` → replace with `await requireServerPermission("doctor:consult")`
- `createMedicine` → replace with `await requireServerPermission("doctor:consult")`
- `updatePatientToWithDoctor` → replace with `await requireServerPermission("doctor:consult")`
- `getReceiptData` → add `await requireServerPermission("doctor:view")` as first line

- [ ] **Step 4: Update doctor/ai-actions.ts**

In `src/app/(hospital)/doctor/ai-actions.ts`, change the import to include `requireServerPermission`:
```typescript
import { requireAuth, requireServerPermission } from "@/lib/auth"
```

Then in `askSithaAI` (the only exported async function), replace `await requireAuth()` with:
```typescript
await requireServerPermission("doctor:consult")
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/(hospital)/patients/actions.ts" \
  "src/app/(hospital)/workup/actions.ts" \
  "src/app/(hospital)/doctor/actions.ts" \
  "src/app/(hospital)/doctor/ai-actions.ts"
git commit -m "feat(permissions): add permission guards to patients, workup, doctor actions"
```

---

## Task 8: Add permission guards to labs, pharmacy, optical actions

**Files:**
- Modify: `src/app/(hospital)/labs/actions.ts`
- Modify: `src/app/(hospital)/pharmacy/actions.ts`
- Modify: `src/app/(hospital)/optical/actions.ts`

- [ ] **Step 1: Update labs/actions.ts**

Change import to:
```typescript
import { requireAuth, requireServerPermission } from "@/lib/auth"
```

- `getLabs` → add `await requireServerPermission("labs:view")` as first line
- `getLabById` → add `await requireServerPermission("labs:view")` as first line
- `createLab` → replace `await requireAuth()` with `await requireServerPermission("labs:config")`
- `updateLab` → replace with `await requireServerPermission("labs:config")`
- `deleteLab` → replace with `await requireServerPermission("labs:config")`
- `getLabInvestigations` → add `await requireServerPermission("labs:view")` as first line
- `getAllInvestigations` → add `await requireServerPermission("labs:view")` as first line
- `createInvestigation` → replace with `await requireServerPermission("labs:config")`
- `updateLabInvestigations` → replace with `await requireServerPermission("labs:config")`
- `getPatientInvestigations` → add `await requireServerPermission("labs:view")` as first line
- `getPendingLabInvestigations` → add `await requireServerPermission("labs:view")` as first line
- `createLabBills` → replace with `await requireServerPermission("labs:create")`
- `getLabBills` → add `await requireServerPermission("labs:view")` as first line
- `getLabBillById` → add `await requireServerPermission("labs:view")` as first line

- [ ] **Step 2: Update pharmacy/actions.ts**

Change import to include `requireServerPermission`.

- `getMedicines` → add `await requireServerPermission("pharmacy:view")` as first line
- `createMedicine` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `updateMedicine` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `deleteMedicine` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `getStock` → add `await requireServerPermission("pharmacy:view")` as first line
- `addStock` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `updateStock` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `getStockSummary` → add `await requireServerPermission("pharmacy:view")` as first line
- `searchMedicineStock` → add `await requireServerPermission("pharmacy:view")` as first line
- `getPatientPrescription` → add `await requireServerPermission("pharmacy:view")` as first line
- `createPharmacyBill` → replace with `await requireServerPermission("pharmacy:create")`
- `getPharmacyBills` → add `await requireServerPermission("pharmacy:view")` as first line
- `getSuppliers` → add `await requireServerPermission("pharmacy:view")` as first line
- `createSupplier` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `updateSupplier` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `deleteSupplier` → replace with `await requireServerPermission("pharmacy:manage_stock")`
- `getPurchaseOrders` → add `await requireServerPermission("pharmacy:purchase_orders")` as first line
- `createPurchaseOrder` → replace with `await requireServerPermission("pharmacy:purchase_orders")`
- `receivePurchaseOrder` → replace with `await requireServerPermission("pharmacy:purchase_orders")`
- `updatePOStatus` → replace with `await requireServerPermission("pharmacy:purchase_orders")`
- `getPendingMedicines` → add `await requireServerPermission("pharmacy:view")` as first line

- [ ] **Step 3: Update optical/actions.ts**

Change import to include `requireServerPermission`.

- `getOpticalProducts` → add `await requireServerPermission("optical:view")` as first line
- `createOpticalProduct` → replace with `await requireServerPermission("optical:manage_stock")`
- `updateOpticalProduct` → replace with `await requireServerPermission("optical:manage_stock")`
- `deleteOpticalProduct` → replace with `await requireServerPermission("optical:manage_stock")`
- `getOpticalStock` → add `await requireServerPermission("optical:view")` as first line
- `addOpticalStock` → replace with `await requireServerPermission("optical:manage_stock")`
- `updateOpticalStock` → replace with `await requireServerPermission("optical:manage_stock")`
- `getStockSummary` → add `await requireServerPermission("optical:view")` as first line
- `searchOpticalStock` → add `await requireServerPermission("optical:view")` as first line
- `getPatientWithARReading` → add `await requireServerPermission("optical:view")` as first line
- `createOpticalBill` → replace with `await requireServerPermission("optical:create")`
- `getOpticalBills` → add `await requireServerPermission("optical:view")` as first line
- `updateOpticalBillStatus` → replace with `await requireServerPermission("optical:edit")`
- `getOpticalSettings` → add `await requireServerPermission("optical:view")` as first line
- `updateOpticalSettings` → replace with `await requireServerPermission("optical:manage_stock")`
- `getOpticalHospitalProfile` → add `await requireServerPermission("optical:view")` as first line

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(hospital)/labs/actions.ts" \
  "src/app/(hospital)/pharmacy/actions.ts" \
  "src/app/(hospital)/optical/actions.ts"
git commit -m "feat(permissions): add permission guards to labs, pharmacy, optical actions"
```

---

## Task 9: Add permission guards to inpatients, insurance, expenses, reports, analytics, license-tracker, staff actions

**Files:**
- Modify: `src/app/(hospital)/inpatients/actions.ts`
- Modify: `src/app/(hospital)/insurance/actions.ts`
- Modify: `src/app/(hospital)/expenses/actions.ts`
- Modify: `src/app/(hospital)/reports/actions.ts`
- Modify: `src/app/(hospital)/analytics/actions.ts`
- Modify: `src/app/(hospital)/license-tracker/actions.ts`
- Modify: `src/app/(hospital)/staff/actions.ts`

- [ ] **Step 1: Update inpatients/actions.ts**

Change import to include `requireServerPermission`.

- `getNextInPatientId` → add `await requireServerPermission("inpatients:view")` as first line
- `getInPatients` → add `await requireServerPermission("inpatients:view")` as first line
- `getInPatientAdmissionFormData` → add `await requireServerPermission("inpatients:create")` as first line
- `getInPatientById` → add `await requireServerPermission("inpatients:view")` as first line
- `createInPatient` → replace `await requireAuth()` with `await requireServerPermission("inpatients:create")`
- `updateInPatientStatus` → replace with `await requireServerPermission("inpatients:edit")`
- `addInPatientPayment` → replace with `await requireServerPermission("inpatients:edit")`
- `dischargeInPatient` → replace with `await requireServerPermission("inpatients:discharge")`
- `updateInPatientDetails` → replace with `await requireServerPermission("inpatients:edit")`
- `deleteInPatient` → replace with `await requireServerPermission("inpatients:delete")`
- `updateInPatientBasicInfo` → replace with `await requireServerPermission("inpatients:edit")`
- `updateInPatient` → replace with `await requireServerPermission("inpatients:edit")`
- `getHospitalProfileForReceipts` → add `await requireServerPermission("inpatients:view")` as first line

- [ ] **Step 2: Update insurance/actions.ts**

Change import to include `requireServerPermission`.

- `getInsuranceCompanies` → add `await requireServerPermission("insurance:view")` as first line
- `getAllInsuranceCompanies` → add `await requireServerPermission("insurance:view")` as first line
- `createInsuranceCompany` → replace with `await requireServerPermission("insurance:create")`
- `updateInsuranceCompany` → replace with `await requireServerPermission("insurance:edit")`
- `deleteInsuranceCompany` → replace with `await requireServerPermission("insurance:edit")`
- `getInsuranceClaims` → add `await requireServerPermission("insurance:view")` as first line
- `getInsuranceClaimById` → add `await requireServerPermission("insurance:view")` as first line
- `createInsuranceClaim` → replace with `await requireServerPermission("insurance:create")`
- `updateInsuranceClaimStatus` → replace with `await requireServerPermission("insurance:edit")`
- `updateInsuranceClaimDetails` → replace with `await requireServerPermission("insurance:edit")`
- `addInsurancePatientPayment` → replace with `await requireServerPermission("insurance:edit")`
- `searchInPatientsForInsurance` → add `await requireServerPermission("insurance:view")` as first line

- [ ] **Step 3: Update expenses/actions.ts**

Change import from `{ requireAuth }` to `{ requireAuth, requireServerPermission }`.

- `seedDefaultCategories` → replace `await requireAuth()` with `await requireServerPermission("expenses:view")`
- `getCategories` → add `await requireServerPermission("expenses:view")` as first line (no auth check currently)
- `createCategory` → replace with `await requireServerPermission("expenses:create")`
- `updateCategory` → replace with `await requireServerPermission("expenses:edit")`
- `deleteCategory` → replace with `await requireServerPermission("expenses:edit")`
- `reorderCategories` → replace with `await requireServerPermission("expenses:edit")`
- `getExpensesByDateRange` → add `await requireServerPermission("expenses:view")` as first line (no auth currently)
- `createExpense` → replace with `await requireServerPermission("expenses:create")`
- `updateExpense` → replace with `await requireServerPermission("expenses:edit")`
- `deleteExpense` → replace with `await requireServerPermission("expenses:delete")`

- [ ] **Step 4: Update reports/actions.ts and analytics/actions.ts**

`reports/actions.ts` — change import and add `await requireServerPermission("reports:view")` as first line of every exported function.

`analytics/actions.ts` — change import and add `await requireServerPermission("reports:view")` as first line of every exported function (`getAnalyticsOverview`, `getGenderDistribution`, `getAgeDistribution`, `getRevenueByCategory`, `getTimeSeries`, `getTopServices`, `getExpenseBreakdown`, `getFinancialSummary`, `getPaymentModeBreakdown`, `getDoctorPerformance`, `getStatusDistribution`, `getCommonDiagnoses`, `getCommonMedicines`, `getReferralStats`, `getSurgeryBreakdown`, `getRegionStats`).

- [ ] **Step 5: Update license-tracker/actions.ts**

Change import to include `requireServerPermission`.

- `getLicenses` → add `await requireServerPermission("licenses:view")` as first line
- `createLicense` → replace `await requireAuth()` with `await requireServerPermission("licenses:create")`
- `updateLicense` → replace with `await requireServerPermission("licenses:create")`
- `deleteLicense` → replace with `await requireServerPermission("licenses:delete")`
- `saveLicenseDocumentUrl` → replace with `await requireServerPermission("licenses:create")`
- `removeLicenseDocument` → replace with `await requireServerPermission("licenses:delete")`

- [ ] **Step 6: Update staff/actions.ts — keep requireAdmin() AND add per-action permission guards**

Change import to include `requireServerPermission`:
```typescript
import { requireAdmin, requireServerPermission } from "@/lib/auth"
```

For each function, keep the existing `await requireAdmin()` call AND add a second permission check after it:

- `getStaffMembers` → keep `await requireAdmin()`, add `await requireServerPermission("staff:view")`
- `getStaffMember` → keep `await requireAdmin()`, add `await requireServerPermission("staff:view")`
- `createStaffMember` → keep `await requireAdmin()`, add `await requireServerPermission("staff:create")`
- `updateStaffMember` → keep `await requireAdmin()`, add `await requireServerPermission("staff:edit")`
- `toggleStaffActive` → keep `await requireAdmin()`, add `await requireServerPermission("staff:deactivate")`
- `resetStaffPassword` → keep `await requireAdmin()`, add `await requireServerPermission("staff:edit")`
- `getRoles` → keep `await requireAdmin()`, add `await requireServerPermission("staff:view")`
- `createRole` → keep `await requireAdmin()`, add `await requireServerPermission("staff:manage_roles")`
- `updateRolePermissions` → keep `await requireAdmin()`, add `await requireServerPermission("staff:manage_roles")`
- `updateRole` → keep `await requireAdmin()`, add `await requireServerPermission("staff:manage_roles")`
- `deleteRole` → keep `await requireAdmin()`, add `await requireServerPermission("staff:manage_roles")`
- `seedSystemRoles` → keep `await requireAdmin()`, add `await requireServerPermission("staff:manage_roles")`

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add "src/app/(hospital)/inpatients/actions.ts" \
  "src/app/(hospital)/insurance/actions.ts" \
  "src/app/(hospital)/expenses/actions.ts" \
  "src/app/(hospital)/reports/actions.ts" \
  "src/app/(hospital)/analytics/actions.ts" \
  "src/app/(hospital)/license-tracker/actions.ts" \
  "src/app/(hospital)/staff/actions.ts"
git commit -m "feat(permissions): add permission guards to remaining server actions"
```

---

## Task 9b: Add permission guards to dues-followups and settings actions

**Files:**
- Modify: `src/app/(hospital)/dues-followups/actions.ts`
- Modify: `src/app/(hospital)/settings/actions.ts`

- [ ] **Step 1: Update dues-followups/actions.ts**

Check current import line — add `requireServerPermission`:
```typescript
import { requireAuth, requireServerPermission } from "@/lib/auth"
```

- `getDues` → add `await requireServerPermission("dues:view")` as first line
- `getFollowUps` → add `await requireServerPermission("dues:view")` as first line
- `markDueAsPaid` → replace `await requireAuth()` with `await requireServerPermission("dues:edit")`
- `getDoctorList` → add `await requireServerPermission("dues:view")` as first line
- `getDepartmentList` → add `await requireServerPermission("dues:view")` as first line
- `getAvailableTemplates` → add `await requireServerPermission("dues:view")` as first line
- `getHospitalDisplayName` → keep `requireAuth()` (utility used across features)
- `sendPatientEmail` → replace with `await requireServerPermission("dues:edit")`

- [ ] **Step 2: Update settings/actions.ts**

Change import to include `requireServerPermission`.

Read-only functions (settings:view):
- `getServiceTemplates` → add `await requireServerPermission("settings:view")` as first line
- `getHospitalProfile` → add `await requireServerPermission("settings:view")` as first line
- `getPrescriptionTemplates` → add `await requireServerPermission("settings:view")`
- `getInpatientTemplates` → add `await requireServerPermission("settings:view")`
- `getPredefinedPackages` → add `await requireServerPermission("settings:view")`
- `getPredefinedSurgeries` → add `await requireServerPermission("settings:view")`
- `getPredefinedDischarges` → add `await requireServerPermission("settings:view")`
- `getMedicineMasterList` → add `await requireServerPermission("settings:view")`

Write functions (settings:edit):
- `createServiceTemplate` → replace with `await requireServerPermission("settings:edit")`
- `updateServiceTemplate` → replace with `await requireServerPermission("settings:edit")`
- `deleteServiceTemplate` → replace with `await requireServerPermission("settings:edit")`
- `updateHospitalProfile` → replace with `await requireServerPermission("settings:edit")`
- `createPrescriptionTemplate` → replace with `await requireServerPermission("settings:edit")`
- `updatePrescriptionTemplate` → replace with `await requireServerPermission("settings:edit")`
- `deletePrescriptionTemplate` → replace with `await requireServerPermission("settings:edit")`
- `createInpatientTemplate` → replace with `await requireServerPermission("settings:edit")`
- `updateInpatientTemplate` → replace with `await requireServerPermission("settings:edit")`
- `deleteInpatientTemplate` → replace with `await requireServerPermission("settings:edit")`
- `createPredefinedPackage` → replace with `await requireServerPermission("settings:edit")`
- `updatePredefinedPackage` → replace with `await requireServerPermission("settings:edit")`
- `deletePredefinedPackage` → replace with `await requireServerPermission("settings:edit")`
- `createPredefinedSurgery` → replace with `await requireServerPermission("settings:edit")`
- `updatePredefinedSurgery` → replace with `await requireServerPermission("settings:edit")`
- `deletePredefinedSurgery` → replace with `await requireServerPermission("settings:edit")`
- `createPredefinedDischarge` → replace with `await requireServerPermission("settings:edit")`
- `updatePredefinedDischarge` → replace with `await requireServerPermission("settings:edit")`
- `deletePredefinedDischarge` → replace with `await requireServerPermission("settings:edit")`
- `createMedicineMaster` → replace with `await requireServerPermission("settings:edit")`
- `updateMedicineMaster` → replace with `await requireServerPermission("settings:edit")`
- `deleteMedicineMaster` → replace with `await requireServerPermission("settings:edit")`
- `saveDefaultPrintConfig` → replace with `await requireServerPermission("settings:edit")`
- `updateNavStyle` → replace with `await requireServerPermission("settings:edit")`

User management functions in settings (staff permissions — these are staff operations in the settings UI):
- `getUsers` → replace with `await requireServerPermission("staff:view")`
- `createUser` → replace with `await requireServerPermission("staff:create")`
- `toggleUserActive` → replace with `await requireServerPermission("staff:deactivate")`

Keep `getDefaultPrintConfig` as `requireAuth()` — it's used by doctor/page.tsx and patients/page.tsx which have their own guards.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(hospital)/dues-followups/actions.ts" \
  "src/app/(hospital)/settings/actions.ts"
git commit -m "feat(permissions): add permission guards to dues-followups and settings actions"
```

---

## Task 10: Gate action buttons in ExpensesPage and LicenseTrackerPage

**Files:**
- Modify: `src/app/(hospital)/expenses/components/ExpensesPage.tsx`
- Modify: `src/app/(hospital)/license-tracker/components/LicenseTrackerPage.tsx`

- [ ] **Step 1: Add usePermissions to ExpensesPage**

In `src/app/(hospital)/expenses/components/ExpensesPage.tsx`, add import:
```typescript
import { usePermissions } from "@/hooks/usePermissions"
```

Inside the component function (after state declarations), add:
```typescript
const { can } = usePermissions()
```

Then gate the buttons:

The "Add Expense" button (around line 195):
```typescript
{can("expenses:create") && (
  <Button size="sm" onClick={() => setShowAddModal(true)}>
    <Plus className="h-4 w-4 mr-1.5" />
    Add Expense
  </Button>
)}
```

The Edit button (around line 465):
```typescript
{can("expenses:edit") && (
  <button onClick={() => handleEdit(expense)} ...>
    <Pencil className="h-3.5 w-3.5" />
  </button>
)}
```

The Delete button (around line 471):
```typescript
{can("expenses:delete") && (
  <button onClick={() => setDeleteId(expense.id)} ...>
    <Trash2 className="h-3.5 w-3.5" />
  </button>
)}
```

- [ ] **Step 2: Add usePermissions to LicenseTrackerPage**

In `src/app/(hospital)/license-tracker/components/LicenseTrackerPage.tsx`, add import and `const { can } = usePermissions()`.

Find and gate:
- Create/Add license button → `{can("licenses:create") && <Button ...>}`
- Edit license button → `{can("licenses:create") && ...}`
- Delete license button → `{can("licenses:delete") && ...}`
- Upload document button → `{can("licenses:create") && ...}`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(hospital)/expenses/components/ExpensesPage.tsx" \
  "src/app/(hospital)/license-tracker/components/LicenseTrackerPage.tsx"
git commit -m "feat(permissions): gate create/edit/delete buttons in expenses and license-tracker"
```

---

## Task 11: Gate action buttons in PatientsPage, LabsPage, PharmacyPage, OpticalPage

**Files:**
- Modify: `src/app/(hospital)/patients/components/PatientsPage.tsx`
- Modify: `src/app/(hospital)/labs/components/LabsPage.tsx`
- Modify: `src/app/(hospital)/pharmacy/components/BillingTab.tsx`
- Modify: `src/app/(hospital)/pharmacy/components/InventoryTab.tsx`
- Modify: `src/app/(hospital)/optical/components/OpticalPage.tsx`

- [ ] **Step 1: Gate PatientsPage buttons**

In `src/app/(hospital)/patients/components/PatientsPage.tsx`, add import and `const { can } = usePermissions()`.

Find and gate:
- "New Patient" / register button → `{can("patients:create") && ...}`
- Edit patient button (in table row actions) → `{can("patients:edit") && ...}`
- Delete patient button → `{can("patients:delete") && ...}`
- "Add to IPD" / admit button → `{can("inpatients:create") && ...}`

- [ ] **Step 2: Gate LabsPage buttons**

In `src/app/(hospital)/labs/components/LabsPage.tsx`, add import and `const { can } = usePermissions()`.

Find and gate:
- "Create Lab Bill" button → `{can("labs:create") && ...}`
- "Add Lab" / config button → `{can("labs:config") && ...}`
- Edit lab button → `{can("labs:config") && ...}`

- [ ] **Step 3: Gate PharmacyPage BillingTab and InventoryTab buttons**

In `src/app/(hospital)/pharmacy/components/BillingTab.tsx`:
- Add import and `const { can } = usePermissions()`
- Gate "Create Bill" button → `{can("pharmacy:create") && ...}`

In `src/app/(hospital)/pharmacy/components/InventoryTab.tsx`:
- Add import and `const { can } = usePermissions()`
- Gate "Add Stock" button → `{can("pharmacy:manage_stock") && ...}`
- Gate "Add Medicine" button → `{can("pharmacy:manage_stock") && ...}`

- [ ] **Step 4: Gate OpticalPage buttons**

In `src/app/(hospital)/optical/components/OpticalPage.tsx`, add import and `const { can } = usePermissions()`.

Find and gate:
- "Create Bill" / sale button → `{can("optical:create") && ...}`
- "Add Stock" button → `{can("optical:manage_stock") && ...}`
- "Add Product" button → `{can("optical:manage_stock") && ...}`

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/(hospital)/patients/components/PatientsPage.tsx" \
  "src/app/(hospital)/labs/components/LabsPage.tsx" \
  "src/app/(hospital)/pharmacy/components/BillingTab.tsx" \
  "src/app/(hospital)/pharmacy/components/InventoryTab.tsx" \
  "src/app/(hospital)/optical/components/OpticalPage.tsx"
git commit -m "feat(permissions): gate action buttons in patients, labs, pharmacy, optical"
```

---

## Task 12: Gate action buttons in InPatientDetailPage and InsurancePage

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`
- Modify: insurance page component (check `src/app/(hospital)/insurance/components/`)

- [ ] **Step 1: Gate InPatientDetailPage buttons**

In `src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx`, add import and `const { can } = usePermissions()`.

Find and gate:
- Edit patient details button → `{can("inpatients:edit") && ...}`
- "Discharge" button → `{can("inpatients:discharge") && ...}`
- "Add Payment" button → `{can("inpatients:edit") && ...}`
- Delete in-patient button → `{can("inpatients:delete") && ...}`

- [ ] **Step 2: Gate InsurancePage buttons**

Check the insurance components directory:
```bash
ls "src/app/(hospital)/insurance/components/"
```

Find the main insurance list/management component and add import and `const { can } = usePermissions()`.

Gate:
- "Create Claim" button → `{can("insurance:create") && ...}`
- "Edit Claim" button → `{can("insurance:edit") && ...}`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(hospital)/inpatients/components/InPatientDetailPage.tsx"
git add "src/app/(hospital)/insurance/components/"*.tsx
git commit -m "feat(permissions): gate action buttons in inpatients and insurance"
```

---

## Task 13: Final verification — manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test ADMIN role**
1. Log in as an ADMIN user
2. Verify: ALL sidebar items are visible (Dashboard, Patients, Workup, Doctor, Labs, Pharmacy, Optical, In-Patients, Insurance, Dues, Expenses, Reports, Analytics, Data Export, Licenses, Staff)
3. Verify: All create/edit/delete buttons visible on all pages
4. Verify: Staff page accessible

- [ ] **Step 3: Test DOCTOR role**
1. Log in as a DOCTOR user (or temporarily change a user's role to DOCTOR)
2. Verify sidebar shows: Dashboard, Patients, Workup, Doctor, Labs, Pharmacy, In-Patients, Insurance, Dues, Reports
3. Verify sidebar does NOT show: Expenses, Analytics, Data Export, Licenses, Staff, Settings, Optical
4. Verify: navigating directly to `/expenses` redirects to `/unauthorized`
5. Verify: Edit patient button visible, Delete patient button NOT visible (DOCTOR has `patients:edit` but not `patients:delete`)

- [ ] **Step 4: Test RECEPTIONIST role**
1. Log in as a RECEPTIONIST
2. Verify sidebar shows: Dashboard, Patients, Workup, Labs, Pharmacy, Optical, Insurance, Dues, Expenses, Reports
3. Verify sidebar does NOT show: Doctor, In-Patients, Analytics, Data Export, Licenses, Staff
4. Verify: navigating to `/doctor` redirects to `/unauthorized`

- [ ] **Step 5: Test OPTOMETRIST role**
1. Log in as OPTOMETRIST
2. Verify sidebar shows: Dashboard, Patients, Workup, Doctor, Optical
3. Verify: All other pages redirect to `/unauthorized`

- [ ] **Step 6: Test NURSE role**
1. Log in as NURSE
2. Verify sidebar shows: Dashboard, Patients, Workup, Doctor, In-Patients, Dues
3. Verify: Pharmacy page redirects to `/unauthorized`

- [ ] **Step 7: Final TypeScript check + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(permissions): complete roles and permissions enforcement across all layers"
```
