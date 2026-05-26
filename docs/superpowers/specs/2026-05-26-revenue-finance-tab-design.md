# Revenue & Finance Tab Redesign

**Date:** 2026-05-26
**Status:** Approved

## Overview

Redesign the Revenue & Finance analytics tab to give hospital managers a clear picture of financial health: cash flow, collection efficiency, payment method distribution, discount leakage, and expense structure.

## Layout (top to bottom)

### Row 1 — 4 KPI Hero Cards

| Card | Value | Extra |
|---|---|---|
| Net Cash Flow | totalCollected − totalExpenses | % change badge (up/down) |
| Total Billed | financial.totalBilled | — |
| Collection Rate | (totalCollected / totalBilled) × 100 | Inline progress bar |
| Pending Dues | financial.totalDues | % change badge |

### Row 2 — Trend Chart + Revenue Mix (2-column)

**Left:** Revenue vs Expenses area chart (Recharts AreaChart)
- Two areas: `collected` (indigo `#4f46e5`) and `expenses` (red `#ef4444`)
- Data: `timeSeries` (already fetched)

**Right:** Revenue by Department donut (Recharts PieChart)
- Data: `revenueByCategory` — needs to be added to the revenue tab fetch
- Categories: Consultations, Labs, Pharmacy, Optical, In-Patient (each has a distinct color from existing SOURCE_COLORS map)
- Donut + legend with amount and %

### Row 3 — Three-Column Grid

**Column 1: Module-wise Collection**
- Paired horizontal bars per module: light indigo = billed, solid indigo = collected
- Data derived from `revenueByCategory` (billed) and a new `getModuleCollections` action (collected per module)
- Actually: use `revenueByCategory` for billed amounts; for collected amounts, add a `collectedByModule` field to `FinancialSummary` or fetch separately

**Column 2: Payment Mode Breakdown**
- Donut + legend
- New action `getPaymentModeBreakdown` aggregating `paymentMode` across:
  - `Prescription` (consultations)
  - `LabBill`
  - `PharmacyBill`
  - `OpticalBill`
  - `InPatient` billing (via Payment table or InPatient.paymentMode)
- Normalize mode strings (e.g., "Cash", "CASH" → "Cash"; "NEFT", "Bank Transfer" → "NEFT/Bank Transfer")
- Return top modes + group rare ones as "Others"
- Color palette: indigo shades `["#4f46e5","#818cf8","#a5b4fc","#c7d2fe","#e0e7ff"]`

**Column 3: Expense Breakdown**
- Donut + legend (existing `expenseBreakdown` data, already fetched)
- Show total discount + total expenses in a 2-cell strip below the donut

### Row 4 — Discount Breakdown (full-width)

- Header: title + total discount amount (amber, top-right)
- 2-column grid of horizontal amber progress bars, one per module:
  - Consultations, Labs, Pharmacy, Optical, In-Patient
- Data: from `AnalyticsOverview` (already has per-module discount fields) or add to `FinancialSummary`
- Preferred: add `discountByModule` to `FinancialSummary` so the revenue tab is self-contained

### Row 5 — Daily Ledger Table

- Columns: Date | Billed | Collected | Expenses | Discount | Dues | Net
- Net = Collected − Expenses (shown green if ≥ 0, red otherwise)
- **Download CSV button** in the table header (top-right)
  - Client-side: build CSV string from `financial.dailyBreakdown`, trigger `<a download>` click
  - Filename: `daily-ledger-{filter}-{today}.csv`

## Data Changes

### New: `getPaymentModeBreakdown(filter, customStart?, customEnd?)`

Returns `{ mode: string; amount: number; percentage: number }[]`

Aggregates `paymentMode` + collected amounts from:
- `Prescription`: `paymentMode` + `amountPaid` (or `total` − `dues`)
- `LabBill`: `paymentMode` + `amountPaid`
- `PharmacyBill`: `paymentMode` + `billAmount` (net of dues)
- `OpticalBill`: `paymentMode` + `billAmount`
- `InPatient` or `Payment` table: `paymentMode` + amount

Normalize modes to canonical set: Cash, UPI, Card, Cheque, NEFT, Insurance, Others.

### Modified: `FinancialSummary` interface

Add:
```ts
discountByModule: {
  consultations: number
  labs: number
  pharmacy: number
  optical: number
  inpatient: number
}
```

Populate inside `getFinancialSummary` using existing per-table queries (already fetched, just need to sum `discount` fields).

### Modified: `AnalyticsPage` revenue tab fetch

Add `getRevenueByCategory` and `getPaymentModeBreakdown` to the parallel fetch.
Add state: `paymentModes: { mode: string; amount: number; percentage: number }[]`

### Modified: `RevenueTab` props

```ts
interface Props {
  financial: FinancialSummary | null
  expenseBreakdown: ExpenseByCategory[]
  timeSeries: TimeSeriesPoint[]
  revenueByCategory: RevenueByCategory[]          // new
  paymentModes: { mode: string; amount: number; percentage: number }[]  // new
}
```

## Color Conventions

- Indigo palette (charts): `#4f46e5`, `#818cf8`, `#a5b4fc`, `#c7d2fe`, `#e0e7ff`
- Collected: `#4f46e5` (solid indigo)
- Billed (unfilled): `#c7d2fe` (light indigo)
- Expenses: `#ef4444` (red)
- Discounts: `#f59e0b` / `#fbbf24` (amber)
- Dues: `#d97706` (amber-600)
- Net positive: `#059669` (emerald)
- Net negative: `#dc2626` (red)

## Files to Change

1. `src/app/(hospital)/analytics/actions.ts` — add `getPaymentModeBreakdown`, add `discountByModule` to `FinancialSummary` + `getFinancialSummary`
2. `src/app/(hospital)/analytics/components/AnalyticsPage.tsx` — add state + fetch for `revenueByCategory` and `paymentModes` in revenue tab
3. `src/app/(hospital)/analytics/components/tabs/RevenueTab.tsx` — full rewrite to match approved mockup
