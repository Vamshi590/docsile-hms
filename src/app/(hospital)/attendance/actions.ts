"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUTCDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z")
}

function dayRange(dateStr: string) {
  const start = toUTCDate(dateStr)
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

/** Get current IST time as HH:MM string */
function nowIST(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
}

/** Get today's date in IST as YYYY-MM-DD */
function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Compare HH:MM strings; returns true if actual > shift */
function isLate(actual: string, shiftStart: string): boolean {
  const [ah, am] = actual.split(":").map(Number)
  const [sh, sm] = shiftStart.split(":").map(Number)
  return ah * 60 + am > sh * 60 + sm
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendanceRow = {
  id: string
  fullName: string
  role: string
  department: string | null
  employeeId: string | null
  shiftStart: string // effective shift (override or global)
  attendance: {
    id: string
    checkIn: string | null
    checkOut: string | null
    status: string
  } | null
}

export type ShiftConfigRow = {
  staffId: string
  staffName: string
  role: string
  department: string | null
  employeeId: string | null
  shiftStart: string | null // null = uses global default
}

export type MonthlyRow = {
  id: string
  fullName: string
  role: string
  department: string | null
  employeeId: string | null
  days: Record<number, { status: string; checkIn?: string; checkOut?: string } | null>
  presentCount: number
  lateCount: number
  absentCount: number
}

// ─── Daily attendance ─────────────────────────────────────────────────────────

export async function getAttendanceByDate(dateStr: string) {
  try {
    const { start, end } = dayRange(dateStr)

    const [allStaff, records, globalConfig] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, role: true, department: true, employeeId: true },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      db.attendance.findMany({
        where: { date: { gte: start, lt: end } },
        select: { id: true, staffId: true, checkIn: true, checkOut: true, status: true },
      }),
      db.hospitalProfile.findFirst({ select: { settings: true } }),
    ])

    // ShiftConfig may not exist yet if Prisma client wasn't regenerated — fall back gracefully
    let shiftConfigs: { staffId: string; shiftStart: string }[] = []
    try {
      shiftConfigs = await db.shiftConfig.findMany({ select: { staffId: true, shiftStart: true } })
    } catch {
      // ShiftConfig table not yet available — use defaults
    }

    const globalShift: string =
      (JSON.parse(globalConfig?.settings ?? "{}") as Record<string, string>).defaultShiftStart ?? "09:00"
    const shiftMap = new Map(shiftConfigs.map((s) => [s.staffId, s.shiftStart]))
    const recordMap = new Map(records.map((r) => [r.staffId, r]))

    const data: AttendanceRow[] = allStaff.map((s) => ({
      ...s,
      shiftStart: shiftMap.get(s.id) ?? globalShift,
      attendance: recordMap.get(s.id) ?? null,
    }))

    return { success: true as const, data, globalShift }
  } catch (err) {
    console.error("getAttendanceByDate error:", err)
    return { success: false as const, error: "Failed to load attendance" }
  }
}

// ─── Mark In ─────────────────────────────────────────────────────────────────

export async function markIn(staffId: string) {
  try {
    const today = todayIST()
    const { start, end } = dayRange(today)
    const checkIn = nowIST()

    // Get effective shift
    const [existing, globalConfig] = await Promise.all([
      db.attendance.findFirst({
        where: { staffId, date: { gte: start, lt: end } },
        select: { id: true, checkIn: true },
      }),
      db.hospitalProfile.findFirst({ select: { settings: true } }),
    ])

    let shiftOverride: { shiftStart: string } | null = null
    try {
      shiftOverride = await db.shiftConfig.findUnique({ where: { staffId }, select: { shiftStart: true } })
    } catch {
      // ShiftConfig not available — use global default
    }

    if (existing?.checkIn) {
      return { success: false as const, error: "Already marked in" }
    }

    const globalShift: string =
      (JSON.parse(globalConfig?.settings ?? "{}") as Record<string, string>).defaultShiftStart ?? "09:00"
    const shiftStart = shiftOverride?.shiftStart ?? globalShift
    const status = isLate(checkIn, shiftStart) ? "LATE" : "PRESENT"

    if (existing) {
      await db.attendance.update({
        where: { id: existing.id },
        data: { checkIn, status },
      })
    } else {
      await db.attendance.create({
        data: { staffId, date: toUTCDate(today), checkIn, status },
      })
    }

    revalidatePath("/attendance")
    return { success: true as const, checkIn, status }
  } catch {
    return { success: false as const, error: "Failed to mark in" }
  }
}

// ─── Mark Out ────────────────────────────────────────────────────────────────

export async function markOut(staffId: string) {
  try {
    const today = todayIST()
    const { start, end } = dayRange(today)
    const checkOut = nowIST()

    const existing = await db.attendance.findFirst({
      where: { staffId, date: { gte: start, lt: end } },
      select: { id: true, checkIn: true },
    })

    if (!existing?.checkIn) {
      return { success: false as const, error: "Mark in first" }
    }

    await db.attendance.update({
      where: { id: existing.id },
      data: { checkOut },
    })

    revalidatePath("/attendance")
    return { success: true as const, checkOut }
  } catch {
    return { success: false as const, error: "Failed to mark out" }
  }
}

// ─── Monthly overview ─────────────────────────────────────────────────────────

export async function getMonthlyAttendance(year: number, month: number) {
  try {
    const { start, end } = monthRange(year, month)
    const daysInMonth = new Date(year, month, 0).getDate()

    const [staff, records] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, role: true, department: true, employeeId: true },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      db.attendance.findMany({
        where: { date: { gte: start, lt: end } },
        select: { staffId: true, date: true, status: true, checkIn: true, checkOut: true },
      }),
    ])

    const recordMap = new Map<string, Map<number, { status: string; checkIn?: string; checkOut?: string }>>()
    for (const r of records) {
      const day = new Date(r.date).getUTCDate()
      if (!recordMap.has(r.staffId)) recordMap.set(r.staffId, new Map())
      recordMap.get(r.staffId)!.set(day, {
        status: r.status,
        checkIn: r.checkIn ?? undefined,
        checkOut: r.checkOut ?? undefined,
      })
    }

    const data: MonthlyRow[] = staff.map((s) => {
      const dayMap = recordMap.get(s.id) ?? new Map()
      const days: MonthlyRow["days"] = {}
      for (let d = 1; d <= daysInMonth; d++) {
        days[d] = dayMap.get(d) ?? null
      }
      const vals = Array.from(dayMap.values())
      return {
        ...s,
        days,
        presentCount: vals.filter((v) => v.status === "PRESENT").length,
        lateCount: vals.filter((v) => v.status === "LATE").length,
        absentCount: vals.filter((v) => v.status === "ABSENT").length,
      }
    })

    return { success: true as const, data, daysInMonth }
  } catch {
    return { success: false as const, error: "Failed to load monthly attendance" }
  }
}

// ─── Shift configuration ──────────────────────────────────────────────────────

export async function getShiftConfigs() {
  try {
    const [allStaff, globalConfig] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, role: true, department: true, employeeId: true },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      db.hospitalProfile.findFirst({ select: { settings: true } }),
    ])

    let overrides: { staffId: string; shiftStart: string }[] = []
    try {
      overrides = await db.shiftConfig.findMany({ select: { staffId: true, shiftStart: true } })
    } catch {
      // ShiftConfig not available yet
    }

    const globalShift: string =
      (JSON.parse(globalConfig?.settings ?? "{}") as Record<string, string>).defaultShiftStart ?? "09:00"
    const overrideMap = new Map(overrides.map((o) => [o.staffId, o.shiftStart]))

    const rows: ShiftConfigRow[] = allStaff.map((s) => ({
      staffId: s.id,
      staffName: s.fullName,
      role: s.role,
      department: s.department,
      employeeId: s.employeeId,
      shiftStart: overrideMap.get(s.id) ?? null,
    }))

    return { success: true as const, rows, globalShift }
  } catch {
    return { success: false as const, error: "Failed to load shift configs" }
  }
}

export async function saveGlobalShift(shiftStart: string) {
  try {
    const profile = await db.hospitalProfile.findFirst()
    if (!profile) return { success: false as const, error: "Hospital profile not found" }

    const existing = JSON.parse(profile.settings ?? "{}") as Record<string, string>
    await db.hospitalProfile.update({
      where: { id: profile.id },
      data: { settings: JSON.stringify({ ...existing, defaultShiftStart: shiftStart }) },
    })

    revalidatePath("/attendance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to save global shift" }
  }
}

export async function saveStaffShift(staffId: string, shiftStart: string) {
  try {
    await db.shiftConfig.upsert({
      where: { staffId },
      update: { shiftStart },
      create: { staffId, shiftStart },
    })
    revalidatePath("/attendance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to save staff shift" }
  }
}

export async function resetStaffShift(staffId: string) {
  try {
    await db.shiftConfig.deleteMany({ where: { staffId } })
    revalidatePath("/attendance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to reset shift" }
  }
}
