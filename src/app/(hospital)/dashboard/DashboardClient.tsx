"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  Users, Eye, Stethoscope, BedDouble, Shield, Settings,
  FlaskConical, ClipboardList, Wallet, FileBarChart, Pill,
  Glasses, ScrollText, DatabaseZap, BarChart3, Quote, Phone,
  UserCog, UserPlus, ChevronRight, ArrowRight, Pin, PinOff,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

const roleQuickActions: Record<string, { href: string; icon: React.ElementType; label: string }[]> = {
  DOCTOR: [
    { href: "/doctor", icon: Stethoscope, label: "My Queue" },
    { href: "/patients", icon: Users, label: "Patients" },
    { href: "/workup", icon: Eye, label: "Refraction" },
    { href: "/inpatients", icon: BedDouble, label: "In-Patients" },
    { href: "/labs", icon: FlaskConical, label: "Lab Results" },
  ],
  RECEPTIONIST: [
    { href: "/patients", icon: UserPlus, label: "Register Patient" },
    { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-ups" },
    { href: "/call-logs", icon: Phone, label: "Call Logs" },
    { href: "/pharmacy", icon: Pill, label: "Pharmacy" },
    { href: "/labs", icon: FlaskConical, label: "Labs" },
  ],
  ADMIN: [
    { href: "/patients", icon: UserPlus, label: "Register Patient" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/reports", icon: FileBarChart, label: "Reports" },
    { href: "/expenses", icon: Wallet, label: "Expenses" },
    { href: "/staff", icon: UserCog, label: "Staff" },
  ],
  OPTOMETRIST: [
    { href: "/workup", icon: Eye, label: "Refraction" },
    { href: "/optical", icon: Glasses, label: "Optical" },
    { href: "/patients", icon: Users, label: "Patients" },
    { href: "/doctor", icon: Stethoscope, label: "Doctor Queue" },
    { href: "/labs", icon: FlaskConical, label: "Labs" },
  ],
  NURSE: [
    { href: "/doctor", icon: Stethoscope, label: "Doctor Queue" },
    { href: "/inpatients", icon: BedDouble, label: "In-Patients" },
    { href: "/patients", icon: Users, label: "Patients" },
    { href: "/labs", icon: FlaskConical, label: "Labs" },
    { href: "/pharmacy", icon: Pill, label: "Pharmacy" },
  ],
}

const defaultQuickActions = [
  { href: "/patients", icon: UserPlus, label: "Register Patient" },
  { href: "/doctor", icon: Stethoscope, label: "Doctor Queue" },
  { href: "/pharmacy", icon: Pill, label: "Pharmacy" },
  { href: "/labs", icon: FlaskConical, label: "Lab Tests" },
  { href: "/expenses", icon: Wallet, label: "Add Expense" },
]

const moduleGroups = [
  {
    label: "Clinical",
    color: "bg-blue-500",
    modules: [
      { href: "/patients", icon: Users, label: "Patients", iconBg: "bg-blue-50", iconColor: "text-blue-500", accentBorder: "group-hover:border-blue-200", accentText: "text-blue-500", description: "Register OPD & IPD visits, manage appointments and billing" },
      { href: "/workup", icon: Eye, label: "Refraction", iconBg: "bg-sky-50", iconColor: "text-sky-500", accentBorder: "group-hover:border-sky-200", accentText: "text-sky-500", description: "Pre-consultation eye assessment, refraction and clinical findings" },
      { href: "/doctor", icon: Stethoscope, label: "Doctor Console", iconBg: "bg-indigo-50", iconColor: "text-indigo-500", accentBorder: "group-hover:border-indigo-200", accentText: "text-indigo-500", description: "Diagnosis, prescriptions, vitals and follow-up notes" },
      { href: "/inpatients", icon: BedDouble, label: "In-Patients", iconBg: "bg-violet-50", iconColor: "text-violet-500", accentBorder: "group-hover:border-violet-200", accentText: "text-violet-500", description: "Admissions, surgery tracking, billing and discharge" },
    ],
  },
  {
    label: "Services",
    color: "bg-emerald-500",
    modules: [
      { href: "/labs", icon: FlaskConical, label: "Labs", iconBg: "bg-teal-50", iconColor: "text-teal-600", accentBorder: "group-hover:border-teal-200", accentText: "text-teal-600", description: "Lab investigations, test billing and report management" },
      { href: "/pharmacy", icon: Pill, label: "Pharmacy", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", accentBorder: "group-hover:border-emerald-200", accentText: "text-emerald-600", description: "Medicine inventory, billing, suppliers and purchase orders" },
      { href: "/optical", icon: Glasses, label: "Optical", iconBg: "bg-blue-50", iconColor: "text-blue-600", accentBorder: "group-hover:border-blue-200", accentText: "text-blue-600", description: "Frames, lenses and contact lens inventory with AR readings" },
      { href: "/insurance", icon: Shield, label: "Insurance", iconBg: "bg-cyan-50", iconColor: "text-cyan-600", accentBorder: "group-hover:border-cyan-200", accentText: "text-cyan-600", description: "TPA insurance claims, preauth tracking and settlements" },
    ],
  },
  {
    label: "Finance & Operations",
    color: "bg-amber-500",
    modules: [
      { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups", iconBg: "bg-amber-50", iconColor: "text-amber-600", accentBorder: "group-hover:border-amber-200", accentText: "text-amber-600", description: "Pending dues and patient follow-up reminders" },
      { href: "/expenses", icon: Wallet, label: "Expenses", iconBg: "bg-orange-50", iconColor: "text-orange-500", accentBorder: "group-hover:border-orange-200", accentText: "text-orange-500", description: "Record and categorize hospital expenses" },
      { href: "/call-logs", icon: Phone, label: "Call Logs", iconBg: "bg-green-50", iconColor: "text-green-600", accentBorder: "group-hover:border-green-200", accentText: "text-green-600", description: "Reception calls, Exotel sync and call analytics" },
    ],
  },
  {
    label: "Insights & Admin",
    color: "bg-rose-500",
    modules: [
      { href: "/analytics", icon: BarChart3, label: "Analytics", iconBg: "bg-rose-50", iconColor: "text-rose-500", accentBorder: "group-hover:border-rose-200", accentText: "text-rose-500", description: "Trends, financials and hospital-wide insights" },
      { href: "/reports", icon: FileBarChart, label: "Reports", iconBg: "bg-sky-50", iconColor: "text-sky-600", accentBorder: "group-hover:border-sky-200", accentText: "text-sky-600", description: "Patient history, prescriptions and billing reports" },
      { href: "/license-tracker", icon: ScrollText, label: "Licenses", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", accentBorder: "group-hover:border-indigo-200", accentText: "text-indigo-600", description: "Track licenses, registrations and renewal dates" },
      { href: "/data", icon: DatabaseZap, label: "Data Export", iconBg: "bg-cyan-50", iconColor: "text-cyan-700", accentBorder: "group-hover:border-cyan-200", accentText: "text-cyan-700", description: "Filter and export hospital data in CSV or Excel" },
      { href: "/staff", icon: UserCog, label: "Staff", iconBg: "bg-purple-50", iconColor: "text-purple-600", accentBorder: "group-hover:border-purple-200", accentText: "text-purple-600", description: "Staff members, roles and module-level permissions" },
      { href: "/settings", icon: Settings, label: "Settings", iconBg: "bg-slate-100", iconColor: "text-slate-600", accentBorder: "group-hover:border-slate-300", accentText: "text-slate-600", description: "Hospital profile, service templates and users" },
    ],
  },
]

interface DashboardClientProps {
  greeting: string
  firstName: string
  userRole: string
  opdCount: number
  ipdCount: number
  activeInpatients: number
}

export function DashboardClient({ greeting, firstName, userRole, opdCount, ipdCount, activeInpatients }: DashboardClientProps) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [quoteFading, setQuoteFading] = useState(false)
  const [time, setTime] = useState("")
  const [dateStr, setDateStr] = useState("")

  useEffect(() => {
    setQuoteIndex(Math.floor(Math.random() * quotes.length))
  }, [])

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

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }))
      setDateStr(now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const quote = quotes[quoteIndex]
  const totalToday = opdCount + ipdCount
  const opdPct = totalToday > 0 ? Math.round((opdCount / totalToday) * 100) : 0
  const ipdPct = totalToday > 0 ? 100 - opdPct : 0
  const quickActions = roleQuickActions[userRole] ?? defaultQuickActions

  // Pinned modules — persisted in localStorage, hydrated after mount
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([])
  useEffect(() => {
    try {
      const stored = localStorage.getItem("docsile-pinned-modules")
      if (stored) setPinnedHrefs(JSON.parse(stored))
    } catch {}
  }, [])

  const togglePin = (href: string) => {
    setPinnedHrefs(prev => {
      const next = prev.includes(href)
        ? prev.filter(h => h !== href)
        : [href, ...prev]
      try { localStorage.setItem("docsile-pinned-modules", JSON.stringify(next)) } catch {}
      return next
    })
  }

  const allModules = moduleGroups.flatMap(g => g.modules)
  const pinnedItems = pinnedHrefs
    .map(href => allModules.find(m => m.href === href))
    .filter(Boolean) as typeof allModules
  const defaultItems = quickActions.filter(a => !pinnedHrefs.includes(a.href))

  const statCards = [
    { label: "OPD Today", value: opdCount, icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
    { label: "IPD Today", value: ipdCount, icon: UserPlus, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    { label: "Active Inpatients", value: activeInpatients, icon: BedDouble, iconBg: "bg-violet-50", iconColor: "text-violet-500" },
  ]

  // Scroll-driven compact bar animations
  const leftColRef = useRef<HTMLDivElement>(null)
  const [scrollFraction, setScrollFraction] = useState(0)
  const [cardExitFraction, setCardExitFraction] = useState(0)
  const SCROLL_THRESHOLD = 72

  const handleScroll = useCallback(() => {
    const el = leftColRef.current
    if (!el) return

    const t = el.scrollTop
    setScrollFraction(Math.min(t / SCROLL_THRESHOLD, 1))
    setCardExitFraction(Math.min(Math.max((t - 20) / 52, 0), 1))
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden gap-5">

      {/* ── Top: Greeting only (full width) ── */}
      <div className="shrink-0 pt-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here&apos;s your hospital overview for today
        </p>
      </div>

      {/* ── Bottom: Left (stats + modules, scrolls) + Right sidebar (fixed) ── */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Left — stat cards + module groups, scrollable */}
        <div className="flex-1 min-w-0 relative">

          {/* Scroll container */}
          <div
            ref={leftColRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto scrollbar-auto pb-4"
          >

          {/* ── Compact sticky status bar ──
              h-14 = 56px, -mb-14 negates its own height → zero layout impact when invisible.
              Opacity is driven frame-by-frame from scroll position (no CSS transition needed). */}
          <div
            className="sticky top-0 z-20 h-14 -mb-14"
            style={{
              opacity: scrollFraction,
              pointerEvents: scrollFraction > 0.5 ? "auto" : "none",
            }}
          >
            <div
              className="h-full flex items-center gap-1 rounded-2xl px-5"
              style={{
                background: "rgba(255,255,255,0.65)",
                backdropFilter: "saturate(180%) blur(20px)",
                WebkitBackdropFilter: "saturate(180%) blur(20px)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.06)",
              }}
            >
              {statCards.map((card, i) => {
                const f = Math.min(Math.max((scrollFraction - i * 0.1) / 0.7, 0), 1)
                return (
                  <div
                    key={card.label}
                    className="flex items-center gap-1"
                    style={{ transform: `translateY(${(1 - f) * 5}px)` }}
                  >
                    {i > 0 && <div className="mx-3 h-3.5 w-px bg-slate-200 shrink-0" />}
                    <div className={`h-6 w-6 rounded-lg ${card.iconBg} flex items-center justify-center shrink-0`}>
                      <card.icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
                    </div>
                    <span className="ml-1.5 text-sm font-bold tabular-nums text-foreground">{card.value}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{card.label}</span>
                  </div>
                )
              })}
              <div className="mx-3 h-3.5 w-px bg-slate-200 shrink-0" />
              <div
                className="flex items-center gap-1.5"
                style={{ transform: `translateY(${(1 - Math.min(Math.max((scrollFraction - 0.3) / 0.7, 0), 1)) * 5}px)` }}
              >
                <div className="relative h-6 w-6 shrink-0">
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{
                      background: totalToday > 0
                        ? `conic-gradient(#3b82f6 0% ${opdPct}%, #8b5cf6 ${opdPct}% 100%)`
                        : "conic-gradient(#e2e8f0 0% 100%)",
                    }}
                  />
                  <div className="absolute inset-[3px] rounded-full bg-white/95" />
                </div>
                <span className="text-xs font-bold tabular-nums">
                  <span className="text-blue-500">{opdCount}</span>
                  <span className="text-muted-foreground font-normal mx-0.5">·</span>
                  <span className="text-violet-500">{ipdCount}</span>
                </span>
                <span className="text-xs text-muted-foreground">Mix</span>
              </div>
            </div>
          </div>

          {/* Blur feather below status bar */}
          <div
            className="sticky top-14 z-10 h-8 -mb-8 pointer-events-none"
            style={{ opacity: scrollFraction }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 100%)",
                backdropFilter: "saturate(180%) blur(8px)",
                WebkitBackdropFilter: "saturate(180%) blur(8px)",
                maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
              }}
            />
          </div>

          <div className="space-y-7">

            {/* Stat cards — same grid width as module cards */}
            <div
              className="grid grid-cols-4 gap-3"
              style={{
                opacity: 1 - cardExitFraction,
                transform: `translateY(${-cardExitFraction * 10}px) scale(${1 - cardExitFraction * 0.035})`,
                filter: `blur(${cardExitFraction * 2.5}px)`,
                pointerEvents: cardExitFraction > 0.8 ? 'none' : 'auto',
                willChange: 'opacity, transform, filter',
              }}
            >
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md hover:border-slate-300 transition-all duration-200"
                >
                  <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums leading-none">{card.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{card.label}</p>
                  </div>
                </div>
              ))}

              {/* Patient Mix — compact donut card */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md hover:border-slate-300 transition-all duration-200">
                <div className="relative shrink-0 h-8 w-8">
                  <div
                    className="h-8 w-8 rounded-full"
                    style={{
                      background: totalToday > 0
                        ? `conic-gradient(#3b82f6 0% ${opdPct}%, #8b5cf6 ${opdPct}% 100%)`
                        : "conic-gradient(#e2e8f0 0% 100%)",
                    }}
                  />
                  <div className="absolute inset-[4px] rounded-full bg-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground leading-none">Patient Mix</p>
                  <p className="text-xs font-bold text-foreground mt-0.5 tabular-nums">
                    <span className="text-blue-500">{opdCount}</span>
                    <span className="text-muted-foreground font-normal mx-1">·</span>
                    <span className="text-violet-500">{ipdCount}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Module groups */}
            {moduleGroups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className={`h-3.5 w-1 rounded-full ${group.color}`} />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{group.label}</p>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {group.modules.map((mod) => (
                    <Link
                      key={mod.href}
                      href={mod.href}
                      className={cn(
                        "group relative flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 overflow-hidden",
                        "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
                        mod.accentBorder,
                      )}
                    >
                      {/* Pin button */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(mod.href) }}
                        className={cn(
                          "absolute top-3 right-3 h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-150 z-10",
                          pinnedHrefs.includes(mod.href)
                            ? "opacity-100 bg-blue-50 text-primary"
                            : "opacity-0 group-hover:opacity-100 bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-primary",
                        )}
                        title={pinnedHrefs.includes(mod.href) ? "Remove from Quick Access" : "Pin to Quick Access"}
                      >
                        <Pin
                          className="h-3 w-3"
                          style={pinnedHrefs.includes(mod.href) ? { fill: "currentColor" } : undefined}
                        />
                      </button>

                      <div className={`h-11 w-11 rounded-xl ${mod.iconBg} flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform duration-200`}>
                        <mod.icon className={`h-5 w-5 ${mod.iconColor}`} />
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{mod.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{mod.description}</p>
                      <div className={cn(
                        "flex items-center gap-1 mt-3 transition-all duration-200",
                        "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0",
                        mod.accentText,
                      )}>
                        <span className="text-[11px] font-semibold">Open</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          </div>{/* end scroll container */}

        </div>{/* end left wrapper */}

        {/* Right — sidebar, never scrolls */}
        <div className="w-64 xl:w-72 shrink-0 flex flex-col gap-4 overflow-hidden pb-4">

          {/* Clock card — premium dark */}
          <div
            className="relative rounded-2xl px-5 py-5 shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
          >
            <div
              className="absolute -top-6 -right-6 h-28 w-28 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(96,165,250,0.25) 0%, transparent 70%)" }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='white'/%3E%3C/svg%3E\")" }}
            />
            <div className="relative flex items-center gap-1.5 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-200/70">Live</span>
            </div>
            <p className="relative text-3xl font-bold tabular-nums tracking-tight text-white leading-none">{time}</p>
            <p className="relative text-xs text-blue-200/60 mt-2 leading-snug">{dateStr}</p>
          </div>

          {/* Quick Access */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Access</p>
              {pinnedItems.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <Pin className="h-2.5 w-2.5" style={{ fill: "currentColor" }} />
                  {pinnedItems.length} pinned
                </span>
              )}
            </div>
            <div className="space-y-0.5">

              {/* Pinned modules — always at top */}
              {pinnedItems.map((item) => (
                <div key={item.href} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-blue-50/50 transition-colors duration-150">
                  <Link href={item.href} className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <item.icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{item.label}</span>
                  </Link>
                  <button
                    onClick={() => togglePin(item.href)}
                    className="h-5 w-5 flex items-center justify-center rounded-md text-primary hover:bg-blue-100 transition-colors shrink-0"
                    title="Unpin"
                  >
                    <PinOff className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Divider between pinned and defaults */}
              {pinnedItems.length > 0 && defaultItems.length > 0 && (
                <div className="my-1.5 h-px bg-slate-100" />
              )}

              {/* Role defaults (excluding already pinned) */}
              {defaultItems.map((action) => (
                <div key={action.href} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 transition-colors duration-150">
                  <Link href={action.href} className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors duration-150">
                      <action.icon className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{action.label}</span>
                  </Link>
                  <button
                    onClick={() => togglePin(action.href)}
                    className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-primary hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Pin to Quick Access"
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {pinnedItems.length === 0 && defaultItems.length === 0 && (
                <p className="text-xs text-muted-foreground/50 px-2.5 py-1.5">Pin modules using the pin icon on any card</p>
              )}

            </div>
          </div>

          {/* Daily Wisdom */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Quote className="h-4 w-4 text-primary/40" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Daily Wisdom</span>
            </div>
            <div className={cn("transition-all duration-500", quoteFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0")}>
              <p className="text-sm text-foreground/70 italic leading-relaxed">&ldquo;{quote?.text}&rdquo;</p>
              <p className="text-xs text-muted-foreground mt-3 font-medium">&mdash; {quote?.author}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
