"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  Settings,
  ArrowRight,
  FlaskConical,
  ClipboardList,
  Wallet,
  FileBarChart,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  BarChart3,
  Quote,
  Heart,
  Phone,
  UserCog,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ROUTE_MODULES } from "@/lib/module-gate"

const quotes = [
  { text: "The good physician treats the disease; the great physician treats the patient who has the disease.", author: "Sir William Osler" },
  { text: "Wherever the art of medicine is loved, there is also a love of humanity.", author: "Hippocrates" },
  { text: "The art of medicine consists of amusing the patient while nature cures the disease.", author: "Voltaire" },
  { text: "Medicine is not only a science; it is also an art. It does not consist of compounding pills and plasters; it deals with the very processes of life.", author: "Paracelsus" },
  { text: "The best doctor gives the least medicines.", author: "Benjamin Franklin" },
  { text: "Healing is a matter of time, but it is sometimes also a matter of opportunity.", author: "Hippocrates" },
  { text: "Let food be thy medicine and medicine be thy food.", author: "Hippocrates" },
  { text: "The doctor of the future will give no medicine, but will instruct his patients in care of the human frame.", author: "Thomas Edison" },
  { text: "People pay the doctor for his trouble; for his kindness they still remain in his debt.", author: "Seneca" },
  { text: "A doctor who cannot take a good history and a patient who cannot give one are in danger of giving and receiving bad treatment.", author: "Paul Dudley White" },
]

const modules = [
  { href: "/patients", icon: Users, label: "Patients", description: "Register and manage OPD & IPD patient visits, appointments and billing", iconBg: "bg-blue-50", iconColor: "text-blue-500" },
  { href: "/workup", icon: Eye, label: "Refraction", description: "Pre-consultation eye assessment with refraction and clinical findings", iconBg: "bg-sky-50", iconColor: "text-sky-500" },
  { href: "/doctor", icon: Stethoscope, label: "Doctor Console", description: "Diagnosis, prescriptions, vitals recording and follow-up notes", iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
  { href: "/labs", icon: FlaskConical, label: "Labs", description: "Lab investigations, test billing and report configuration", iconBg: "bg-teal-50", iconColor: "text-teal-600" },
  { href: "/pharmacy", icon: Pill, label: "Pharmacy", description: "Medicine inventory, billing, suppliers and purchase orders", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { href: "/optical", icon: Glasses, label: "Optical", description: "Frames, lenses and contact lens inventory with AR readings", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { href: "/inpatients", icon: BedDouble, label: "In-Patients", description: "Patient admissions, surgery tracking, billing and discharge", iconBg: "bg-violet-50", iconColor: "text-violet-500" },
  { href: "/insurance", icon: Shield, label: "Insurance", description: "TPA insurance claims, preauth tracking and settlements", iconBg: "bg-cyan-50", iconColor: "text-cyan-600" },
  { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups", description: "Track pending dues and schedule patient follow-up reminders", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { href: "/expenses", icon: Wallet, label: "Expenses", description: "Record and categorize hospital expenses and expenditures", iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { href: "/call-logs", icon: Phone, label: "Call Logs", description: "Reception call management, Exotel sync and call analytics", iconBg: "bg-green-50", iconColor: "text-green-600" },
  { href: "/analytics", icon: BarChart3, label: "Analytics", description: "Comprehensive dashboard with trends, financials and insights", iconBg: "bg-rose-50", iconColor: "text-rose-500" },
  { href: "/reports", icon: FileBarChart, label: "Reports", description: "Patient history, visit records, prescriptions and billing reports", iconBg: "bg-sky-50", iconColor: "text-sky-600" },
  { href: "/license-tracker", icon: ScrollText, label: "Licenses", description: "Track hospital licenses, registrations and renewal dates", iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
  { href: "/data", icon: DatabaseZap, label: "Data Export", description: "Select, filter and export hospital data in CSV or Excel", iconBg: "bg-cyan-50", iconColor: "text-cyan-700" },
  { href: "/staff", icon: UserCog, label: "Staff", description: "Manage staff members, roles and module-level permissions", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
  { href: "/settings", icon: Settings, label: "Configurations", description: "Hospital profile, service templates and user management", iconBg: "bg-slate-100", iconColor: "text-slate-600" },
]

interface DashboardClientProps {
  greeting: string
  enabledModules: string[]
}

export function DashboardClient({ greeting, enabledModules }: DashboardClientProps) {
  // Filter the modules grid: keep always-on routes (those not in ROUTE_MODULES like
  // /dues-followups, /data, /staff, /settings) + gated routes that ARE enabled.
  const visibleModules = modules.filter((mod) => {
    const moduleCode = ROUTE_MODULES[mod.href]
    if (!moduleCode) return true // always-on
    return enabledModules.includes(moduleCode)
  })
  const [mounted, setMounted] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [quoteFading, setQuoteFading] = useState(false)

  useEffect(() => {
    setMounted(true)
    setQuoteIndex(Math.floor(Math.random() * quotes.length))
  }, [])

  // Rotate quotes every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteFading(true)
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % quotes.length)
        setQuoteFading(false)
      }, 500)
    }, 10000)
    return () => clearInterval(interval)
  }, [])


  const quote = quotes[quoteIndex]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Greeting + Quote Banner */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-linear-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10 px-8 py-7 mb-8 transition-all duration-700",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              {greeting}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s your hospital overview for today
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>

        {/* Inspirational Quote */}
        <div
          className={cn(
            "mt-5 flex items-start gap-3 transition-all duration-500",
            quoteFading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          )}
        >
          <Quote className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground/70 italic leading-relaxed">
              &ldquo;{quote?.text}&rdquo;
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              &mdash; {quote?.author}
            </p>
          </div>
        </div>
      </div>

     

      {/* Modules Grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Modules</p>
        <div className="grid grid-cols-3 gap-4">
          {visibleModules.map((mod, i) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={cn(
                "group relative rounded-2xl border border-border bg-white p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
              style={{ transitionDelay: `${400 + i * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl ${mod.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                  <mod.icon className={`h-5 w-5 ${mod.iconColor}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 mt-1" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{mod.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{mod.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
