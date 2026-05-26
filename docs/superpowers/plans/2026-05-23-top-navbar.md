# Top Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scrollable Chrome-style top navbar as a per-hospital alternative to the existing sidebar, toggled from Settings → Hospital Profile.

**Architecture:** `navStyle` is stored in `HospitalProfile.settings` JSON (no schema migration). `layout.tsx` reads it server-side and renders either `<Sidebar>` or `<TopNavBar>`. Both nav components share a single `nav-items.ts` source of truth for module links.

**Tech Stack:** Next.js 14 App Router, React Server/Client components, Supabase, shadcn/ui (DropdownMenu, Avatar, Button), Tailwind CSS, lucide-react icons.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `src/components/layout/nav-items.ts` |
| **Modify** | `src/components/layout/Sidebar.tsx` |
| **Create** | `src/components/layout/TopNavBar.tsx` |
| **Modify** | `src/app/(hospital)/layout.tsx` |
| **Modify** | `src/app/(hospital)/settings/actions.ts` |
| **Modify** | `src/app/(hospital)/settings/components/SettingsPage.tsx` |

---

### Task 1: Extract shared nav items

**Files:**
- Create: `src/components/layout/nav-items.ts`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `nav-items.ts` with the NavItem type and NAV_SECTIONS array**

Create `src/components/layout/nav-items.ts` with this exact content:

```typescript
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  ClipboardList,
  FlaskConical,
  FileBarChart,
  Wallet,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  BarChart3,
  UserCog,
  LayoutDashboard,
  Phone,
} from "lucide-react"

export type NavItem = {
  href: string
  icon: React.ElementType
  label: string
  exact?: boolean
  adminOnly?: boolean
  moduleCode?: string
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/patients", icon: Users, label: "Patients", moduleCode: "patients" },
      { href: "/workup", icon: Eye, label: "Refraction", moduleCode: "workup" },
      { href: "/doctor", icon: Stethoscope, label: "Doctor", moduleCode: "doctor" },
      { href: "/inpatients", icon: BedDouble, label: "In-Patients", moduleCode: "inpatients" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/pharmacy", icon: Pill, label: "Pharmacy", moduleCode: "pharmacy" },
      { href: "/optical", icon: Glasses, label: "Optical", moduleCode: "optical" },
      { href: "/labs", icon: FlaskConical, label: "Labs", moduleCode: "labs" },
      { href: "/call-logs", icon: Phone, label: "Call Logs", moduleCode: "call-logs" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/insurance", icon: Shield, label: "Insurance", moduleCode: "insurance" },
      { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups" },
      { href: "/expenses", icon: Wallet, label: "Expenses", moduleCode: "expenses" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Analytics", moduleCode: "analytics" },
      { href: "/reports", icon: FileBarChart, label: "Reports", moduleCode: "reports" },
      { href: "/data", icon: DatabaseZap, label: "Data Export" },
      { href: "/license-tracker", icon: ScrollText, label: "Licenses", moduleCode: "license-tracker" },
      { href: "/staff", icon: UserCog, label: "Staff", adminOnly: true },
    ],
  },
]
```

- [ ] **Step 2: Update `Sidebar.tsx` to import from `nav-items.ts`**

In `src/components/layout/Sidebar.tsx`:

Remove these lines from the top imports (the icon imports):
```typescript
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  Settings,
  LogOut,
  Hospital,
  ClipboardList,
  FlaskConical,
  FileBarChart,
  Wallet,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  BarChart3,
  UserCog,
  LayoutDashboard,
  Phone,
} from "lucide-react"
```

Replace with only the icons Sidebar still uses locally (Settings, LogOut, Hospital) plus the shared import:
```typescript
import { Settings, LogOut, Hospital } from "lucide-react"
import { NAV_SECTIONS } from "./nav-items"
import type { NavItem } from "./nav-items"
```

Remove the `type NavItem = { ... }` block (lines 33–40) and the `const NAV_SECTIONS` block (lines 42–85) entirely — they now live in `nav-items.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `Sidebar.tsx` or `nav-items.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav-items.ts src/components/layout/Sidebar.tsx
git commit -m "refactor(nav): extract NAV_SECTIONS and NavItem to shared nav-items.ts"
```

---

### Task 2: Add `updateNavStyle` server action

**Files:**
- Modify: `src/app/(hospital)/settings/actions.ts`

- [ ] **Step 1: Add `updateNavStyle` at the end of `actions.ts`**

Append this function to the end of `src/app/(hospital)/settings/actions.ts` (after `saveDefaultPrintConfig`):

```typescript
// ─── Nav Style ────────────────────────────────────────────────────────────────

export async function updateNavStyle(style: "side" | "top") {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { data: existing } = await supabase
      .from("HospitalProfile")
      .select("id, settings")
      .limit(1)
      .single()
    let base: Record<string, unknown> = {}
    if (existing?.settings) {
      try { base = JSON.parse(existing.settings) } catch { /* ignore */ }
    }
    base.navStyle = style
    const nextSettings = JSON.stringify(base)
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
    revalidatePath("/")
    return { success: true as const }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update navigation style"
    return { success: false as const, error: msg }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `settings/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/settings/actions.ts
git commit -m "feat(nav): add updateNavStyle server action"
```

---

### Task 3: Create `TopNavBar` component

**Files:**
- Create: `src/components/layout/TopNavBar.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/layout/TopNavBar.tsx` with this content:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, LogOut, Hospital, ChevronDown } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NAV_SECTIONS } from "./nav-items"

interface TopNavBarProps {
  user: { fullName: string; role: string }
  hospitalName: string
  enabledModules: string[]
}

export function TopNavBar({ user, hospitalName, enabledModules }: TopNavBarProps) {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  const allItems = NAV_SECTIONS.flatMap((s) => s.items).filter((item) => {
    if (item.adminOnly && user.role !== "ADMIN") return false
    if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
    return true
  })

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border/60 bg-background flex items-center shrink-0">
      {/* Hospital name */}
      <div className="flex items-center gap-2.5 px-4 shrink-0 border-r border-border/60 h-full">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Hospital className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-foreground truncate max-w-[140px]">
          {hospitalName}
        </span>
      </div>

      {/* Scrollable tab strip */}
      <nav className="flex-1 overflow-x-auto scrollbar-none flex items-stretch h-full">
        {allItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 text-[13px] font-medium whitespace-nowrap h-full border-b-2 transition-colors duration-150",
                active
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User dropdown */}
      <div className="shrink-0 px-3 border-l border-border/60 h-full flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] font-medium text-foreground hidden sm:block max-w-[100px] truncate">
                {user.fullName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="text-[13px] font-semibold text-foreground truncate">{user.fullName}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{user.role.toLowerCase()}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action="/api/logout" method="POST" className="w-full">
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full text-destructive focus:outline-none"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `TopNavBar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TopNavBar.tsx
git commit -m "feat(nav): add TopNavBar component with scrollable tab strip and user dropdown"
```

---

### Task 4: Update layout to conditionally render TopNavBar or Sidebar

**Files:**
- Modify: `src/app/(hospital)/layout.tsx`

- [ ] **Step 1: Replace the layout file content**

The current `src/app/(hospital)/layout.tsx` is:

```typescript
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { BillingBanner } from "@/components/layout/BillingBanner"
import { getSession } from "@/lib/auth"
import { getHospitalProfile } from "@/lib/db"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"
import { getAdminConfig, type AdminConfig } from "@/lib/admin-client"
import { routeModule, isModuleEnabled } from "@/lib/module-gate"
```

Replace the entire file with:

```typescript
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopNavBar } from "@/components/layout/TopNavBar"
import { BillingBanner } from "@/components/layout/BillingBanner"
import { getSession } from "@/lib/auth"
import { getHospitalProfile } from "@/lib/db"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"
import { getAdminConfig, type AdminConfig } from "@/lib/admin-client"
import { routeModule, isModuleEnabled } from "@/lib/module-gate"

export default async function HospitalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, { hospitalName, hospital }] = await Promise.all([
    getSession(),
    getHospitalProfile(),
  ])

  if (!user) redirect("/login")

  const h = await headers()
  const pathname =
    h.get("x-pathname") ?? h.get("x-invoke-path") ?? h.get("x-matched-path") ?? "/"

  let config: AdminConfig
  try {
    config = await getAdminConfig()
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Configuration unavailable</h1>
          <p className="text-sm text-slate-600">
            Could not reach the admin server. Try again in a moment, or contact support.
          </p>
        </div>
      </div>
    )
  }

  const mod = routeModule(pathname)
  if (mod && !isModuleEnabled(pathname, config.enabledModules)) {
    redirect(`/_module-disabled?module=${mod}`)
  }

  let navStyle: "side" | "top" = "side"
  if (hospital?.settings) {
    try {
      const parsed = JSON.parse(hospital.settings) as { navStyle?: unknown }
      if (parsed?.navStyle === "top") navStyle = "top"
    } catch {
      // ignore malformed JSON — default to sidebar
    }
  }

  const navProps = {
    user,
    hospitalName,
    enabledModules: config.enabledModules,
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <BillingBanner message={config.billing.bannerMessage} />
      {navStyle === "top" ? (
        <TopNavBar {...navProps} />
      ) : (
        <Sidebar {...navProps} />
      )}
      <main className="h-full overflow-y-auto flex-1">
        <div className="min-h-full px-4 pt-6 pb-8">{children}</div>
      </main>
      <InstallPrompt />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If you see `hospital` not in the return type of `getHospitalProfile`, check `src/lib/db.ts` — the cached function selects `*` from `HospitalProfile` and returns `{ hospital, hospitalName }`. The `hospital` field is the raw DB row with a `settings: string` field.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/layout.tsx
git commit -m "feat(nav): conditionally render TopNavBar or Sidebar based on navStyle setting"
```

---

### Task 5: Add nav style toggle to Settings UI

**Files:**
- Modify: `src/app/(hospital)/settings/components/SettingsPage.tsx`

This task edits the `HospitalProfileTab` component (around line 688). There are five changes: import, type, state, load, and UI.

- [ ] **Step 1: Add `updateNavStyle` to the import at the top of SettingsPage.tsx**

Find the line that imports `updateHospitalProfile` (around line 47–48):
```typescript
  getHospitalProfile,
  updateHospitalProfile,
```

Replace with:
```typescript
  getHospitalProfile,
  updateHospitalProfile,
  updateNavStyle,
```

- [ ] **Step 2: Add `settings` to the `HospitalProfile` type**

Find the `type HospitalProfile` block (around line 195–206):
```typescript
type HospitalProfile = {
  id: string
  name: string
  displayName: string | null
  ...
  registrationFeeEnabled?: boolean
  registrationFeeAmount?: number
  registrationFeeDefaultChecked?: boolean
}
```

Add `settings` as the last field inside the type:
```typescript
  settings?: string | null
```

- [ ] **Step 3: Add `navStyle` state to `HospitalProfileTab`**

Find the existing state declarations (around line 688–697):
```typescript
  const [regFeeEnabled, setRegFeeEnabled] = useState(false)
  const [regFeeAmount, setRegFeeAmount] = useState("")
  const [regFeeDefaultChecked, setRegFeeDefaultChecked] = useState(true)
```

Add below them:
```typescript
  const [navStyle, setNavStyle] = useState<"side" | "top">("side")
  const [navStyleSaving, setNavStyleSaving] = useState(false)
```

- [ ] **Step 4: Load `navStyle` from the hospital profile in the `useEffect`**

Find the `useEffect` that calls `getHospitalProfile()` (around line 699–716). Inside the `if (p)` block, after the last `setRegFeeDefaultChecked` line:
```typescript
        setRegFeeDefaultChecked(hp.registrationFeeDefaultChecked ?? true)
```

Add:
```typescript
        if (hp.settings) {
          try {
            const s = JSON.parse(hp.settings) as { navStyle?: unknown }
            if (s?.navStyle === "top") setNavStyle("top")
          } catch { /* ignore */ }
        }
```

- [ ] **Step 5: Add `handleNavStyleChange` function**

After the `handleSave` function (around line 736), add:
```typescript
  async function handleNavStyleChange(style: "side" | "top") {
    setNavStyle(style)
    setNavStyleSaving(true)
    const result = await updateNavStyle(style)
    setNavStyleSaving(false)
    if (result.success) toast.success("Navigation style updated — takes effect on next page load")
    else toast.error(result.error ?? "Failed to update navigation style")
  }
```

- [ ] **Step 6: Add the Navigation Style UI section**

Find the border divider just before the Save button (around line 821):
```typescript
        <div className="border-t border-border pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-9">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
```

Insert a new section *before* that div:
```tsx
        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Navigation Style</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Choose how the navigation is displayed across the app.</p>
          </div>
          <div className="flex items-center gap-0">
            <button
              type="button"
              disabled={navStyleSaving}
              onClick={() => handleNavStyleChange("side")}
              className={cn(
                "flex items-center gap-2 px-4 h-9 text-sm font-medium border transition-colors rounded-l-lg rounded-r-none focus:outline-none",
                navStyle === "side"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
              )}
            >
              Sidebar
            </button>
            <button
              type="button"
              disabled={navStyleSaving}
              onClick={() => handleNavStyleChange("top")}
              className={cn(
                "flex items-center gap-2 px-4 h-9 text-sm font-medium border-t border-b border-r transition-colors rounded-r-lg rounded-l-none focus:outline-none",
                navStyle === "top"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
              )}
            >
              Top Bar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Takes effect on next page load.</p>
        </div>
```

Note: `cn` is already imported in this file.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(hospital\)/settings/components/SettingsPage.tsx
git commit -m "feat(nav): add navigation style toggle to Hospital Profile settings"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npm run dev
```

- [ ] **Step 2: Verify sidebar mode (default)**

Open the app. The sidebar should behave exactly as before — no visual change. Verify it slides in on hover.

- [ ] **Step 3: Switch to Top Bar in Settings**

Go to Settings → Hospital Profile → scroll to "Navigation Style" → click "Top Bar". Toast confirms "Navigation style updated — takes effect on next page load."

- [ ] **Step 4: Reload and verify Top Bar appears**

Hard reload (`Cmd+Shift+R`). The sidebar must be gone. A sticky top bar must appear with hospital name on the left, scrollable tabs in the middle, and a user dropdown on the right. Active tab must be highlighted with a bottom border.

- [ ] **Step 5: Navigate between modules**

Click several tabs. Each should navigate correctly and highlight the active tab. Modules not in `enabledModules` must not appear.

- [ ] **Step 6: Test user dropdown**

Click the user avatar/name in the top-right. Dropdown must show user name, role, Settings link, and Logout button. Settings link navigates to `/settings`. Logout button fires the `POST /api/logout` form.

- [ ] **Step 7: Switch back to Sidebar in Settings**

In Settings → Hospital Profile → click "Sidebar". Reload. Sidebar must be back and Top Bar gone.
