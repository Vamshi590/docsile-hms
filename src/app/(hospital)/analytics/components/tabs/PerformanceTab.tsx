"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState, fmt } from "../analytics-shared"
import type { TopService, DoctorPerformance, SurgeryBreakdown, CommonMedicine, CommonInvestigation, PharmacySaleStat, LabTestStat } from "../../actions"

const INDIGO = ["#4f46e5", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"]

const AVATAR_GRADIENTS = [
  ["#f59e0b", "#fbbf24"],
  ["#6366f1", "#818cf8"],
  ["#8b5cf6", "#a78bfa"],
  ["#14b8a6", "#2dd4bf"],
  ["#f97316", "#fb923c"],
  ["#64748b", "#94a3b8"],
  ["#ec4899", "#f9a8d4"],
  ["#10b981", "#34d399"],
]

const BAR_COLORS = [
  "linear-gradient(90deg,#4f46e5,#818cf8)",
  "linear-gradient(90deg,#6366f1,#a5b4fc)",
  "linear-gradient(90deg,#8b5cf6,#c4b5fd)",
  "linear-gradient(90deg,#14b8a6,#5eead4)",
  "linear-gradient(90deg,#f97316,#fdba74)",
  "linear-gradient(90deg,#94a3b8,#cbd5e1)",
  "linear-gradient(90deg,#ec4899,#f9a8d4)",
  "linear-gradient(90deg,#10b981,#34d399)",
]

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

interface Props {
  topServices: TopService[]
  doctorPerf: DoctorPerformance[]
  referrals: { name: string; count: number }[]
  totalSurgeries: number
  conversionRate: number
  surgeryBreakdown: SurgeryBreakdown[]
  prescribedMeds: CommonMedicine[]
  pharmacySales: PharmacySaleStat[]
  prescribedInvs: CommonInvestigation[]
  labTests: LabTestStat[]
}

export default function PerformanceTab({
  topServices, doctorPerf, referrals, totalSurgeries, conversionRate, surgeryBreakdown,
  prescribedMeds, pharmacySales, prescribedInvs, labTests,
}: Props) {
  const maxPatients = doctorPerf[0]?.patients ?? 1
  const maxService  = topServices[0]?.revenue ?? 1
  const maxSurgery  = surgeryBreakdown[0]?.count ?? 1

  const referralTotal = referrals.reduce((s, r) => s + r.count, 0)
  const referralData  = referrals.slice(0, 5).map(r => ({ name: r.name, value: r.count }))

  return (
    <div className="space-y-5">

      {/* ROW 1: Doctor Leaderboard + Top Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Doctor Leaderboard */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Doctor Leaderboard</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Ranked by patients seen · revenue alongside</p>
            {doctorPerf.length > 0 ? (
              <div>
                {doctorPerf.map((doc, i) => {
                  const [from, to] = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]
                  const rankLabel = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`
                  const pct = Math.round((doc.patients / maxPatients) * 100)
                  return (
                    <div key={doc.name} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                      <span className="text-sm w-6 text-center shrink-0">{rankLabel}</span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: `linear-gradient(135deg,${from},${to})` }}
                      >
                        {initials(doc.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground tabular-nums">{doc.patients} pts</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{fmt(doc.revenue)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Top Services by Revenue</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Most billed services this period</p>
            {topServices.length > 0 ? (
              <div>
                {topServices.slice(0, 8).map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{s.name}</span>
                    <div className="w-28 shrink-0">
                      <div className="h-2 bg-indigo-50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                          style={{ width: `${Math.round((s.revenue / maxService) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right shrink-0">{s.count}</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums w-14 text-right shrink-0">{fmt(s.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>

      {/* ROW 2: Surgery Breakdown + Referral Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Surgery Breakdown */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Surgery Breakdown</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">By procedure type this period</p>
            {totalSurgeries > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-4 p-3.5 bg-pink-50 border border-pink-100 rounded-xl">
                  <p className="text-4xl font-black text-pink-700 tabular-nums">{totalSurgeries}</p>
                  <div>
                    <p className="text-xs font-semibold text-pink-800">Total Surgeries</p>
                    <p className="text-[11px] text-pink-600 mt-0.5">Conversion rate: <strong>{conversionRate}%</strong></p>
                  </div>
                </div>
                {surgeryBreakdown.length > 0 ? (
                  <div>
                    {surgeryBreakdown.map(s => (
                      <div key={s.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                        <span className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">{s.name}</span>
                        <div className="w-28 shrink-0">
                          <div className="h-2 bg-pink-50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-pink-600 to-pink-400"
                              style={{ width: `${Math.round((s.count / maxSurgery) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-pink-700 tabular-nums w-6 text-right shrink-0">{s.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No procedure breakdown available" />
                )}
              </>
            ) : <EmptyState message="No surgeries this period" />}
          </CardContent>
        </Card>

        {/* Referral Sources donut */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Referral Sources</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Where patients are referred from</p>
            {referralData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="shrink-0" style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={referralData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                        dataKey="value" paddingAngle={2} strokeWidth={0}>
                        {referralData.map((_, i) => <Cell key={i} fill={INDIGO[i % INDIGO.length]} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]
                          return (
                            <div className="bg-white border border-border/40 rounded-lg px-3 py-2 shadow-md text-xs">
                              <p className="font-semibold">{d.name}</p>
                              <p className="text-muted-foreground mt-0.5">
                                {d.value} · {referralTotal > 0 ? Math.round((Number(d.value) / referralTotal) * 100) : 0}%
                              </p>
                            </div>
                          )
                        }}
                        cursor={false}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {referralData.map((r, i) => {
                    const pct = referralTotal > 0 ? Math.round((r.value / referralTotal) * 100) : 0
                    return (
                      <div key={r.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: INDIGO[i % INDIGO.length] }} />
                          <span className="text-xs text-muted-foreground truncate">{r.name}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs font-semibold tabular-nums">{r.value}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <EmptyState message="No referral data for this period" />}
          </CardContent>
        </Card>
      </div>

      {/* ROW 3: Top Medicines Prescribed + Top Medicines Sold */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Medicines Prescribed */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Top Medicines Prescribed</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Most frequently prescribed drugs this period</p>
            {prescribedMeds.filter(m => m.name !== "Others").length > 0 ? (
              <div>
                {prescribedMeds.filter(m => m.name !== "Others").map((m, i) => (
                  <div key={m.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{m.name}</span>
                    <div className="w-24 shrink-0">
                      <div className="h-2 bg-violet-50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                          style={{ width: `${m.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-foreground tabular-nums w-10 text-right shrink-0">{m.count}x</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>

        {/* Top Medicines Sold */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Top Medicines Sold</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Best-selling medicines from pharmacy billing</p>
            {pharmacySales.length > 0 ? (() => {
              const maxQty = pharmacySales[0]?.quantity ?? 1
              return (
                <div>
                  {pharmacySales.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{m.name}</span>
                      <div className="w-24 shrink-0">
                        <div className="h-2 bg-teal-50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
                            style={{ width: `${Math.round((m.quantity / maxQty) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right shrink-0">{m.quantity} qty</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums w-14 text-right shrink-0">{fmt(m.revenue)}</span>
                    </div>
                  ))}
                </div>
              )
            })() : <EmptyState />}
          </CardContent>
        </Card>
      </div>

      {/* ROW 4: Top Investigations Prescribed + Top Lab Tests Billed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Investigations Prescribed */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Top Investigations Prescribed</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Most ordered investigations from prescriptions</p>
            {prescribedInvs.length > 0 ? (() => {
              const maxCount = prescribedInvs[0]?.count ?? 1
              return (
                <div>
                  {prescribedInvs.map((inv, i) => (
                    <div key={inv.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{inv.name}</span>
                      <div className="w-24 shrink-0">
                        <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                            style={{ width: `${Math.round((inv.count / maxCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground tabular-nums w-10 text-right shrink-0">{inv.count}x</span>
                    </div>
                  ))}
                </div>
              )
            })() : <EmptyState />}
          </CardContent>
        </Card>

        {/* Top Lab Tests Billed */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Top Lab Tests Billed</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Most billed lab investigations this period</p>
            {labTests.length > 0 ? (() => {
              const maxRev = labTests[0]?.revenue ?? 1
              return (
                <div>
                  {labTests.map((t, i) => (
                    <div key={t.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{t.name}</span>
                      <div className="w-24 shrink-0">
                        <div className="h-2 bg-sky-50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400"
                            style={{ width: `${Math.round((t.revenue / maxRev) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right shrink-0">{t.count}x</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums w-14 text-right shrink-0">{fmt(t.revenue)}</span>
                    </div>
                  ))}
                </div>
              )
            })() : <EmptyState />}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
