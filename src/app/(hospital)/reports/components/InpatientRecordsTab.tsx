"use client"

import { useState, useEffect } from "react"
import {
  BedDouble,
  Calendar,
  Stethoscope,
  Syringe,
  FileText,
  Shield,
  Pill,
  ChevronDown,
  ChevronUp,
  Heart,
  CalendarCheck,
  ClipboardList,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateLong, formatCurrency } from "@/lib/utils"
import { getInpatientRecords } from "../actions"

type InpatientRecord = Awaited<ReturnType<typeof getInpatientRecords>>

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ADMITTED: "default",
  DISCHARGED: "secondary",
  CANCELLED: "destructive",
}

// Flat array: each item is a single medicine row
type IPPrescription = {
  medicine: string
  days: string
  timing: string
  note?: string
}

// Discharge notes is a JSON object, not a plain string
type DischargeSummary = {
  diagnosis?: string
  conditionAtDischarge?: string
  medications?: string
  followUpInstructions?: string
  notes?: string
}

export function InpatientRecordsTab({ patientInternalId }: { patientInternalId: string }) {
  const [record, setRecord] = useState<InpatientRecord>(null)
  const [loading, setLoading] = useState(true)
  const [showPrescriptions, setShowPrescriptions] = useState(false)
  const [showDischarge, setShowDischarge] = useState(false)
  const [showInsurance, setShowInsurance] = useState(false)

  useEffect(() => {
    setLoading(true)
    getInpatientRecords(patientInternalId).then((data) => {
      setRecord(data)
      setLoading(false)
    })
  }, [patientInternalId])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto mb-4">
          <BedDouble className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No inpatient records</p>
        <p className="text-xs text-muted-foreground mt-1">This patient has no inpatient admissions</p>
      </div>
    )
  }

  const ipPrescriptions: IPPrescription[] = (() => {
    try {
      const parsed = JSON.parse(record.prescriptions || "[]")
      return Array.isArray(parsed) ? parsed.filter((m: IPPrescription) => m.medicine?.trim()) : []
    } catch { return [] }
  })()

  const dischargeSummary: DischargeSummary | null = (() => {
    try {
      const parsed = JSON.parse(record.dischargeNotes || "{}")
      if (parsed && typeof parsed === "object" && (parsed.diagnosis || parsed.conditionAtDischarge || parsed.medications || parsed.followUpInstructions || parsed.notes)) {
        return parsed
      }
      return null
    } catch { return null }
  })()

  const doctors: string[] = (() => {
    try { return JSON.parse(record.doctorNames || "[]") } catch { return [] }
  })()

  return (
    <div className="space-y-4">
      {/* Admission Card */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50">
              <BedDouble className="h-5.5 w-5.5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-base font-bold text-foreground">{record.name}</h3>
                <span className="text-xs font-mono bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-semibold">
                  {record.ipNumber}
                </span>
                <Badge variant={STATUS_COLORS[record.status] ?? "secondary"}>
                  {record.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Admitted: {formatDateLong(record.admissionDate)}
                </span>
                {record.dischargeDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Discharged: {formatDateLong(record.dischargeDate)}
                  </span>
                )}
                {record.department && (
                  <span>{record.department}</span>
                )}
                {record.wardName && record.bedNumber && (
                  <span>Ward: {record.wardName} / Bed: {record.bedNumber}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {doctors.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Doctors</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {doctors.map((d, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" /> {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {record.provisionDiagnosis && (
              <div>
                <span className="text-xs text-muted-foreground">Provisional Diagnosis</span>
                <p className="text-sm font-medium text-foreground mt-0.5">{record.provisionDiagnosis}</p>
              </div>
            )}
            {record.operationName && (
              <div>
                <span className="text-xs text-muted-foreground">Operation</span>
                <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1">
                  <Syringe className="h-3.5 w-3.5 text-violet-500" /> {record.operationName}
                </p>
                {record.operationDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateLong(record.operationDate)}</p>
                )}
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">Financial</span>
              <div className="mt-0.5 space-y-0.5">
                <p className="text-sm font-medium text-foreground">Package: {formatCurrency(record.packageAmount)}</p>
                <p className="text-xs text-emerald-600 font-medium">Paid: {formatCurrency(record.totalReceivedAmount)}</p>
                {record.balanceAmount > 0 && (
                  <p className="text-xs text-red-600 font-medium">Due: {formatCurrency(record.balanceAmount)}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Admission Notes */}
        {record.admissionNotes && (
          <div className="border-t border-gray-100 px-6 py-3">
            <span className="text-xs text-muted-foreground">Admission Notes</span>
            <p className="text-sm text-foreground mt-0.5">{record.admissionNotes}</p>
          </div>
        )}
      </div>

      {/* Inpatient Prescriptions */}
      {ipPrescriptions.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPrescriptions(!showPrescriptions)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Pill className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-foreground">Inpatient Prescriptions</span>
              <Badge variant="secondary" className="text-xs">{ipPrescriptions.length} medicine{ipPrescriptions.length !== 1 ? "s" : ""}</Badge>
            </div>
            {showPrescriptions ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showPrescriptions && (
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="space-y-2">
                {ipPrescriptions.map((med, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-gray-50/80 border border-gray-100"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-foreground">{med.medicine}</span>
                    </div>
                    {med.timing && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium shrink-0">
                        {med.timing}
                      </span>
                    )}
                    {med.days && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium shrink-0">
                        {med.days} days
                      </span>
                    )}
                    {med.note && (
                      <span className="text-xs text-muted-foreground italic shrink-0 max-w-[160px] truncate">
                        {med.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discharge Summary */}
      {(dischargeSummary || (record.status === "DISCHARGED" && record.dischargeDate)) && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDischarge(!showDischarge)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-foreground">Discharge Summary</span>
              {record.dischargeDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDateLong(record.dischargeDate)}
                </span>
              )}
            </div>
            {showDischarge ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showDischarge && (
            <div className="border-t border-gray-100">
              {dischargeSummary ? (
                <div className="p-5 space-y-4">
                  {/* Discharge Date & Condition Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {record.dischargeDate && (
                      <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                          Discharge Date
                        </p>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          {formatDateLong(record.dischargeDate)}
                        </p>
                      </div>
                    )}
                    {dischargeSummary.conditionAtDischarge && (
                      <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                          Condition at Discharge
                        </p>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-rose-500" />
                          {dischargeSummary.conditionAtDischarge}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Diagnosis */}
                  {dischargeSummary.diagnosis && (
                    <div className="rounded-xl bg-blue-50/50 border border-blue-100 px-4 py-3">
                      <p className="text-[11px] text-blue-600 font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        Discharge Diagnosis
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {dischargeSummary.diagnosis}
                      </p>
                    </div>
                  )}

                  {/* Medications on Discharge */}
                  {dischargeSummary.medications && (
                    <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 px-4 py-3">
                      <p className="text-[11px] text-emerald-600 font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Pill className="h-3 w-3" />
                        Medications on Discharge
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {dischargeSummary.medications}
                      </p>
                    </div>
                  )}

                  {/* Follow-up Instructions */}
                  {dischargeSummary.followUpInstructions && (
                    <div className="rounded-xl bg-amber-50/50 border border-amber-100 px-4 py-3">
                      <p className="text-[11px] text-amber-600 font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3" />
                        Follow-up Instructions
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {dischargeSummary.followUpInstructions}
                      </p>
                    </div>
                  )}

                  {/* Additional Notes */}
                  {dischargeSummary.notes && (
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Additional Notes
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {dischargeSummary.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-5 py-4 bg-gray-50/30">
                  <p className="text-sm text-muted-foreground">
                    Discharged on {formatDateLong(record.dischargeDate)}. No detailed discharge summary available.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Insurance Claims */}
      {record.insuranceClaims.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowInsurance(!showInsurance)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-foreground">Insurance Claims</span>
              <Badge variant="secondary" className="text-xs">{record.insuranceClaims.length}</Badge>
            </div>
            {showInsurance ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showInsurance && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {record.insuranceClaims.map((claim: any) => (
                <div key={claim.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{claim.insuranceCompanyName}</span>
                        <span className="text-xs font-mono text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                          {claim.claimNumber}
                        </span>
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">{claim.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-right">
                      {claim.totalApprovedAmount > 0 && (
                        <p className="text-sm font-medium">Approved: {formatCurrency(claim.totalApprovedAmount)}</p>
                      )}
                      {claim.finalSettledAmount > 0 && (
                        <p className="text-xs text-emerald-600 font-medium">Settled: {formatCurrency(claim.finalSettledAmount)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
