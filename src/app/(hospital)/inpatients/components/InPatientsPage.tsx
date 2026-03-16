"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { RefreshCw, Plus } from "lucide-react"
import { PageHeader, FilterBar, SearchInput, StatBadge, BreadcrumbHeader } from "@/components/layout/header"
import { InPatientStatusBadge } from "./InPatientStatusBadge"
import { InPatientDetailPage } from "./InPatientDetailPage"
import InPatientAdmissionForm from "./InPatientAdmissionForm"
import { getInPatients } from "../actions"
import type { InPatient } from "@/lib/types"

type Stats = {
  totalAdmitted: number
  activeInStay: number
  readyToDischarge: number
  dischargedToday: number
  totalBalancePending: number
}

const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Admitted", value: "ADMITTED" },
  { label: "Pre-Op", value: "PRE_OP" },
  { label: "In Surgery", value: "IN_SURGERY" },
  { label: "Post-Op", value: "POST_OP" },
  { label: "Ready to Discharge", value: "READY_FOR_DISCHARGE" },
  { label: "Discharged", value: "DISCHARGED" },
]

export default function InPatientsPage() {
  const [patients, setPatients] = useState<InPatient[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [admitOpen, setAdmitOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const result = await getInPatients({
      search: search.trim() || undefined,
      statuses: statusFilter ? [statusFilter] : undefined,
      showDischarged: statusFilter === "" || statusFilter === "DISCHARGED",
    })
    setPatients(result.data as InPatient[])
    setStats(result.stats)
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const selectedPatient = patients.find(p => p.id === selectedId) ?? null

  // If a patient is selected, show the detail page
  if (selectedPatient) {
    return (
      <div className="space-y-5">
        <BreadcrumbHeader
          onBack={() => setSelectedId(null)}
          backLabel="In-Patients"
          currentLabel={selectedPatient.name}
          subtitle={`· ${selectedPatient.ipNumber}`}
        />
        <InPatientDetailPage
          inpatient={selectedPatient}
          onBack={() => setSelectedId(null)}
          onUpdate={fetchData}
        />
      </div>
    )
  }

  return (
    <div className="">
      <PageHeader title="In-Patients" description="Admission & ward management">
        {stats && (
          <>
            <StatBadge value={stats.totalAdmitted} label="Admitted" variant="info" />
            <StatBadge value={stats.activeInStay} label="Active" variant="default" />
            <StatBadge value={stats.readyToDischarge} label="Discharge Ready" variant="success" />
          </>
        )}
      </PageHeader>

      {/* Filters */}
      <FilterBar className="top-16">
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            onSubmit={fetchData}
            placeholder="Search by name, IP number, phone..."
            className="w-64"
          />
          <div className="filter-divider" />
          <div className="flex gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/30">
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`rounded-md text-xs font-medium h-7 px-3 transition-all ${
                  statusFilter === opt.value
                    ? "bg-white text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setAdmitOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Admit Patient
          </Button>
        </div>
      </FilterBar>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>IP Number</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor(s)</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Admission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                  <div className="text-3xl mb-2">🏥</div>
                  <div className="font-medium">No inpatients found</div>
                  <div className="text-xs mt-1">
                    {search ? "Try a different search term" : "Admit a new patient to get started"}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              patients.map(patient => {
                const doctors = (() => {
                  try { return (JSON.parse(patient.doctorNames) as string[]).join(", ") }
                  catch { return patient.doctorNames }
                })()
                return (
                  <TableRow
                    key={patient.id}
                    onClick={() => setSelectedId(patient.id)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-medium">
                        {patient.ipNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {patient.age}y · {patient.gender.charAt(0)} · {patient.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {doctors || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {patient.operationName || (
                          <span className="text-muted-foreground italic">Not assigned</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(patient.admissionDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <InPatientStatusBadge status={patient.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium text-xs ${
                          patient.balanceAmount > 0
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        ₹{patient.balanceAmount.toLocaleString("en-IN")}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {!loading && patients.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {patients.length} patient{patients.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Admission Form */}
      <InPatientAdmissionForm
        open={admitOpen}
        onClose={() => setAdmitOpen(false)}
        onSuccess={() => {
          setAdmitOpen(false)
          fetchData()
        }}
      />
    </div>
  )
}
