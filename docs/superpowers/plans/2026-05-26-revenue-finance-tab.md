# Revenue & Finance Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Revenue & Finance analytics tab to show KPI cards, trend chart, revenue mix donut, module-wise collection bars, payment mode breakdown donut, expense donut, discount breakdown, and a downloadable daily ledger.

**Architecture:** Extend `FinancialSummary` with per-module discount fields, add a new `getPaymentModeBreakdown` server action, fetch `revenueByCategory` in the revenue tab, then rewrite `RevenueTab.tsx` to match the approved mockup.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Recharts, Supabase

---

## File Map

| File | Change |
|---|---|
| `src/app/(hospital)/analytics/actions.ts` | Add `PaymentModeBreakdown` interface + `getPaymentModeBreakdown`, extend `FinancialSummary` with `discountByModule`, update `getFinancialSummary` to populate it |
| `src/app/(hospital)/analytics/components/AnalyticsPage.tsx` | Add `paymentModes` state, fetch `getRevenueByCategory` + `getPaymentModeBreakdown` in revenue tab, pass new props to `RevenueTab` |
| `src/app/(hospital)/analytics/components/tabs/RevenueTab.tsx` | Full rewrite matching approved mockup |

---

## Task 1: Extend FinancialSummary with per-module discounts

**Files:**
- Modify: `src/app/(hospital)/analytics/actions.ts`

- [ ] **Step 1: Add `discountByModule` to the `FinancialSummary` interface**

In `actions.ts`, locate the `FinancialSummary` interface (line ~90) and replace it with:

```typescript
export interface FinancialSummary {
  totalBilled: number
  totalCollected: number
  totalDiscount: number
  totalDues: number
  totalExpenses: number
  netCashFlow: number
  dailyBreakdown: DailyFinancial[]
  discountByModule: {
    consultations: number
    labs: number
    pharmacy: number
    optical: number
    inpatient: number
  }
}
```

- [ ] **Step 2: Populate `discountByModule` in `getFinancialSummary`**

In `getFinancialSummary` (line ~806), replace the return statement:

```typescript
  return {
    totalBilled,
    totalCollected,
    totalDiscount,
    totalDues,
    totalExpenses,
    netCashFlow: totalCollected - totalExpenses,
    dailyBreakdown: Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    discountByModule: {
      consultations: rxDiscount,
      labs: labBillsSum.discount,
      pharmacy: pharmacyBillsSum.discountAmount,
      optical: opticalBillsSum.discountAmount,
      inpatient: inpatientBillingSum.discount,
    },
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `FinancialSummary`.

---

## Task 2: Add `getPaymentModeBreakdown` server action

**Files:**
- Modify: `src/app/(hospital)/analytics/actions.ts`

- [ ] **Step 1: Add the `PaymentModeBreakdown` interface** (after `FinancialSummary` interface)

```typescript
export interface PaymentModeBreakdown {
  mode: string
  amount: number
  percentage: number
}
```

- [ ] **Step 2: Add the `getPaymentModeBreakdown` function** (after `getFinancialSummary`)

```typescript
// ─── PAYMENT MODE BREAKDOWN ───────────────────────────

function normalizePaymentMode(raw: string | null | undefined): string {
  if (!raw) return "Cash"
  const s = raw.trim().toUpperCase()
  if (s === "CASH") return "Cash"
  if (s === "UPI") return "UPI"
  if (s === "CARD") return "Card"
  if (s === "CHEQUE" || s === "NEFT" || s === "BANK TRANSFER" || s === "ONLINE") return "Cheque/NEFT"
  if (s === "INSURANCE") return "Insurance"
  return "Others"
}

export async function getPaymentModeBreakdown(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<PaymentModeBreakdown[]> {
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const [rxData, labData, pharmacyData, opticalData, inpatientData] = await Promise.all([
    supabase.from("Prescription").select("paymentMode, amountPaid")
      .gte("prescriptionDate", from).lt("prescriptionDate", to).neq("status", "CANCELLED")
      .returns<{ paymentMode: string | null; amountPaid: number | null }[]>(),
    supabase.from("LabBill").select("paymentMode, amountPaid")
      .gte("createdAt", from).lt("createdAt", to)
      .returns<{ paymentMode: string | null; amountPaid: number | null }[]>(),
    supabase.from("PharmacyBill").select("paymentMode, paidAmount")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<{ paymentMode: string | null; paidAmount: number | null }[]>(),
    supabase.from("OpticalBill").select("paymentMode, paidAmount")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<{ paymentMode: string | null; paidAmount: number | null }[]>(),
    supabase.from("InPatient").select("paymentRecords")
      .gte("admissionDate", from).lt("admissionDate", to)
      .returns<{ paymentRecords: string | null }[]>(),
  ])

  const map = new Map<string, number>()

  const add = (mode: string | null | undefined, amount: number | null | undefined) => {
    const key = normalizePaymentMode(mode)
    map.set(key, (map.get(key) ?? 0) + (amount ?? 0))
  }

  for (const r of rxData.data ?? []) add(r.paymentMode, r.amountPaid)
  for (const r of labData.data ?? []) add(r.paymentMode, r.amountPaid)
  for (const r of pharmacyData.data ?? []) add(r.paymentMode, r.paidAmount)
  for (const r of opticalData.data ?? []) add(r.paymentMode, r.paidAmount)

  // InPatient stores payment as JSON array: [{ paymentMode, amount, ... }]
  for (const row of inpatientData.data ?? []) {
    try {
      const records: { paymentMode?: string; amount?: number }[] = JSON.parse(row.paymentRecords ?? "[]")
      for (const rec of records) add(rec.paymentMode, rec.amount)
    } catch { /* skip malformed */ }
  }

  const total = [...map.values()].reduce((s, v) => s + v, 0)
  const ORDER = ["Cash", "UPI", "Card", "Cheque/NEFT", "Insurance", "Others"]

  return ORDER
    .filter(m => (map.get(m) ?? 0) > 0)
    .map(m => ({
      mode: m,
      amount: map.get(m) ?? 0,
      percentage: total > 0 ? Math.round(((map.get(m) ?? 0) / total) * 100) : 0,
    }))
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

---

## Task 3: Update AnalyticsPage to fetch new data for revenue tab

**Files:**
- Modify: `src/app/(hospital)/analytics/components/AnalyticsPage.tsx`

- [ ] **Step 1: Add imports for new types and actions**

At the top of `AnalyticsPage.tsx`, add to the existing import from `"../actions"`:

```typescript
import {
  // ... existing imports ...
  type PaymentModeBreakdown,
  getPaymentModeBreakdown,
} from "../actions"
```

- [ ] **Step 2: Add `paymentModes` state**

After the existing state declarations, add:

```typescript
const [paymentModes, setPaymentModes] = useState<PaymentModeBreakdown[]>([])
```

- [ ] **Step 3: Update the revenue tab fetch block**

Replace the existing `tab === "revenue"` branch inside `loadData`:

```typescript
} else if (tab === "revenue") {
  setFinancial(null); setTimeSeries([]); setPaymentModes([])
  const [f, e, ts, rc, pm] = await Promise.all([
    getFinancialSummary(...args),
    getExpenseBreakdown(...args),
    getTimeSeries(...args),
    getRevenueByCategory(...args),
    getPaymentModeBreakdown(...args),
  ])
  setFinancial(f); setExpenseBreakdown(e); setTimeSeries(ts)
  setRevenueByCat(rc); setPaymentModes(pm)
}
```

- [ ] **Step 4: Pass new props to RevenueTab**

Find the `<RevenueTab ... />` JSX and update to:

```tsx
<RevenueTab
  financial={financial}
  expenseBreakdown={expenseBreakdown}
  timeSeries={timeSeries}
  revenueByCategory={revenueByCategory}
  paymentModes={paymentModes}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 4: Rewrite RevenueTab.tsx

**Files:**
- Modify: `src/app/(hospital)/analytics/components/tabs/RevenueTab.tsx`

- [ ] **Step 1: Replace the entire file with the new implementation**

```typescript
"use client"

import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  IndianRupee, TrendingUp, TrendingDown, Receipt, CreditCard, Download,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartCard, CustomTooltip, EmptyState, fmt, fmtShort, SOURCE_COLORS, CHART_COLORS,
} from "../analytics-shared"
import type {
  FinancialSummary, ExpenseByCategory, TimeSeriesPoint,
  RevenueByCategory, PaymentModeBreakdown,
} from "../../actions"

const INDIGO = ["#4f46e5", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"]
const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#4f46e5", UPI: "#818cf8", Card: "#a5b4fc",
  "Cheque/NEFT": "#c7d2fe", Insurance: "#e0e7ff", Others: "#f1f5f9",
}

interface Props {
  financial: FinancialSummary | null
  expenseBreakdown: ExpenseByCategory[]
  timeSeries: TimeSeriesPoint[]
  revenueByCategory: RevenueByCategory[]
  paymentModes: PaymentModeBreakdown[]
}

// ── KPI HERO CARD ─────────────────────────────────────
function KpiCard({
  label, value, sub, icon, iconBg, valueColor, progress,
}: {
  label: string; value: string; sub: React.ReactNode
  icon: React.ReactNode; iconBg: string; valueColor: string
  progress?: number
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className={`text-3xl font-black mt-1.5 tabular-nums ${valueColor}`}>{value}</p>
            <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
        </div>
        {progress !== undefined && (
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
              style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── DONUT + LEGEND ────────────────────────────────────
function DonutSection({
  data, total, colorFn,
}: {
  data: { name: string; value: number }[]
  total: number
  colorFn: (name: string, i: number) => string
}) {
  if (data.length === 0) return <EmptyState />
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={56}
              dataKey="value" paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => <Cell key={d.name} fill={colorFn(d.name, i)} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]
                return (
                  <div className="bg-white border border-border/40 rounded-lg px-3 py-2 shadow-md text-xs">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-muted-foreground mt-0.5">{fmt(Number(d.value))} · {total > 0 ? Math.round((Number(d.value) / total) * 100) : 0}%</p>
                  </div>
                )
              }}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFn(d.name, i) }} />
                <span className="text-xs text-muted-foreground truncate">{d.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs font-semibold tabular-nums">{fmt(d.value)}</span>
                <span className="text-[10px] text-muted-foreground ml-1">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CSV DOWNLOAD ──────────────────────────────────────
function downloadLedgerCsv(daily: FinancialSummary["dailyBreakdown"], filterLabel: string) {
  const header = ["Date", "Billed", "Collected", "Expenses", "Discount", "Dues", "Net"].join(",")
  const rows = daily.map(d => [
    d.date,
    d.billed.toFixed(2),
    d.collected.toFixed(2),
    d.expenses.toFixed(2),
    d.discount.toFixed(2),
    d.dues.toFixed(2),
    (d.collected - d.expenses).toFixed(2),
  ].join(","))
  const csv = [header, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `daily-ledger-${filterLabel}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── MAIN COMPONENT ────────────────────────────────────
export default function RevenueTab({
  financial, expenseBreakdown, timeSeries, revenueByCategory, paymentModes,
}: Props) {
  if (!financial) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading financial data...
      </div>
    )
  }

  const netCashFlow = financial.netCashFlow
  const collectionRate = financial.totalBilled > 0
    ? Math.round((financial.totalCollected / financial.totalBilled) * 100) : 0

  // Revenue mix donut data
  const revData = revenueByCategory.filter(r => r.amount > 0).map(r => ({ name: r.category, value: r.amount }))
  const revTotal = revData.reduce((s, d) => s + d.value, 0)

  // Expense donut data
  const expTotal = expenseBreakdown.reduce((s, e) => s + e.amount, 0)
  const expData = expenseBreakdown.filter(e => e.amount > 0).map(e => ({ name: e.category, value: e.amount }))

  // Payment mode donut data
  const pmData = paymentModes.map(p => ({ name: p.mode, value: p.amount }))
  const pmTotal = paymentModes.reduce((s, p) => s + p.amount, 0)

  // Module collection bars — billed from revenueByCategory, collected not directly available per-module
  // Show billed per module as relative bars (same as revenue mix)
  const maxModBilled = Math.max(...revenueByCategory.map(r => r.amount), 1)

  // Discount bars
  const disc = financial.discountByModule
  const maxDisc = Math.max(disc.consultations, disc.labs, disc.pharmacy, disc.optical, disc.inpatient, 1)
  const discModules = [
    { label: "Consultations", value: disc.consultations },
    { label: "Labs",          value: disc.labs },
    { label: "Pharmacy",      value: disc.pharmacy },
    { label: "Optical",       value: disc.optical },
    { label: "In-Patient",    value: disc.inpatient },
  ]

  return (
    <div className="space-y-5">

      {/* ROW 1: KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Net Cash Flow"
          value={fmt(netCashFlow)}
          valueColor={netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}
          icon={netCashFlow >= 0
            ? <TrendingUp className="h-5 w-5 text-emerald-600" />
            : <TrendingDown className="h-5 w-5 text-red-600" />}
          iconBg={netCashFlow >= 0 ? "bg-emerald-50" : "bg-red-50"}
          sub="Collected minus expenses"
        />
        <KpiCard
          label="Total Billed"
          value={fmt(financial.totalBilled)}
          valueColor="text-indigo-600"
          icon={<Receipt className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
          sub="Across all departments"
        />
        <KpiCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          valueColor="text-foreground"
          icon={<CreditCard className="h-5 w-5 text-slate-500" />}
          iconBg="bg-slate-100"
          sub={`${fmt(financial.totalCollected)} of ${fmt(financial.totalBilled)}`}
          progress={collectionRate}
        />
        <KpiCard
          label="Pending Dues"
          value={fmt(financial.totalDues)}
          valueColor="text-amber-600"
          icon={<IndianRupee className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          sub="Outstanding balance"
        />
      </div>

      {/* ROW 2: Trend + Revenue Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue vs Expenses Trend" subtitle="Daily collected amount vs operational expenses">
          {timeSeries.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradRevCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRevExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtShort}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip currency />} cursor={false} />
                  <Area type="monotone" dataKey="collected" name="Collected"
                    stroke="#4f46e5" fill="url(#gradRevCollected)" strokeWidth={2.5}
                    dot={false} activeDot={{ r: 4, fill: "#4f46e5" }} />
                  <Area type="monotone" dataKey="expenses" name="Expenses"
                    stroke="#ef4444" fill="url(#gradRevExpenses)" strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: "#ef4444" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Revenue by Department</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Billed amount per module</p>
            <DonutSection
              data={revData}
              total={revTotal}
              colorFn={(name) => SOURCE_COLORS[name] ?? CHART_COLORS[0]}
            />
          </CardContent>
        </Card>
      </div>

      {/* ROW 3: Module Collection + Payment Mode + Expense */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Module-wise collection bars */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Module-wise Billing</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Revenue billed per department</p>
            <div className="space-y-3">
              {revenueByCategory.map((r) => (
                <div key={r.category}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground truncate pr-2">{r.category}</span>
                    <span className="font-semibold tabular-nums shrink-0">{fmt(r.amount)}</span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${maxModBilled > 0 ? Math.round((r.amount / maxModBilled) * 100) : 0}%`,
                        backgroundColor: SOURCE_COLORS[r.category] ?? CHART_COLORS[0],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Mode Breakdown */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Payment Mode Breakdown</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Collected by payment method</p>
            <DonutSection
              data={pmData}
              total={pmTotal}
              colorFn={(name) => PAYMENT_COLORS[name] ?? INDIGO[4]}
            />
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Expense Breakdown</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Operational costs by category</p>
            <DonutSection
              data={expData}
              total={expTotal}
              colorFn={(_, i) => INDIGO[i % INDIGO.length]}
            />
            <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total Discount</p>
                <p className="text-base font-black text-amber-600 mt-0.5 tabular-nums">{fmt(financial.totalDiscount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total Expenses</p>
                <p className="text-base font-black text-indigo-600 mt-0.5 tabular-nums">{fmt(financial.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROW 4: Discount Breakdown */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Discount Breakdown</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Concessions given per department</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total</p>
              <p className="text-xl font-black text-amber-600 tabular-nums mt-0.5">{fmt(financial.totalDiscount)}</p>
            </div>
          </div>
          {financial.totalDiscount > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-0">
              {discModules.map(m => (
                <div key={m.label} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                  <span className="text-xs font-medium text-foreground w-24 shrink-0">{m.label}</span>
                  <div className="flex-1 h-2 bg-amber-50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                      style={{ width: `${maxDisc > 0 ? Math.round((m.value / maxDisc) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-amber-600 tabular-nums w-16 text-right shrink-0">{fmt(m.value)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState message="No discounts for this period" />}
        </CardContent>
      </Card>

      {/* ROW 5: Daily Ledger */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Daily Ledger</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Day-by-day breakdown · most recent first</p>
          </div>
          <button
            onClick={() => downloadLedgerCsv(financial.dailyBreakdown, "period")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 hover:bg-muted border border-border/50 rounded-lg text-xs font-semibold text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10">
                {["Date", "Billed", "Collected", "Expenses", "Discount", "Dues", "Net"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {financial.dailyBreakdown.length > 0 ? financial.dailyBreakdown.map((day) => {
                const net = day.collected - day.expenses
                return (
                  <tr key={day.date} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground tabular-nums">{day.date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(day.billed)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 font-medium tabular-nums">{fmt(day.collected)}</td>
                    <td className="px-4 py-2.5 text-right text-red-500 tabular-nums">{fmt(day.expenses)}</td>
                    <td className="px-4 py-2.5 text-right text-amber-500 tabular-nums">{fmt(day.discount)}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600 tabular-nums">{fmt(day.dues)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(net)}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No data for this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Verify the dev server renders the tab without crashing**

Start dev server if not running:
```bash
cd /Users/vamshidhar/Desktop/docsile-hms/docsile-hms && npm run dev
```

Navigate to `/analytics`, click **Revenue & Finance** tab. Verify:
- 4 KPI cards render with values
- Trend chart shows two area lines
- Revenue by Department donut renders
- Module-wise Billing bars show
- Payment Mode donut renders (may be empty if no data yet)
- Expense Breakdown donut renders
- Discount Breakdown section renders
- Daily Ledger table shows rows
- "Download CSV" button is visible; clicking it downloads a `.csv` file
