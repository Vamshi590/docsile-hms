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
  LayoutDashboard,
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/patients", icon: Users, label: "Patients" },
  { href: "/workup", icon: Eye, label: "Workup" },
  { href: "/doctor", icon: Stethoscope, label: "Doctor" },
  { href: "/labs", icon: FlaskConical, label: "Labs" },
  { href: "/pharmacy", icon: Pill, label: "Pharmacy" },
  { href: "/optical", icon: Glasses, label: "Optical" },
  { href: "/inpatients", icon: BedDouble, label: "In-Patients" },
  { href: "/insurance", icon: Shield, label: "Insurance" },
  { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups" },
  { href: "/expenses", icon: Wallet, label: "Expenses" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/reports", icon: FileBarChart, label: "Reports" },
  { href: "/license-tracker", icon: ScrollText, label: "Licenses" },
  { href: "/data", icon: DatabaseZap, label: "Data Export" },
  { href: "/staff", icon: UserCog, label: "Staff", adminOnly: true },
]

interface SidebarProps {
  user: { fullName: string; role: string }
  hospitalName?: string
}

export function Sidebar({ user, hospitalName = "Docsile HMS" }: SidebarProps) {
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

  // Show sidebar when mouse moves to the left edge of the screen
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (e.clientX <= 6) {
        showSidebar()
      }
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [showSidebar])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  return (
    <>
      {/* Overlay backdrop when sidebar is open */}
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
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-border bg-white shadow-2xl transition-transform duration-300 ease-in-out",
          visible ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Hospital Brand */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Hospital className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.9rem] font-semibold text-foreground truncate leading-snug">
              {hospitalName}
            </p>
            <p className="text-xs text-muted-foreground leading-snug">HMS</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-4 space-y-0.5">
          {navItems
            .filter((item) => !item.adminOnly || user.role === "ADMIN")
            .map((item) => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setVisible(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.9rem] font-semibold transition-all duration-150",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-primary" : "text-current"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </Link>
              )
            })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border px-2 pt-3 pb-4 space-y-0.5">
          <Link
            href="/settings"
            onClick={() => setVisible(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.9rem] font-medium transition-all duration-150",
              isActive("/settings")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span>Configurations</span>
          </Link>

          {/* User card */}
          <div className="mt-2 flex items-center rounded-xl bg-muted gap-3 px-3.5 py-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[0.85rem] font-semibold text-foreground truncate leading-snug">
                {user.fullName}
              </p>
              <p className="text-xs text-muted-foreground capitalize leading-snug">
                {user.role.toLowerCase()}
              </p>
            </div>
            <form action="/api/logout" method="POST">
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                title="Logout"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
