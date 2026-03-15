import Link from "next/link"
import { getSession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  Settings,
  ArrowRight,
  TrendingUp,
  FlaskConical,
  ClipboardList,
  Wallet,
  FileBarChart,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  BarChart3,
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
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    href: "/workup",
    icon: Eye,
    label: "Workup",
    description: "Pre-consultation eye assessment — refraction & clinical findings",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-500",
  },
  {
    href: "/doctor",
    icon: Stethoscope,
    label: "Doctor Console",
    description: "Diagnosis, prescriptions, vitals and follow-up notes",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
  },
  {
    href: "/inpatients",
    icon: BedDouble,
    label: "In-Patients",
    description: "Admitted patients, surgery tracking, billing & discharge",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-500",
  },
  {
    href: "/insurance",
    icon: Shield,
    label: "Insurance",
    description: "TPA insurance claims, preauth tracking, settlement and billing",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
  },
  {
    href: "/labs",
    icon: FlaskConical,
    label: "Labs",
    description: "Lab investigations, billing and report configuration",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
  },
  {
    href: "/pharmacy",
    icon: Pill,
    label: "Pharmacy",
    description: "Inventory, billing, suppliers and purchase orders with GST",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    href: "/optical",
    icon: Glasses,
    label: "Optical",
    description: "Frames, lenses & contact lens inventory, billing with AR readings",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    href: "/dues-followups",
    icon: ClipboardList,
    label: "Dues & Follow-Ups",
    description: "Track pending dues and schedule patient follow-up reminders",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    href: "/expenses",
    icon: Wallet,
    label: "Expenses",
    description: "Record and categorize hospital expenses and expenditures",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    href: "/analytics",
    icon: BarChart3,
    label: "Analytics",
    description: "Comprehensive analytics dashboard with trends, financials and reports",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
  },
  {
    href: "/reports",
    icon: FileBarChart,
    label: "Reports",
    description: "Patient history, visit records, prescriptions and billing reports",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    href: "/license-tracker",
    icon: ScrollText,
    label: "License Tracker",
    description: "Track hospital licenses, registrations and renewal dates",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
  {
    href: "/data",
    icon: DatabaseZap,
    label: "Data Export",
    description: "Select, filter and export hospital data in CSV or Excel format",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-700",
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
  const user = (await getSession())!
  const now = new Date()
  const hour = now.getHours()
  const greeting = getGreeting(hour)

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  const supabase = await createClient()
  const [opdResult, ipdResult, activeIPResult] = await Promise.all([
    supabase
      .from("Patient")
      .select("*", { count: "exact", head: true })
      .eq("patientType", "OPD")
      .gte("appointmentDate", today.toISOString())
      .lt("appointmentDate", tomorrow.toISOString()),
    supabase
      .from("Patient")
      .select("*", { count: "exact", head: true })
      .eq("patientType", "IPD")
      .gte("appointmentDate", today.toISOString())
      .lt("appointmentDate", tomorrow.toISOString()),
    supabase
      .from("InPatient")
      .select("*", { count: "exact", head: true })
      .neq("status", "DISCHARGED"),
  ])
  const opdToday = opdResult.count ?? 0
  const ipdToday = ipdResult.count ?? 0
  const activeIP = activeIPResult.count ?? 0

  return (
    <div className="space-y-7 animate-fade-in bg-gray-50">

      <PageHeader
        title={`${greeting},👋`}
        description="Dashboard"
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
