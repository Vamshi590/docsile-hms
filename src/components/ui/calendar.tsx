"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn, todayISO } from "@/lib/utils"

interface CalendarProps {
  value?: string        // ISO "YYYY-MM-DD"
  onChange: (date: string) => void
  minDate?: string
  maxDate?: string
  className?: string
}

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function toISO(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

interface CalendarCell {
  iso: string
  day: number
  currentMonth: boolean
}

function buildGrid(viewYear: number, viewMonth: number): CalendarCell[] {
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startDow = firstDay.getDay() // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  const cells: CalendarCell[] = []

  // Fill trailing days of previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
    cells.push({ iso: toISO(prevYear, prevMonth, day), day, currentMonth: false })
  }

  // Fill current month days
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toISO(viewYear, viewMonth, day), day, currentMonth: true })
  }

  // Fill leading days of next month until 42 cells
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ iso: toISO(nextYear, nextMonth, nextDay), day: nextDay, currentMonth: false })
    nextDay++
  }

  return cells
}

export function Calendar({ value, onChange, minDate, maxDate, className }: CalendarProps) {
  const today = todayISO()

  // Parse initial view month from value, falling back to today
  const initFromValue = (): { year: number; month: number } => {
    if (value) {
      const parts = value.split("-").map(Number)
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { year: parts[0], month: parts[1] - 1 }
      }
    }
    const todayParts = today.split("-").map(Number)
    return { year: todayParts[0], month: todayParts[1] - 1 }
  }

  const [viewYear, setViewYear] = useState(initFromValue().year)
  const [viewMonth, setViewMonth] = useState(initFromValue().month)

  const cells = buildGrid(viewYear, viewMonth)

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const isDisabled = (iso: string): boolean => {
    if (minDate && iso < minDate) return true
    if (maxDate && iso > maxDate) return true
    return false
  }

  const isSelected = (iso: string) => iso === value
  const isToday = (iso: string) => iso === today

  return (
    <div className={cn("p-3 select-none", className)} style={{ width: 280 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goPrev}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={goNext}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map(d => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase text-muted-foreground/60 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ iso, day, currentMonth }) => {
          const selected = isSelected(iso)
          const todayCell = isToday(iso)
          const disabled = isDisabled(iso)

          return (
            <div key={iso} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => !disabled && onChange(iso)}
                disabled={disabled}
                aria-label={iso}
                aria-pressed={selected}
                className={cn(
                  "h-8 w-8 rounded-full text-sm font-medium transition-colors duration-150 flex items-center justify-center",
                  // Base
                  !selected && !disabled && "hover:bg-muted/70",
                  // Current month vs overflow
                  currentMonth && !selected && !disabled ? "text-foreground" : "",
                  !currentMonth && !selected ? "opacity-30" : "",
                  // Today (not selected)
                  todayCell && !selected ? "font-bold text-primary" : "",
                  // Selected
                  selected ? "bg-primary text-primary-foreground font-semibold" : "",
                  // Disabled
                  disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
                )}
              >
                {day}
              </button>
              {/* Dot for today, only when not selected */}
              {todayCell && !selected && (
                <span className="block h-1 w-1 rounded-full bg-primary mt-0.5" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
