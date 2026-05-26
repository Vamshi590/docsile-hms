"use client"

import React from "react"
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// ─── COLORS ──────────────────────────────────────────
export const CHART_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
]

export const SOURCE_COLORS: Record<string, string> = {
  Consultations: "#3b82f6",
  Labs:          "#14b8a6",
  Pharmacy:      "#10b981",
  Optical:       "#8b5cf6",
  "In-Patient":  "#f59e0b",
}

export const STATUS_COLORS: Record<string, string> = {
  REGISTERED:   "#94a3b8",
  IN_WORKUP:    "#f59e0b",
  WORKUP_DONE:  "#06b6d4",
  WITH_DOCTOR:  "#8b5cf6",
  VISITED:      "#3b82f6",
  COMPLETED:    "#10b981",
  MEDICAL_ONLY: "#14b8a6",
  MOVED:        "#6366f1",
  CANCELLED:    "#ef4444",
  NO_SHOW:      "#f43f5e",
}

// ─── FORMATTERS ──────────────────────────────────────
export const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

export const fmtShort = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

// ─── STAT CARD ───────────────────────────────────────
export function StatCard({
  title, value, change, icon, iconBg, iconColor, subtitle, trend,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  subtitle?: string
  trend?: React.ReactNode
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-200 border-border/50 shadow-sm bg-white">
      <CardContent className="px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums leading-none">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-[11px] font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span>{Math.abs(change)}% vs prev period</span>
              </div>
            )}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        {trend && <div className="mt-3">{trend}</div>}
      </CardContent>
    </Card>
  )
}

// ─── HERO STAT CARD ──────────────────────────────────
export function HeroStatCard({
  title, value, change, icon, accentClass, subtitle,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  accentClass: string
  subtitle?: string
}) {
  const [iconColor = "", iconBg = ""] = accentClass.split(" ")
  return (
    <Card className="border-border/50 shadow-sm bg-white hover:shadow-md transition-all">
      <CardContent className="px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span>{Math.abs(change)}% from previous period</span>
              </div>
            )}
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          <div className={`h-12 w-12 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CHART CARD ──────────────────────────────────────
export function ChartCard({
  title, subtitle, action, children, className = "",
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`overflow-hidden border-border/50 shadow-sm bg-white ${className}`}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
        <div className="p-6">{children}</div>
      </CardContent>
    </Card>
  )
}

// ─── MINI SECTION HEADER ─────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</p>
  )
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────
export function CustomTooltip({ active, payload, label, currency = false }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  currency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-semibold text-foreground tabular-nums">
            {currency ? fmt(entry.value) : entry.value.toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────
export function EmptyState({ message = "No data available for this period" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{message}</div>
  )
}

// ─── PROGRESS BAR ROW ────────────────────────────────
export function ProgressRow({
  label, value, maxValue, displayValue, color = "#3b82f6", rank,
}: {
  label: string
  value: number
  maxValue: number
  displayValue: string
  color?: string
  rank?: number
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      {rank !== undefined && (
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-4 text-right shrink-0">{rank}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground truncate">{label}</span>
          <span className="text-xs font-semibold text-foreground ml-2 shrink-0 tabular-nums">{displayValue}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}
