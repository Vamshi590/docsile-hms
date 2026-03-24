"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format } from "date-fns"
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Search, RefreshCw, Clock, Eye, BarChart3,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCallLogs, getCallStats, syncExotelCalls } from "../actions"
import { CallDetailSheet } from "./CallDetailSheet"
import type { Database } from "@/lib/supabase/types"

type CallLog = Database["public"]["Tables"]["CallLog"]["Row"]

type TimeFilter = "today" | "week" | "month" | "custom"

function getDateRange(filter: TimeFilter, customStart: string, customEnd: string) {
  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")
  switch (filter) {
    case "today":
      return { startDate: todayStr, endDate: todayStr }
    case "week": {
      const weekAgo = new Date(today)
      weekAgo.setDate(today.getDate() - 7)
      return { startDate: format(weekAgo, "yyyy-MM-dd"), endDate: todayStr }
    }
    case "month": {
      const monthAgo = new Date(today)
      monthAgo.setMonth(today.getMonth() - 1)
      return { startDate: format(monthAgo, "yyyy-MM-dd"), endDate: todayStr }
    }
    case "custom":
      return { startDate: customStart || todayStr, endDate: customEnd || todayStr }
  }
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function formatPhone(phone: string): string {
  if (!phone) return "Unknown"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  completed: { label: "Answered", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: Phone },
  missed: { label: "Missed", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: PhoneMissed },
  busy: { label: "Busy", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: PhoneOff },
  failed: { label: "Failed", color: "text-gray-500", bg: "bg-gray-50 border-gray-200", icon: PhoneOff },
  ringing: { label: "Ringing", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Phone },
}

type CallStats = {
  total: number
  completed: number
  missed: number
  busy: number
  failed: number
  inbound: number
  outbound: number
  totalDuration: number
  avgDuration: number
}

export default function CallLogsPage() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [stats, setStats] = useState<CallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showStatsDialog, setShowStatsDialog] = useState(false)

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [directionFilter, setDirectionFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange(timeFilter, customStart, customEnd)
      const [callsData, statsData] = await Promise.all([
        getCallLogs({ startDate, endDate, status: statusFilter, direction: directionFilter, search: searchQuery }),
        getCallStats(startDate, endDate),
      ])
      setCalls(callsData)
      setStats(statsData)
    } catch {
      toast.error("Failed to load call logs")
    } finally {
      setLoading(false)
    }
  }, [timeFilter, customStart, customEnd, statusFilter, directionFilter, searchQuery])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncExotelCalls()
      if (result.success) {
        toast.success(`Synced ${result.synced} new call(s) from Exotel`)
        fetchData()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSyncing(false)
    }
  }

  const filteredCalls = useMemo(() => {
    if (!searchQuery) return calls
    const q = searchQuery.toLowerCase()
    return calls.filter((call) => {
      return (
        call.callFrom.toLowerCase().includes(q) ||
        (call.callerName?.toLowerCase().includes(q)) ||
        (call.notes?.toLowerCase().includes(q))
      )
    })
  }, [calls, searchQuery])

  return (
    <div className="space-y-0">
      <PageHeader title="Call Logs" description="Reception call management">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatsDialog(true)}
          >
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Stats
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Calls"}
          </Button>
        </div>
      </PageHeader>

      {/* Sub Header with Date Filter */}
      <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border -mx-6">
        <div className="bg-muted rounded-lg p-0.5 flex">
          {(["today", "week", "month", "custom"] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
                timeFilter === f
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "today" ? "Today" : f === "week" ? "7 Days" : f === "month" ? "30 Days" : "Custom"}
            </button>
          ))}
        </div>

        {timeFilter === "custom" && (
          <>
            <label className="text-xs font-medium text-muted-foreground">From:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <label className="text-xs font-medium text-muted-foreground">To:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </>
        )}
      </div>

      {/* Call List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
            <Input
              type="text"
              placeholder="Search by phone, name, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm w-full sm:w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Answered</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="h-9 text-sm w-full sm:w-[150px]">
              <SelectValue placeholder="All Directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Call Table */}
        {loading ? (
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Caller / Contact</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No call logs found for the selected filters</p>
            <p className="text-gray-400 text-xs mt-1">Call data will appear here once Exotel is connected</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead>Direction</TableHead>
                <TableHead>Caller / Contact</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCalls.map((call) => {
                const config = STATUS_CONFIG[call.status] || STATUS_CONFIG.failed
                const isInbound = call.direction === "inbound"
                const DirectionIcon = isInbound ? PhoneIncoming : PhoneOutgoing

                return (
                  <TableRow key={call.id} className="cursor-pointer" onClick={() => setSelectedCall(call)}>
                    {/* Direction */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DirectionIcon className={`h-4 w-4 ${isInbound ? "text-blue-500" : "text-orange-500"}`} />
                        <span className="text-sm capitalize">{call.direction}</span>
                      </div>
                    </TableCell>

                    {/* Caller Name */}
                    <TableCell>
                      <span className="text-sm font-medium text-gray-800">
                        {call.callerName || "—"}
                      </span>
                    </TableCell>

                    {/* Phone Number */}
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {formatPhone(isInbound ? call.callFrom : call.callTo)}
                      </span>
                    </TableCell>

                    {/* Date & Time */}
                    <TableCell>
                      {call.startTime ? (
                        <div className="text-sm">
                          <div className="text-gray-800">{format(new Date(call.startTime), "dd MMM yyyy")}</div>
                          <div className="text-gray-500 text-xs">{format(new Date(call.startTime), "hh:mm a")}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>

                    {/* Duration */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{formatDuration(call.duration)}</span>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </TableCell>

                    {/* Notes */}
                    <TableCell>
                      <span className="text-sm text-gray-500 truncate max-w-[150px] block">
                        {call.notes || "—"}
                      </span>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCall(call)
                        }}
                      >
                        <Eye className="h-4 w-4 text-gray-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Call Detail Sheet */}
      {selectedCall && (
        <CallDetailSheet
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onUpdated={() => {
            setSelectedCall(null)
            fetchData()
          }}
        />
      )}

      {/* Stats Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Call Statistics</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-2xl font-bold text-gray-800">{stats?.total ?? 0}</div>
                <div className="text-xs text-gray-500">Total Calls</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">{formatDuration(stats?.avgDuration ?? 0)}</div>
                <div className="text-xs text-gray-500">Avg Duration</div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">By Status</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-700">Answered</span>
                  </div>
                  <span className="text-sm font-semibold text-green-700">{stats?.completed ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2">
                    <PhoneMissed className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-gray-700">Missed</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{stats?.missed ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2">
                    <PhoneOff className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-gray-700">Busy</span>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">{stats?.busy ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <PhoneOff className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Failed</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">{stats?.failed ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Direction Breakdown */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">By Direction</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700">Inbound</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{stats?.inbound ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-2">
                    <PhoneOutgoing className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-700">Outbound</span>
                  </div>
                  <span className="text-sm font-semibold text-orange-600">{stats?.outbound ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Total Duration */}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-gray-700">Total Talk Time</span>
              </div>
              <span className="text-sm font-semibold text-purple-700">{formatDuration(stats?.totalDuration ?? 0)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
