"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
  minDate?: string
  maxDate?: string
  align?: "start" | "center" | "end"
}

function formatDisplay(iso: string): string {
  // Parse timezone-safe using IST offset
  const d = new Date(iso + "T00:00:00+05:30")
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  minDate,
  maxDate,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 w-full flex items-center gap-2 px-3 rounded-lg border border-input bg-white",
            "text-sm text-left transition-colors duration-150",
            "hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
            !value && "text-muted-foreground",
            className
          )}
          aria-label={value ? formatDisplay(value) : placeholder}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">
            {value ? formatDisplay(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-auto p-0 rounded-2xl border border-border/60 shadow-xl"
      >
        <Calendar
          value={value}
          onChange={(iso) => {
            onChange(iso)
            setOpen(false)
          }}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
