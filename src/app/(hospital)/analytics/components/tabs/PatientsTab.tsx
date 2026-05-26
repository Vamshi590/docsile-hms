"use client"

import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  Users, UserPlus, BedDouble, Activity, Scissors,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ChartCard, CustomTooltip, EmptyState } from "../analytics-shared"
import type {
  TimeSeriesPoint, GenderDistribution, AnalyticsOverview,
  CommonDiagnosis, CommonMedicine,
} from "../../actions"

// Indigo shades for pie charts
const INDIGO = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff", "#ddd6fe"]

interface Props {
  timeSeries: TimeSeriesPoint[]
  gender: GenderDistribution | null
  referrals: { name: string; count: number }[]
  diagnoses: CommonDiagnosis[]
  medicines: CommonMedicine[]
  overview: AnalyticsOverview | null
}

function KpiCard({
  title, value, subtitle, icon, change,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  change?: number
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
            <p className="text-3xl font-black text-foreground mt-1.5 tabular-nums">{value}</p>
            {change !== undefined ? (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                <span>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}%</span>
                <span className="font-normal text-muted-foreground">{subtitle}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
            )}
          </div>
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <div className="text-indigo-500">{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PieSection({
  title, subtitle, data, nameKey, total,
}: {
  title: string
  subtitle: string
  data: { name: string; count: number; percentage: number }[]
  nameKey: string
  total: number
}) {
  if (data.length === 0) return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">{subtitle}</p>
        <EmptyState />
      </CardContent>
    </Card>
  )

  const pieData = data.map(d => ({ name: d.name, value: d.count }))

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">{subtitle}</p>
        <div className="flex items-center gap-5">
          <div className="shrink-0" style={{ width: 140, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%"
                  innerRadius={42} outerRadius={65}
                  dataKey="value" paddingAngle={2} strokeWidth={0}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={INDIGO[i % INDIGO.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]
                    return (
                      <div className="bg-white border border-border/40 rounded-lg px-3 py-2 shadow-md text-xs">
                        <p className="font-semibold text-foreground">{d.name}</p>
                        <p className="text-muted-foreground mt-0.5">{d.value} · {total > 0 ? Math.round((Number(d.value) / total) * 100) : 0}%</p>
                      </div>
                    )
                  }}
                  cursor={false}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2.5 min-w-0">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: INDIGO[i % INDIGO.length] }} />
                  <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PatientsTab({ timeSeries, gender, referrals, diagnoses, medicines, overview }: Props) {
  const genderTotal = (gender?.male ?? 0) + (gender?.female ?? 0) + (gender?.other ?? 0)

  const referralTotal = referrals.reduce((s, r) => s + r.count, 0)
  const referralData  = referrals.slice(0, 5).map(r => ({
    name: r.name,
    count: r.count,
    percentage: referralTotal > 0 ? Math.round((r.count / referralTotal) * 100) : 0,
  }))

  const diagnosisData = diagnoses.map(d => ({ name: d.diagnosis, count: d.count, percentage: d.percentage }))
  const medicineData  = medicines.map(m => ({ name: m.name, count: m.count, percentage: m.percentage }))
  const diagnosisTotal = diagnoses.reduce((s, d) => s + d.count, 0)
  const medicineTotal  = medicines.reduce((s, m) => s + m.count, 0)

  return (
    <div className="space-y-5">

      {/* ROW 1: 5 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Patients"
          value={(overview?.totalPatients ?? 0).toLocaleString("en-IN")}
          subtitle="vs last period"
          change={overview?.patientChange}
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          title="New Today"
          value={overview?.newPatientsToday ?? 0}
          subtitle="Registered today"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <KpiCard
          title="Active Inpatients"
          value={overview?.activeInpatients ?? 0}
          subtitle="Currently admitted"
          icon={<BedDouble className="h-5 w-5" />}
        />
        <KpiCard
          title="Avg / Day"
          value={overview?.avgDailyPatients ?? 0}
          subtitle="Patients per day"
          icon={<Activity className="h-5 w-5" />}
        />
        <KpiCard
          title="Surgeries"
          value={overview?.totalSurgeries ?? 0}
          subtitle="This period"
          icon={<Scissors className="h-5 w-5" />}
        />
      </div>

      {/* ROW 2: Daily Patient Volume */}
      <ChartCard title="Daily Patient Volume" subtitle="Number of patients registered per day">
        {timeSeries.length > 0 ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradPatientsTab" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Area type="monotone" dataKey="patients" name="Patients"
                  stroke="#6366f1" fill="url(#gradPatientsTab)" strokeWidth={2.5}
                  dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState />}
      </ChartCard>

      {/* ROW 3: Referral Sources + Gender Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Referral Sources */}
        <PieSection
          title="Top Referral Sources"
          subtitle="Where patients come from"
          data={referralData}
          nameKey="name"
          total={referralTotal}
        />

        {/* Gender Distribution */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Gender Distribution</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Patient demographics</p>
            {genderTotal > 0 && gender ? (
              <div className="flex items-center gap-6">
                <div className="shrink-0" style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Male",   value: gender.male   },
                          { name: "Female", value: gender.female },
                          { name: "Other",  value: gender.other  },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={60}
                        dataKey="value" paddingAngle={3} strokeWidth={0}
                      >
                        {["#4f46e5","#a5b4fc","#e0e7ff"].map((color, i) => (
                          <Cell key={i} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3.5">
                  {[
                    { label: "Male",   value: gender.male,   color: "#4f46e5" },
                    { label: "Female", value: gender.female, color: "#a5b4fc" },
                    { label: "Other",  value: gender.other,  color: "#e0e7ff" },
                  ].filter(g => g.value > 0).map(g => {
                    const pct = genderTotal > 0 ? Math.round((g.value / genderTotal) * 100) : 0
                    return (
                      <div key={g.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                            <span className="text-xs font-medium text-foreground">{g.label}</span>
                          </div>
                          <span className="text-xs font-bold text-foreground tabular-nums">
                            {g.value.toLocaleString("en-IN")} <span className="text-muted-foreground font-normal">{pct}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>

      {/* ROW 4: Eye Conditions + Medicines Prescribed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieSection
          title="Most Common Eye Conditions"
          subtitle="From doctor's diagnosis in prescriptions"
          data={diagnosisData}
          nameKey="diagnosis"
          total={diagnosisTotal}
        />
        <PieSection
          title="Most Common Medicines Prescribed"
          subtitle="From invoice items in prescriptions"
          data={medicineData}
          nameKey="name"
          total={medicineTotal}
        />
      </div>
    </div>
  )
}
