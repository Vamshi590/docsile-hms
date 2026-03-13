"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a YYYY-MM-DD string to midnight UTC DateTime */
function toUTCDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z")
}

/** Get start (inclusive) and end (exclusive) of a UTC day */
function dayRange(dateStr: string) {
  const start = toUTCDate(dateStr)
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

/** Get start/end of a calendar month in UTC */
function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "ON_LEAVE"
  | "HOLIDAY"

export type LeaveType = "SICK" | "CASUAL" | "EARNED" | "UNPAID"

export type StaffWithAttendance = {
  id: string
  fullName: string
  role: string
  department: string | null
  designation: string | null
  employeeId: string | null
  attendance: {
    id: string
    status: string
    checkIn: string | null
    checkOut: string | null
    leaveType: string | null
    notes: string | null
  } | null
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Fetch all active staff with their attendance record for a given date.
 */
export async function getAttendanceByDate(dateStr: string) {
  try {
    const { start, end } = dayRange(dateStr)

    const [allStaff, records] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          role: true,
          department: true,
          designation: true,
          employeeId: true,
        },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      db.attendance.findMany({
        where: { date: { gte: start, lt: end } },
        select: {
          id: true,
          staffId: true,
          status: true,
          checkIn: true,
          checkOut: true,
          leaveType: true,
          notes: true,
        },
      }),
    ])

    const recordMap = new Map(records.map((r) => [r.staffId, r]))

    return {
      success: true as const,
      data: allStaff.map((s) => ({
        ...s,
        attendance: recordMap.get(s.id) ?? null,
      })) as StaffWithAttendance[],
    }
  } catch {
    return { success: false as const, error: "Failed to load attendance" }
  }
}

/**
 * Create or update a single attendance record.
 */
export async function upsertAttendance(data: {
  staffId: string
  date: string
  status: string
  checkIn?: string
  checkOut?: string
  leaveType?: string
  notes?: string
}) {
  try {
    const { start, end } = dayRange(data.date)

    const existing = await db.attendance.findFirst({
      where: { staffId: data.staffId, date: { gte: start, lt: end } },
      select: { id: true },
    })

    const payload = {
      status: data.status,
      checkIn: data.checkIn?.trim() || null,
      checkOut: data.checkOut?.trim() || null,
      leaveType: data.leaveType || null,
      notes: data.notes?.trim() || null,
    }

    if (existing) {
      await db.attendance.update({ where: { id: existing.id }, data: payload })
    } else {
      await db.attendance.create({
        data: { staffId: data.staffId, date: toUTCDate(data.date), ...payload },
      })
    }

    revalidatePath("/staff")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to save attendance" }
  }
}

/**
 * Save multiple attendance records in one transaction (bulk mark).
 */
export async function bulkSaveAttendance(
  dateStr: string,
  records: Array<{
    staffId: string
    status: string
    checkIn?: string
    checkOut?: string
    leaveType?: string
    notes?: string
  }>
) {
  try {
    const { start, end } = dayRange(dateStr)
    const date = toUTCDate(dateStr)

    const existing = await db.attendance.findMany({
      where: { date: { gte: start, lt: end } },
      select: { id: true, staffId: true },
    })
    const existingMap = new Map(existing.map((e) => [e.staffId, e.id]))

    const toUpdate = records.filter((r) => existingMap.has(r.staffId))
    const toCreate = records.filter((r) => !existingMap.has(r.staffId))

    await db.$transaction([
      ...toUpdate.map((r) =>
        db.attendance.update({
          where: { id: existingMap.get(r.staffId)! },
          data: {
            status: r.status,
            checkIn: r.checkIn?.trim() || null,
            checkOut: r.checkOut?.trim() || null,
            leaveType: r.leaveType || null,
            notes: r.notes?.trim() || null,
          },
        })
      ),
      ...toCreate.map((r) =>
        db.attendance.create({
          data: {
            staffId: r.staffId,
            date,
            status: r.status,
            checkIn: r.checkIn?.trim() || null,
            checkOut: r.checkOut?.trim() || null,
            leaveType: r.leaveType || null,
            notes: r.notes?.trim() || null,
          },
        })
      ),
    ])

    revalidatePath("/staff")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to bulk save attendance" }
  }
}

/**
 * Delete (reset) a single attendance record.
 */
export async function deleteAttendance(id: string) {
  try {
    await db.attendance.delete({ where: { id } })
    revalidatePath("/staff")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete attendance" }
  }
}

// ─── Monthly overview ─────────────────────────────────────────────────────────

export type MonthlyStaffRow = {
  id: string
  fullName: string
  role: string
  department: string | null
  employeeId: string | null
  days: Record<
    number,
    { status: string; checkIn?: string; checkOut?: string } | null
  >
  presentCount: number
  lateCount: number
  halfDayCount: number
  absentCount: number
  leaveCount: number
  holidayCount: number
}

export async function getMonthlyAttendance(year: number, month: number) {
  try {
    const { start, end } = monthRange(year, month)
    const daysInMonth = new Date(year, month, 0).getDate()

    const [staff, records] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          role: true,
          department: true,
          employeeId: true,
        },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      db.attendance.findMany({
        where: { date: { gte: start, lt: end } },
        select: {
          staffId: true,
          date: true,
          status: true,
          checkIn: true,
          checkOut: true,
        },
      }),
    ])

    // Build staffId → (day → record) map
    const recordMap = new Map<
      string,
      Map<number, { status: string; checkIn?: string; checkOut?: string }>
    >()
    for (const r of records) {
      const day = new Date(r.date).getUTCDate()
      if (!recordMap.has(r.staffId)) recordMap.set(r.staffId, new Map())
      recordMap.get(r.staffId)!.set(day, {
        status: r.status,
        checkIn: r.checkIn ?? undefined,
        checkOut: r.checkOut ?? undefined,
      })
    }

    const data: MonthlyStaffRow[] = staff.map((s) => {
      const dayMap = recordMap.get(s.id) ?? new Map()
      const days: MonthlyStaffRow["days"] = {}
      for (let d = 1; d <= daysInMonth; d++) {
        days[d] = dayMap.get(d) ?? null
      }
      const vals = Array.from(dayMap.values())
      return {
        ...s,
        days,
        presentCount: vals.filter((v) => v.status === "PRESENT").length,
        lateCount: vals.filter((v) => v.status === "LATE").length,
        halfDayCount: vals.filter((v) => v.status === "HALF_DAY").length,
        absentCount: vals.filter((v) => v.status === "ABSENT").length,
        leaveCount: vals.filter((v) => v.status === "ON_LEAVE").length,
        holidayCount: vals.filter((v) => v.status === "HOLIDAY").length,
      }
    })

    return { success: true as const, data, daysInMonth }
  } catch {
    return {
      success: false as const,
      error: "Failed to load monthly attendance",
    }
  }
}

// ─── Staff history ────────────────────────────────────────────────────────────

export type AttendanceRecord = {
  id: string
  date: Date
  status: string
  checkIn: string | null
  checkOut: string | null
  leaveType: string | null
  notes: string | null
}

export async function getStaffAttendanceHistory(
  staffId: string,
  year: number,
  month: number
) {
  try {
    const { start, end } = monthRange(year, month)

    const [staff, records] = await Promise.all([
      db.user.findUnique({
        where: { id: staffId },
        select: {
          id: true,
          fullName: true,
          role: true,
          department: true,
          designation: true,
          employeeId: true,
          joiningDate: true,
        },
      }),
      db.attendance.findMany({
        where: { staffId, date: { gte: start, lt: end } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          status: true,
          checkIn: true,
          checkOut: true,
          leaveType: true,
          notes: true,
        },
      }),
    ])

    if (!staff) return { success: false as const, error: "Staff not found" }

    return { success: true as const, data: { staff, records } }
  } catch {
    return {
      success: false as const,
      error: "Failed to load staff attendance history",
    }
  }
}

/**
 * Lightweight list of active staff (for dropdowns).
 */
export async function getActiveStaffList() {
  try {
    const staff = await db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        role: true,
        department: true,
        employeeId: true,
      },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    })
    return { success: true as const, data: staff }
  } catch {
    return { success: false as const, error: "Failed to load staff list" }
  }
}
