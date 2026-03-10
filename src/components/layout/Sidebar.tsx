"use client"

import { useState } from "react"
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
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  FlaskConical,
  FileBarChart,
  Wallet,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  UserCog,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  const [collapsed, setCollapsed] = useState(true)

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-62"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-6 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white shadow-md hover:shadow-lg hover:bg-accent transition-all duration-150"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-foreground" />
          : <ChevronLeft className="h-4 w-4 text-foreground" />
        }
      </button>

      {/* Hospital Brand */}
      <div
        className={cn(
          "flex items-center border-b border-border overflow-hidden",
          collapsed ? "justify-center px-0 py-4" : "gap-3 px-5 py-4"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Hospital className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[0.9rem] font-semibold text-foreground truncate leading-snug">
              {hospitalName}
            </p>
            <p className="text-xs text-muted-foreground leading-snug">HMS</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto scrollbar-hide px-2", collapsed ? "py-2 space-y-1" : "py-4 space-y-0.5")}>
        <TooltipProvider delayDuration={0}>
          {navItems.filter((item) => !item.adminOnly || user.role === "ADMIN").map((item) => {
            const active = isActive(item.href, item.exact)
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-xl transition-all duration-150",
                  collapsed
                    ? "justify-center px-1 py-2.5"
                    : "gap-3 px-3.5 py-2.5 text-[0.9rem] font-semibold",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-gray-500 hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon
                  className={cn(
                    "shrink-0",
                    collapsed ? "h-[18px] w-[18px]" : "h-[18px] w-[18px]",
                    active ? "text-primary" : "text-current"
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                  </>
                )}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}
        </TooltipProvider>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border px-2 pt-3 pb-4 space-y-0.5">
        <TooltipProvider delayDuration={0}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center rounded-xl py-2.5 text-[0.9rem] font-medium transition-all duration-150 justify-center px-2.5",
                    isActive("/settings")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Settings className="h-[18px] w-[18px] shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              className={cn(
                "flex items-center rounded-xl py-2.5 text-[0.9rem] font-medium transition-all duration-150 gap-3 px-3.5",
                isActive("/settings")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Settings className="h-[18px] w-[18px] shrink-0" />
              <span>Settings</span>
            </Link>
          )}

          {/* User card */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 flex items-center rounded-xl bg-muted justify-center px-2 py-2.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {getInitials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{user.fullName}</TooltipContent>
            </Tooltip>
          ) : (
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
          )}
        </TooltipProvider>
      </div>
    </aside>
  )
}
