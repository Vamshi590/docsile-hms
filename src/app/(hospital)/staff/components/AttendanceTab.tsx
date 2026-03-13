"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  Loader2,
  Users,
  Clock,
  AlertCircle,
  Palmtree,
  X,
  Save,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  getAttendanceByDate,
  getMonthlyAttendance,
  getStaffAttendanceHistory,
  getActiveStaffList,
  upsertAttendance,
  bulkSaveAttendance,
  deleteAttendance,
  type StaffWithAttendance,
  type MonthlyStaffRow,
  type AttendanceRecord,
} from "../attendance-actions"

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "HOLIDAY", label: "Holiday" },
]

const LEAVE_TYPES = [
  { value: "SICK", label: "Sick Leave" },
  { value: "CASUAL", label: "Casual Leave" },
  { value: "EARNED", label: "Earned Leave" },
  { value: "UNPAID", label: "Unpaid Leave" },
]

const STATUS_STYLE: Record<
  string,
  { bg: string; text: string; dot: string; short: string }
> = {
  PRESENT: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    short: "P",
  },
  ABSENT: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
    short: "A",
  },
  LATE: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
    short: "L",
  },
  HALF_DAY: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    dot: "bg-blue-500",
    short: "H",
  },
  ON_LEAVE: {
    bg: "bg-violet-50 border-violet-200",
    text: "text-violet-700",
    dot: "bg-violet-500",
    short: "Lv",
  },
  HOLIDAY: {
    bg: "bg-slate-50 border-slate-200",
    text: "text-slate-600",
    dot: "bg-slate-400",
    short: "Ho",
  },
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function prevDateStr(d: string) {
  const dt = new Date(d + "T00:00:00Z")
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

function nextDateStr(d: string) {
  const dt = new Date(d + "T00:00:00Z")
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z")
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function getDayOfWeek(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function isWeekend(year: number, month: number, day: number) {
  const dow = getDayOfWeek(year, month, day)
  return dow === 0 || dow === 6
}

// ─── Sub-tab: DAILY ───────────────────────────────────────────────────────────

type DailyRow = {
  staffId: string
  staffName: string
  role: string
  department: string | null
  employeeId: string | null
  attendanceId: string | null
  status: string
  checkIn: string
  checkOut: string
  leaveType: string
  notes: string
  isDirty: boolean
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status]
  if (!s) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
        s.bg,
        s.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", s.dot)} />
      {STATUSES.find((x) => x.value === status)?.label ?? status}
    </span>
  )
}

function DailyTab() {
  const [date, setDate] = useState(todayStr())
  const [rows, setRows] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // staffId being saved
  const [savingAll, setSavingAll] = useState(false)

  const loadDate = useCallback(async (d: string) => {
    setLoading(true)
    const res = await getAttendanceByDate(d)
    if (res.success) {
      setRows(
        res.data.map((s: StaffWithAttendance) => ({
          staffId: s.id,
          staffName: s.fullName,
          role: s.role,
          department: s.department,
          employeeId: s.employeeId,
          attendanceId: s.attendance?.id ?? null,
          status: s.attendance?.status ?? "",
          checkIn: s.attendance?.checkIn ?? "",
          checkOut: s.attendance?.checkOut ?? "",
          leaveType: s.attendance?.leaveType ?? "",
          notes: s.attendance?.notes ?? "",
          isDirty: false,
        }))
      )
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDate(date)
  }, [date, loadDate])

  function updateRow(
    staffId: string,
    patch: Partial<Omit<DailyRow, "staffId">>
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.staffId === staffId ? { ...r, ...patch, isDirty: true } : r
      )
    )
  }

  function bulkSetStatus(status: string) {
    setRows((prev) =>
      prev.map((r) => ({ ...r, status, isDirty: true }))
    )
  }

  async function saveRow(row: DailyRow) {
    if (!row.status) { toast.error("Select a status first"); return }
    setSaving(row.staffId)
    const res = await upsertAttendance({
      staffId: row.staffId,
      date,
      status: row.status,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      leaveType: row.leaveType,
      notes: row.notes,
    })
    setSaving(null)
    if (res.success) {
      toast.success(`${row.staffName} saved`)
      setRows((prev) =>
        prev.map((r) =>
          r.staffId === row.staffId ? { ...r, isDirty: false } : r
        )
      )
    } else {
      toast.error(res.error)
    }
  }

  async function saveAll() {
    const dirty = rows.filter((r) => r.isDirty && r.status)
    if (!dirty.length) { toast("No changes to save"); return }
    setSavingAll(true)
    const res = await bulkSaveAttendance(
      date,
      dirty.map((r) => ({
        staffId: r.staffId,
        status: r.status,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        leaveType: r.leaveType,
        notes: r.notes,
      }))
    )
    setSavingAll(false)
    if (res.success) {
      toast.success(`${dirty.length} record${dirty.length > 1 ? "s" : ""} saved`)
      setRows((prev) => prev.map((r) => ({ ...r, isDirty: false })))
      loadDate(date)
    } else {
      toast.error(res.error)
    }
  }

  async function resetRow(row: DailyRow) {
    if (!row.attendanceId) {
      setRows((prev) =>
        prev.map((r) =>
          r.staffId === row.staffId
            ? { ...r, status: "", checkIn: "", checkOut: "", leaveType: "", notes: "", isDirty: false }
            : r
        )
      )
      return
    }
    const res = await deleteAttendance(row.attendanceId)
    if (res.success) {
      toast.success("Reset to not-marked")
      loadDate(date)
    } else {
      toast.error(res.error)
    }
  }

  const markedCount = rows.filter((r) => r.status).length
  const presentCount = rows.filter((r) => r.status === "PRESENT").length
  const absentCount = rows.filter((r) => r.status === "ABSENT").length
  const lateCount = rows.filter((r) => r.status === "LATE").length
  const leaveCount = rows.filter((r) => r.status === "ON_LEAVE" || r.status === "HALF_DAY").length
  const dirtyCount = rows.filter((r) => r.isDirty && r.status).length
  const isToday = date === todayStr()

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDate(prevDateStr(date))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-8 w-40 border-0 bg-transparent text-sm font-medium text-center focus-visible:ring-0 cursor-pointer"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDate(nextDateStr(date))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isToday && (
          <Button variant="outline" size="sm" onClick={() => setDate(todayStr())}>
            Today
          </Button>
        )}
        {isToday && (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50">
            Today
          </Badge>
        )}

        <div className="flex-1" />

        {/* Summary chips */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {presentCount} Present
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {absentCount} Absent
            </span>
            {lateCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {lateCount} Late
              </span>
            )}
            {leaveCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                {leaveCount} Leave
              </span>
            )}
            <span className="text-muted-foreground">
              {markedCount}/{rows.length} marked
            </span>
          </div>
        )}
      </div>

      {/* Action bar */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            onClick={() => bulkSetStatus("PRESENT")}
          >
            <Check className="h-3.5 w-3.5" /> Mark All Present
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-50"
            onClick={() => bulkSetStatus("HOLIDAY")}
          >
            <Palmtree className="h-3.5 w-3.5" /> Mark as Holiday
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={saveAll}
            disabled={savingAll || dirtyCount === 0}
          >
            {savingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save All{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
          No active staff found. Add staff members first.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Staff</th>
                <th className="text-left px-3 py-2.5 font-medium w-44">Status</th>
                <th className="text-left px-3 py-2.5 font-medium w-28">Check In</th>
                <th className="text-left px-3 py-2.5 font-medium w-28">Check Out</th>
                <th className="text-left px-3 py-2.5 font-medium w-36">Leave Type</th>
                <th className="text-left px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.staffId}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    row.isDirty ? "bg-amber-50/40" : "hover:bg-muted/20"
                  )}
                >
                  {/* Staff */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {row.staffName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground leading-tight">
                          {row.staffName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.role}
                          {row.department ? ` · ${row.department}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <Select
                      value={row.status}
                      onValueChange={(v) => updateRow(row.staffId, { status: v, leaveType: v !== "ON_LEAVE" ? "" : row.leaveType })}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 text-xs focus:ring-1 focus:ring-gray-200 focus:ring-offset-0 border",
                          row.status && STATUS_STYLE[row.status]
                            ? `${STATUS_STYLE[row.status].bg} ${STATUS_STYLE[row.status].text}`
                            : "text-muted-foreground"
                        )}
                      >
                        <SelectValue placeholder="Not marked" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  STATUS_STYLE[s.value]?.dot
                                )}
                              />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Check In */}
                  <td className="px-3 py-2.5">
                    <Input
                      type="time"
                      value={row.checkIn}
                      onChange={(e) => updateRow(row.staffId, { checkIn: e.target.value })}
                      className="h-8 w-24 text-xs focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                      disabled={row.status === "ABSENT" || row.status === "HOLIDAY"}
                    />
                  </td>

                  {/* Check Out */}
                  <td className="px-3 py-2.5">
                    <Input
                      type="time"
                      value={row.checkOut}
                      onChange={(e) => updateRow(row.staffId, { checkOut: e.target.value })}
                      className="h-8 w-24 text-xs focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                      disabled={row.status === "ABSENT" || row.status === "HOLIDAY"}
                    />
                  </td>

                  {/* Leave Type */}
                  <td className="px-3 py-2.5">
                    {row.status === "ON_LEAVE" || row.status === "HALF_DAY" ? (
                      <Select
                        value={row.leaveType}
                        onValueChange={(v) => updateRow(row.staffId, { leaveType: v })}
                      >
                        <SelectTrigger className="h-8 text-xs w-32 focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAVE_TYPES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="px-3 py-2.5">
                    <Input
                      value={row.notes}
                      onChange={(e) => updateRow(row.staffId, { notes: e.target.value })}
                      placeholder="Optional note..."
                      className="h-8 text-xs focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 min-w-[120px]"
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 px-2 text-xs gap-1",
                          row.isDirty
                            ? "text-amber-700 hover:bg-amber-100"
                            : "text-muted-foreground"
                        )}
                        onClick={() => saveRow(row)}
                        disabled={saving === row.staffId || !row.status}
                      >
                        {saving === row.staffId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Save
                      </Button>
                      {(row.status || row.isDirty) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => resetRow(row)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Sub-tab: MONTHLY ─────────────────────────────────────────────────────────

function MonthlyTab() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState<MonthlyStaffRow[]>([])
  const [daysInMonth, setDaysInMonth] = useState(31)
  const [loading, setLoading] = useState(true)
  const [quickEdit, setQuickEdit] = useState<{
    staffId: string
    staffName: string
    day: number
    current: { status: string; checkIn?: string; checkOut?: string } | null
  } | null>(null)
  const [quickStatus, setQuickStatus] = useState("")
  const [quickCheckIn, setQuickCheckIn] = useState("")
  const [quickCheckOut, setQuickCheckOut] = useState("")
  const [quickSaving, setQuickSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await getMonthlyAttendance(year, month)
    if (res.success) {
      setData(res.data)
      setDaysInMonth(res.daysInMonth)
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    loadData()
  }, [loadData])

  function navigate(dir: -1 | 1) {
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y)
    setMonth(m)
  }

  function openQuickEdit(
    staffId: string,
    staffName: string,
    day: number,
    current: { status: string; checkIn?: string; checkOut?: string } | null
  ) {
    setQuickEdit({ staffId, staffName, day, current })
    setQuickStatus(current?.status ?? "")
    setQuickCheckIn(current?.checkIn ?? "")
    setQuickCheckOut(current?.checkOut ?? "")
  }

  async function saveQuickEdit() {
    if (!quickEdit || !quickStatus) return
    setQuickSaving(true)
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(quickEdit.day).padStart(2, "0")}`
    const res = await upsertAttendance({
      staffId: quickEdit.staffId,
      date: dateStr,
      status: quickStatus,
      checkIn: quickCheckIn,
      checkOut: quickCheckOut,
    })
    setQuickSaving(false)
    if (res.success) {
      toast.success("Updated")
      setQuickEdit(null)
      loadData()
    } else {
      toast.error(res.error)
    }
  }

  // Summary totals
  const totals = data.reduce(
    (acc, s) => ({
      present: acc.present + s.presentCount,
      absent: acc.absent + s.absentCount,
      late: acc.late + s.lateCount,
      leave: acc.leave + s.leaveCount,
      halfDay: acc.halfDay + s.halfDayCount,
    }),
    { present: 0, absent: 0, late: 0, leave: 0, halfDay: 0 }
  )

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-semibold min-w-36 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {(year !== today.getFullYear() || month !== today.getMonth() + 1) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }}
          >
            This Month
          </Button>
        )}
        <div className="flex-1" />
        {/* Summary chips */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {[
              { label: "Present", val: totals.present, color: "bg-emerald-50 text-emerald-700" },
              { label: "Absent", val: totals.absent, color: "bg-red-50 text-red-700" },
              { label: "Late", val: totals.late, color: "bg-amber-50 text-amber-700" },
              { label: "Leave", val: totals.leave, color: "bg-violet-50 text-violet-700" },
              { label: "Half Day", val: totals.halfDay, color: "bg-blue-50 text-blue-700" },
            ]
              .filter((x) => x.val > 0)
              .map((x) => (
                <span key={x.label} className={cn("px-2 py-1 rounded-full font-medium", x.color)}>
                  {x.val} {x.label}
                </span>
              ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
          No active staff found.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ minWidth: `${200 + daysInMonth * 36 + 160}px` }}>
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-medium sticky left-0 bg-muted/30 min-w-[200px] z-10">
                    Staff
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={cn(
                        "text-center px-0 py-2.5 font-medium w-9",
                        isWeekend(year, month, d) && "bg-slate-50/80 text-slate-400"
                      )}
                    >
                      <div>{d}</div>
                      <div className="text-[9px] font-normal">
                        {DAY_NAMES[getDayOfWeek(year, month, d)]}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-2 py-2.5 font-medium w-10 text-emerald-600">P</th>
                  <th className="text-center px-2 py-2.5 font-medium w-10 text-red-600">A</th>
                  <th className="text-center px-2 py-2.5 font-medium w-10 text-amber-600">L</th>
                  <th className="text-center px-2 py-2.5 font-medium w-10 text-violet-600">Lv</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-muted/10"
                  >
                    <td className="px-4 py-2 sticky left-0 bg-card z-10 border-r border-border/50">
                      <p className="font-medium text-foreground truncate max-w-[160px]">
                        {s.fullName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{s.role}</p>
                    </td>
                    {days.map((d) => {
                      const cell = s.days[d]
                      const s_ = cell ? STATUS_STYLE[cell.status] : null
                      return (
                        <td
                          key={d}
                          className={cn(
                            "text-center px-0 py-2 cursor-pointer transition-colors",
                            isWeekend(year, month, d) && "bg-slate-50/50",
                            !cell && "hover:bg-muted/30"
                          )}
                          title={cell ? `${cell.status}${cell.checkIn ? " · " + cell.checkIn : ""}` : "Click to mark"}
                          onClick={() => openQuickEdit(s.id, s.fullName, d, cell ?? null)}
                        >
                          {cell && s_ ? (
                            <span
                              className={cn(
                                "inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold border mx-auto",
                                s_.bg,
                                s_.text
                              )}
                            >
                              {s_.short}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] text-slate-300 hover:bg-muted/50 mx-auto">
                              ·
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-2 font-semibold text-emerald-600">
                      {s.presentCount || "—"}
                    </td>
                    <td className="text-center px-2 py-2 font-semibold text-red-600">
                      {s.absentCount || "—"}
                    </td>
                    <td className="text-center px-2 py-2 font-semibold text-amber-600">
                      {s.lateCount || "—"}
                    </td>
                    <td className="text-center px-2 py-2 font-semibold text-violet-600">
                      {s.leaveCount || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Edit Dialog */}
      <Dialog open={!!quickEdit} onOpenChange={(o) => !o && setQuickEdit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {quickEdit?.staffName} —{" "}
              {quickEdit &&
                new Date(
                  Date.UTC(year, month - 1, quickEdit.day)
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={quickStatus} onValueChange={setQuickStatus}>
                <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLE[s.value]?.dot)} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Check In</Label>
                <Input
                  type="time"
                  value={quickCheckIn}
                  onChange={(e) => setQuickCheckIn(e.target.value)}
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check Out</Label>
                <Input
                  type="time"
                  value={quickCheckOut}
                  onChange={(e) => setQuickCheckOut(e.target.value)}
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuickEdit(null)}>Cancel</Button>
            <Button onClick={saveQuickEdit} disabled={quickSaving || !quickStatus}>
              {quickSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-tab: STAFF HISTORY ───────────────────────────────────────────────────

type StaffOption = {
  id: string
  fullName: string
  role: string
  department: string | null
  employeeId: string | null
}

function StaffHistoryTab() {
  const today = new Date()
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>("")
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [staffInfo, setStaffInfo] = useState<StaffOption & { joiningDate?: Date | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
  const [editStatus, setEditStatus] = useState("")
  const [editCheckIn, setEditCheckIn] = useState("")
  const [editCheckOut, setEditCheckOut] = useState("")
  const [editLeaveType, setEditLeaveType] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await getActiveStaffList()
      if (res.success) setStaffList(res.data)
      setLoadingStaff(false)
    }
    load()
  }, [])

  const loadHistory = useCallback(async () => {
    if (!selectedStaffId) return
    setLoading(true)
    const res = await getStaffAttendanceHistory(selectedStaffId, year, month)
    if (res.success) {
      setRecords(res.data.records as AttendanceRecord[])
      setStaffInfo(res.data.staff as StaffOption & { joiningDate?: Date | null })
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }, [selectedStaffId, year, month])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function navigate(dir: -1 | 1) {
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y)
    setMonth(m)
  }

  function openEdit(rec: AttendanceRecord) {
    setEditingRecord(rec)
    setEditStatus(rec.status)
    setEditCheckIn(rec.checkIn ?? "")
    setEditCheckOut(rec.checkOut ?? "")
    setEditLeaveType(rec.leaveType ?? "")
    setEditNotes(rec.notes ?? "")
  }

  async function saveEdit() {
    if (!editingRecord || !editStatus) return
    setEditSaving(true)
    const dateStr = new Date(editingRecord.date).toISOString().slice(0, 10)
    const res = await upsertAttendance({
      staffId: selectedStaffId,
      date: dateStr,
      status: editStatus,
      checkIn: editCheckIn,
      checkOut: editCheckOut,
      leaveType: editLeaveType,
      notes: editNotes,
    })
    setEditSaving(false)
    if (res.success) {
      toast.success("Updated")
      setEditingRecord(null)
      loadHistory()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete(rec: AttendanceRecord) {
    const res = await deleteAttendance(rec.id)
    if (res.success) {
      toast.success("Record removed")
      loadHistory()
    } else {
      toast.error(res.error)
    }
  }

  // Stats
  const stats = records.reduce(
    (acc, r) => {
      if (r.status === "PRESENT") acc.present++
      else if (r.status === "ABSENT") acc.absent++
      else if (r.status === "LATE") acc.late++
      else if (r.status === "ON_LEAVE") acc.leave++
      else if (r.status === "HALF_DAY") acc.halfDay++
      else if (r.status === "HOLIDAY") acc.holiday++
      return acc
    },
    { present: 0, absent: 0, late: 0, leave: 0, halfDay: 0, holiday: 0 }
  )

  const daysInMonth = new Date(year, month, 0).getDate()

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-60">
          {loadingStaff ? (
            <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
          ) : (
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                <SelectValue placeholder="Select staff member..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      {s.fullName}
                      <span className="text-xs text-muted-foreground">{s.role}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-semibold min-w-32 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!selectedStaffId ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-30" />
          Select a staff member to view their attendance history.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Staff info + Stats */}
          {staffInfo && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                  {staffInfo.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base">{staffInfo.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {staffInfo.role}
                    {staffInfo.department ? ` · ${staffInfo.department}` : ""}
                    {staffInfo.employeeId ? ` · ${staffInfo.employeeId}` : ""}
                  </p>
                </div>
                {/* Stat chips */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {[
                    { label: "Present", val: stats.present, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { label: "Absent", val: stats.absent, color: "bg-red-50 text-red-700 border-red-200" },
                    { label: "Late", val: stats.late, color: "bg-amber-50 text-amber-700 border-amber-200" },
                    { label: "Leave", val: stats.leave, color: "bg-violet-50 text-violet-700 border-violet-200" },
                    { label: "Half Day", val: stats.halfDay, color: "bg-blue-50 text-blue-700 border-blue-200" },
                  ].map((x) => (
                    <span key={x.label} className={cn("px-2.5 py-1 rounded-full font-semibold border", x.color)}>
                      {x.val} {x.label}
                    </span>
                  ))}
                  <span className="px-2.5 py-1 rounded-full font-medium bg-muted/50 text-muted-foreground border border-border">
                    {records.length}/{daysInMonth} marked
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Records Table */}
          {records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm rounded-xl border border-dashed border-border">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No attendance records for this month.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-medium w-36">Date</th>
                    <th className="text-left px-3 py-2.5 font-medium w-16">Day</th>
                    <th className="text-left px-3 py-2.5 font-medium w-36">Status</th>
                    <th className="text-left px-3 py-2.5 font-medium w-24">Check In</th>
                    <th className="text-left px-3 py-2.5 font-medium w-24">Check Out</th>
                    <th className="text-left px-3 py-2.5 font-medium w-28">Leave Type</th>
                    <th className="text-left px-3 py-2.5 font-medium">Notes</th>
                    <th className="w-16 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const d = new Date(rec.date)
                    const dayOfWeek = DAY_NAMES[d.getUTCDay()]
                    const isWeekendDay = d.getUTCDay() === 0 || d.getUTCDay() === 6
                    return (
                      <tr
                        key={rec.id}
                        className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/20",
                          isWeekendDay && "bg-slate-50/40"
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium tabular-nums">
                          {d.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{dayOfWeek}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-sm">
                          {rec.checkIn ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {rec.checkIn}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-sm">
                          {rec.checkOut ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {rec.checkOut}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {rec.leaveType
                            ? LEAVE_TYPES.find((l) => l.value === rec.leaveType)?.label ?? rec.leaveType
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                          {rec.notes || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => openEdit(rec)}
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(rec)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Edit Record Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(o) => !o && setEditingRecord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Edit Record —{" "}
              {editingRecord &&
                new Date(editingRecord.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLE[s.value]?.dot)} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Check In</Label>
                <Input
                  type="time"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check Out</Label>
                <Input
                  type="time"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>
            {(editStatus === "ON_LEAVE" || editStatus === "HALF_DAY") && (
              <div className="space-y-1.5">
                <Label>Leave Type</Label>
                <Select value={editLeaveType} onValueChange={setEditLeaveType}>
                  <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional note..."
                className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving || !editStatus}>
              {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

type SubTab = "daily" | "monthly" | "history"

export function AttendanceTab() {
  const [subTab, setSubTab] = useState<SubTab>("daily")

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
        {(
          [
            { value: "daily", label: "Daily Attendance" },
            { value: "monthly", label: "Monthly Overview" },
            { value: "history", label: "Staff History" },
          ] as { value: SubTab; label: string }[]
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setSubTab(t.value)}
            className={cn(
              "px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors",
              subTab === t.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === "daily" && <DailyTab />}
      {subTab === "monthly" && <MonthlyTab />}
      {subTab === "history" && <StaffHistoryTab />}
    </div>
  )
}
