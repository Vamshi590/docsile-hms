"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const ROUTE_LABELS: Record<string, string> = {
  dashboard:        "Dashboard",
  patients:         "Patients",
  workup:           "Refraction",
  doctor:           "Doctor",
  inpatients:       "In-Patients",
  insurance:        "Insurance",
  labs:             "Labs",
  pharmacy:         "Pharmacy",
  optical:          "Optical",
  expenses:         "Expenses",
  "dues-followups": "Dues & Follow-Ups",
  "call-logs":      "Call Logs",
  "license-tracker":"Licenses",
  analytics:        "Analytics",
  reports:          "Reports",
  data:             "Data Export",
  staff:            "Staff",
  settings:         "Configurations",
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }))

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-0.5 px-8 pt-2.5 pb-0 select-none"
    >
      <Link
        href="/dashboard"
        className="flex items-center text-muted-foreground/40 hover:text-muted-foreground transition-colors duration-150"
        title="Dashboard"
      >
        <LayoutDashboard className="h-3 w-3" />
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-0.5">
          <ChevronRight className="h-3 w-3 text-muted-foreground/25 shrink-0" />
          {crumb.isLast ? (
            <span className={cn(
              "text-[11px] font-medium text-muted-foreground/70 px-1"
            )}>
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-[11px] font-medium text-muted-foreground/40 hover:text-muted-foreground px-1 transition-colors duration-150"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
