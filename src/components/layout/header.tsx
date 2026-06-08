"use client"

import { ReactNode, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  onRefresh?: () => void | Promise<void>
}

export function PageHeader({ title, description, children, className, onRefresh }: PageHeaderProps) {
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || spinning) return
    setSpinning(true)
    try {
      await onRefresh()
    } finally {
      setSpinning(false)
    }
  }, [onRefresh, spinning])

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4",
        "bg-white/80 backdrop-blur-md border-b border-border/60",
        "pl-12 md:pl-6 pr-3 sm:pr-6 py-2.5 sm:py-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 sticky top-0 z-20",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-tight sm:leading-none truncate">{title}</h1>
          {description && (
            <p className="hidden sm:block text-[13px] text-muted-foreground mt-1.5 leading-none">{description}</p>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={spinning}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 shrink-0"
            title="Refresh"
          >
            <svg className={cn("h-3.5 w-3.5", spinning && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.657v4.992" />
            </svg>
          </button>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap sm:shrink-0 [&>*]:min-w-0">{children}</div>
      )}
    </div>
  )
}

interface BreadcrumbHeaderProps {
  onBack: () => void
  backLabel: string
  currentLabel: string
  subtitle?: string
  children?: ReactNode
  className?: string
}

export function BreadcrumbHeader({ onBack, backLabel, currentLabel, subtitle, children, className }: BreadcrumbHeaderProps) {
  const router = useRouter()

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4",
        "bg-white/80 backdrop-blur-md border-b border-border/60",
        "pl-12 md:pl-6 pr-3 sm:pr-6 py-2.5 sm:py-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 sticky top-0 z-20",
        className
      )}
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 text-xs sm:text-sm overflow-x-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span className="font-medium">Dashboard</span>
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <button
          onClick={onBack}
          className="px-1.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-medium truncate"
        >
          {backLabel}
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0 px-1.5 py-1">
          <span className="font-semibold text-foreground truncate" aria-current="page">{currentLabel}</span>
          {subtitle && (
            <span className="text-xs font-mono text-muted-foreground/70 shrink-0">
              {subtitle}
            </span>
          )}
        </div>
      </nav>
      {children && (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap sm:shrink-0 [&>*]:min-w-0">{children}</div>
      )}
    </div>
  )
}

interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 sm:gap-3 flex-wrap sm:flex-nowrap",
        "bg-white/60 backdrop-blur-sm border-b border-border/40",
        "px-3 sm:px-6 py-2 sm:py-2.5 -mx-3 sm:-mx-6 mb-3 sm:mb-5 sm:sticky sm:top-16 z-10",
        className
      )}
    >
      {children}
    </div>
  )
}

interface DateNavigatorProps {
  date: string
  onDateChange: (date: string) => void
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
  isToday?: boolean
}

export function DateNavigator({ date, onDateChange, onPrev, onNext, onToday, isToday }: DateNavigatorProps) {
  const formatted = (() => {
    try {
      const d = new Date(date + "T00:00:00")
      return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    } catch { return date }
  })()

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onPrev}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 bg-white hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <div className="relative">
        <button
          className="h-8 px-3 flex items-center gap-2 rounded-lg border border-border/60 bg-white hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
          onClick={() => {
            const input = document.getElementById("__date-nav-input") as HTMLInputElement
            input?.showPicker?.()
          }}
        >
          <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span>{formatted}</span>
        </button>
        <input
          id="__date-nav-input"
          type="date"
          value={date}
          onChange={e => onDateChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </div>
      <button
        onClick={onNext}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 bg-white hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      {onToday && !isToday && (
        <button
          onClick={onToday}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  )
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, onSubmit, placeholder = "Search...", className }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSubmit?.()}
        className={cn(
          "h-8 w-full rounded-lg border border-border/60 bg-white pl-9 pr-8 text-sm",
          "placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
          "transition-all duration-150"
        )}
      />
      {value && (
        <button
          onClick={() => { onChange(""); onSubmit?.() }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-full bg-muted-foreground/15 hover:bg-muted-foreground/25 transition-colors"
        >
          <svg className="h-2.5 w-2.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function SectionHeader({ title, description, children, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-4", className)}>
      <div>
        <h2 className="text-[0.95rem] font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  )
}

interface StatBadgeProps {
  value: number | string
  label: string
  variant?: "default" | "info" | "success" | "warning" | "destructive"
}

export function StatBadge({ value, label, variant = "default" }: StatBadgeProps) {
  const styles = {
    default: "bg-muted/60 text-foreground border-border/40",
    info: "bg-primary/5 text-primary border-primary/15",
    success: "bg-success/5 text-green-700 border-success/15",
    warning: "bg-warning/5 text-amber-700 border-warning/15",
    destructive: "bg-destructive/5 text-red-700 border-destructive/15",
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm",
      styles[variant]
    )}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="font-normal opacity-80">{label}</span>
    </div>
  )
}
