# Roles & Permissions Enforcement Design

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** Full enforcement of existing role/permission system across UI, pages, and server actions

---

## Problem

The Docsile HMS has a fully defined permission system (5 system roles, 30+ permissions across 13 modules) but permissions are not enforced. Any authenticated user can access any page or call any server action regardless of their role. Only the Staff page is ADMIN-only.

---

## Goal

When a user logs in with a given role, they should only:
- See sidebar nav items they have permission to access
- Be able to navigate to pages they have permission to view (direct URL access blocked)
- See action buttons (create, edit, delete) only for operations they're permitted to perform
- Have server actions reject unauthorized requests even if the UI is bypassed

---

## Architecture

Three enforcement layers, each independently blocking unauthorized access:

```
Request → Sidebar (hides links) → Page guard (redirects) → Server action (rejects)
```

---

## Section 1: Permission Utility Layer

**File:** `src/lib/permissions.ts` (extend existing file)

Add two new async server-side helpers:

```typescript
async function requirePermission(permission: string): Promise<SessionUser>
async function requireAnyPermission(permissions: string[]): Promise<SessionUser>
```

Both:
1. Call `getSession()` to read JWT from cookie
2. Check `user.permissions` array using existing `hasPermission()` / `hasAnyPermission()`
3. Call `redirect("/unauthorized")` if check fails
4. Return the session user if check passes

**New page:** `src/app/(hospital)/unauthorized/page.tsx`  
Simple "You don't have permission to access this page" screen with a back button. No permission required to view this page.

---

## Section 2: Sidebar & Nav Items

**File:** `src/components/layout/nav-items.ts`

Add a `permission` field to each nav item:

| Route | Permission |
|---|---|
| `/dashboard` | `dashboard:view` |
| `/patients` | `patients:view` |
| `/workup` | `workup:view` |
| `/doctor` | `doctor:view` |
| `/labs` | `labs:view` |
| `/pharmacy` | `pharmacy:view` |
| `/optical` | `optical:view` |
| `/inpatients` | `inpatients:view` |
| `/insurance` | `insurance:view` |
| `/dues-followups` | `dues:view` |
| `/expenses` | `expenses:view` |
| `/reports` | `reports:view` |
| `/analytics` | `reports:view` |
| `/data` | `data:export` |
| `/license-tracker` | `licenses:view` |
| `/settings` | `settings:view` |
| `/staff` | `staff:view` (replaces `adminOnly`) |

**File:** `src/components/layout/Sidebar.tsx`

Update `visibleItems` filter:
```typescript
const visibleItems = section.items.filter((item) => {
  if (item.permission && !hasPermission(user.permissions, item.permission)) return false
  if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
  return true
})
```

Remove `adminOnly` logic — replaced by `staff:view` permission check.

---

## Section 3: Page Guards

Every `page.tsx` under `src/app/(hospital)/` calls `requirePermission()` before rendering.

| Page | Permission |
|---|---|
| `dashboard/page.tsx` | `dashboard:view` |
| `patients/page.tsx` | `patients:view` |
| `workup/page.tsx` | `workup:view` |
| `doctor/page.tsx` | `doctor:view` |
| `labs/page.tsx` | `labs:view` |
| `pharmacy/page.tsx` | `pharmacy:view` |
| `optical/page.tsx` | `optical:view` |
| `inpatients/page.tsx` | `inpatients:view` |
| `insurance/page.tsx` | `insurance:view` |
| `dues-followups/page.tsx` | `dues:view` |
| `expenses/page.tsx` | `expenses:view` |
| `reports/page.tsx` | `reports:view` |
| `analytics/page.tsx` | `reports:view` |
| `data/page.tsx` | `data:export` |
| `license-tracker/page.tsx` | `licenses:view` |
| `settings/page.tsx` | `settings:view` |
| `staff/page.tsx` | `staff:view` |

---

## Section 4: Server Action Guards

Every server action calls `requirePermission()` before touching the database.

| File | Action → Permission |
|---|---|
| `patients/actions.ts` | read → `patients:view`, create → `patients:create`, update → `patients:edit`, delete → `patients:delete` |
| `workup/actions.ts` | read → `workup:view`, create/update → `workup:create` |
| `doctor/actions.ts` | read → `doctor:view`, consult/prescribe → `doctor:consult` |
| `doctor/ai-actions.ts` | all → `doctor:consult` |
| `labs/actions.ts` | read → `labs:view`, create/update → `labs:create`, config → `labs:config` |
| `pharmacy/actions.ts` | read → `pharmacy:view`, billing → `pharmacy:create`, stock → `pharmacy:manage_stock` |
| `optical/actions.ts` | read → `optical:view`, create/update → `optical:create`, stock → `optical:manage_stock` |
| `inpatients/actions.ts` | read → `inpatients:view`, create → `inpatients:create`, update → `inpatients:edit`, discharge → `inpatients:discharge` |
| `insurance/actions.ts` | read → `insurance:view`, create/update → `insurance:create` |
| `expenses/actions.ts` | read → `expenses:view`, create → `expenses:create`, update → `expenses:edit`, delete → `expenses:delete` |
| `reports/actions.ts` | all → `reports:view` |
| `analytics/actions.ts` | all → `reports:view` |
| `license-tracker/actions.ts` | read → `licenses:view`, create/update → `licenses:create`, delete → `licenses:delete` |
| `staff/actions.ts` | view/create/update → `staff:view`/`staff:create`/`staff:edit`, roles → `staff:manage_roles` (replaces `requireAdmin()`) |

---

## Section 5: Client-Side Button Visibility

There is no existing client-side session hook — user data flows via server component props. We'll add a React context so client components can read permissions without prop-drilling.

**New file:** `src/contexts/UserContext.tsx`

```typescript
"use client"
const UserContext = createContext<SessionUser | null>(null)
export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) { ... }
export function useUser(): SessionUser { ... } // throws if used outside provider
```

**Update:** `src/app/(hospital)/layout.tsx` — wrap `children` with `<UserProvider user={user}>`.

**New file:** `src/hooks/usePermissions.ts`

```typescript
"use client"
export function usePermissions() {
  const user = useUser()
  return {
    can: (permission: string) => hasPermission(user.permissions, permission),
    canAny: (permissions: string[]) => hasAnyPermission(user.permissions, permissions),
  }
}
```

**Components updated:**

| Component | Gated Actions |
|---|---|
| `PatientsPage` | Create, Edit, Delete patient |
| `DoctorPage` | Consult / Prescribe |
| `LabsPage` | Create bill, Edit, Config |
| `PharmacyPage` | Billing, Stock management |
| `OpticalPage` | Create sale, Stock management |
| `InPatientDetailPage` | Admit, Edit, Discharge |
| `InsurancePage` | Create / Edit claim |
| `ExpensesPage` | Create, Edit, Delete |
| `LicenseTrackerPage` | Create, Edit, Delete |

Pattern:
```typescript
const { can } = usePermissions()
{can("patients:create") && <Button>New Patient</Button>}
```

---

## Default Role Access Summary

| Module | ADMIN | DOCTOR | RECEPTIONIST | OPTOMETRIST | NURSE |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Patients | ✅ | view | view+create | view | view |
| Workup | ✅ | view | view+create | view+create+edit | view |
| Doctor | ✅ | view+consult | — | — | — |
| Labs | ✅ | view | view+create | — | view |
| Pharmacy | ✅ | — | view+create | — | — |
| Optical | ✅ | — | — | view+create+edit+stock | — |
| In-Patients | ✅ | view | — | — | view+create+edit |
| Insurance | ✅ | — | view+create | — | — |
| Dues | ✅ | — | view+edit | — | — |
| Expenses | ✅ | — | — | — | — |
| Reports | ✅ | — | view | — | — |
| Analytics | ✅ | — | — | — | — |
| Settings | ✅ | — | — | — | — |
| Staff | ✅ | — | — | — | — |
| Licenses | ✅ | — | — | — | — |
| Data Export | ✅ | — | — | — | — |

---

## Out of Scope

- Changing `User.role` from string to FK (low risk, no functional impact needed now)
- Adding permissions to the `call-logs` module (not in current permission definitions)
- Per-patient or per-record row-level permissions
