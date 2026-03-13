"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/header"
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Lock,
  Settings2, Users, RotateCcw, Loader2,
} from "lucide-react"
import {
  getAttendanceByDate,
  getMonthlyAttendance,
  getShiftConfigs,
  saveGlobalShift,
  saveStaffShift,
  resetStaffShift,
  markIn,
  markOut,
  type AttendanceRow,
  type MonthlyRow,
  type ShiftConfigRow,
} from "../actions"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  })
}

function prevDay(d: string) {
  const dt = new Date(d + "T00:00:00")
  dt.setDate(dt.getDate() - 1)
  return dt.toISOString().slice(0, 10)
}

function nextDay(d: string) {
  const dt = new Date(d + "T00:00:00")
  dt.setDate(dt.getDate() + 1)
  return dt.toISOString().slice(0, 10)
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LATE:    { label: "Late",    className: "bg-amber-50  text-amber-700  border-amber-200"  },
  ABSENT:  { label: "Absent",  className: "bg-red-50    text-red-700    border-red-200"    },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, className: "bg-muted text-muted-foreground" }
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  )
}

// ─── Daily Tab ────────────────────────────────────────────────────────────────

function DailyTab() {
  const [date, setDate] = useState(todayIST())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const today = todayIST()
  const isToday = date === today
  const isReadOnly = !isToday

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAttendanceByDate(date)
      if (res.success) setRows(res.data)
      else toast.error(res.error)
    } catch (e) {
      console.error(e)
      toast.error("Failed to load attendance data")
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  async function handleMark(staffId: string, hasCheckIn: boolean) {
    if (isReadOnly) return
    setPendingId(staffId)
    const res = hasCheckIn ? await markOut(staffId) : await markIn(staffId)
    if (res.success) {
      toast.success(hasCheckIn ? "Marked out" : "Marked in")
      await load()
    } else {
      toast.error(res.error)
    }
    setPendingId(null)
  }

  const present = rows.filter((r) => r.attendance?.status === "PRESENT").length
  const late    = rows.filter((r) => r.attendance?.status === "LATE").length
  const absent  = rows.filter((r) => !r.attendance).length

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(prevDay(date))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{fmtDate(date)}</span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setDate(nextDay(date))}
            disabled={date >= today}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setDate(today)}>
              <Clock className="h-3.5 w-3.5" /> Today
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            {present} Present
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
            {late} Late
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" />
            {absent} Not marked
          </span>
        </div>
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Viewing <strong>{fmtDate(date)}</strong> — past dates are read-only. Only today&apos;s attendance can be marked.</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Staff Member</TableHead>
              <TableHead className="font-semibold">Role / Department</TableHead>
              <TableHead className="font-semibold text-center">Shift</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
              <TableHead className="font-semibold text-center">In Time</TableHead>
              <TableHead className="font-semibold text-center">Out Time</TableHead>
              {isToday && <TableHead className="font-semibold text-center w-32">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: isToday ? 7 : 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isToday ? 7 : 6} className="text-center py-12 text-muted-foreground">
                  No staff found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const att = row.attendance
                const hasCheckIn = !!att?.checkIn
                const hasCheckOut = !!att?.checkOut
                const isBusy = pendingId === row.id
                return (
                  <TableRow key={row.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{row.fullName}</p>
                        {row.employeeId && (
                          <p className="text-xs text-muted-foreground">#{row.employeeId}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{row.role}</p>
                        {row.department && (
                          <p className="text-xs text-muted-foreground">{row.department}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-mono text-muted-foreground">{row.shiftStart}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {att ? <StatusBadge status={att.status} /> : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-mono">
                        {att?.checkIn ?? <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-mono">
                        {att?.checkOut ?? <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    {isToday && (
                      <TableCell className="text-center">
                        {hasCheckOut ? (
                          <span className="text-xs text-muted-foreground">Done</span>
                        ) : (
                          <Button
                            size="sm"
                            variant={hasCheckIn ? "outline" : "default"}
                            className={`h-7 text-xs px-3 ${hasCheckIn ? "border-rose-200 text-rose-600 hover:bg-rose-50" : ""}`}
                            disabled={isBusy}
                            onClick={() => handleMark(row.id, hasCheckIn)}
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : hasCheckIn ? "Mark Out" : "Mark In"}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Monthly Tab ──────────────────────────────────────────────────────────────

function MonthlyTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<MonthlyRow[]>([])
  const [daysInMonth, setDaysInMonth] = useState(30)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getMonthlyAttendance(year, month)
    if (res.success) { setRows(res.data); setDaysInMonth(res.daysInMonth) }
    else toast.error(res.error)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const cellColor: Record<string, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700",
    LATE:    "bg-amber-100  text-amber-700",
    ABSENT:  "bg-red-100    text-red-700",
  }

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[140px] text-center">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable grid */}
      <div className="rounded-lg border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold sticky left-0 bg-muted/60 z-10 min-w-[160px]">Staff</TableHead>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <TableHead key={i + 1} className="text-center font-medium min-w-[36px] px-1 text-xs">
                  {i + 1}
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold min-w-[50px]">P</TableHead>
              <TableHead className="text-center font-semibold min-w-[50px]">L</TableHead>
              <TableHead className="text-center font-semibold min-w-[50px]">A</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-28 bg-muted animate-pulse rounded" /></TableCell>
                  {Array.from({ length: daysInMonth + 3 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-6 bg-muted animate-pulse rounded mx-auto" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/20">
                  <TableCell className="sticky left-0 bg-white z-10 border-r border-border">
                    <div>
                      <p className="font-medium text-sm">{row.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.role}</p>
                    </div>
                  </TableCell>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const rec = row.days[i + 1]
                    const cls = rec ? (cellColor[rec.status] ?? "bg-muted text-muted-foreground") : ""
                    return (
                      <TableCell key={i + 1} className="text-center px-1 py-1">
                        {rec ? (
                          <span className={`inline-block rounded text-[10px] font-medium px-1 py-0.5 ${cls}`} title={rec.status}>
                            {rec.status === "PRESENT" ? "P" : rec.status === "LATE" ? "L" : rec.status === "ABSENT" ? "A" : rec.status[0]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-center text-sm font-medium text-emerald-700">{row.presentCount}</TableCell>
                  <TableCell className="text-center text-sm font-medium text-amber-700">{row.lateCount}</TableCell>
                  <TableCell className="text-center text-sm font-medium text-red-700">{row.absentCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Configuration Tab ────────────────────────────────────────────────────────

function ConfigTab() {
  const [rows, setRows] = useState<ShiftConfigRow[]>([])
  const [globalShift, setGlobalShift] = useState("09:00")
  const [editGlobal, setEditGlobal] = useState("09:00")
  const [loading, setLoading] = useState(true)
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [overrideVal, setOverrideVal] = useState("")
  const [savingOverride, setSavingOverride] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getShiftConfigs()
    if (res.success) {
      setRows(res.rows)
      setGlobalShift(res.globalShift)
      setEditGlobal(res.globalShift)
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSaveGlobal() {
    if (!editGlobal) return
    setSavingGlobal(true)
    const res = await saveGlobalShift(editGlobal)
    if (res.success) { toast.success("Default shift updated"); setGlobalShift(editGlobal); await load() }
    else toast.error(res.error)
    setSavingGlobal(false)
  }

  async function handleSaveOverride(staffId: string) {
    if (!overrideVal) return
    setSavingOverride(staffId)
    const res = await saveStaffShift(staffId, overrideVal)
    if (res.success) { toast.success("Shift override saved"); setOverrideId(null); await load() }
    else toast.error(res.error)
    setSavingOverride(null)
  }

  async function handleReset(staffId: string) {
    setResettingId(staffId)
    const res = await resetStaffShift(staffId)
    if (res.success) { toast.success("Shift reset to default"); await load() }
    else toast.error(res.error)
    setResettingId(null)
  }

  void startTransition

  return (
    <div className="space-y-6">
      {/* Global shift card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm">Default Shift Start Time</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Staff without a personal override use this time. Check-in after this = <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200">Late</Badge>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Input
              type="time"
              value={editGlobal}
              onChange={(e) => setEditGlobal(e.target.value)}
              className="w-32 h-8 text-sm font-mono"
            />
            <Button
              size="sm" className="h-8"
              onClick={handleSaveGlobal}
              disabled={savingGlobal || editGlobal === globalShift}
            >
              {savingGlobal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Per-staff overrides */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
          <h3 className="font-semibold text-sm">Per-Staff Shift Overrides</h3>
          <p className="text-xs text-muted-foreground">Set a custom shift start time for individual staff members.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="font-semibold">Staff Member</TableHead>
              <TableHead className="font-semibold">Role / Department</TableHead>
              <TableHead className="font-semibold text-center">Override Shift</TableHead>
              <TableHead className="font-semibold text-center w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {[1, 2, 3, 4].map((j) => (
                    <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No staff found</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isEditing = overrideId === row.staffId
                const isSaving = savingOverride === row.staffId
                const isResetting = resettingId === row.staffId
                return (
                  <TableRow key={row.staffId} className="hover:bg-muted/20">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{row.staffName}</p>
                        {row.employeeId && <p className="text-xs text-muted-foreground">#{row.employeeId}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{row.role}</p>
                        {row.department && <p className="text-xs text-muted-foreground">{row.department}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing ? (
                        <Input
                          type="time"
                          value={overrideVal}
                          onChange={(e) => setOverrideVal(e.target.value)}
                          className="w-28 h-7 text-sm font-mono mx-auto"
                          autoFocus
                        />
                      ) : row.shiftStart ? (
                        <span className="font-mono text-sm">{row.shiftStart}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Default ({globalShift})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <Button size="sm" className="h-7 text-xs px-3" onClick={() => handleSaveOverride(row.staffId)} disabled={isSaving || !overrideVal}>
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setOverrideId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs px-3"
                              onClick={() => { setOverrideId(row.staffId); setOverrideVal(row.shiftStart ?? globalShift) }}
                            >
                              Override
                            </Button>
                            {row.shiftStart && (
                              <Button
                                size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => handleReset(row.staffId)}
                                disabled={isResetting}
                              >
                                {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AttendancePage({ hospitalName }: { hospitalName?: string }) {
  return (
    <Tabs defaultValue="daily" className="flex flex-col h-full">
      <PageHeader title="Attendance" description={hospitalName}>
        <TabsList>
          <TabsTrigger value="daily" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Daily
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <Users className="h-4 w-4" /> Monthly
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings2 className="h-4 w-4" /> Configuration
          </TabsTrigger>
        </TabsList>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        <TabsContent value="daily" className="mt-0">
          <DailyTab />
        </TabsContent>
        <TabsContent value="monthly" className="mt-0">
          <MonthlyTab />
        </TabsContent>
        <TabsContent value="config" className="mt-0">
          <ConfigTab />
        </TabsContent>
      </div>
    </Tabs>
  )
}
