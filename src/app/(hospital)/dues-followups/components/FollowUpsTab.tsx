"use client"

import React, { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { FilterBar, SearchInput } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { WhatsAppButton } from "./WhatsAppButton"
import { getFollowUps, getDoctorList, getDepartmentList } from "../actions"
import type { FollowUpRecord, FollowUpsSummary } from "../actions"
import { formatDateLong } from "@/lib/utils"

export function FollowUpsTab({ refreshRef }: { refreshRef?: React.MutableRefObject<(() => void) | null> }) {
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([])
  const [summary, setSummary] = useState<FollowUpsSummary>({
    todayCount: 0, tomorrowCount: 0, totalCount: 0, overdueCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "OPD" | "IPD">("ALL")
  const [doctorFilter, setDoctorFilter] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [includeOverdue, setIncludeOverdue] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [doctors, setDoctors] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])

  // Load filter options once
  useEffect(() => {
    getDoctorList().then(setDoctors)
    getDepartmentList().then(setDepartments)
  }, [])

  const loadFollowUps = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getFollowUps({
        search: search.trim() || undefined,
        type: typeFilter,
        doctor: doctorFilter || undefined,
        department: departmentFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        includeOverdue,
      })
      setFollowUps(result.followUps)
      setSummary(result.summary)
    } catch {
      toast.error("Failed to load follow-ups")
    }
    setLoading(false)
  }, [search, typeFilter, doctorFilter, departmentFilter, dateFrom, dateTo, includeOverdue])

  useEffect(() => { loadFollowUps() }, [loadFollowUps])

  // Expose refresh to parent
  useEffect(() => {
    if (refreshRef) refreshRef.current = loadFollowUps
    return () => { if (refreshRef) refreshRef.current = null }
  }, [refreshRef, loadFollowUps])

  function getFollowUpWhatsAppMessage(fu: FollowUpRecord) {
    return `Hello ${fu.patientName}, this is a reminder. You have a follow-up appointment scheduled for ${formatDateLong(fu.followUpDate)} with Dr. ${fu.doctorName}. Please visit at your convenience. Thank you.`
  }

  function getFollowUpDateStyle(fu: FollowUpRecord) {
    if (fu.isOverdue) return "text-red-600 font-semibold"
    const d = new Date(fu.followUpDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d >= today && d < tomorrow) return "text-amber-600 font-semibold"
    return "text-foreground"
  }

  return (
    <div>
      {/* Filters */}
      <FilterBar className="top-16">
        <div className="flex items-center gap-2.5 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            onSubmit={loadFollowUps}
            placeholder="Search name, phone, ID..."
            className="w-56"
          />
          <div className="filter-divider" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "ALL" | "OPD" | "IPD")}>
            <SelectTrigger className="w-28 text-sm bg-white h-8 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="OPD">OPD</SelectItem>
              <SelectItem value="IPD">IPD</SelectItem>
            </SelectContent>
          </Select>
          <Select value={doctorFilter || "_all"} onValueChange={(v) => setDoctorFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-40 text-sm bg-white h-8 border-border/60">
              <SelectValue placeholder="All Doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Doctors</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter || "_all"} onValueChange={(v) => setDepartmentFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-40 text-sm bg-white h-8 border-border/60">
              <SelectValue placeholder="All Depts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="filter-divider" />
          <DatePicker
            value={dateFrom}
            onChange={(d) => setDateFrom(d)}
            className="w-36 text-sm bg-white h-8 border-border/60"
          />
          <DatePicker
            value={dateTo}
            onChange={(d) => setDateTo(d)}
            className="w-36 text-sm bg-white h-8 border-border/60"
          />
          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeOverdue}
              onChange={(e) => setIncludeOverdue(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-muted-foreground whitespace-nowrap">Overdue</span>
          </label>
        </div>
      </FilterBar>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Today</p>
          <p className="text-xl font-bold text-amber-600">{summary.todayCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Tomorrow</p>
          <p className="text-xl font-bold text-foreground">{summary.tomorrowCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Next 5 Days</p>
          <p className="text-xl font-bold text-primary">{summary.totalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Overdue</p>
          <p className="text-xl font-bold text-red-600">{summary.overdueCount}</p>
        </div>
      </div>

      {/* Follow-Ups Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>Patient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Follow-Up Date</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Diagnosis / Reason</TableHead>
              <TableHead>Last Visit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : followUps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  <CalendarClock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <div className="font-medium">No follow-ups found</div>
                  <div className="text-xs mt-1">No patients due for follow-up in this period</div>
                </TableCell>
              </TableRow>
            ) : (
              followUps.map((fu) => (
                <TableRow key={`${fu.type}-${fu.id}`}>
                  <TableCell>
                    <div className="font-medium text-sm">{fu.patientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {fu.uhid} &middot; {fu.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={fu.type === "OPD" ? "secondary" : "outline"} className="text-xs">
                      {fu.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm ${getFollowUpDateStyle(fu)}`}>
                        {formatDateLong(fu.followUpDate)}
                      </span>
                      {fu.isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{fu.doctorName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{fu.department}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-48">
                      {fu.diagnosis}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{formatDateLong(fu.lastVisitDate)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <WhatsAppButton phone={fu.phone} message={getFollowUpWhatsAppMessage(fu)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && followUps.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {followUps.length} record{followUps.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
