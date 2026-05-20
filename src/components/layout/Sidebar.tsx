"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  Settings,
  LogOut,
  Hospital,
  ClipboardList,
  FlaskConical,
  FileBarChart,
  Wallet,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  BarChart3,
  UserCog,
  LayoutDashboard,
  Phone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/utils"

type NavItem = {
  href: string
  icon: React.ElementType
  label: string
  exact?: boolean
  adminOnly?: boolean
  moduleCode?: string // gated by plan if set
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/patients", icon: Users, label: "Patients", moduleCode: "patients" },
      { href: "/workup", icon: Eye, label: "Refraction", moduleCode: "workup" },
      { href: "/doctor", icon: Stethoscope, label: "Doctor", moduleCode: "doctor" },
      { href: "/inpatients", icon: BedDouble, label: "In-Patients", moduleCode: "inpatients" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/pharmacy", icon: Pill, label: "Pharmacy", moduleCode: "pharmacy" },
      { href: "/optical", icon: Glasses, label: "Optical", moduleCode: "optical" },
      { href: "/labs", icon: FlaskConical, label: "Labs", moduleCode: "labs" },
      { href: "/call-logs", icon: Phone, label: "Call Logs", moduleCode: "call-logs" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/insurance", icon: Shield, label: "Insurance", moduleCode: "insurance" },
      { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups" },
      { href: "/expenses", icon: Wallet, label: "Expenses", moduleCode: "expenses" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Analytics", moduleCode: "analytics" },
      { href: "/reports", icon: FileBarChart, label: "Reports", moduleCode: "reports" },
      { href: "/data", icon: DatabaseZap, label: "Data Export" },
      { href: "/license-tracker", icon: ScrollText, label: "Licenses", moduleCode: "license-tracker" },
      { href: "/staff", icon: UserCog, label: "Staff", adminOnly: true },
    ],
  },
]

interface SidebarProps {
  user: { fullName: string; role: string }
  hospitalName?: string
  enabledModules?: string[]
}

export function Sidebar({ user, hospitalName = "Docsile HMS", enabledModules = [] }: SidebarProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  const showSidebar = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setVisible(true)
  }, [])

  const hideSidebar = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, 300)
  }, [])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (e.clientX <= 6) {
        showSidebar()
      }
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [showSidebar])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  return (
    <>
      {/* Overlay backdrop */}
      {visible && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setVisible(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={showSidebar}
        onMouseLeave={hideSidebar}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-white border-r border-gray-200/80 shadow-2xl transition-transform duration-300 ease-in-out",
          visible ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Hospital Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Hospital className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate leading-snug">
              {hospitalName}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">Hospital Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3 space-y-4">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.adminOnly && user.role !== "ADMIN") return false
              if (item.moduleCode && !enabledModules.includes(item.moduleCode))
                return false
              return true
            })
            if (visibleItems.length === 0) return null

            return (
              <div key={section.label}>
                {section.label && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = isActive(item.href, item.exact)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setVisible(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                          active
                            ? "bg-primary/8 text-primary"
                            : "text-gray-500 hover:text-foreground hover:bg-gray-50"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-primary" : "text-gray-400"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-100 px-3 pt-3 pb-4 space-y-1">
          <Link
            href="/settings"
            onClick={() => setVisible(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
              isActive("/settings")
                ? "bg-primary/8 text-primary"
                : "text-gray-500 hover:text-foreground hover:bg-gray-50"
            )}
          >
            <Settings className={cn("h-4 w-4 shrink-0", isActive("/settings") ? "text-primary" : "text-gray-400")} />
            <span>Configurations</span>
          </Link>

          {/* User card */}
          <div className="mt-1 flex items-center rounded-lg bg-gray-50 border border-gray-100 gap-3 px-3 py-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-bold">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground truncate leading-snug">
                {user.fullName}
              </p>
              <p className="text-[11px] text-muted-foreground capitalize leading-snug">
                {user.role.toLowerCase()}
              </p>
            </div>
            <form action="/api/logout" method="POST">
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                title="Logout"
                className="text-gray-400 hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </>
  )
}
