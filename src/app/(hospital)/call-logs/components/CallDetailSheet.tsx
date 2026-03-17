"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Clock, User, FileText, Link2, Search, Play,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateCallNotes, linkCallToPatient, searchPatients } from "../actions"
import type { Database } from "@/lib/supabase/types"

type CallLog = Database["public"]["Tables"]["CallLog"]["Row"]

interface CallDetailSheetProps {
  call: CallLog
  onClose: () => void
  onUpdated: () => void
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

export function CallDetailSheet({ call, onClose, onUpdated }: CallDetailSheetProps) {
  const [notes, setNotes] = useState(call.notes || "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [patientSearch, setPatientSearch] = useState("")
  const [patientResults, setPatientResults] = useState<{ id: string; fullName: string; phone: string | null; patientId: string | null }[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [showPatientSearch, setShowPatientSearch] = useState(false)

  const config = STATUS_CONFIG[call.status] || STATUS_CONFIG.failed
  const StatusIcon = config.icon
  const isInbound = call.direction === "inbound"
  const DirectionIcon = isInbound ? PhoneIncoming : PhoneOutgoing

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await updateCallNotes(call.id, notes)
      toast.success("Notes saved")
      onUpdated()
    } catch {
      toast.error("Failed to save notes")
    } finally {
      setSavingNotes(false)
    }
  }

  const handlePatientSearch = async () => {
    if (!patientSearch.trim()) return
    setSearchingPatients(true)
    try {
      const results = await searchPatients(patientSearch)
      setPatientResults(results)
    } catch {
      toast.error("Failed to search patients")
    } finally {
      setSearchingPatients(false)
    }
  }

  const handleLinkPatient = async (patientId: string, patientName: string) => {
    try {
      await linkCallToPatient(call.id, patientId, patientName)
      toast.success(`Linked to ${patientName}`)
      setShowPatientSearch(false)
      onUpdated()
    } catch {
      toast.error("Failed to link patient")
    }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${config.bg}`}>
              <StatusIcon className={`h-4 w-4 ${config.color}`} />
            </div>
            Call Details
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Caller Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <DirectionIcon className={`h-4 w-4 ${isInbound ? "text-blue-500" : "text-orange-500"}`} />
              <span className="capitalize font-medium">{call.direction} Call</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${config.bg} ${config.color}`}>
                {config.label}
              </span>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">From</span>
                <span className="text-sm font-medium">{formatPhone(call.callFrom)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">To</span>
                <span className="text-sm font-medium">{formatPhone(call.callTo)}</span>
              </div>
              {call.startTime && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Date & Time</span>
                  <span className="text-sm font-medium">
                    {format(new Date(call.startTime), "dd MMM yyyy, hh:mm a")}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Duration</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(call.duration)}
                </span>
              </div>
            </div>
          </div>

          {/* Linked Patient */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Patient
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowPatientSearch(!showPatientSearch)}
              >
                <Link2 className="h-3 w-3 mr-1" />
                {call.patientId ? "Change" : "Link Patient"}
              </Button>
            </div>

            {call.callerName ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-blue-800">{call.callerName}</p>
                {call.patientId && (
                  <p className="text-xs text-blue-600 mt-0.5">ID: {call.patientId}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No patient linked to this call</p>
            )}

            {showPatientSearch && (
              <div className="space-y-2 mt-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search patient name or phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8" onClick={handlePatientSearch} disabled={searchingPatients}>
                    <Search className="h-3 w-3" />
                  </Button>
                </div>
                {patientResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {patientResults.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleLinkPatient(patient.id, patient.fullName)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium">{patient.fullName}</p>
                        <p className="text-xs text-gray-500">
                          {patient.patientId} {patient.phone ? `| ${patient.phone}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recording */}
          {call.recordingUrl && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Play className="h-4 w-4" />
                Recording
              </h3>
              <audio controls className="w-full" preload="none">
                <source src={call.recordingUrl} />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Notes
            </h3>
            <Textarea
              placeholder="Add notes about this call (e.g., appointment requested, follow-up needed)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={savingNotes || notes === (call.notes || "")}
            >
              {savingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
