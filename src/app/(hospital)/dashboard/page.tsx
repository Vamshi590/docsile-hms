import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  Settings,
  ArrowRight,
  TrendingUp,
} from "lucide-react"
import { PageHeader } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

const modules = [
  {
    href: "/patients",
    icon: Users,
    label: "Patients",
    description: "Register OPD & IPD patients, manage visits and billing",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  {
    href: "/workup",
    icon: Eye,
    label: "Workup",
    description: "Pre-consultation eye assessment — refraction & clinical findings",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  {
    href: "/doctor",
    icon: Stethoscope,
    label: "Doctor Console",
    description: "Diagnosis, prescriptions, vitals and follow-up notes",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  {
    href: "/inpatients",
    icon: BedDouble,
    label: "In-Patients",
    description: "Admitted patients, surgery tracking, billing & discharge",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  {
    href: "/insurance",
    icon: Shield,
    label: "Insurance",
    description: "TPA insurance claims, preauth tracking, settlement and billing",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  {
    href: "/settings",
    icon: Settings,
    label: "Settings",
    description: "Hospital profile, service templates and user management",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
]

export default async function DashboardPage() {
  const user = await requireAuth()
  const now = new Date()
  const hour = now.getHours()
  const greeting = getGreeting(hour)

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  const [hospital, opdToday, ipdToday, activeIP] = await Promise.all([
    db.hospitalProfile.findFirst(),
    db.patient.count({
      where: { patientType: "OPD", appointmentDate: { gte: today, lt: tomorrow } },
    }),
    db.patient.count({
      where: { patientType: "IPD", appointmentDate: { gte: today, lt: tomorrow } },
    }),
    db.inPatient.count({
      where: { status: { not: "DISCHARGED" } },
    }),
  ])

  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"

  return (
    <div className="space-y-7 animate-fade-in bg-gray-50">

      <PageHeader
        title={`${greeting}, ${user.fullName.split(" ")[0]} 👋`}
        description={hospitalName}
      />

      {/* Module Cards */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Modules
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group"
            >
              <Card className="p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 h-full">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-11 w-11 rounded-xl ${mod.iconBg} flex items-center justify-center`}>
                      <mod.icon className={`h-5 w-5 ${mod.iconColor}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 mt-1" />
                  </div>
                  <h3 className="text-[0.95rem] font-semibold text-foreground mb-1">{mod.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
