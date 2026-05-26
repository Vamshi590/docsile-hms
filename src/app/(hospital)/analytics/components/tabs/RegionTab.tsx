"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "../analytics-shared"
import type { RegionStat } from "../../actions"

const INDIGO = ["#4f46e5", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"]
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

function getInsightBadge(stat: RegionStat, maxTotal: number) {
  const pct = maxTotal > 0 ? stat.total / maxTotal : 0
  const returnRate = stat.total > 0 ? stat.returning / stat.total : 0

  if (pct >= 0.6 && returnRate >= 0.4) return { label: "Strong", color: "bg-emerald-100 text-emerald-700" }
  if (pct >= 0.3 && returnRate >= 0.3) return { label: "Stable", color: "bg-blue-100 text-blue-700" }
  if (pct >= 0.15) return { label: "Opportunity", color: "bg-amber-100 text-amber-700" }
  return { label: "Focus Needed", color: "bg-rose-100 text-rose-700" }
}

interface Props {
  regionStats: RegionStat[]
}

export default function RegionTab({ regionStats }: Props) {
  if (regionStats.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-10">
          <EmptyState message="No region data yet — add addresses to patient records to see regional stats" />
        </CardContent>
      </Card>
    )
  }

  const maxTotal = regionStats[0]?.total ?? 1
  const grandTotal = regionStats.reduce((s, r) => s + r.total, 0)

  const pieData = regionStats.slice(0, 5).map(r => ({ name: r.region, value: r.total }))
  const topConcentration = regionStats[0]

  return (
    <div className="space-y-5">

      {/* ROW 1: Leaderboard + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Region Leaderboard */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Patients by Region</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Ranked by patient volume this period</p>
            <div>
              {regionStats.map((r, i) => {
                const rankLabel = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`
                const pct = Math.round((r.total / maxTotal) * 100)
                return (
                  <div key={r.region} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                    <span className="text-sm w-6 text-center shrink-0">{rankLabel}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{r.region}</p>
                      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground tabular-nums">{r.total} pts</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{r.percentage}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Regional Distribution Donut */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Regional Distribution</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Share of total patients by region</p>
            <div className="flex items-center gap-4">
              <div className="shrink-0" style={{ width: 140, height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={44} outerRadius={64}
                      dataKey="value" paddingAngle={2} strokeWidth={0}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={INDIGO[i % INDIGO.length]} />)}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]
                        const pct = grandTotal > 0 ? Math.round((Number(d.value) / grandTotal) * 100) : 0
                        return (
                          <div className="bg-white border border-border/40 rounded-lg px-3 py-2 shadow-md text-xs">
                            <p className="font-semibold">{d.name}</p>
                            <p className="text-muted-foreground mt-0.5">{d.value} pts · {pct}%</p>
                          </div>
                        )
                      }}
                      cursor={false}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {pieData.map((r, i) => {
                  const pct = grandTotal > 0 ? Math.round((r.value / grandTotal) * 100) : 0
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
          </CardContent>
        </Card>
      </div>

      {/* ROW 2: New vs Returning + Concentration Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* New vs Returning stacked bars */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">New vs Returning by Region</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Patient loyalty breakdown per region</p>
            <div>
              {regionStats.map((r) => {
                const newPct = r.total > 0 ? Math.round((r.newPatients / r.total) * 100) : 0
                const retPct = 100 - newPct
                return (
                  <div key={r.region} className="py-2.5 border-b border-border/30 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{r.region}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{r.total} total</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden gap-px">
                      {newPct > 0 && (
                        <div
                          className="bg-indigo-500 rounded-l-full"
                          style={{ width: `${newPct}%` }}
                          title={`New: ${r.newPatients}`}
                        />
                      )}
                      {retPct > 0 && (
                        <div
                          className="bg-emerald-400 rounded-r-full"
                          style={{ width: `${retPct}%` }}
                          title={`Returning: ${r.returning}`}
                        />
                      )}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-indigo-600 tabular-nums">{r.newPatients} new ({newPct}%)</span>
                      <span className="text-[10px] text-emerald-600 tabular-nums">{r.returning} returning ({retPct}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-[10px] text-muted-foreground">New patients</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[10px] text-muted-foreground">Returning patients</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Concentration Insights */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Concentration Insights</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Where to focus outreach and resources</p>

            {topConcentration && (
              <div className="mb-4 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-xs font-semibold text-indigo-800">Top region: {topConcentration.region}</p>
                <p className="text-[11px] text-indigo-600 mt-1">
                  {topConcentration.total} patients ({topConcentration.percentage}% of total) — {" "}
                  {topConcentration.total > 0 ? Math.round((topConcentration.returning / topConcentration.total) * 100) : 0}% returning
                </p>
              </div>
            )}

            <div className="space-y-2">
              {regionStats.map((r, i) => {
                const badge = getInsightBadge(r, maxTotal)
                const returnRate = r.total > 0 ? Math.round((r.returning / r.total) * 100) : 0
                return (
                  <div key={r.region} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: INDIGO[i % INDIGO.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{r.region}</p>
                      <p className="text-[10px] text-muted-foreground">{returnRate}% return rate</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
