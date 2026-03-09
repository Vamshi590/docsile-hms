"use client"

import { useState, useEffect } from "react"
import {
  Calendar,
  Stethoscope,
  FileText,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  CalendarCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateLong, formatCurrency } from "@/lib/utils"
import { getVisitHistory } from "../actions"

type Visit = Awaited<ReturnType<typeof getVisitHistory>>[0]

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  BILLED: { label: "Billed", variant: "default" },
  PAID: { label: "Paid", variant: "default" },
  PARTIAL: { label: "Partial", variant: "outline" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
}

export function VisitHistoryTab({ patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getVisitHistory(patientId).then((data) => {
      setVisits(data)
      setLoading(false)
    })
  }, [patientId])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto mb-4">
          <Calendar className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No visit history</p>
        <p className="text-xs text-muted-foreground mt-1">This patient has no recorded visits yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{visits.length} visit{visits.length !== 1 ? "s" : ""} found</p>
      </div>

      {visits.map((visit, index) => {
        const expanded = expandedId === visit.id
        const statusInfo = STATUS_MAP[visit.status] ?? { label: visit.status, variant: "secondary" as const }

        return (
          <div
            key={visit.id}
            className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors"
          >
            <button
              onClick={() => setExpandedId(expanded ? null : visit.id)}
              className="w-full px-5 py-4 text-left"
            >
              <div className="flex items-center gap-4">
                {/* Visit Number */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-sm">
                  #{visits.length - index}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {formatDateLong(visit.prescriptionDate)}
                    </span>
                    {visit.prescriptionNumber && (
                      <span className="text-xs font-mono text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                        {visit.prescriptionNumber}
                      </span>
                    )}
                    <Badge variant={visit.patientType === "IPD" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                      {visit.patientType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {visit.doctorName && (
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />
                        {visit.doctorName}
                      </span>
                    )}
                    {visit.department && (
                      <span>{visit.department}</span>
                    )}
                    {visit.presentComplaint && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <FileText className="h-3 w-3 shrink-0" />
                        {visit.presentComplaint}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 shrink-0">
                  {visit.total > 0 && (
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(visit.total)}
                    </span>
                  )}
                  <Badge variant={statusInfo.variant} className="text-xs">
                    {statusInfo.label}
                  </Badge>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>

            {/* Expanded Details */}
            {expanded && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visit.presentComplaint && (
                    <DetailRow label="Chief Complaint" value={visit.presentComplaint} />
                  )}
                  {visit.diagnosis && (
                    <DetailRow label="Diagnosis" value={visit.diagnosis} />
                  )}
                  {visit.doctorName && (
                    <DetailRow label="Doctor" value={visit.doctorName} />
                  )}
                  {visit.department && (
                    <DetailRow label="Department" value={visit.department} />
                  )}
                  {visit.total > 0 && (
                    <DetailRow label="Bill Amount" value={formatCurrency(visit.total)} />
                  )}
                  {visit.balanceDue > 0 && (
                    <DetailRow label="Balance Due" value={formatCurrency(visit.balanceDue)} highlight />
                  )}
                  {visit.followUpDate && (
                    <DetailRow
                      label="Follow-up"
                      value={formatDateLong(visit.followUpDate)}
                      icon={<CalendarCheck className="h-3.5 w-3.5 text-blue-500" />}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DetailRow({
  label,
  value,
  highlight,
  icon,
}: {
  label: string
  value: string
  highlight?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm font-medium mt-0.5 flex items-center gap-1.5 ${highlight ? "text-red-600" : "text-foreground"}`}>
        {icon}
        {value}
      </p>
    </div>
  )
}
