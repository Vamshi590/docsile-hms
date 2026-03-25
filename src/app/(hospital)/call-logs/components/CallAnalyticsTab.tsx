"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Clock, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Users, Link2, Flame, Moon, Timer,
} from "lucide-react"
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { getCallAnalytics, type CallAnalyticsData } from "../actions"

// ─── Colors ──────────────────────────────────────────

const COLORS = {
  answered: "#10b981",
  missed: "#ef4444",
  busy: "#f59e0b",
  failed: "#94a3b8",
  inbound: "#3b82f6",
  outbound: "#f97316",
  primary: "#3b82f6",
  purple: "#8b5cf6",
}

const GRADIENT_COLORS = [
  { id: "gAnswered", color: "#10b981" },
  { id: "gMissed", color: "#ef4444" },
  { id: "gTotal", color: "#3b82f6" },
]

// ─── Helpers ─────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM"
  if (h === 12) return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatPhone(phone: string): string {
  if (phone.length === 10) return `${phone.slice(0, 5)} ${phone.slice(5)}`
  return phone
}

const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0

// ─── KPI Card ────────────────────────────────────────

function KPICard({ title, value, subtitle, change, icon, accentColor, accentBg }: {
  title: string; value: string | number; subtitle?: string; change?: number
  icon: React.ReactNode; accentColor: string; accentBg: string
}) {
  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-sm">
      <div className={`absolute top-0 left-0 w-full h-[3px] ${accentBg}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-[26px] font-extrabold tracking-tight text-foreground leading-none">{value}</p>
            {change !== undefined && change !== 0 && (
              <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${change > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change)}% vs prev
              </div>
            )}
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl ${accentBg} bg-opacity-10 flex items-center justify-center`}>
            <div className={accentColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Chart Card ──────────────────────────────────────

function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <Card className={`overflow-hidden border-0 shadow-sm ${className}`}>
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// ─── Custom Tooltip ──────────────────────────────────

function ChartTooltip({ active, payload, label, suffix = "" }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>
  label?: string; suffix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-xl shadow-xl p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500">{entry.name}</span>
          <span className="font-bold text-gray-900 ml-auto">{entry.value}{suffix}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Heatmap Cell ────────────────────────────────────

function HeatmapGrid({ data }: { data: CallAnalyticsData["hourlyDistribution"] }) {
  const maxVal = Math.max(...data.map(d => d.total), 1)

  return (
    <div className="space-y-3">
      {/* Hour labels row */}
      <div className="grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
        {data.map((d) => {
          const intensity = d.total / maxVal
          const bg = d.total === 0
            ? "bg-gray-50"
            : intensity > 0.75 ? "bg-blue-500" : intensity > 0.5 ? "bg-blue-400" : intensity > 0.25 ? "bg-blue-300" : "bg-blue-200"
          return (
            <div key={d.hour} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground font-medium">
                {d.hour % 3 === 0 ? formatHour(d.hour).replace(" AM", "a").replace(" PM", "p") : ""}
              </span>
              <div
                className={`w-full aspect-square rounded-[4px] ${bg} transition-all duration-200 hover:scale-110 cursor-default relative group/cell`}
                title={`${formatHour(d.hour)}: ${d.total} calls (${d.answered} answered, ${d.missed} missed)`}
              >
                {d.total > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[8px] font-bold ${intensity > 0.5 ? "text-white" : "text-blue-700"}`}>
                      {d.total}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {["bg-gray-50", "bg-blue-200", "bg-blue-300", "bg-blue-400", "bg-blue-500"].map((bg, i) => (
          <div key={i} className={`h-3 w-3 rounded-[3px] ${bg}`} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  )
}

// ─── Ring Stat ───────────────────────────────────────

function RingStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0
  const circumference = 2 * Math.PI * 28
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="5" />
          <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-extrabold text-foreground">{Math.round(percentage)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────

export default function CallAnalyticsTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<CallAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getCallAnalytics(startDate, endDate)
      setData(result)
    } catch (err) {
      console.error("Failed to load call analytics:", err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Loading call analytics...</p>
      </div>
    )
  }

  if (!data) return null

  const directionData = [
    { name: "Inbound", value: data.inboundCalls, color: COLORS.inbound },
    { name: "Outbound", value: data.outboundCalls, color: COLORS.outbound },
  ].filter(d => d.value > 0)

  const statusPieData = [
    { name: "Answered", value: data.answeredCalls, color: COLORS.answered },
    { name: "Missed", value: data.missedCalls, color: COLORS.missed },
    { name: "Busy", value: data.busyCalls, color: COLORS.busy },
    { name: "Failed", value: data.failedCalls, color: COLORS.failed },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Row 1: Hero KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard title="Total Calls" value={data.totalCalls} change={data.totalChange}
          icon={<Phone className="h-[18px] w-[18px]" />} accentColor="text-blue-600" accentBg="bg-blue-500" />
        <KPICard title="Answered" value={data.answeredCalls} change={data.answeredChange}
          subtitle={`${data.answerRate}% answer rate`}
          icon={<Phone className="h-[18px] w-[18px]" />} accentColor="text-emerald-600" accentBg="bg-emerald-500" />
        <KPICard title="Missed" value={data.missedCalls} change={data.missedChange}
          subtitle={`${data.missedRate}% miss rate`}
          icon={<PhoneMissed className="h-[18px] w-[18px]" />} accentColor="text-red-500" accentBg="bg-red-500" />
        <KPICard title="Avg Duration" value={formatDuration(data.avgDuration)}
          subtitle={`${formatDuration(data.totalTalkTime)} total`}
          icon={<Timer className="h-[18px] w-[18px]" />} accentColor="text-violet-600" accentBg="bg-violet-500" />
        <KPICard title="Patient Linked" value={data.linkedCalls}
          subtitle={`${pct(data.linkedCalls, data.totalCalls)}% of calls`}
          icon={<Link2 className="h-[18px] w-[18px]" />} accentColor="text-cyan-600" accentBg="bg-cyan-500" />
      </div>

      {/* ── Row 2: Answer/Miss Rate Rings + Direction + Quick Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Breakdown - Rings */}
        <ChartCard title="Call Outcome" subtitle="Answer vs miss rate">
          <div className="flex items-center justify-around py-3">
            <RingStat label="Answered" value={data.answeredCalls} total={data.totalCalls} color={COLORS.answered} />
            <RingStat label="Missed" value={data.missedCalls} total={data.totalCalls} color={COLORS.missed} />
            <RingStat label="Busy" value={data.busyCalls} total={data.totalCalls} color={COLORS.busy} />
          </div>
        </ChartCard>

        {/* Direction Pie */}
        <ChartCard title="Call Direction" subtitle="Inbound vs outbound split">
          <div className="h-52 flex items-center justify-center">
            {directionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={directionData} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                    dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                    {directionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </ChartCard>

        {/* Quick Insights */}
        <ChartCard title="Quick Insights" subtitle="Key performance indicators">
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100/60">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Peak Hour</p>
                  <p className="text-[10px] text-gray-500">Busiest time</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{formatHour(data.peakHour)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100/60">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Moon className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Quiet Hour</p>
                  <p className="text-[10px] text-gray-500">Least active</p>
                </div>
              </div>
              <span className="text-sm font-bold text-indigo-700">{formatHour(data.quietHour)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100/60">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Talk Time</p>
                  <p className="text-[10px] text-gray-500">Total conversation</p>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-700">{formatDuration(data.totalTalkTime)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/60">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Unique Callers</p>
                  <p className="text-[10px] text-gray-500">Distinct numbers</p>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-700">{data.topCallers.length}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Daily Trend ── */}
      {data.dailyTrend.length > 1 && (
        <ChartCard title="Daily Call Volume" subtitle="Answered vs missed trend over time">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyTrend}>
                <defs>
                  {GRADIENT_COLORS.map(g => (
                    <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={g.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8"
                  tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}` }} />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                <Area type="monotone" dataKey="answered" name="Answered" stroke={COLORS.answered}
                  fill="url(#gAnswered)" strokeWidth={2.5} dot={{ r: 2.5, fill: COLORS.answered }} />
                <Area type="monotone" dataKey="missed" name="Missed" stroke={COLORS.missed}
                  fill="url(#gMissed)" strokeWidth={2} dot={{ r: 2, fill: COLORS.missed }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* ── Row 4: Heatmap + Duration Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <ChartCard title="Hourly Activity" subtitle="Call volume by hour of day" className="lg:col-span-3">
          <HeatmapGrid data={data.hourlyDistribution} />
        </ChartCard>

        <ChartCard title="Call Duration Distribution" subtitle="How long answered calls last" className="lg:col-span-2">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.durationBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip content={<ChartTooltip suffix=" calls" />} />
                <Bar dataKey="count" name="Calls" radius={[6, 6, 0, 0]} barSize={28}>
                  {data.durationBuckets.map((_, i) => (
                    <Cell key={i} fill={i < 2 ? "#93c5fd" : i < 4 ? "#3b82f6" : "#1d4ed8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 5: Top Callers Table ── */}
      {data.topCallers.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Top Callers</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Most frequent contacts in this period</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Calls</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Answered</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Answer Rate</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Talk Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topCallers.map((caller, i) => {
                    const rate = caller.calls > 0 ? Math.round((caller.answered / caller.calls) * 100) : 0
                    return (
                      <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${
                            i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-400"
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-semibold text-foreground text-xs">{caller.name || "Unknown"}</p>
                            <p className="text-[11px] text-muted-foreground">{formatPhone(caller.phone)}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-foreground">{caller.calls}</td>
                        <td className="px-5 py-3 text-right text-emerald-600 font-semibold">{caller.answered}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium w-8 text-right">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-muted-foreground font-medium">
                          {formatDuration(caller.totalDuration)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 6: Status Breakdown Pie (only if varied data) ── */}
      {statusPieData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Status Breakdown" subtitle="Distribution of call outcomes">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={3} strokeWidth={0}>
                    {statusPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Inbound vs Outbound details */}
          <ChartCard title="Direction Details" subtitle="Inbound and outbound performance">
            <div className="space-y-4 py-2">
              {/* Inbound */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-blue-100/30 border border-blue-100/60">
                <div className="flex items-center gap-2 mb-3">
                  <PhoneIncoming className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-800">Inbound</span>
                  <span className="ml-auto text-lg font-extrabold text-blue-700">{data.inboundCalls}</span>
                </div>
                <div className="h-2 bg-blue-200/60 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct(data.inboundCalls, data.totalCalls)}%` }} />
                </div>
                <p className="text-[10px] text-blue-600 mt-1.5 font-medium">{pct(data.inboundCalls, data.totalCalls)}% of all calls</p>
              </div>

              {/* Outbound */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50/80 to-orange-100/30 border border-orange-100/60">
                <div className="flex items-center gap-2 mb-3">
                  <PhoneOutgoing className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-bold text-orange-800">Outbound</span>
                  <span className="ml-auto text-lg font-extrabold text-orange-700">{data.outboundCalls}</span>
                </div>
                <div className="h-2 bg-orange-200/60 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct(data.outboundCalls, data.totalCalls)}%` }} />
                </div>
                <p className="text-[10px] text-orange-600 mt-1.5 font-medium">{pct(data.outboundCalls, data.totalCalls)}% of all calls</p>
              </div>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  )
}
