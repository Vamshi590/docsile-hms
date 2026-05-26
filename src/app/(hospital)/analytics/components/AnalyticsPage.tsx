"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format } from "date-fns"
import {
  type TimeFilter, type AnalyticsOverview, type GenderDistribution,
  type AgeGroup, type RevenueByCategory, type TimeSeriesPoint,
  type TopService, type ExpenseByCategory, type FinancialSummary,
  type DoctorPerformance, type StatusDistribution,
  type CommonDiagnosis, type CommonMedicine, type PaymentModeBreakdown,
  type SurgeryBreakdown, type RegionStat,
  type CommonInvestigation, type PharmacySaleStat, type LabTestStat,
  getAnalyticsOverview, getGenderDistribution, getAgeDistribution,
  getRevenueByCategory, getTimeSeries, getTopServices,
  getExpenseBreakdown, getFinancialSummary, getDoctorPerformance,
  getStatusDistribution, getReferralStats,
  getCommonDiagnoses, getCommonMedicines, getPaymentModeBreakdown,
  getSurgeryBreakdown, getRegionStats,
  getTopPrescribedInvestigations, getTopPharmacySales, getTopLabTests,
} from "../actions"
import OverviewTab    from "./tabs/OverviewTab"
import PatientsTab   from "./tabs/PatientsTab"
import RevenueTab    from "./tabs/RevenueTab"
import PerformanceTab from "./tabs/PerformanceTab"
import RegionTab     from "./tabs/RegionTab"
import CallAnalyticsTab from "../../call-logs/components/CallAnalyticsTab"
import { AskSithaAI } from "../../doctor/components/AskSithaAI"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── TABS ────────────────────────────────────────────

type Tab = "overview" | "patients" | "revenue" | "performance" | "region" | "calls"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview",     label: "Overview" },
  { key: "patients",     label: "Patients" },
  { key: "revenue",      label: "Revenue & Finance" },
  { key: "performance",  label: "Performance" },
  { key: "region",       label: "Region" },
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
  const [chatOpen, setChatOpen] = useState(false)

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
  const [diagnoses, setDiagnoses]             = useState<CommonDiagnosis[]>([])
  const [medicines, setMedicines]             = useState<CommonMedicine[]>([])
  const [paymentModes, setPaymentModes]       = useState<PaymentModeBreakdown[]>([])
  const [surgeryBreakdown, setSurgeryBreakdown]   = useState<SurgeryBreakdown[]>([])
  const [regionStats, setRegionStats]             = useState<RegionStat[]>([])
  const [prescribedInvs, setPrescribedInvs]       = useState<CommonInvestigation[]>([])
  const [pharmacySales, setPharmacySales]         = useState<PharmacySaleStat[]>([])
  const [labTests, setLabTests]                   = useState<LabTestStat[]>([])
  const [prescribedMeds, setPrescribedMeds]       = useState<CommonMedicine[]>([])

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
        const [o, g, a, r] = await Promise.all([
          getAnalyticsOverview(...args),
          getGenderDistribution(...args),
          getAgeDistribution(...args),
          getRevenueByCategory(...args),
        ])
        setOverview(o); setGender(g); setAgeGroups(a); setRevenueByCat(r)
      } else if (tab === "patients") {
        setTimeSeries([]); setReferrals([]); setDiagnoses([]); setMedicines([])
        const [ts, g, ref, diag, med] = await Promise.all([
          getTimeSeries(...args),
          getGenderDistribution(...args),
          getReferralStats(...args),
          getCommonDiagnoses(...args),
          getCommonMedicines(...args),
        ])
        setTimeSeries(ts); setGender(g); setReferrals(ref); setDiagnoses(diag); setMedicines(med)
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
      } else if (tab === "performance") {
        setTopServices([]); setDoctorPerf([]); setReferrals([]); setSurgeryBreakdown([])
        setPrescribedInvs([]); setPharmacySales([]); setLabTests([]); setPrescribedMeds([])
        const [top, dr, ref, sb, invs, pharm, labs, meds] = await Promise.all([
          getTopServices(...args),
          getDoctorPerformance(...args),
          getReferralStats(...args),
          getSurgeryBreakdown(...args),
          getTopPrescribedInvestigations(...args),
          getTopPharmacySales(...args),
          getTopLabTests(...args),
          getCommonMedicines(...args),
        ])
        setTopServices(top); setDoctorPerf(dr); setReferrals(ref); setSurgeryBreakdown(sb)
        setPrescribedInvs(invs); setPharmacySales(pharm); setLabTests(labs); setPrescribedMeds(meds)
      } else if (tab === "region") {
        setRegionStats([])
        const rs = await getRegionStats(...args)
        setRegionStats(rs)
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

          {/* Filter pills + Sitha toggle */}
          <div className="flex items-center gap-2.5">
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

            <button
              onClick={() => setChatOpen(o => !o)}
              title={chatOpen ? "Hide Sitha" : "Ask Sitha AI"}
              className={cn(
                "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors shrink-0",
                chatOpen
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {chatOpen ? "Hide Sitha" : "Ask Sitha"}
            </button>
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
        <div className={cn("max-w-[1320px] mx-auto", chatOpen && "flex gap-6 items-start")}>

          {/* Main content */}
          <div className={cn(chatOpen && "flex-1 min-w-0")}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-9 w-9 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="mt-4 text-sm text-muted-foreground">Loading analytics...</p>
              </div>
            ) : (
              <>
                {tab === "overview" && (
                  overview
                    ? <OverviewTab
                        overview={overview}
                        gender={gender}
                        ageGroups={ageGroups}
                        revenueByCategory={revenueByCategory}
                      />
                    : <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">No overview data available</div>
                )}
                {tab === "patients" && (
                  <PatientsTab
                    timeSeries={timeSeries}
                    gender={gender}
                    referrals={referrals}
                    diagnoses={diagnoses}
                    medicines={medicines}
                    overview={overview}
                  />
                )}
                {tab === "revenue" && (
                  <RevenueTab
                    financial={financial}
                    expenseBreakdown={expenseBreakdown}
                    timeSeries={timeSeries}
                    revenueByCategory={revenueByCategory}
                    paymentModes={paymentModes}
                  />
                )}
                {tab === "performance" && (
                  <PerformanceTab
                    topServices={topServices}
                    doctorPerf={doctorPerf}
                    referrals={referrals}
                    totalSurgeries={overview?.totalSurgeries ?? 0}
                    conversionRate={overview?.conversionRate ?? 0}
                    surgeryBreakdown={surgeryBreakdown}
                    prescribedMeds={prescribedMeds}
                    pharmacySales={pharmacySales}
                    prescribedInvs={prescribedInvs}
                    labTests={labTests}
                  />
                )}
                {tab === "region" && (
                  <RegionTab regionStats={regionStats} />
                )}
                {tab === "calls" && (
                  <CallAnalyticsTab startDate={callDateRange.startDate} endDate={callDateRange.endDate} />
                )}
              </>
            )}
          </div>

          {/* Sitha AI panel */}
          {chatOpen && (
            <div className="w-80 shrink-0 sticky top-[113px] self-start max-h-[calc(100vh-8rem)] overflow-y-auto pr-0.5">
              <AskSithaAI patientId={null} module="analytics" />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
