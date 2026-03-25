"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format } from "date-fns"
import {
  Users, IndianRupee, TrendingUp, TrendingDown,
  BedDouble, Stethoscope, FlaskConical, Pill, Glasses,
  ArrowUpRight, ArrowDownRight, Wallet, CreditCard,
  Receipt, Scissors, UserCheck,
} from "lucide-react"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/header"
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
import CallAnalyticsTab from "../../call-logs/components/CallAnalyticsTab"

// ─── COLORS ──────────────────────────────────────────

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
]

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: "#94a3b8", IN_WORKUP: "#f59e0b", WORKUP_DONE: "#06b6d4",
  WITH_DOCTOR: "#8b5cf6", VISITED: "#3b82f6", COMPLETED: "#10b981",
  MEDICAL_ONLY: "#14b8a6", MOVED: "#6366f1", CANCELLED: "#ef4444", NO_SHOW: "#f43f5e",
}

// ─── TABS ────────────────────────────────────────────

type Tab = "overview" | "trends" | "financial" | "reports" | "calls"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "trends", label: "Trends" },
  { key: "financial", label: "Financial" },
  { key: "reports", label: "Reports" },
  { key: "calls", label: "Calls" },
]

// ─── CURRENCY FORMATTER ──────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

const fmtShort = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

// ─── STAT CARD ───────────────────────────────────────

function StatCard({
  title, value, change, icon, iconBg, iconColor, subtitle,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  subtitle?: string
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                <span>{Math.abs(change)}% from prev period</span>
              </div>
            )}
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CHART CARD ──────────────────────────────────────

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
        {children}
      </CardContent>
    </Card>
  )
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────

function CustomTooltip({ active, payload, label, currency = false }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; currency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-gray-700 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900">{currency ? fmt(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const [filter, setFilter] = useState<TimeFilter>("month")
  const [customRange, setCustomRange] = useState({ start: "", end: "" })
  const [loading, setLoading] = useState(true)

  // Data states
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [gender, setGender] = useState<GenderDistribution | null>(null)
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [revenueByCategory, setRevenueByCategory] = useState<RevenueByCategory[]>([])
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [topServices, setTopServices] = useState<TopService[]>([])
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseByCategory[]>([])
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [doctorPerf, setDoctorPerf] = useState<DoctorPerformance[]>([])
  const [statusDist, setStatusDist] = useState<StatusDistribution[]>([])
  const [referrals, setReferrals] = useState<{ name: string; count: number }[]>([])

  // Compute date strings for the Calls tab (CallAnalyticsTab needs yyyy-MM-dd strings)
  const callDateRange = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, "yyyy-MM-dd")
    switch (filter) {
      case "today":
        return { startDate: todayStr, endDate: todayStr }
      case "week": {
        const d = new Date(today); d.setDate(d.getDate() - 7)
        return { startDate: format(d, "yyyy-MM-dd"), endDate: todayStr }
      }
      case "month": {
        const d = new Date(today); d.setDate(d.getDate() - 30)
        return { startDate: format(d, "yyyy-MM-dd"), endDate: todayStr }
      }
      case "year": {
        const d = new Date(today); d.setFullYear(d.getFullYear() - 1)
        return { startDate: format(d, "yyyy-MM-dd"), endDate: todayStr }
      }
      case "custom":
        return { startDate: customRange.start || todayStr, endDate: customRange.end || todayStr }
    }
  }, [filter, customRange])

  const loadData = useCallback(async () => {
    if (tab === "calls") { setLoading(false); return }
    setLoading(true)
    try {
      const args: [TimeFilter, string?, string?] = [filter]
      if (filter === "custom") {
        args.push(customRange.start, customRange.end)
      }

      if (tab === "overview") {
        const [o, g, a, r, ts, e, s] = await Promise.all([
          getAnalyticsOverview(...args),
          getGenderDistribution(...args),
          getAgeDistribution(...args),
          getRevenueByCategory(...args),
          getTimeSeries(...args),
          getExpenseBreakdown(...args),
          getStatusDistribution(...args),
        ])
        setOverview(o)
        setGender(g)
        setAgeGroups(a)
        setRevenueByCategory(r)
        setTimeSeries(ts)
        setExpenseBreakdown(e)
        setStatusDist(s)
      } else if (tab === "trends") {
        const [ts, top, dr, ref] = await Promise.all([
          getTimeSeries(...args),
          getTopServices(...args),
          getDoctorPerformance(...args),
          getReferralStats(...args),
        ])
        setTimeSeries(ts)
        setTopServices(top)
        setDoctorPerf(dr)
        setReferrals(ref)
      } else if (tab === "financial") {
        const [f, e] = await Promise.all([
          getFinancialSummary(...args),
          getExpenseBreakdown(...args),
        ])
        setFinancial(f)
        setExpenseBreakdown(e)
      } else if (tab === "reports") {
        const [top, dr, s, ref] = await Promise.all([
          getTopServices(...args),
          getDoctorPerformance(...args),
          getStatusDistribution(...args),
          getReferralStats(...args),
        ])
        setTopServices(top)
        setDoctorPerf(dr)
        setStatusDist(s)
        setReferrals(ref)
      }
    } catch (err) {
      console.error("Error loading analytics:", err)
    } finally {
      setLoading(false)
    }
  }, [tab, filter, customRange])

  useEffect(() => { loadData() }, [loadData])

  // ─── LOADING SKELETON ──────────────────────────────

  const Skeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-5">
            <div className="flex justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-200 rounded w-24" />
                <div className="h-7 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-11 w-11 bg-gray-200 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // ─── OVERVIEW TAB ──────────────────────────────────

  const renderOverview = () => {
    if (!overview) return <Skeleton />

    const genderData = gender ? [
      { name: "Male", value: gender.male, color: "#3b82f6" },
      { name: "Female", value: gender.female, color: "#ec4899" },
      { name: "Other", value: gender.other, color: "#8b5cf6" },
    ].filter((d) => d.value > 0) : []

    const statusData = statusDist.map((s, i) => ({
      ...s,
      color: STATUS_COLORS[s.status] ?? CHART_COLORS[i % CHART_COLORS.length],
      label: s.status.replace(/_/g, " "),
    }))

    return (
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Patients" value={overview.totalPatients} change={overview.patientChange}
            icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50" iconColor="text-blue-500"
            subtitle={`${overview.newPatientsToday} registered today`} />
          <StatCard title="Total Revenue" value={fmt(overview.totalRevenue)} change={overview.revenueChange}
            icon={<IndianRupee className="h-5 w-5" />} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
          <StatCard title="Collected" value={fmt(overview.totalCollected)}
            icon={<CreditCard className="h-5 w-5" />} iconBg="bg-green-50" iconColor="text-green-600"
            subtitle="Actual cash received" />
          <StatCard title="Pending Dues" value={fmt(overview.totalDues)}
            icon={<Receipt className="h-5 w-5" />} iconBg="bg-amber-50" iconColor="text-amber-500" />
          <StatCard title="Total Expenses" value={fmt(overview.totalExpenses)}
            icon={<Wallet className="h-5 w-5" />} iconBg="bg-red-50" iconColor="text-red-500" />
          <StatCard title="Net Cash Flow" value={fmt(overview.totalCollected - overview.totalExpenses)}
            icon={(overview.totalCollected - overview.totalExpenses) >= 0
              ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            iconBg={(overview.totalCollected - overview.totalExpenses) >= 0 ? "bg-emerald-50" : "bg-red-50"}
            iconColor={(overview.totalCollected - overview.totalExpenses) >= 0 ? "text-emerald-500" : "text-red-500"} />
          <StatCard title="In-Patients" value={overview.totalInpatients}
            icon={<BedDouble className="h-5 w-5" />} iconBg="bg-violet-50" iconColor="text-violet-500"
            subtitle={`${overview.activeInpatients} currently admitted`} />
          <StatCard title="Surgeries" value={overview.totalSurgeries}
            icon={<Scissors className="h-5 w-5" />} iconBg="bg-pink-50" iconColor="text-pink-500" />
        </div>

        {/* Revenue Breakdown Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard title="Consultation" value={fmt(overview.totalConsultationRevenue)}
            icon={<Stethoscope className="h-4 w-4" />} iconBg="bg-blue-50" iconColor="text-blue-500" />
          <StatCard title="Labs" value={fmt(overview.totalLabRevenue)}
            icon={<FlaskConical className="h-4 w-4" />} iconBg="bg-teal-50" iconColor="text-teal-500" />
          <StatCard title="Pharmacy" value={fmt(overview.totalPharmacyRevenue)}
            icon={<Pill className="h-4 w-4" />} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
          <StatCard title="Optical" value={fmt(overview.totalOpticalRevenue)}
            icon={<Glasses className="h-4 w-4" />} iconBg="bg-purple-50" iconColor="text-purple-500" />
          <StatCard title="In-Patient" value={fmt(overview.totalInpatientRevenue)}
            icon={<BedDouble className="h-4 w-4" />} iconBg="bg-amber-50" iconColor="text-amber-500" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Age Distribution">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageGroups}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="count" name="Patients" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Revenue by Category">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip currency />} cursor={false} />
                  <Bar dataKey="amount" name="Revenue" radius={[4, 4, 0, 0]} barSize={36}>
                    {revenueByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Expense Breakdown">
            <div className="h-64 flex items-center justify-center">
              {expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="amount" nameKey="category" paddingAngle={3} strokeWidth={0}>
                      {expenseBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip currency />} cursor={false} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Gender Distribution">
            <div className="h-64 flex items-center justify-center">
              {genderData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                      {genderData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Patient Status">
            <div className="h-64 flex items-center justify-center">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="count" nameKey="label" paddingAngle={2} strokeWidth={0}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </ChartCard>
        </div>
      </div>
    )
  }

  // ─── TRENDS TAB ────────────────────────────────────

  const renderTrends = () => (
    <div className="space-y-6">
      {/* Patient Trend */}
      <ChartCard title="Daily Patient Volume">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeries}>
              <defs>
                <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Area type="monotone" dataKey="patients" name="Patients" stroke="#3b82f6" fill="url(#colorP)" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Revenue vs Expenses */}
      <ChartCard title="Revenue vs Expenses">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip currency />} cursor={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Services */}
        <ChartCard title="Top Services by Revenue">
          {topServices.length > 0 ? (
            <div className="space-y-3">
              {topServices.slice(0, 8).map((service, i) => {
                const maxRev = topServices[0]?.revenue || 1
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-foreground truncate">{service.name}</span>
                        <span className="text-xs font-semibold text-foreground ml-2 shrink-0">{fmt(service.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(service.revenue / maxRev) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">{service.count}x</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No service data available</p>
          )}
        </ChartCard>

        {/* Doctor Performance */}
        <ChartCard title="Doctor Performance">
          {doctorPerf.length > 0 ? (
            <div className="space-y-3">
              {doctorPerf.map((doc, i) => {
                const maxP = doctorPerf[0]?.patients || 1
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-foreground truncate">{doc.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{doc.patients} patients</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${(doc.patients / maxP) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-foreground shrink-0 w-16 text-right">{fmt(doc.revenue)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No doctor data available</p>
          )}
        </ChartCard>
      </div>

      {/* Referrals */}
      {referrals.length > 0 && (
        <ChartCard title="Top Referral Sources">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={referrals.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="count" name="Patients" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  )

  // ─── FINANCIAL TAB ─────────────────────────────────

  const renderFinancial = () => {
    if (!financial) return <Skeleton />

    const summaryCards = [
      { title: "Total Billed", value: financial.totalBilled, color: "text-foreground", bg: "bg-blue-50", desc: "Total revenue billed" },
      { title: "Total Collected", value: financial.totalCollected, color: "text-emerald-600", bg: "bg-emerald-50", desc: "Actual cash received" },
      { title: "Total Discount", value: financial.totalDiscount, color: "text-orange-600", bg: "bg-orange-50", desc: "Discounts given" },
      { title: "Pending Dues", value: financial.totalDues, color: "text-amber-600", bg: "bg-amber-50", desc: "Outstanding payments" },
      { title: "Total Expenses", value: financial.totalExpenses, color: "text-red-600", bg: "bg-red-50", desc: "Operational costs" },
    ]

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {summaryCards.map((card, i) => (
            <Card key={i} className="relative overflow-hidden group hover:shadow-md transition-all">
              <div className={`absolute top-0 right-0 w-20 h-20 ${card.bg} rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform`} />
              <CardContent className="p-5 relative">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</p>
                <p className={`text-2xl font-bold mt-1.5 ${card.color}`}>{fmt(card.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Net Cash Flow Card */}
        <Card className={`border-2 ${financial.netCashFlow >= 0 ? "border-emerald-200 bg-emerald-50/30" : "border-red-200 bg-red-50/30"}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Net Cash Flow (Collected - Expenses)</p>
              <p className={`text-3xl font-bold mt-1 ${financial.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(financial.netCashFlow)}
              </p>
            </div>
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${financial.netCashFlow >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
              {financial.netCashFlow >= 0
                ? <TrendingUp className="h-7 w-7 text-emerald-600" />
                : <TrendingDown className="h-7 w-7 text-red-600" />}
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary Table */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">Financial Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Metric</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: "Total Billed", value: financial.totalBilled, color: "text-foreground", desc: "Total revenue from all consultations" },
                    { label: "Total Collected", value: financial.totalCollected, color: "text-emerald-600", desc: "Amount actually collected from patients" },
                    { label: "Total Discount", value: financial.totalDiscount, color: "text-orange-600", desc: "Total discounts given" },
                    { label: "Pending Dues", value: financial.totalDues, color: "text-amber-600", desc: "Amount yet to be collected" },
                    { label: "Total Expenses", value: financial.totalExpenses, color: "text-red-600", desc: "All operational expenses" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className={`px-5 py-3.5 font-medium ${row.color}`}>{row.label}</td>
                      <td className={`px-5 py-3.5 text-right font-semibold ${row.color}`}>{fmt(row.value)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{row.desc}</td>
                    </tr>
                  ))}
                  <tr className={`${financial.netCashFlow >= 0 ? "bg-emerald-50/50" : "bg-red-50/50"}`}>
                    <td className="px-5 py-3.5 font-bold text-foreground">Net Cash Flow</td>
                    <td className={`px-5 py-3.5 text-right font-bold ${financial.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmt(financial.netCashFlow)}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">Net cash remaining after expenses</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Daily Ledger */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">Daily Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Billed</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Collected</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Net</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Dues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {financial.dailyBreakdown.length > 0 ? financial.dailyBreakdown.map((day, i) => {
                    const net = day.collected - day.expenses
                    return (
                      <tr key={i} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{day.date}</td>
                        <td className="px-4 py-3 text-right text-foreground">{fmt(day.billed)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(day.collected)}</td>
                        <td className="px-4 py-3 text-right text-red-500">{fmt(day.expenses)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(net)}</td>
                        <td className="px-4 py-3 text-right text-orange-500">{fmt(day.discount)}</td>
                        <td className="px-4 py-3 text-right text-amber-500">{fmt(day.dues)}</td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground italic">No daily data available for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown Chart */}
        {expenseBreakdown.length > 0 && (
          <ChartCard title="Expense Breakdown by Category">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="amount" nameKey="category" paddingAngle={3} strokeWidth={0}>
                    {expenseBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip currency />} cursor={false} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>
    )
  }

  // ─── REPORTS TAB ───────────────────────────────────

  const renderReports = () => (
    <div className="space-y-6">
      {/* Top Services Table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Top Services Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Service Name</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Count</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Avg/Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topServices.length > 0 ? topServices.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-5 py-3 text-right text-foreground">{s.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{fmt(s.revenue)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{fmt(s.count > 0 ? s.revenue / s.count : 0)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground italic">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Doctor Report */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Doctor Performance Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Doctor</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Patients Seen</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Revenue Generated</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Avg/Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doctorPerf.length > 0 ? doctorPerf.map((d, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Stethoscope className="h-3.5 w-3.5 text-primary" />
                      </div>
                      {d.name}
                    </td>
                    <td className="px-5 py-3 text-right text-foreground">{d.patients}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{fmt(d.revenue)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{fmt(d.patients > 0 ? d.revenue / d.patients : 0)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground italic">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution Report */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Patient Status Distribution</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Count</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statusDist.length > 0 ? statusDist.sort((a, b) => b.count - a.count).map((s, i) => {
                  const total = statusDist.reduce((sum, d) => sum + d.count, 0)
                  const pct = total > 0 ? (s.count / total) * 100 : 0
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] ?? "#94a3b8" }} />
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground">{s.count}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] ?? "#94a3b8" }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={3} className="px-5 py-10 text-center text-muted-foreground italic">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Referral Report */}
      {referrals.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">Referral Sources Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Referred By</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Patients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{r.name}</td>
                      <td className="px-5 py-3 text-right text-foreground">{r.count}</td>
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

  // ─── RENDER ────────────────────────────────────────

  return (
    <div className="space-y-0 animate-fade-in bg-gray-50 min-h-screen">
      {/* Header */}
      <PageHeader title="Analytics Dashboard">
        {/* Time Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded-lg p-0.5 flex">
            {(["today", "week", "month", "year", "custom"] as TimeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 capitalize ${
                  filter === f ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "week" ? "7 Days" : f === "month" ? "30 Days" : f === "year" ? "1 Year" : f}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {/* Custom Date Range */}
      {filter === "custom" && (
        <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border -mx-6">
          <label className="text-xs font-medium text-muted-foreground">From:</label>
          <input type="date" value={customRange.start}
            onChange={(e) => setCustomRange((p) => ({ ...p, start: e.target.value }))}
            className="px-2.5 py-1.5 border border-border rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          <label className="text-xs font-medium text-muted-foreground">To:</label>
          <input type="date" value={customRange.end}
            onChange={(e) => setCustomRange((p) => ({ ...p, end: e.target.value }))}
            className="px-2.5 py-1.5 border border-border rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-0 border-b border-border -mx-6 px-6 bg-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all duration-150 ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="mt-4 text-sm text-muted-foreground">Loading analytics...</p>
          </div>
        ) : (
          <>
            {tab === "overview" && renderOverview()}
            {tab === "trends" && renderTrends()}
            {tab === "financial" && renderFinancial()}
            {tab === "reports" && renderReports()}
            {tab === "calls" && (
              <CallAnalyticsTab startDate={callDateRange.startDate} endDate={callDateRange.endDate} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
