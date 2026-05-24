"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState } from "react"
import { Settings, LogOut, Hospital, ChevronDown, Menu } from "lucide-react"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface TopNavBarProps {
  user: { fullName: string; role: string }
  hospitalName: string
  enabledModules: string[]
}

export function TopNavBar({ user, hospitalName, enabledModules }: TopNavBarProps) {
  const pathname = usePathname()
  const logoutFormRef = useRef<HTMLFormElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

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
    <>
    <form ref={logoutFormRef} action="/api/logout" method="POST" className="hidden" />
    <header className="z-40 shrink-0 bg-zinc-900 flex items-end">
      {/* Mobile hamburger — hidden on md+ */}
      <button
        className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center text-white/70 hover:text-white"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {/* Hospital name */}
      <div className="flex items-center gap-2.5 px-4 shrink-0 w-52 h-10 border-r border-white/10">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Hospital className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-white truncate max-w-[140px]">
          {hospitalName}
        </span>
      </div>

      {/* Scrollable tab strip — items aligned to bottom so active tab's rounded-t corners show */}
      <nav className="hidden md:flex flex-1 overflow-x-auto scrollbar-hide items-end px-1 h-10">
        {allItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap rounded-t-lg mx-0.5 transition-colors duration-150",
                active
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User dropdown */}
      <div className="shrink-0 px-3 h-10 border-l border-white/10 flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-7 px-2 text-white hover:bg-white/10 hover:text-white">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-white/15 text-white font-bold">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] font-medium text-white hidden sm:block max-w-[100px] truncate">
                {user.fullName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-white/60" />
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
            <DropdownMenuItem
              onSelect={() => logoutFormRef.current?.submit()}
              className="text-destructive focus:text-destructive cursor-pointer gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Mobile nav drawer */}
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-gray-100">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <Hospital className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground truncate">{hospitalName}</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.adminOnly && user.role !== "ADMIN") return false
              if (item.moduleCode && !enabledModules.includes(item.moduleCode)) return false
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
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                          active
                            ? "bg-primary/8 text-primary"
                            : "text-gray-500 hover:text-foreground hover:bg-gray-50"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-gray-400")} />
                        <span className="truncate">{item.label}</span>
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="border-t border-gray-100 px-3 pt-3 pb-4">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
              isActive("/settings") ? "bg-primary/8 text-primary" : "text-gray-500 hover:text-foreground hover:bg-gray-50"
            )}
          >
            <Settings className={cn("h-4 w-4 shrink-0", isActive("/settings") ? "text-primary" : "text-gray-400")} />
            <span>Configurations</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}
