"use client"

import { useState, useCallback } from "react"
import { PageHeader } from "@/components/layout/header"
import {
  Calendar,
  Pill,
  BedDouble,
  FlaskConical,
  IndianRupee,
  FileSearch,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PatientSearch } from "./PatientSearch"
import { PatientSummaryCard } from "./PatientSummaryCard"
import { VisitHistoryTab } from "./VisitHistoryTab"
import { PrescriptionsTab } from "./PrescriptionsTab"
import { InpatientRecordsTab } from "./InpatientRecordsTab"
import { LabRecordsTab } from "./LabRecordsTab"
import { BillingTab } from "./BillingTab"
import { getPatientSummary } from "../actions"
import { Skeleton } from "@/components/ui/skeleton"

type PatientSummary = Awaited<ReturnType<typeof getPatientSummary>>

const TABS = [
  { id: "visits", label: "Visits", icon: Calendar, accent: "blue" },
  { id: "prescriptions", label: "Prescriptions", icon: Pill, accent: "emerald" },
  { id: "inpatient", label: "Inpatient", icon: BedDouble, accent: "violet" },
  { id: "labs", label: "Lab Records", icon: FlaskConical, accent: "orange" },
  { id: "billing", label: "Billing & Dues", icon: IndianRupee, accent: "rose" },
] as const

const ACCENT_STYLES: Record<string, { active: string; icon: string; dot: string }> = {
  blue:    { active: "bg-blue-50 border-blue-200 text-blue-700 shadow-sm shadow-blue-100/50",       icon: "text-blue-600",    dot: "bg-blue-500" },
  emerald: { active: "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100/50", icon: "text-emerald-600", dot: "bg-emerald-500" },
  violet:  { active: "bg-violet-50 border-violet-200 text-violet-700 shadow-sm shadow-violet-100/50",   icon: "text-violet-600",  dot: "bg-violet-500" },
  orange:  { active: "bg-orange-50 border-orange-200 text-orange-700 shadow-sm shadow-orange-100/50",   icon: "text-orange-600",  dot: "bg-orange-500" },
  rose:    { active: "bg-rose-50 border-rose-200 text-rose-700 shadow-sm shadow-rose-100/50",       icon: "text-rose-600",    dot: "bg-rose-500" },
}

export default function ReportsPage() {
  const [patient, setPatient] = useState<PatientSummary>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("visits")

  const handlePatientSelect = useCallback(async (selected: { patientId: string }) => {
    setLoading(true)
    setActiveTab("visits")
    const summary = await getPatientSummary(selected.patientId)
    setPatient(summary)
    setLoading(false)
  }, [])

  return (
    <div className="space-y-0">
      <PageHeader title="Patient Reports">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          <span>Complete Patient History</span>
        </div>
      </PageHeader>

      {/* Search Section */}
      <div className="py-8 px-4">
        <div className="text-center mb-5">
          <h2 className="text-lg font-semibold text-foreground">Search Patient Records</h2>
          <p className="text-sm text-muted-foreground mt-1">Look up any patient by ID, name, or phone number to view their complete history</p>
        </div>
        <PatientSearch
          onSelect={handlePatientSelect}
          selectedPatientId={patient?.patientId}
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4 px-1">
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4 mt-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patient Report */}
      {!loading && patient && (
        <div className="space-y-0 px-1">
          {/* Summary Card */}
          <PatientSummaryCard patient={patient} />

          {/* Tab Navigation */}
          <div className="sticky top-18 z-10 -mx-5 px-5 pt-5 pb-0 bg-gray-50">
            <div className="bg-white border border-gray-200 rounded-2xl p-1.5 flex gap-1 overflow-x-auto">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                const styles = ACCENT_STYLES[tab.accent]
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 whitespace-nowrap",
                      isActive
                        ? styles.active
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-gray-50"
                    )}
                  >
                    <tab.icon className={cn("h-4 w-4 shrink-0", isActive ? styles.icon : "text-current")} />
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="pt-5">
            {activeTab === "visits" && (
              <VisitHistoryTab patientId={patient.patientId} />
            )}
            {activeTab === "prescriptions" && (
              <PrescriptionsTab patientId={patient.patientId} patient={patient} />
            )}
            {activeTab === "inpatient" && (
              <InpatientRecordsTab patientInternalId={patient.id} patient={patient} />
            )}
            {activeTab === "labs" && (
              <LabRecordsTab patientId={patient.patientId} patient={patient} />
            )}
            {activeTab === "billing" && (
              <BillingTab patientId={patient.patientId} patientInternalId={patient.id} />
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !patient && (
        <div className="text-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 mx-auto mb-5">
            <FileSearch className="h-9 w-9 text-primary/60" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Search for a patient to get started</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
            Enter a Patient ID, name, or phone number above to view their complete medical history, prescriptions, lab records, and billing details.
          </p>
        </div>
      )}
    </div>
  )
}
