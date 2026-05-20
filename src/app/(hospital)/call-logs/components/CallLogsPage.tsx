"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format } from "date-fns"
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Search, RefreshCw, Clock, Eye, Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCallLogs, syncExotelCalls } from "../actions"
import { CallDetailSheet } from "./CallDetailSheet"
import CallAnalyticsTab from "./CallAnalyticsTab"
import type { Database } from "@/lib/supabase/types"

type CallLog = Database["public"]["Tables"]["CallLog"]["Row"]

type ActiveTab = "calls" | "analytics"

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

export default function CallLogsPage({
  initialCalls,
  initialStartDate,
  initialEndDate,
  initialStatusFilter,
  initialDirectionFilter,
  initialSearchQuery,
}: {
  initialCalls: CallLog[]
  initialStartDate: string
  initialEndDate: string
  initialStatusFilter: string
  initialDirectionFilter: string
  initialSearchQuery: string
}) {
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>("calls")

  // Date picker state — seeded from URL on first load
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [directionFilter, setDirectionFilter] = useState(initialDirectionFilter)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)

  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  const fetchData = useCallback(async () => {
    if (activeTab !== "calls") return
    setLoading(true)
    try {
      const callsData = await getCallLogs({ startDate, endDate, status: statusFilter, direction: directionFilter, search: searchQuery })
      setCalls(callsData)
    } catch {
      toast.error("Failed to load call logs")
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, statusFilter, directionFilter, searchQuery, activeTab])

  const skipFirstLoad = useRef(true)
  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false
      return
    }
    fetchData()
  }, [fetchData])

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
      <PageHeader title="Call Logs" description="Reception call management" onRefresh={fetchData}>
        <div className="flex items-center gap-2">
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

      {/* Sub Header: Date Picker + Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3 bg-card border-b border-border -mx-6">
        {/* Date Picker */}
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <span className="text-xs text-muted-foreground font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-muted rounded-lg p-0.5 flex">
          {([
            { key: "calls" as ActiveTab, label: "Calls" },
            { key: "analytics" as ActiveTab, label: "Analytics" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                activeTab === t.key
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && (
        <div className="pt-4">
          <CallAnalyticsTab startDate={startDate} endDate={endDate} />
        </div>
      )}

      {/* ── Calls Tab ── */}
      {activeTab === "calls" && (
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DirectionIcon className={`h-4 w-4 ${isInbound ? "text-blue-500" : "text-orange-500"}`} />
                          <span className="text-sm capitalize">{call.direction}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-gray-800">
                          {call.callerName || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatPhone(isInbound ? call.callFrom : call.callTo)}
                        </span>
                      </TableCell>
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
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span>{formatDuration(call.duration)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500 truncate max-w-[150px] block">
                          {call.notes || "—"}
                        </span>
                      </TableCell>
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
      )}

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
    </div>
  )
}
