# Analytics Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the analytics dashboard with better visual hierarchy, fix the broken revenueChange calculation, add collection rate / revenue-per-patient KPIs, and split the 982-line monolith into focused tab components.

**Architecture:** The monolithic `AnalyticsPage.tsx` is split into a thin shell + four tab components. Recharts stays (already installed v3.7.0). Tab names change: Trends→Patients, Financial→Revenue & Finance, Reports→Performance. A shared `analytics-shared.tsx` holds StatCard, ChartCard, CustomTooltip and formatters used across all tabs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Recharts 3.7, Tailwind v4, shadcn/ui

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/app/(hospital)/analytics/actions.ts` | Fix revenueChange; add collectionRate + revenuePerPatient fields |
| Modify | `src/app/(hospital)/analytics/page.tsx` | Remove timeSeries from SSR (not needed for overview) |
| Modify | `src/app/(hospital)/analytics/components/AnalyticsPage.tsx` | Thin shell: tab routing, filter bar, loadData, state |
| **Create** | `src/app/(hospital)/analytics/components/analytics-shared.tsx` | StatCard, ChartCard, CustomTooltip, fmt, fmtShort, COLORS |
| **Create** | `src/app/(hospital)/analytics/components/tabs/OverviewTab.tsx` | Overview tab content |
| **Create** | `src/app/(hospital)/analytics/components/tabs/PatientsTab.tsx` | Patients tab (was Trends) |
| **Create** | `src/app/(hospital)/analytics/components/tabs/RevenueTab.tsx` | Revenue & Finance tab (was Financial) |
| **Create** | `src/app/(hospital)/analytics/components/tabs/PerformanceTab.tsx` | Performance tab (was Reports) |

---

## Task 1: Fix actions.ts — revenueChange + new KPI fields

**Files:**
- Modify: `src/app/(hospital)/analytics/actions.ts:21-38` (AnalyticsOverview interface)
- Modify: `src/app/(hospital)/analytics/actions.ts:306-332` (getAnalyticsOverview return block)

### Current bug
`revenueChange` only compares current `totalRevenue` against `prevPrescriptionsTotal` (consultation only). It should compare against all revenue sources from the previous period.

- [ ] **Step 1: Add new fields to AnalyticsOverview interface**

In `actions.ts`, replace the `AnalyticsOverview` interface (lines 21-38) with:

```typescript
export interface AnalyticsOverview {
  totalPatients: number
  newPatientsToday: number
  totalRevenue: number
  totalCollected: number
  totalDues: number
  totalExpenses: number
  totalConsultationRevenue: number
  totalLabRevenue: number
  totalPharmacyRevenue: number
  totalOpticalRevenue: number
  totalInpatientRevenue: number
  totalInpatients: number
  activeInpatients: number
  totalSurgeries: number
  patientChange: number
  revenueChange: number
  collectionRate: number        // totalCollected / totalRevenue * 100
  revenuePerPatient: number     // totalRevenue / totalPatients
}
```

- [ ] **Step 2: Add prev-period revenue queries**

In `getAnalyticsOverview`, inside the `Promise.all([...])` block (around line 164), add two more parallel fetches for previous-period billing:

```typescript
// add to the Promise.all array:
// Previous period lab bills
supabase.from("LabBill").select("*")
  .gte("createdAt", prevFrom).lt("createdAt", prevTo)
  .returns<LabBillRow[]>(),
// Previous period pharmacy bills
supabase.from("PharmacyBill").select("*")
  .gte("billDate", prevFrom).lt("billDate", prevTo).neq("status", "CANCELLED")
  .returns<PharmacyBillRow[]>(),
// Previous period optical bills
supabase.from("OpticalBill").select("*")
  .gte("billDate", prevFrom).lt("billDate", prevTo).neq("status", "CANCELLED")
  .returns<OpticalBillRow[]>(),
// Previous period inpatient
supabase.from("InPatient").select("netAmount")
  .gte("admissionDate", prevFrom).lt("admissionDate", prevTo)
  .returns<Pick<InPatientRow, "netAmount">[]>(),
```

Destructure the extra results at the top of the function:

```typescript
const [
  totalPatientsRes, prevPatientsRes,
  prescriptionsData, prevPrescriptionsData,
  expensesData, labBillsData, pharmacyBillsData, opticalBillsData,
  totalInpatientsRes, activeInpatientsRes, surgeriesData, inpatientBillingData,
  prevLabBillsData, prevPharmacyBillsData, prevOpticalBillsData, prevInpatientData,
] = await Promise.all([...])
```

- [ ] **Step 3: Fix revenueChange + add new computed fields**

Replace the revenueChange calculation (around line 306) and the return block:

```typescript
const prevLabRevenue = (prevLabBillsData.data ?? []).reduce((s, r) => s + (r.total || 0), 0)
const prevPharmacyRevenue = (prevPharmacyBillsData.data ?? []).reduce((s, r) => s + (r.billAmount || 0), 0)
const prevOpticalRevenue = (prevOpticalBillsData.data ?? []).reduce((s, r) => s + (r.billAmount || 0), 0)
const prevInpatientRevenue = (prevInpatientData.data ?? []).reduce((s, r) => s + (r.netAmount || 0), 0)
const prevRevenue = prevPrescriptionsTotal + prevLabRevenue + prevPharmacyRevenue + prevOpticalRevenue + prevInpatientRevenue

const patientChange = prevPatients > 0
  ? Math.round(((totalPatients - prevPatients) / prevPatients) * 100)
  : 0
const revenueChange = prevRevenue > 0
  ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
  : 0
const collectionRate = totalRevenue > 0
  ? Math.round((totalCollected / totalRevenue) * 100)
  : 0
const revenuePerPatient = totalPatients > 0
  ? Math.round(totalRevenue / totalPatients)
  : 0

return {
  totalPatients,
  newPatientsToday: newPatientsToday ?? 0,
  totalRevenue,
  totalCollected,
  totalDues,
  totalExpenses: expensesTotal,
  totalConsultationRevenue: consultationRevenue,
  totalLabRevenue: labRevenue,
  totalPharmacyRevenue: pharmacyRevenue,
  totalOpticalRevenue: opticalRevenue,
  totalInpatientRevenue: inpatientRevenue,
  totalInpatients,
  activeInpatients,
  totalSurgeries: surgeries,
  patientChange,
  revenueChange,
  collectionRate,
  revenuePerPatient,
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors from actions.ts

---

## Task 2: Create shared component utilities

**Files:**
- Create: `src/app/(hospital)/analytics/components/analytics-shared.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/app/(hospital)/analytics/components/analytics-shared.tsx
"use client"

import React from "react"
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// ─── COLORS ──────────────────────────────────────────
export const CHART_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
]

export const SOURCE_COLORS: Record<string, string> = {
  Consultations: "#3b82f6",
  Labs:          "#14b8a6",
  Pharmacy:      "#10b981",
  Optical:       "#8b5cf6",
  "In-Patient":  "#f59e0b",
}

export const STATUS_COLORS: Record<string, string> = {
  REGISTERED:   "#94a3b8",
  IN_WORKUP:    "#f59e0b",
  WORKUP_DONE:  "#06b6d4",
  WITH_DOCTOR:  "#8b5cf6",
  VISITED:      "#3b82f6",
  COMPLETED:    "#10b981",
  MEDICAL_ONLY: "#14b8a6",
  MOVED:        "#6366f1",
  CANCELLED:    "#ef4444",
  NO_SHOW:      "#f43f5e",
}

// ─── FORMATTERS ──────────────────────────────────────
export const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

export const fmtShort = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

// ─── STAT CARD ───────────────────────────────────────
export function StatCard({
  title, value, change, icon, iconBg, iconColor, subtitle, trend,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  subtitle?: string
  trend?: React.ReactNode  // optional sparkline slot
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-200 border-border/50 shadow-sm bg-white">
      <CardContent className="px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums leading-none">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-[11px] font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span>{Math.abs(change)}% vs prev period</span>
              </div>
            )}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        {trend && <div className="mt-3">{trend}</div>}
      </CardContent>
    </Card>
  )
}

// ─── HERO STAT CARD ──────────────────────────────────
// Larger card for the top row of Overview — stands out more
export function HeroStatCard({
  title, value, change, icon, accentClass, subtitle,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  accentClass: string   // e.g. "text-emerald-600 bg-emerald-50"
  subtitle?: string
}) {
  const [iconColor, iconBg] = accentClass.split(" ")
  return (
    <Card className={`border-border/50 shadow-sm bg-white hover:shadow-md transition-all`}>
      <CardContent className="px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span>{Math.abs(change)}% from previous period</span>
              </div>
            )}
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          <div className={`h-12 w-12 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CHART CARD ──────────────────────────────────────
export function ChartCard({
  title, subtitle, action, children, className = "",
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`overflow-hidden border-border/50 shadow-sm bg-white ${className}`}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
        <div className="p-6">{children}</div>
      </CardContent>
    </Card>
  )
}

// ─── MINI SECTION HEADER ─────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</p>
  )
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────
export function CustomTooltip({ active, payload, label, currency = false }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  currency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-semibold text-foreground tabular-nums">
            {currency ? fmt(entry.value) : entry.value.toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────
export function EmptyState({ message = "No data available for this period" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{message}</div>
  )
}

// ─── PROGRESS BAR ROW ────────────────────────────────
export function ProgressRow({
  label, value, maxValue, displayValue, color = "#3b82f6", rank,
}: {
  label: string
  value: number
  maxValue: number
  displayValue: string
  color?: string
  rank?: number
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      {rank !== undefined && (
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-4 text-right shrink-0">{rank}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground truncate">{label}</span>
          <span className="text-xs font-semibold text-foreground ml-2 shrink-0 tabular-nums">{displayValue}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "analytics-shared" | head -10
```

Expected: no errors

---

## Task 3: Create OverviewTab

**Files:**
- Create: `src/app/(hospital)/analytics/components/tabs/OverviewTab.tsx`

The Overview tab shows 4 hero KPI cards, revenue breakdown donut + source bar, and demographics.

- [ ] **Step 1: Create OverviewTab.tsx**

```tsx
// src/app/(hospital)/analytics/components/tabs/OverviewTab.tsx
"use client"

import {
  Users, IndianRupee, TrendingUp, TrendingDown, BedDouble, Stethoscope,
  FlaskConical, Pill, Glasses, Wallet, CreditCard, Scissors, BadgePercent,
} from "lucide-react"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import {
  HeroStatCard, StatCard, ChartCard, SectionLabel,
  CustomTooltip, EmptyState, ProgressRow,
  fmt, fmtShort, CHART_COLORS, SOURCE_COLORS,
} from "../analytics-shared"
import type {
  AnalyticsOverview, GenderDistribution, AgeGroup,
  RevenueByCategory, ExpenseByCategory, StatusDistribution,
} from "../../actions"

interface Props {
  overview: AnalyticsOverview
  gender: GenderDistribution | null
  ageGroups: AgeGroup[]
  revenueByCategory: RevenueByCategory[]
  expenseBreakdown: ExpenseByCategory[]
  statusDist: StatusDistribution[]
}

export default function OverviewTab({ overview, gender, ageGroups, revenueByCategory, expenseBreakdown, statusDist }: Props) {
  const netCashFlow = overview.totalCollected - overview.totalExpenses

  // Revenue breakdown donut data (filter out zero sources)
  const donutData = revenueByCategory.filter(r => r.amount > 0)

  // Gender donut data
  const genderData = gender ? [
    { name: "Male",   value: gender.male,   color: "#3b82f6" },
    { name: "Female", value: gender.female, color: "#ec4899" },
    { name: "Other",  value: gender.other,  color: "#8b5cf6" },
  ].filter(d => d.value > 0) : []

  return (
    <div className="space-y-6">

      {/* ── Hero KPIs (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <HeroStatCard
          title="Total Revenue"
          value={fmt(overview.totalRevenue)}
          change={overview.revenueChange}
          icon={<IndianRupee className="h-5 w-5" />}
          accentClass="text-emerald-600 bg-emerald-50"
          subtitle={`${fmt(overview.totalConsultationRevenue)} consultation`}
        />
        <HeroStatCard
          title="Total Patients"
          value={overview.totalPatients.toLocaleString("en-IN")}
          change={overview.patientChange}
          icon={<Users className="h-5 w-5" />}
          accentClass="text-blue-600 bg-blue-50"
          subtitle={`${overview.newPatientsToday} registered today`}
        />
        <HeroStatCard
          title="Collection Rate"
          value={`${overview.collectionRate}%`}
          icon={<BadgePercent className="h-5 w-5" />}
          accentClass={overview.collectionRate >= 80 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}
          subtitle={`${fmt(overview.totalCollected)} collected of ${fmt(overview.totalRevenue)}`}
        />
        <HeroStatCard
          title="Net Cash Flow"
          value={fmt(netCashFlow)}
          icon={netCashFlow >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          accentClass={netCashFlow >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}
          subtitle={`${fmt(overview.totalExpenses)} expenses`}
        />
      </div>

      {/* ── Secondary metrics strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard title="Pending Dues"       value={fmt(overview.totalDues)}         icon={<CreditCard className="h-4 w-4" />} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard title="Revenue / Patient"  value={fmt(overview.revenuePerPatient)} icon={<IndianRupee className="h-4 w-4" />} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard title="Active In-Patients" value={overview.activeInpatients}        icon={<BedDouble className="h-4 w-4" />} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard title="Surgeries"          value={overview.totalSurgeries}          icon={<Scissors className="h-4 w-4" />} iconBg="bg-rose-50" iconColor="text-rose-600" />
        <StatCard title="Total Expenses"     value={fmt(overview.totalExpenses)}      icon={<Wallet className="h-4 w-4" />} iconBg="bg-red-50" iconColor="text-red-500" />
        <StatCard title="Total In-Patients"  value={overview.totalInpatients}         icon={<Stethoscope className="h-4 w-4" />} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
      </div>

      {/* ── Revenue source cards ── */}
      <div>
        <SectionLabel>Revenue by Department</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { title: "Consultation", value: overview.totalConsultationRevenue, icon: <Stethoscope className="h-4 w-4" />, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
            { title: "Labs",         value: overview.totalLabRevenue,          icon: <FlaskConical className="h-4 w-4" />, iconBg: "bg-teal-50",  iconColor: "text-teal-500" },
            { title: "Pharmacy",     value: overview.totalPharmacyRevenue,     icon: <Pill className="h-4 w-4" />,         iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
            { title: "Optical",      value: overview.totalOpticalRevenue,      icon: <Glasses className="h-4 w-4" />,      iconBg: "bg-purple-50",  iconColor: "text-purple-500" },
            { title: "In-Patient",   value: overview.totalInpatientRevenue,    icon: <BedDouble className="h-4 w-4" />,    iconBg: "bg-amber-50",   iconColor: "text-amber-500" },
          ].map((card) => (
            <StatCard key={card.title} {...card} value={fmt(card.value)} />
          ))}
        </div>
      </div>

      {/* ── Charts row: Revenue donut + Age bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue donut with legend */}
        <ChartCard title="Revenue Mix" subtitle="Breakdown by department">
          {donutData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      dataKey="amount" nameKey="category"
                      paddingAngle={3} strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.category} fill={SOURCE_COLORS[entry.category] ?? CHART_COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip currency />} cursor={false} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {donutData.map((entry) => {
                  const pct = overview.totalRevenue > 0 ? ((entry.amount / overview.totalRevenue) * 100).toFixed(1) : "0"
                  return (
                    <div key={entry.category} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[entry.category] ?? CHART_COLORS[0] }} />
                        <span className="text-xs text-muted-foreground truncate">{entry.category}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold text-foreground tabular-nums">{fmt(entry.amount)}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        {/* Age distribution bar */}
        <ChartCard title="Patients by Age Group" subtitle="Distribution across age bands">
          {ageGroups.some(g => g.count > 0) ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageGroups} barCategoryGap="20%">
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  <Bar dataKey="count" name="Patients" fill="#93b5f7" radius={[5, 5, 5, 5]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* ── Gender + Expense + Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Gender donut */}
        <ChartCard title="Gender Distribution">
          {genderData.length > 0 ? (
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={76}
                    dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                    {genderData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        {/* Expense breakdown */}
        <ChartCard title="Expense Breakdown">
          {expenseBreakdown.length > 0 ? (
            <div className="space-y-3">
              {expenseBreakdown.slice(0, 5).map((e, i) => {
                const max = expenseBreakdown[0]?.amount ?? 1
                return (
                  <ProgressRow
                    key={e.category}
                    label={e.category}
                    value={e.amount}
                    maxValue={max}
                    displayValue={fmt(e.amount)}
                    color={e.color || CHART_COLORS[i % CHART_COLORS.length]}
                  />
                )
              })}
            </div>
          ) : <EmptyState />}
        </ChartCard>

        {/* Patient status breakdown */}
        <ChartCard title="Patient Status">
          {statusDist.length > 0 ? (
            <div className="space-y-3">
              {statusDist.sort((a, b) => b.count - a.count).slice(0, 6).map((s, i) => {
                const total = statusDist.reduce((sum, d) => sum + d.count, 0)
                const STATUS_COLORS_MAP: Record<string, string> = {
                  REGISTERED: "#94a3b8", IN_WORKUP: "#f59e0b", WORKUP_DONE: "#06b6d4",
                  WITH_DOCTOR: "#8b5cf6", VISITED: "#3b82f6", COMPLETED: "#10b981",
                  MEDICAL_ONLY: "#14b8a6", MOVED: "#6366f1", CANCELLED: "#ef4444", NO_SHOW: "#f43f5e",
                }
                return (
                  <ProgressRow
                    key={s.status}
                    label={s.status.replace(/_/g, " ")}
                    value={s.count}
                    maxValue={total}
                    displayValue={s.count.toString()}
                    color={STATUS_COLORS_MAP[s.status] ?? CHART_COLORS[i % CHART_COLORS.length]}
                  />
                )
              })}
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "OverviewTab" | head -10
```

Expected: no errors

---

## Task 4: Create PatientsTab (was Trends)

**Files:**
- Create: `src/app/(hospital)/analytics/components/tabs/PatientsTab.tsx`

Shows daily volume area chart, referral sources, and demographics.

- [ ] **Step 1: Create PatientsTab.tsx**

```tsx
// src/app/(hospital)/analytics/components/tabs/PatientsTab.tsx
"use client"

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  ChartCard, CustomTooltip, EmptyState, ProgressRow,
  CHART_COLORS, STATUS_COLORS,
} from "../analytics-shared"
import type { TimeSeriesPoint, AgeGroup, GenderDistribution, StatusDistribution } from "../../actions"
import { PieChart, Pie, Cell } from "recharts"

interface Props {
  timeSeries: TimeSeriesPoint[]
  ageGroups: AgeGroup[]
  gender: GenderDistribution | null
  statusDist: StatusDistribution[]
  referrals: { name: string; count: number }[]
}

export default function PatientsTab({ timeSeries, ageGroups, gender, statusDist, referrals }: Props) {
  const genderData = gender ? [
    { name: "Male",   value: gender.male,   color: "#3b82f6" },
    { name: "Female", value: gender.female, color: "#ec4899" },
    { name: "Other",  value: gender.other,  color: "#8b5cf6" },
  ].filter(d => d.value > 0) : []

  const statusTotal = statusDist.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-6">

      {/* Daily patient volume area chart */}
      <ChartCard title="Daily Patient Volume" subtitle="Number of patients registered per day">
        {timeSeries.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradPatients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Area type="monotone" dataKey="patients" name="Patients"
                  stroke="#3b82f6" fill="url(#gradPatients)" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState />}
      </ChartCard>

      {/* Status distribution + referrals side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Patient status breakdown horizontal bars */}
        <ChartCard title="Patient Status Breakdown" subtitle="OPD workflow stages">
          {statusDist.length > 0 ? (
            <div className="space-y-3">
              {statusDist.sort((a, b) => b.count - a.count).map((s, i) => (
                <ProgressRow
                  key={s.status}
                  label={s.status.replace(/_/g, " ")}
                  value={s.count}
                  maxValue={statusTotal}
                  displayValue={`${s.count} (${statusTotal > 0 ? ((s.count / statusTotal) * 100).toFixed(0) : 0}%)`}
                  color={STATUS_COLORS[s.status] ?? CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </div>
          ) : <EmptyState />}
        </ChartCard>

        {/* Top referral sources */}
        <ChartCard title="Top Referral Sources" subtitle="Where patients come from">
          {referrals.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={referrals.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  <Bar dataKey="count" name="Patients" fill="#b4a7f5" radius={[0, 5, 5, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState message="No referral data for this period" />}
        </ChartCard>
      </div>

      {/* Demographics: Age + Gender */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Age Distribution" subtitle="Patients by age band">
          {ageGroups.some(g => g.count > 0) ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageGroups} barCategoryGap="20%">
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  <Bar dataKey="count" name="Patients" fill="#93c5fd" radius={[5, 5, 5, 5]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Gender Distribution">
          {genderData.length > 0 ? (
            <div className="h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={82}
                    dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                    {genderData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "PatientsTab" | head -10
```

Expected: no errors

---

## Task 5: Create RevenueTab (was Financial)

**Files:**
- Create: `src/app/(hospital)/analytics/components/tabs/RevenueTab.tsx`

Shows revenue vs expenses area chart, 5 summary cards, daily ledger table, expense donut.

- [ ] **Step 1: Create RevenueTab.tsx**

```tsx
// src/app/(hospital)/analytics/components/tabs/RevenueTab.tsx
"use client"

import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  IndianRupee, Wallet, Receipt, BadgePercent, TrendingUp, TrendingDown,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartCard, CustomTooltip, EmptyState, fmt, fmtShort, CHART_COLORS,
} from "../analytics-shared"
import type { FinancialSummary, ExpenseByCategory, TimeSeriesPoint } from "../../actions"

interface Props {
  financial: FinancialSummary | null
  expenseBreakdown: ExpenseByCategory[]
  timeSeries: TimeSeriesPoint[]
}

export default function RevenueTab({ financial, expenseBreakdown, timeSeries }: Props) {
  if (!financial) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading financial data...
      </div>
    )
  }

  const netCashFlow = financial.netCashFlow
  const collectionRate = financial.totalBilled > 0
    ? Math.round((financial.totalCollected / financial.totalBilled) * 100)
    : 0

  const summaryCards = [
    { title: "Total Billed",   value: financial.totalBilled,     icon: <Receipt className="h-4 w-4" />,      bg: "bg-blue-50",    color: "text-blue-600",    desc: "All revenue billed" },
    { title: "Collected",      value: financial.totalCollected,  icon: <IndianRupee className="h-4 w-4" />,  bg: "bg-emerald-50", color: "text-emerald-600", desc: "Cash received" },
    { title: "Discounts",      value: financial.totalDiscount,   icon: <BadgePercent className="h-4 w-4" />, bg: "bg-orange-50",  color: "text-orange-600",  desc: "Total concessions" },
    { title: "Pending Dues",   value: financial.totalDues,       icon: <Receipt className="h-4 w-4" />,      bg: "bg-amber-50",   color: "text-amber-600",   desc: "Outstanding" },
    { title: "Total Expenses", value: financial.totalExpenses,   icon: <Wallet className="h-4 w-4" />,       bg: "bg-red-50",     color: "text-red-600",     desc: "Operational costs" },
  ]

  return (
    <div className="space-y-6">

      {/* Net cash flow highlight */}
      <Card className={`border-2 ${netCashFlow >= 0 ? "border-emerald-200 bg-emerald-50/30" : "border-red-200 bg-red-50/30"}`}>
        <CardContent className="px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Cash Flow</p>
            <p className={`text-4xl font-bold mt-1.5 tabular-nums ${netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(netCashFlow)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Collection rate: <span className="font-semibold text-foreground">{collectionRate}%</span>
              {" · "}Collected {fmt(financial.totalCollected)} of {fmt(financial.totalBilled)} billed
            </p>
          </div>
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${netCashFlow >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
            {netCashFlow >= 0
              ? <TrendingUp className="h-7 w-7 text-emerald-600" />
              : <TrendingDown className="h-7 w-7 text-red-600" />
            }
          </div>
        </CardContent>
      </Card>

      {/* 5 summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.title} className="border-border/50 shadow-sm hover:shadow-md transition-all">
            <CardContent className="px-4 py-4">
              <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <div className={card.color}>{card.icon}</div>
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{card.title}</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${card.color}`}>{fmt(card.value)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue vs Expenses area chart (from timeSeries) */}
      <ChartCard title="Revenue vs Expenses Trend" subtitle="Daily collected amount vs expenses">
        {timeSeries.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtShort} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip currency />} cursor={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                <Area type="monotone" dataKey="collected" name="Collected"
                  stroke="#10b981" fill="url(#gradCollected)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses"
                  stroke="#ef4444" fill="url(#gradExpenses)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState />}
      </ChartCard>

      {/* Expense breakdown donut */}
      {expenseBreakdown.length > 0 && (
        <ChartCard title="Expense Breakdown" subtitle="By category">
          <div className="flex items-center gap-6">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%"
                    innerRadius={50} outerRadius={76}
                    dataKey="amount" nameKey="category"
                    paddingAngle={3} strokeWidth={0}>
                    {expenseBreakdown.map((entry, i) => (
                      <Cell key={entry.category} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip currency />} cursor={false} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {expenseBreakdown.map((e, i) => {
                const total = expenseBreakdown.reduce((s, x) => s + x.amount, 0)
                const pct = total > 0 ? ((e.amount / total) * 100).toFixed(1) : "0"
                return (
                  <div key={e.category} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color || CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-muted-foreground truncate">{e.category}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-foreground tabular-nums">{fmt(e.amount)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ChartCard>
      )}

      {/* Daily ledger table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground">Daily Ledger</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Day-by-day financial breakdown (most recent first)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  {["Date", "Billed", "Collected", "Expenses", "Net", "Discount", "Dues"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {financial.dailyBreakdown.length > 0 ? financial.dailyBreakdown.map((day) => {
                  const net = day.collected - day.expenses
                  return (
                    <tr key={day.date} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground tabular-nums">{day.date}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(day.billed)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium tabular-nums">{fmt(day.collected)}</td>
                      <td className="px-4 py-3 text-right text-red-500 tabular-nums">{fmt(day.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(net)}</td>
                      <td className="px-4 py-3 text-right text-orange-500 tabular-nums">{fmt(day.discount)}</td>
                      <td className="px-4 py-3 text-right text-amber-500 tabular-nums">{fmt(day.dues)}</td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No data for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "RevenueTab" | head -10
```

Expected: no errors

---

## Task 6: Create PerformanceTab (was Reports)

**Files:**
- Create: `src/app/(hospital)/analytics/components/tabs/PerformanceTab.tsx`

Shows doctor performance bars + table, top services bar chart, referral table.

- [ ] **Step 1: Create PerformanceTab.tsx**

```tsx
// src/app/(hospital)/analytics/components/tabs/PerformanceTab.tsx
"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Stethoscope, Scissors } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartCard, CustomTooltip, EmptyState, ProgressRow,
  fmt, fmtShort, CHART_COLORS,
} from "../analytics-shared"
import type { TopService, DoctorPerformance } from "../../actions"

interface Props {
  topServices: TopService[]
  doctorPerf: DoctorPerformance[]
  referrals: { name: string; count: number }[]
  totalSurgeries: number
}

export default function PerformanceTab({ topServices, doctorPerf, referrals, totalSurgeries }: Props) {
  const maxDoctorPatients = doctorPerf[0]?.patients ?? 1
  const maxServiceRevenue = topServices[0]?.revenue ?? 1

  return (
    <div className="space-y-6">

      {/* Surgeries highlight chip */}
      {totalSurgeries > 0 && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-700">
          <Scissors className="h-4 w-4" />
          {totalSurgeries} surgeries performed this period
        </div>
      )}

      {/* Doctor performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Doctor Performance" subtitle="Patients seen — ranked">
          {doctorPerf.length > 0 ? (
            <div className="space-y-4">
              {doctorPerf.slice(0, 8).map((doc, i) => (
                <div key={doc.name} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <ProgressRow
                    label={doc.name}
                    value={doc.patients}
                    maxValue={maxDoctorPatients}
                    displayValue={`${doc.patients} pts`}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                  <span className="text-xs font-semibold text-foreground shrink-0 w-20 text-right tabular-nums">
                    {fmt(doc.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : <EmptyState />}
        </ChartCard>

        {/* Top services bar chart */}
        <ChartCard title="Top Services by Revenue">
          {topServices.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServices.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtShort} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<CustomTooltip currency />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#93b5f7" radius={[0, 5, 5, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* Doctor full table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground">Doctor Performance Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Doctor</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Patients</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Avg / Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {doctorPerf.length > 0 ? doctorPerf.map((d) => (
                  <tr key={d.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        </div>
                        {d.name}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{d.patients}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmt(d.revenue)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{fmt(d.patients > 0 ? d.revenue / d.patients : 0)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top services table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground">Top Services</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Service</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Count</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Avg / Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {topServices.length > 0 ? topServices.map((s, i) => (
                  <tr key={s.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.count}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmt(s.revenue)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{fmt(s.count > 0 ? s.revenue / s.count : 0)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Referral sources */}
      {referrals.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">Referral Sources</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/10">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Referred By</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Patients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {referrals.map((r, i) => (
                    <tr key={r.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{r.name}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "PerformanceTab" | head -10
```

Expected: no errors

---

## Task 7: Rewrite AnalyticsPage.tsx shell + update page.tsx

**Files:**
- Modify: `src/app/(hospital)/analytics/components/AnalyticsPage.tsx` (full rewrite)
- Modify: `src/app/(hospital)/analytics/page.tsx` (remove timeSeries from SSR)

The shell is now thin: filter bar, tab bar, state management, loadData, tab routing.
New tab names: Overview | Patients | Revenue & Finance | Performance | Calls

- [ ] **Step 1: Rewrite AnalyticsPage.tsx**

Replace the entire file with:

```tsx
// src/app/(hospital)/analytics/components/AnalyticsPage.tsx
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format } from "date-fns"
import {
  type TimeFilter, type AnalyticsOverview, type GenderDistribution,
  type AgeGroup, type RevenueByCategory, type TimeSeriesPoint,
  type TopService, type ExpenseByCategory, type FinancialSummary,
  type DoctorPerformance, type StatusDistribution,
  getAnalyticsOverview, getGenderDistribution, getAgeDistribution,
  getRevenueByCategory, getTimeSeries, getTopServices,
  getExpenseBreakdown, getFinancialSummary, getDoctorPerformance,
  getStatusDistribution, getReferralStats,
} from "../actions"
import OverviewTab    from "./tabs/OverviewTab"
import PatientsTab   from "./tabs/PatientsTab"
import RevenueTab    from "./tabs/RevenueTab"
import PerformanceTab from "./tabs/PerformanceTab"
import CallAnalyticsTab from "../../call-logs/components/CallAnalyticsTab"

// ─── TABS ────────────────────────────────────────────

type Tab = "overview" | "patients" | "revenue" | "performance" | "calls"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview",     label: "Overview" },
  { key: "patients",     label: "Patients" },
  { key: "revenue",      label: "Revenue & Finance" },
  { key: "performance",  label: "Performance" },
  { key: "calls",        label: "Calls" },
]

// ─── COMPONENT ───────────────────────────────────────

export default function AnalyticsPage({
  initialOverview,
  initialGender,
  initialAgeGroups,
  initialRevenueByCategory,
  initialExpenseBreakdown,
  initialStatusDist,
}: {
  initialOverview: AnalyticsOverview | null
  initialGender: GenderDistribution | null
  initialAgeGroups: AgeGroup[]
  initialRevenueByCategory: RevenueByCategory[]
  initialExpenseBreakdown: ExpenseByCategory[]
  initialStatusDist: StatusDistribution[]
}) {
  const [tab, setTab]       = useState<Tab>("overview")
  const [filter, setFilter] = useState<TimeFilter>("month")
  const [customRange, setCustomRange] = useState({ start: "", end: "" })
  const [loading, setLoading] = useState(false)

  // Data states
  const [overview, setOverview]               = useState<AnalyticsOverview | null>(initialOverview)
  const [gender, setGender]                   = useState<GenderDistribution | null>(initialGender)
  const [ageGroups, setAgeGroups]             = useState<AgeGroup[]>(initialAgeGroups)
  const [revenueByCategory, setRevenueByCat]  = useState<RevenueByCategory[]>(initialRevenueByCategory)
  const [timeSeries, setTimeSeries]           = useState<TimeSeriesPoint[]>([])
  const [topServices, setTopServices]         = useState<TopService[]>([])
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseByCategory[]>(initialExpenseBreakdown)
  const [financial, setFinancial]             = useState<FinancialSummary | null>(null)
  const [doctorPerf, setDoctorPerf]           = useState<DoctorPerformance[]>([])
  const [statusDist, setStatusDist]           = useState<StatusDistribution[]>(initialStatusDist)
  const [referrals, setReferrals]             = useState<{ name: string; count: number }[]>([])

  // Calls tab date range
  const callDateRange = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, "yyyy-MM-dd")
    if (filter === "today")  return { startDate: todayStr, endDate: todayStr }
    if (filter === "week")   { const d = new Date(today); d.setDate(d.getDate() - 7); return { startDate: format(d, "yyyy-MM-dd"), endDate: todayStr } }
    if (filter === "month")  { const d = new Date(today); d.setDate(d.getDate() - 30); return { startDate: format(d, "yyyy-MM-dd"), endDate: todayStr } }
    if (filter === "year")   { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return { startDate: format(d, "yyyy-MM-dd"), endDate: todayStr } }
    return { startDate: customRange.start || todayStr, endDate: customRange.end || todayStr }
  }, [filter, customRange])

  const loadData = useCallback(async () => {
    if (tab === "calls") return
    setLoading(true)
    try {
      const args: [TimeFilter, string?, string?] = [filter]
      if (filter === "custom") args.push(customRange.start, customRange.end)

      if (tab === "overview") {
        const [o, g, a, r, e, s] = await Promise.all([
          getAnalyticsOverview(...args),
          getGenderDistribution(...args),
          getAgeDistribution(...args),
          getRevenueByCategory(...args),
          getExpenseBreakdown(...args),
          getStatusDistribution(...args),
        ])
        setOverview(o); setGender(g); setAgeGroups(a); setRevenueByCat(r); setExpenseBreakdown(e); setStatusDist(s)
      } else if (tab === "patients") {
        const [ts, g, a, s, ref] = await Promise.all([
          getTimeSeries(...args),
          getGenderDistribution(...args),
          getAgeDistribution(...args),
          getStatusDistribution(...args),
          getReferralStats(...args),
        ])
        setTimeSeries(ts); setGender(g); setAgeGroups(a); setStatusDist(s); setReferrals(ref)
      } else if (tab === "revenue") {
        const [f, e, ts] = await Promise.all([
          getFinancialSummary(...args),
          getExpenseBreakdown(...args),
          getTimeSeries(...args),
        ])
        setFinancial(f); setExpenseBreakdown(e); setTimeSeries(ts)
      } else if (tab === "performance") {
        const [top, dr, ref] = await Promise.all([
          getTopServices(...args),
          getDoctorPerformance(...args),
          getReferralStats(...args),
        ])
        setTopServices(top); setDoctorPerf(dr); setReferrals(ref)
      }
    } catch (err) {
      console.error("Analytics load error:", err)
    } finally {
      setLoading(false)
    }
  }, [tab, filter, customRange])

  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    loadData()
  }, [loadData])

  return (
    <div className="min-h-screen -mx-4 -mt-6">

      {/* Sticky header */}
      <div className="bg-white border-b border-border/60 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Analytics</h1>

          {/* Filter pills */}
          <div className="flex items-center gap-2">
            <div className="bg-muted/50 border border-border/40 rounded-full p-0.5 flex">
              {(["today", "week", "month", "year", "custom"] as TimeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-150 ${
                    filter === f ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "week" ? "Week" : f === "month" ? "Month" : f === "year" ? "Year" : f === "custom" ? "Custom" : "Today"}
                </button>
              ))}
            </div>

            {filter === "custom" && (
              <div className="flex items-center gap-2">
                <input type="date" value={customRange.start}
                  onChange={(e) => setCustomRange(p => ({ ...p, start: e.target.value }))}
                  className="px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <span className="text-xs text-muted-foreground">to</span>
                <input type="date" value={customRange.end}
                  onChange={(e) => setCustomRange(p => ({ ...p, end: e.target.value }))}
                  className="px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky tab bar */}
      <div className="bg-white border-b border-border/40 px-6 sticky top-[61px] z-10">
        <div className="max-w-[1320px] mx-auto flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-150 ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pt-6 pb-12">
        <div className="max-w-[1320px] mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-9 w-9 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="mt-4 text-sm text-muted-foreground">Loading analytics...</p>
            </div>
          ) : (
            <>
              {tab === "overview" && overview && (
                <OverviewTab
                  overview={overview}
                  gender={gender}
                  ageGroups={ageGroups}
                  revenueByCategory={revenueByCategory}
                  expenseBreakdown={expenseBreakdown}
                  statusDist={statusDist}
                />
              )}
              {tab === "patients" && (
                <PatientsTab
                  timeSeries={timeSeries}
                  ageGroups={ageGroups}
                  gender={gender}
                  statusDist={statusDist}
                  referrals={referrals}
                />
              )}
              {tab === "revenue" && (
                <RevenueTab
                  financial={financial}
                  expenseBreakdown={expenseBreakdown}
                  timeSeries={timeSeries}
                />
              )}
              {tab === "performance" && (
                <PerformanceTab
                  topServices={topServices}
                  doctorPerf={doctorPerf}
                  referrals={referrals}
                  totalSurgeries={overview?.totalSurgeries ?? 0}
                />
              )}
              {tab === "calls" && (
                <CallAnalyticsTab startDate={callDateRange.startDate} endDate={callDateRange.endDate} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update page.tsx — remove timeSeries from SSR (not needed for Overview)**

Replace `src/app/(hospital)/analytics/page.tsx` with:

```tsx
import AnalyticsPage from "./components/AnalyticsPage"
import {
  getAnalyticsOverview,
  getGenderDistribution,
  getAgeDistribution,
  getRevenueByCategory,
  getExpenseBreakdown,
  getStatusDistribution,
} from "./actions"

export default async function AnalyticsRoute() {
  const [overview, gender, ageGroups, revenueByCategory, expenseBreakdown, statusDist] =
    await Promise.all([
      getAnalyticsOverview("month"),
      getGenderDistribution("month"),
      getAgeDistribution("month"),
      getRevenueByCategory("month"),
      getExpenseBreakdown("month"),
      getStatusDistribution("month"),
    ])

  return (
    <AnalyticsPage
      initialOverview={overview}
      initialGender={gender}
      initialAgeGroups={ageGroups}
      initialRevenueByCategory={revenueByCategory}
      initialExpenseBreakdown={expenseBreakdown}
      initialStatusDist={statusDist}
    />
  )
}
```

- [ ] **Step 3: Full typecheck**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors

- [ ] **Step 4: ESLint on all changed files**

```bash
npx eslint \
  src/app/\(hospital\)/analytics/actions.ts \
  src/app/\(hospital\)/analytics/page.tsx \
  src/app/\(hospital\)/analytics/components/AnalyticsPage.tsx \
  src/app/\(hospital\)/analytics/components/analytics-shared.tsx \
  src/app/\(hospital\)/analytics/components/tabs/OverviewTab.tsx \
  src/app/\(hospital\)/analytics/components/tabs/PatientsTab.tsx \
  src/app/\(hospital\)/analytics/components/tabs/RevenueTab.tsx \
  src/app/\(hospital\)/analytics/components/tabs/PerformanceTab.tsx \
  --max-warnings 5 2>&1 | tail -20
```

Expected: only pre-existing warnings (react-hooks/exhaustive-deps), no new errors

---

## Self-Review

### Spec coverage check
- ✅ Hero KPI row with Revenue + Patients + Collection Rate + Net Cash Flow → OverviewTab
- ✅ Revenue breakdown donut + legend → OverviewTab
- ✅ Fix revenueChange to use all sources → Task 1
- ✅ Add collectionRate KPI → actions.ts + OverviewTab
- ✅ Add revenuePerPatient KPI → actions.ts + OverviewTab  
- ✅ Add surgeries count display → PerformanceTab
- ✅ Patients tab: daily volume area + referrals horizontal bar + demographics → PatientsTab
- ✅ Revenue tab: area chart + daily ledger + expense donut → RevenueTab
- ✅ Performance tab: doctor horizontal bars + top services bar chart → PerformanceTab
- ✅ 5 tabs kept (Overview, Patients, Revenue & Finance, Performance, Calls) → AnalyticsPage
- ✅ Calls tab unchanged

### Type consistency check
- `AnalyticsOverview.collectionRate: number` — defined in Task 1, used in OverviewTab ✅
- `AnalyticsOverview.revenuePerPatient: number` — defined in Task 1, used in OverviewTab ✅
- `AnalyticsOverview.totalSurgeries` — already existed, passed to PerformanceTab ✅
- `ProgressRow` props: `label, value, maxValue, displayValue, color, rank` — consistent across OverviewTab, PatientsTab, PerformanceTab ✅
- `HeroStatCard` props: `accentClass` split on space → `[iconColor, iconBg]` — both always two classes ✅
- `ChartCard` subtitle prop optional ✅

### Placeholder scan
- No TBD, TODO, or "similar to Task N" patterns ✅
- All code blocks complete ✅
- All file paths exact ✅
