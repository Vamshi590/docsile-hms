"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format } from "date-fns"
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Search, RefreshCw, Clock, ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
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

  const statCards = [
    { label: "Total Calls", value: stats?.total ?? 0, color: "text-gray-800", bg: "bg-white" },
    { label: "Answered", value: stats?.completed ?? 0, color: "text-green-700", bg: "bg-green-50" },
    { label: "Missed", value: stats?.missed ?? 0, color: "text-red-600", bg: "bg-red-50" },
    { label: "Avg Duration", value: formatDuration(stats?.avgDuration ?? 0), color: "text-blue-700", bg: "bg-blue-50" },
  ]

  return (
    <div className="space-y-0">
      <PageHeader title="Call Logs" description="Reception call management">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Calls"}
        </Button>
      </PageHeader>

      {/* Time filter tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 mt-4">
        <div className="flex flex-wrap gap-3 items-center">
          {(["today", "week", "month", "custom"] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === filter
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {filter === "today" ? "Today" : filter === "week" ? "This Week" : filter === "month" ? "This Month" : "Custom Range"}
            </button>
          ))}

          {timeFilter === "custom" && (
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[150px] h-9 text-sm"
              />
              <span className="text-sm text-gray-500">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[150px] h-9 text-sm"
              />
              <Button size="sm" onClick={fetchData}>
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-xl shadow-sm border border-gray-100 p-4`}
          >
            {loading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Call List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
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

        {/* Call List */}
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No call logs found for the selected filters</p>
            <p className="text-gray-400 text-xs mt-1">Call data will appear here once Exotel is connected</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCalls.map((call) => {
              const config = STATUS_CONFIG[call.status] || STATUS_CONFIG.failed
              const StatusIcon = config.icon
              const isInbound = call.direction === "inbound"
              const DirectionIcon = isInbound ? PhoneIncoming : PhoneOutgoing

              return (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Direction & Status Icon */}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ${config.bg}`}>
                    <StatusIcon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  {/* Caller Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {call.callerName || formatPhone(isInbound ? call.callFrom : call.callTo)}
                      </span>
                      {call.callerName && (
                        <span className="text-xs text-gray-400 truncate">
                          {formatPhone(isInbound ? call.callFrom : call.callTo)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <DirectionIcon className={`h-3 w-3 ${isInbound ? "text-blue-500" : "text-orange-500"}`} />
                      <span className="text-xs text-gray-500 capitalize">{call.direction}</span>
                      {call.startTime && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(call.startTime), "hh:mm a")}
                          </span>
                        </>
                      )}
                      {call.notes && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs text-gray-400 truncate max-w-[120px]">{call.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0 w-16 justify-end">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(call.duration)}</span>
                  </div>

                  <ChevronDown className="h-4 w-4 text-gray-300 -rotate-90 shrink-0" />
                </button>
              )
            })}
          </div>
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
    </div>
  )
}
