import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a date as DD-MM-YYYY (India standard) */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return format(d, "dd-MM-yyyy")
}

/** Format a date as DD MMM YYYY */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return format(d, "dd MMM yyyy")
}

/** Format datetime as DD-MM-YYYY HH:mm */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return format(d, "dd-MM-yyyy HH:mm")
}

/** Format time as HH:mm */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return format(d, "HH:mm")
}

/** Get relative time (e.g. "2 hours ago") */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  if (isToday(d)) return format(d, "HH:mm")
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`
  return formatDistanceToNow(d, { addSuffix: true })
}

/** Format currency in Indian Rupees */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0"
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return "₹0"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

/** Convert a Date to YYYY-MM-DD string in IST (Asia/Kolkata) */
export function toLocalDateISO(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date)
}

/** Convert a Date to YYYY-MM-DDTHH:mm string in IST (Asia/Kolkata) */
export function toLocalDateTimeISO(date: Date = new Date()): string {
  const d = toLocalDateISO(date)
  const t = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
  return `${d}T${t}`
}

/** Get today's date as YYYY-MM-DD string in IST */
export function todayISO(): string {
  return toLocalDateISO()
}

/** Convert YYYY-MM-DD string to Date */
export function parseISODate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00")
}

/** Calculate age from date of birth */
export function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null
  const d = typeof dob === "string" ? new Date(dob) : dob
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const monthDiff = today.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age--
  }
  return age
}

/** Generate a sequential ID string e.g. "0001" */
export function padId(num: number, length = 4): string {
  return String(num).padStart(length, "0")
}

/** Get initials from a full name */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** Truncate text with ellipsis */
export function truncate(text: string, length = 30): string {
  if (text.length <= length) return text
  return text.substring(0, length) + "…"
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
