# Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the docsile-hms Next.js app fully usable on phones (375px) and tablets (768px) without breaking the existing desktop experience.

**Architecture:** Layer-by-layer rollout — navigation shell first, then layout padding, then data grids/tables, then forms. Each layer is an independent commit. All changes are additive Tailwind breakpoint classes; no component APIs change.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, shadcn/ui (Sheet, Dialog, Button), Radix UI, lucide-react

---

## File Map

### L1 — Navigation
- Modify: `src/components/layout/Sidebar.tsx` — add mobile hamburger button (md:hidden), keep desktop hover behavior
- Modify: `src/components/layout/TopNavBar.tsx` — add hamburger button + Sheet drawer on mobile, hide tab strip on mobile

### L2 — Layout Shell
- Modify: `src/app/(hospital)/layout.tsx` — responsive content area padding

### L3 — Data Patterns
- Modify: `src/app/(hospital)/dashboard/DashboardClient.tsx` — responsive module grid + banner layout
- Modify: `src/app/(hospital)/patients/components/PatientTable.tsx` — mobile card stack
- Modify: `src/app/(hospital)/inpatients/components/InPatientsPage.tsx` — mobile card stack
- Modify: `src/app/(hospital)/labs/components/LabBillingTab.tsx` — mobile card stack
- Modify: `src/app/(hospital)/optical/components/BillingTab.tsx` — mobile card stack
- Modify: `src/app/(hospital)/insurance/components/InsuranceClaimDetail.tsx` — mobile card stack for claim list
- Modify: `src/app/(hospital)/dues-followups/components/DuesFollowupsPage.tsx` — fix 3-col header grid
- Modify: `src/app/(hospital)/dues-followups/components/FollowUpsTab.tsx` — mobile card stack
- Modify: `src/app/(hospital)/analytics/components/AnalyticsPage.tsx` — responsive charts

### L4 — Forms
- Modify: `src/app/(hospital)/patients/components/PatientRegistrationStepper.tsx` — responsive step indicator + form grids + full-screen dialog
- Modify: `src/app/(hospital)/inpatients/components/Step1Patient.tsx` — responsive form grids
- Modify: `src/app/(hospital)/inpatients/components/Step2Hospital.tsx` — responsive form grids
- Modify: `src/app/(hospital)/inpatients/components/Step3Payment.tsx` — responsive form grids
- Modify: `src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx` — full-screen dialog + responsive step indicator

---

## Task 1: Layout Shell — Responsive Content Padding

**Files:**
- Modify: `src/app/(hospital)/layout.tsx`

- [ ] **Step 1: Update content wrapper padding**

In `src/app/(hospital)/layout.tsx`, find line 74:
```tsx
<div className="min-h-full px-4 pt-6 pb-8">{children}</div>
```
Change to:
```tsx
<div className="min-h-full px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:pt-6 lg:pb-8">{children}</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(hospital\)/layout.tsx
git commit -m "feat(responsive): responsive content padding in hospital layout"
```

---

## Task 2: Sidebar — Mobile Hamburger Button

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

The Sidebar already has `visible` state and `showSidebar()`. We add a fixed hamburger button visible only on mobile (`md:hidden`). The existing desktop hover-to-show behavior is unchanged.

- [ ] **Step 1: Add Menu icon to imports**

In `src/components/layout/Sidebar.tsx`, find:
```tsx
import { Settings, LogOut, Hospital } from "lucide-react"
```
Change to:
```tsx
import { Settings, LogOut, Hospital, Menu } from "lucide-react"
```

- [ ] **Step 2: Add hamburger button to the JSX fragment**

Find the opening `<>` fragment in the `return` statement (line 61). Add the hamburger button as the first child, before the overlay `div`:

```tsx
return (
  <>
    {/* Mobile hamburger — fixed top-left, only visible on small screens when sidebar is closed */}
    {!visible && (
      <button
        className="fixed top-2 left-2 z-50 md:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-md"
        onClick={showSidebar}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>
    )}

    {/* Overlay backdrop */}
    {visible && (
```

- [ ] **Step 3: Verify the sidebar still closes on nav item click**

The existing `onClick={() => setVisible(false)}` on each `<Link>` already handles this — no change needed.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(responsive): add mobile hamburger button to Sidebar"
```

---

## Task 3: TopNavBar — Mobile Hamburger + Sheet Drawer

**Files:**
- Modify: `src/components/layout/TopNavBar.tsx`

On mobile (`md:hidden`), the tab strip is hidden and a hamburger opens a Sheet drawer listing all nav items.

- [ ] **Step 1: Add Sheet and useState imports**

In `src/components/layout/TopNavBar.tsx`, find:
```tsx
import { Settings, LogOut, Hospital, ChevronDown } from "lucide-react"
```
Change to:
```tsx
import { Settings, LogOut, Hospital, ChevronDown, Menu } from "lucide-react"
```

Add after the existing React import (or at top of file, after `"use client"`):
```tsx
import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
```

- [ ] **Step 2: Add mobileOpen state**

Inside `TopNavBar` function, after the `logoutFormRef` declaration (line 28), add:
```tsx
const [mobileOpen, setMobileOpen] = useState(false)
```

- [ ] **Step 3: Add hamburger button to the header (mobile-only)**

In the `<header>` element, before the hospital-name `<div>`, add:
```tsx
{/* Mobile hamburger — hidden on md+ */}
<button
  className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center text-white/70 hover:text-white"
  onClick={() => setMobileOpen(true)}
  aria-label="Open menu"
>
  <Menu className="h-5 w-5" />
</button>
```

- [ ] **Step 4: Hide the tab strip on mobile**

Find:
```tsx
<nav className="flex-1 overflow-x-auto scrollbar-hide flex items-end px-1 h-10">
```
Change to:
```tsx
<nav className="hidden md:flex flex-1 overflow-x-auto scrollbar-hide items-end px-1 h-10">
```

- [ ] **Step 5: Add the mobile Sheet drawer**

After the closing `</header>` tag (before `</>` closing fragment or end of return), add:

```tsx
{/* Mobile nav drawer */}
<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
  <SheetContent side="left" className="w-72 p-0 flex flex-col">
    <SheetHeader className="px-5 py-4 border-b border-gray-100">
      <SheetTitle className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Hospital className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-foreground truncate">{hospitalName}</span>
      </SheetTitle>
    </SheetHeader>
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => {
          if (item.adminOnly && user.role !== "ADMIN") return false
          if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
          return true
        })
        if (visibleItems.length === 0) return null
        return (
          <div key={section.label}>
            {section.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const active = isActive(item.href, item.exact)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-primary/8 text-primary"
                        : "text-gray-500 hover:text-foreground hover:bg-gray-50"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-gray-400")} />
                    <span className="truncate">{item.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
    <div className="border-t border-gray-100 px-3 pt-3 pb-4">
      <Link
        href="/settings"
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
          isActive("/settings") ? "bg-primary/8 text-primary" : "text-gray-500 hover:text-foreground hover:bg-gray-50"
        )}
      >
        <Settings className={cn("h-4 w-4 shrink-0", isActive("/settings") ? "text-primary" : "text-gray-400")} />
        <span>Configurations</span>
      </Link>
    </div>
  </SheetContent>
</Sheet>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/TopNavBar.tsx
git commit -m "feat(responsive): add mobile hamburger drawer to TopNavBar"
```

---

## Task 4: Dashboard — Responsive Module Grid

**Files:**
- Modify: `src/app/(hospital)/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Fix the banner layout for mobile**

In `DashboardClient.tsx` around line 109, find:
```tsx
<div className="flex items-start justify-between gap-8">
```
Change to:
```tsx
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-8">
```

- [ ] **Step 2: Fix the modules grid**

Find line 148:
```tsx
<div className="grid grid-cols-3 gap-4">
```
Change to:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/dashboard/DashboardClient.tsx
git commit -m "feat(responsive): responsive dashboard grid and banner layout"
```

---

## Task 5: Patient Table — Mobile Card Stack

**Files:**
- Modify: `src/app/(hospital)/patients/components/PatientTable.tsx`

The existing `<Table>` is wrapped in `hidden md:block`. A mobile card list (`md:hidden`) renders the same data as tap-friendly cards.

- [ ] **Step 1: Find the return statement's root element**

Open `src/app/(hospital)/patients/components/PatientTable.tsx`. Find the `return (` in the `PatientTable` function. The root element currently starts with either a `<div>` or directly with `<Table>`.

- [ ] **Step 2: Wrap the existing table in a desktop-only div**

Wrap everything currently in the return (the skeleton + the Table) in:
```tsx
<div>
  {/* ── Desktop table (hidden on mobile) ── */}
  <div className="hidden md:block">
    {/* existing skeleton + Table JSX goes here, unchanged */}
  </div>

  {/* ── Mobile card list (hidden on md+) ── */}
  <div className="md:hidden space-y-2">
    {loading ? (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    ) : patients.length === 0 ? (
      <div className="py-12 text-center text-sm text-muted-foreground">No patients found</div>
    ) : (
      sortedPatients.map((patient, i) => {
        const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ")
        const token = tokenMap.get(patient.id)
        return (
          <div
            key={patient.id}
            onClick={() => onRowClick(patient)}
            className="rounded-xl border border-border bg-white p-4 active:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  #{patient.patientId} · Token {token}
                </p>
              </div>
              <PatientStatusBadge status={patient.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {patient.age != null && <span>Age {patient.age}</span>}
              <span>{patient.gender}</span>
              {patient.phone && <span>{patient.phone}</span>}
            </div>
            {(patient.doctorName || patient.appointmentDate) && (
              <div className="mt-1 text-xs text-muted-foreground">
                {patient.doctorName && <span>{patient.doctorName}</span>}
                {patient.doctorName && patient.appointmentDate && <span> · </span>}
                {patient.appointmentDate && (
                  <span>{new Date(patient.appointmentDate).toLocaleDateString("en-IN")}</span>
                )}
              </div>
            )}
            {(onEdit || onDelete || onQuickPrint) && (
              <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {onQuickPrint && defaultPrintConfigured && patient.status === "COMPLETED" && (
                  <button
                    onClick={() => onQuickPrint(patient)}
                    disabled={quickPrintingId === patient.id}
                    className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {quickPrintingId === patient.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Print"}
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => onEdit(patient)}
                    className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Edit
                  </button>
                )}
                {onDelete && userRole === "ADMIN" && (
                  <button
                    onClick={() => onDelete(patient)}
                    className="text-xs px-2 py-1 rounded-md border border-destructive/30 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })
    )}
  </div>
</div>
```

**Important:** The `sortedPatients` variable is computed inside `PatientTable` — use whatever sorted array is used by the existing table's `.map()`. Check the function body for the variable name (it may be `sorted` or computed inline).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/patients/components/PatientTable.tsx
git commit -m "feat(responsive): mobile card stack for PatientTable"
```

---

## Task 6: InPatients Page — Mobile Card Stack

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/InPatientsPage.tsx`

- [ ] **Step 1: Read the full InPatientsPage table section**

Open `src/app/(hospital)/inpatients/components/InPatientsPage.tsx` and find the `<Table>` element (around line 80+). Note the columns displayed and the data shape from `InPatient` type.

- [ ] **Step 2: Wrap the existing Table in a desktop-only div**

Find the `<Table` opening tag and its wrapping div. Change from:
```tsx
<div className="...existing classes...">
  <Table>
    ...
  </Table>
</div>
```
To:
```tsx
<>
  {/* Desktop table */}
  <div className="hidden md:block ...existing classes...">
    <Table>
      ...existing table unchanged...
    </Table>
  </div>

  {/* Mobile card list */}
  <div className="md:hidden space-y-2 mt-2">
    {loading ? (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    ) : filteredPatients.length === 0 ? (
      <div className="py-12 text-center text-sm text-muted-foreground">No patients found</div>
    ) : (
      filteredPatients.map((patient) => (
        <div
          key={patient.id}
          onClick={() => setSelectedId(patient.id)}
          className="rounded-xl border border-border bg-white p-4 active:bg-gray-50 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{patient.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {patient.ipNumber} · Age {patient.age}
              </p>
            </div>
            <InPatientStatusBadge status={patient.status} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {patient.doctorNames?.join(", ")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Admitted: {new Date(patient.admissionDate).toLocaleDateString("en-IN")}
          </div>
        </div>
      ))
    )}
  </div>
</>
```

**Note:** Replace `filteredPatients` with whatever variable is used by the existing table's `.map()`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/InPatientsPage.tsx
git commit -m "feat(responsive): mobile card stack for InPatientsPage"
```

---

## Task 7: Dues Header + Labs + FollowUps — Mobile Card Stacks

**Files:**
- Modify: `src/app/(hospital)/dues-followups/components/DuesFollowupsPage.tsx`
- Modify: `src/app/(hospital)/dues-followups/components/FollowUpsTab.tsx`
- Modify: `src/app/(hospital)/labs/components/LabBillingTab.tsx`

### DuesFollowupsPage — Fix 3-column header grid

- [ ] **Step 1: Fix the page header grid**

In `DuesFollowupsPage.tsx` find (around line 34):
```tsx
<div className="grid grid-cols-3 items-center bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
```
Change to:
```tsx
<div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 backdrop-blur-md border-b border-border/60 px-4 py-3 md:px-6 md:py-4 -mx-3 md:-mx-4 lg:-mx-6 -mt-4 md:-mt-6 sticky top-0 z-20">
```

The three children (title+refresh / tab switcher / actions) will now flex-wrap gracefully on mobile. Verify the tab switcher (`<div className="flex justify-center">`) and the actions div still render correctly — they may need `shrink-0` added.

### FollowUpsTab — Add mobile cards

- [ ] **Step 2: Wrap existing table and add card list in FollowUpsTab.tsx**

Open `src/app/(hospital)/dues-followups/components/FollowUpsTab.tsx`. Find the `<Table` element. Wrap it and add the mobile card list:

```tsx
<>
  {/* Desktop table */}
  <div className="hidden md:block">
    {/* existing Table JSX unchanged */}
  </div>

  {/* Mobile card list */}
  <div className="md:hidden space-y-2 mt-2">
    {loading ? (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    ) : followUps.length === 0 ? (
      <div className="py-12 text-center text-sm text-muted-foreground">No follow-ups</div>
    ) : (
      followUps.map((fu) => (
        <div key={fu.id} className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{fu.patientName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fu.phone}</p>
            </div>
            {/* render status badge if available */}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {fu.followUpDate && (
              <span>Follow-up: {new Date(fu.followUpDate).toLocaleDateString("en-IN")}</span>
            )}
          </div>
          {fu.notes && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{fu.notes}</p>
          )}
        </div>
      ))
    )}
  </div>
</>
```

**Note:** Replace `followUps`, `fu.patientName`, `fu.phone`, `fu.followUpDate`, `fu.notes` with the actual variable/field names used in the component. Run `grep -n "\.map(" src/app/\(hospital\)/dues-followups/components/FollowUpsTab.tsx` to find the array variable name.

### LabBillingTab — Add mobile cards

- [ ] **Step 3: Wrap existing table and add card list in LabBillingTab.tsx**

Open `src/app/(hospital)/labs/components/LabBillingTab.tsx`. Find the `<Table` element. Wrap it and add:

```tsx
<>
  {/* Desktop table */}
  <div className="hidden md:block">
    {/* existing Table JSX unchanged */}
  </div>

  {/* Mobile card list */}
  <div className="md:hidden space-y-2 mt-2">
    {loading ? (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    ) : billings.length === 0 ? (
      <div className="py-12 text-center text-sm text-muted-foreground">No lab billing records</div>
    ) : (
      billings.map((bill) => (
        <div key={bill.id} className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{bill.patientName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{bill.testName}</p>
            </div>
            {/* render amount badge */}
            <span className="text-sm font-semibold text-foreground shrink-0">₹{bill.amount}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {bill.date && new Date(bill.date).toLocaleDateString("en-IN")}
          </div>
        </div>
      ))
    )}
  </div>
</>
```

**Note:** Replace `billings`, `bill.patientName`, `bill.testName`, `bill.amount`, `bill.date` with the actual variable/field names. Run `grep -n "\.map(" src/app/\(hospital\)/labs/components/LabBillingTab.tsx` to find array variable names.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(hospital\)/dues-followups/components/DuesFollowupsPage.tsx \
        src/app/\(hospital\)/dues-followups/components/FollowUpsTab.tsx \
        src/app/\(hospital\)/labs/components/LabBillingTab.tsx
git commit -m "feat(responsive): mobile cards for dues, followups, labs billing"
```

---

## Task 8: Analytics — Responsive Charts

**Files:**
- Modify: `src/app/(hospital)/analytics/components/AnalyticsPage.tsx`

Recharts `<BarChart>`, `<LineChart>`, `<PieChart>` etc. that have hard-coded `width={600}` or similar values need to be wrapped in `<ResponsiveContainer>`.

- [ ] **Step 1: Add ResponsiveContainer to recharts imports**

Find the recharts import in `AnalyticsPage.tsx`. Add `ResponsiveContainer` if not already present:
```tsx
import { ..., ResponsiveContainer } from "recharts"
```

- [ ] **Step 2: Wrap each chart in ResponsiveContainer**

For every chart component that has a fixed `width` prop, wrap it:

Before:
```tsx
<BarChart width={600} height={300} data={data}>
  ...
</BarChart>
```
After:
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    ...
  </BarChart>
</ResponsiveContainer>
```

Remove the `width` prop from the inner chart (it's controlled by the container). Keep `height`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/analytics/components/AnalyticsPage.tsx
git commit -m "feat(responsive): responsive recharts with ResponsiveContainer"
```

---

## Task 9: PatientRegistrationStepper — Responsive Form + Dialog

**Files:**
- Modify: `src/app/(hospital)/patients/components/PatientRegistrationStepper.tsx`

- [ ] **Step 1: Make the DialogContent full-screen on mobile**

Find the `<DialogContent` JSX in `PatientRegistrationStepper.tsx`. It will look something like:
```tsx
<DialogContent className="max-w-2xl ...">
```
Change to:
```tsx
<DialogContent className="max-w-full h-full rounded-none sm:max-w-2xl sm:h-auto sm:rounded-xl overflow-y-auto">
```

- [ ] **Step 2: Make the step indicator responsive**

Find the STEPS rendering. It likely renders step numbers/labels in a horizontal flex row. Add `hidden sm:flex` to the full step-label version and add a compact mobile indicator:

Before the existing step indicator (whatever JSX renders the step tabs), add a mobile-only step counter:
```tsx
{/* Mobile step counter — visible only on small screens */}
<div className="sm:hidden flex items-center justify-between px-1 mb-4">
  <span className="text-xs font-medium text-muted-foreground">
    Step {currentStep} of {STEPS.length}
  </span>
  <span className="text-xs font-semibold text-foreground">
    {STEPS.find(s => s.num === currentStep)?.label}
  </span>
</div>
{/* Hide the original step row on mobile */}
<div className="hidden sm:flex ...existing step row classes...">
  {/* existing step indicator JSX */}
</div>
```

Note: `currentStep` is the variable tracking current step. Check the component for the actual state variable name (may be `step` or `currentStep`).

- [ ] **Step 3: Make form field grids responsive**

Search the file for all `grid-cols-2` occurrences (there will be several for paired fields like name/phone, age/gender, etc.). Change each one:

From:
```tsx
<div className="grid grid-cols-2 gap-4">
```
To:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

Run this find to check count:
```bash
grep -n "grid-cols-2" src/app/\(hospital\)/patients/components/PatientRegistrationStepper.tsx
```

- [ ] **Step 4: Add text-base to all form inputs to prevent iOS zoom**

Search for `<Input` in the file. Each `<Input` should have `className` that includes `text-base` on mobile. The safest way is to add a global override in `globals.css` rather than touching every input:

In `src/app/globals.css`, add inside the `@layer base` block (or create one):
```css
@layer base {
  input, select, textarea {
    font-size: 16px; /* prevents iOS auto-zoom on focus */
  }
}
```

This applies globally — test on desktop to confirm it doesn't change desktop appearance (Tailwind's `text-sm` on specific inputs will still override this since it's more specific).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(hospital\)/patients/components/PatientRegistrationStepper.tsx src/app/globals.css
git commit -m "feat(responsive): mobile-friendly PatientRegistrationStepper dialog and form grids"
```

---

## Task 10: InPatient Wizard — Responsive Steps + Dialog

**Files:**
- Modify: `src/app/(hospital)/inpatients/components/InPatientAdmissionForm.tsx`
- Modify: `src/app/(hospital)/inpatients/components/Step1Patient.tsx`
- Modify: `src/app/(hospital)/inpatients/components/Step2Hospital.tsx`
- Modify: `src/app/(hospital)/inpatients/components/Step3Payment.tsx`

### InPatientAdmissionForm — Dialog + Step Indicator

- [ ] **Step 1: Make DialogContent full-screen on mobile**

In `InPatientAdmissionForm.tsx`, find `<DialogContent`. Change:
```tsx
<DialogContent className="max-w-2xl ...">
```
To:
```tsx
<DialogContent className="max-w-full h-full rounded-none sm:max-w-2xl sm:h-auto sm:rounded-xl overflow-y-auto">
```

- [ ] **Step 2: Make step indicator responsive**

Find the step tabs row (renders Step 1 / Step 2 / Step 3 labels). Add `hidden sm:flex` to the label row and add a mobile step counter above it:
```tsx
{/* Mobile step counter */}
<div className="sm:hidden flex items-center justify-between px-1 mb-4">
  <span className="text-xs font-medium text-muted-foreground">Step {step} of 3</span>
  <span className="text-xs font-semibold text-foreground">
    {step === 1 ? "Patient Info" : step === 2 ? "Hospital Details" : "Payment"}
  </span>
</div>
```

### Step1Patient — Responsive Grids

- [ ] **Step 3: Find and fix grid-cols-2 in Step1Patient.tsx**

```bash
grep -n "grid-cols-2" src/app/\(hospital\)/inpatients/components/Step1Patient.tsx
```

For each match, change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.

### Step2Hospital — Responsive Grids

- [ ] **Step 4: Find and fix grid-cols-2 in Step2Hospital.tsx**

```bash
grep -n "grid-cols-2" src/app/\(hospital\)/inpatients/components/Step2Hospital.tsx
```

For each match, change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.

### Step3Payment — Responsive Grids

- [ ] **Step 5: Find and fix grid-cols-2 in Step3Payment.tsx**

```bash
grep -n "grid-cols-2" src/app/\(hospital\)/inpatients/components/Step3Payment.tsx
```

For each match, change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(hospital\)/inpatients/components/InPatientAdmissionForm.tsx \
        src/app/\(hospital\)/inpatients/components/Step1Patient.tsx \
        src/app/\(hospital\)/inpatients/components/Step2Hospital.tsx \
        src/app/\(hospital\)/inpatients/components/Step3Payment.tsx
git commit -m "feat(responsive): mobile-friendly InPatient wizard dialog and form grids"
```

---

## Task 11: Optical + Insurance — Mobile Card Stacks

**Files:**
- Modify: `src/app/(hospital)/optical/components/BillingTab.tsx`
- Modify: `src/app/(hospital)/insurance/components/InsuranceClaimDetail.tsx`

### Optical BillingTab

- [ ] **Step 1: Apply card stack pattern to optical billing table**

Open `src/app/(hospital)/optical/components/BillingTab.tsx`. Find the `<Table>` element. Wrap it:

```tsx
<>
  {/* Desktop table */}
  <div className="hidden md:block">
    {/* existing Table JSX unchanged */}
  </div>

  {/* Mobile card list */}
  <div className="md:hidden space-y-2 mt-2">
    {items.length === 0 ? (
      <div className="py-12 text-center text-sm text-muted-foreground">No billing records</div>
    ) : (
      items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.patientName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.itemDescription}</p>
            </div>
            <span className="text-sm font-semibold shrink-0">₹{item.amount}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {item.date && new Date(item.date).toLocaleDateString("en-IN")}
          </div>
        </div>
      ))
    )}
  </div>
</>
```

**Note:** Replace `items`, `item.patientName`, `item.itemDescription`, `item.amount`, `item.date` with the actual variable/field names from the component.

### Insurance ClaimDetail — mobile-friendly claim list

- [ ] **Step 2: Wrap insurance claim table with card stack**

Open `src/app/(hospital)/insurance/components/InsuranceClaimDetail.tsx`. Apply the same `hidden md:block` + `md:hidden` card stack pattern. Cards should show: patient name, claim number, TPA/insurer, amount claimed, status badge.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/optical/components/BillingTab.tsx \
        src/app/\(hospital\)/insurance/components/InsuranceClaimDetail.tsx
git commit -m "feat(responsive): mobile card stacks for Optical and Insurance"
```

---

## Task 12: Final Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open Chrome DevTools → Device toolbar (Ctrl+Shift+M)**

Test at these viewport widths in sequence:
1. **375px** (iPhone SE) — smallest supported
2. **768px** (iPad portrait)
3. **1280px** (desktop)

- [ ] **Step 3: Check each viewport against this checklist**

At 375px:
- [ ] Hamburger button visible (top-left for sidebar mode, or in TopNavBar for top mode)
- [ ] Tapping hamburger opens the drawer
- [ ] All nav items are reachable from the drawer
- [ ] Dashboard shows 1-column grid
- [ ] Patient list shows cards, not a table
- [ ] InPatient list shows cards
- [ ] No horizontal page overflow (check `document.documentElement.scrollWidth === window.innerWidth` in console)
- [ ] PatientRegistrationStepper dialog is full-screen
- [ ] InPatient admission dialog is full-screen
- [ ] Form fields stack to one column

At 768px:
- [ ] Sidebar or top tabs visible (drawer not shown by default)
- [ ] Dashboard shows 2-column grid
- [ ] Tables visible (not cards)
- [ ] Forms show 2-column layout

At 1280px:
- [ ] Desktop layout identical to before all changes
- [ ] Dashboard shows 3-column grid
- [ ] All tables visible with all columns

- [ ] **Step 4: Fix any regressions found**

If any check fails, fix it before marking complete.
