"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, LogOut, Hospital, ChevronDown } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NAV_SECTIONS } from "./nav-items"

interface TopNavBarProps {
  user: { fullName: string; role: string }
  hospitalName: string
  enabledModules: string[]
}

export function TopNavBar({ user, hospitalName, enabledModules }: TopNavBarProps) {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  const allItems = NAV_SECTIONS.flatMap((s) => s.items).filter((item) => {
    if (item.adminOnly && user.role !== "ADMIN") return false
    if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
    return true
  })

  return (
    <header className="z-40 h-14 border-b border-border/60 bg-background flex items-center shrink-0">
      {/* Hospital name */}
      <div className="flex items-center gap-2.5 px-4 shrink-0 w-52 border-r border-border/60 h-full">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Hospital className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-foreground truncate max-w-[140px]">
          {hospitalName}
        </span>
      </div>

      {/* Scrollable tab strip */}
      <nav className="flex-1 overflow-x-auto scrollbar-hide flex items-stretch h-full">
        {allItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 text-[13px] font-medium whitespace-nowrap h-full border-b-2 transition-colors duration-150",
                active
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User dropdown */}
      <div className="shrink-0 px-3 border-l border-border/60 h-full flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] font-medium text-foreground hidden sm:block max-w-[100px] truncate">
                {user.fullName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="text-[13px] font-semibold text-foreground truncate">{user.fullName}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{user.role.toLowerCase()}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action="/api/logout" method="POST" className="w-full">
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full text-destructive focus:outline-none"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
