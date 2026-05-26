"use client"

import {
  Users, IndianRupee, TrendingUp, TrendingDown,
  Wallet, CreditCard, Scissors, RefreshCw, Activity, ArrowRightLeft,
} from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import {
  HeroStatCard, StatCard, ChartCard, CustomTooltip, EmptyState,
  fmt, fmtShort, CHART_COLORS, SOURCE_COLORS,
} from "../analytics-shared"
import type { AnalyticsOverview, GenderDistribution, AgeGroup, RevenueByCategory } from "../../actions"

interface Props {
  overview: AnalyticsOverview
  gender: GenderDistribution | null
  ageGroups: AgeGroup[]
  revenueByCategory: RevenueByCategory[]
}

export default function OverviewTab({ overview, gender, ageGroups, revenueByCategory }: Props) {
  const netCashFlow = overview.totalCollected - overview.totalExpenses
  const donutData = revenueByCategory.filter(r => r.amount > 0)

  const genderTotal = (gender?.male ?? 0) + (gender?.female ?? 0) + (gender?.other ?? 0)
  const genderSplit = genderTotal > 0 && gender ? [
    { label: "M", pct: Math.round(gender.male / genderTotal * 100),   color: "bg-indigo-500" },
    { label: "F", pct: Math.round(gender.female / genderTotal * 100), color: "bg-indigo-300" },
    { label: "O", pct: Math.round(gender.other / genderTotal * 100),  color: "bg-indigo-200" },
  ] : []

  // Financial bar heights (proportional to totalRevenue, max 120px)
  const maxFinVal = Math.max(overview.totalRevenue, 1)
  const fBarH = (v: number) => Math.max(v > 0 ? 4 : 0, Math.round((v / maxFinVal) * 120))

  const finBars = [
    { label: "Billed",    value: overview.totalRevenue,   color: "bg-indigo-500" },
    { label: "Collected", value: overview.totalCollected, color: "bg-indigo-400" },
    { label: "Expenses",  value: overview.totalExpenses,  color: "bg-slate-400"  },
    { label: "Dues",      value: overview.totalDues,      color: "bg-slate-300"  },
    { label: "Discounts", value: overview.totalDiscount,  color: "bg-indigo-200" },
  ]

  // Discount bar heights (proportional to max module discount, max 100px)
  const discountModules = [
    { label: "Consult",    value: overview.consultationDiscount, color: "bg-indigo-500" },
    { label: "Labs",       value: overview.labDiscount,          color: "bg-indigo-400" },
    { label: "Pharmacy",   value: overview.pharmacyDiscount,     color: "bg-indigo-300" },
    { label: "Optical",    value: overview.opticalDiscount,      color: "bg-slate-300"  },
    { label: "In-Patient", value: overview.inpatientDiscount,    color: "bg-slate-200"  },
  ]
  const maxDiscount = Math.max(...discountModules.map(d => d.value), 1)
  const dBarH = (v: number) => Math.max(v > 0 ? 4 : 0, Math.round((v / maxDiscount) * 100))

  // Age bar heights (proportional to max age group, max 100px)
  const maxAge = Math.max(...ageGroups.map(g => g.count), 1)
  const aBarH = (v: number) => Math.max(v > 0 ? 4 : 0, Math.round((v / maxAge) * 100))

  return (
    <div className="space-y-5">

      {/* ROW 1: 4 hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStatCard
          title="Total Revenue"
          value={fmt(overview.totalRevenue)}
          change={overview.revenueChange}
          icon={<IndianRupee className="h-5 w-5" />}
          accentClass="text-indigo-600 bg-indigo-50"
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
          title="Conversion Rate"
          value={`${overview.conversionRate}%`}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          accentClass={overview.conversionRate >= 50 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}
          subtitle={`${overview.surgeryConverted} of ${overview.surgeryRecommended} surgery patients`}
        />
        <HeroStatCard
          title="Net Cash Flow"
          value={fmt(netCashFlow)}
          icon={netCashFlow >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          accentClass={netCashFlow >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}
          subtitle={`${fmt(overview.totalExpenses)} expenses`}
        />
      </div>

      {/* ROW 2: Revenue Mix donut + Financial Summary bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue Mix */}
        <ChartCard title="Revenue Mix" subtitle="Breakdown by department">
          {donutData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      dataKey="amount" nameKey="category"
                      paddingAngle={3} strokeWidth={0}>
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
                        <span className="text-xs font-semibold tabular-nums">{fmt(entry.amount)}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        {/* Financial Summary */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Financial Summary</p>
              </div>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full tabular-nums">
                {overview.collectionRate}% collected
              </span>
            </div>

            {/* 5 vertical bars */}
            <div className="flex items-end justify-center gap-6 px-4" style={{ height: 140 }}>
              {finBars.map(bar => (
                <div key={bar.label} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-foreground tabular-nums">{fmtShort(bar.value)}</span>
                  <div className={`w-10 rounded-t-lg ${bar.color}`} style={{ height: fBarH(bar.value) }} />
                  <span className="text-[10px] text-muted-foreground font-medium">{bar.label}</span>
                </div>
              ))}
            </div>

            {/* Bottom strip: Net Cash Flow, Rev/Patient, Gender Split */}
            <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Net Cash Flow</p>
                <p className={`text-sm font-black mt-0.5 tabular-nums ${netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmt(netCashFlow)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Rev / Patient</p>
                <p className="text-sm font-black text-foreground mt-0.5 tabular-nums">{fmt(overview.revenuePerPatient)}</p>
              </div>
              {genderSplit.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Gender Split</p>
                  <div className="flex h-2 rounded-full overflow-hidden">
                    {genderSplit.map(g => g.pct > 0 && (
                      <div key={g.label} className={g.color} style={{ width: `${g.pct}%` }} />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-1 text-[9px] text-muted-foreground">
                    {genderSplit.map(g => (
                      <span key={g.label}>{g.label} {g.pct}%</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROW 3: 5 mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Pending Dues"       value={fmt(overview.totalDues)}            icon={<CreditCard className="h-4 w-4" />}  iconBg="bg-amber-50"  iconColor="text-amber-600" />
        <StatCard title="Surgeries"          value={overview.totalSurgeries}            icon={<Scissors className="h-4 w-4" />}   iconBg="bg-rose-50"   iconColor="text-rose-600" />
        <StatCard title="Total Expenses"     value={fmt(overview.totalExpenses)}        icon={<Wallet className="h-4 w-4" />}     iconBg="bg-red-50"    iconColor="text-red-500" />
        <StatCard title="Follow-up Visits"   value={overview.followUpVisits}            icon={<RefreshCw className="h-4 w-4" />}  iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatCard title="Avg. Daily Patients" value={overview.avgDailyPatients}         icon={<Activity className="h-4 w-4" />}   iconBg="bg-blue-50"   iconColor="text-blue-600" />
      </div>

      {/* ROW 4: Discounts by Module + Age Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Discounts by Module */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Discounts by Module</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Concessions given this period</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total</p>
                <p className="text-lg font-black text-indigo-600 tabular-nums mt-0.5">{fmt(overview.totalDiscount)}</p>
              </div>
            </div>
            {overview.totalDiscount > 0 ? (
              <div className="flex items-end justify-around gap-3 px-2" style={{ height: 130 }}>
                {discountModules.map(mod => (
                  <div key={mod.label} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold text-foreground tabular-nums">{fmtShort(mod.value)}</span>
                    <div className={`w-10 rounded-t-lg ${mod.color}`} style={{ height: dBarH(mod.value) }} />
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">{mod.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No discounts for this period" />
            )}
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Age Distribution</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Patients by age band</p>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted/40 px-3 py-1 rounded-full border border-border/40">
                {overview.totalPatients.toLocaleString("en-IN")} total
              </span>
            </div>
            {ageGroups.some(g => g.count > 0) ? (
              <div className="flex items-end justify-around gap-2 px-1" style={{ height: 130 }}>
                {ageGroups.map(g => (
                  <div key={g.label} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold text-foreground">{g.count}</span>
                    <div className="w-9 rounded-t-lg bg-indigo-400" style={{ height: aBarH(g.count) }} />
                    <span className="text-[9px] text-muted-foreground">{g.label}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
