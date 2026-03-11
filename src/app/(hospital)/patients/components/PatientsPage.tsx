"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Plus, Search, ChevronLeft, ChevronRight,
  BarChart2, TrendingUp, IndianRupee, X, ArrowLeft,
  MoreVertical, Pencil, Trash2, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PatientTable, PatientRow } from "./PatientTable"
import { PatientRegistrationStepper } from "./PatientRegistrationStepper"
import InPatientAdmissionForm from "@/app/(hospital)/inpatients/components/InPatientAdmissionForm"
import { InPatientStatusBadge } from "@/app/(hospital)/inpatients/components/InPatientStatusBadge"
import { InPatientDetailPage } from "@/app/(hospital)/inpatients/components/InPatientDetailPage"
import { PatientDetail } from "./PatientDetail"
import { ExistingPatientSearch } from "./ExistingPatientSearch"
import { AddServicesModal } from "./AddServicesModal"
import { getPatients, searchExistingPatients, getCurrentUserRole, deletePatient } from "../actions"
import { getInPatients, deleteInPatient } from "@/app/(hospital)/inpatients/actions"
import { todayISO, formatDateLong, toLocalDateISO } from "@/lib/utils"
import type { InPatient } from "@/lib/types"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

type SearchResult = Awaited<ReturnType<typeof searchExistingPatients>>[0]

export function PatientsPage({ hospitalName }: { hospitalName: string }) {
  const [tab, setTab] = useState<"OPD" | "IPD">("OPD")
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [search, setSearch] = useState("")
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [inpatients, setInpatients] = useState<InPatient[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState("")

  // Edit/Delete state
  const [editPatient, setEditPatient] = useState<PatientRow | null>(null)
  const [editInpatient, setEditInpatient] = useState<InPatient | null>(null)
  const [selectedInpatient, setSelectedInpatient] = useState<InPatient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "OPD" | "IPD"; id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)


  async function loadPatients() {
    setLoading(true)
    if (tab === "IPD") {
      const result = await getInPatients({
        search: search.trim() || undefined,
        showDischarged: true,
      })
      setInpatients(result.data as InPatient[])
    } else {
      const data = await getPatients({ date: selectedDate, search: search || undefined, type: tab })
      setPatients(data)
    }
    setLoading(false)
  }

  useEffect(() => { loadPatients() }, [selectedDate, tab])
  useEffect(() => { getCurrentUserRole().then(r => setUserRole(r.role)) }, [])

  function prevDay() {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() - 1)
    setSelectedDate(toLocalDateISO(d))
  }
  function nextDay() {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() + 1)
    setSelectedDate(toLocalDateISO(d))
  }

  const registered = patients.filter(p => p.status === "REGISTERED").length
  const inProgress = patients.filter(p => ["IN_WORKUP", "WORKUP_DONE", "WITH_DOCTOR"].includes(p.status)).length
  const visited = patients.filter(p => ["VISITED", "COMPLETED", "MEDICAL_ONLY"].includes(p.status)).length
  const totalRevenue = patients.reduce((sum, p) => {
    const invoices = (p as { invoices?: { amountPaid: number }[] }).invoices ?? []
    return sum + invoices.reduce((s, inv) => s + inv.amountPaid, 0)
  }, 0)
  const totalBalance = patients.reduce((sum, p) => {
    const invoices = (p as { invoices?: { balanceDue: number }[] }).invoices ?? []
    return sum + invoices.reduce((s, inv) => s + inv.balanceDue, 0)
  }, 0)

  async function handleDelete() {
    if (!deleteTarget) return
    setSubmitting(true)
    const result = deleteTarget.type === "OPD"
      ? await deletePatient(deleteTarget.id)
      : await deleteInPatient(deleteTarget.id)
    setSubmitting(false)
    if (result.success) {
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
      loadPatients()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as "OPD" | "IPD"); setSelectedPatient(null) }}>

        {/* Page Header — sticky bar */}
        <div className="bg-white border-b border-border px-6 py-4 -mx-6 -mt-6 mb-0 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              {(selectedPatient || selectedInpatient) ? (
                /* Breadcrumb */
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setSelectedPatient(null); setSelectedInpatient(null) }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-[1.2rem] font-semibold">Patients</span>
                  </button>
                  <span className="text-muted-foreground text-[1.2rem]">/</span>
                  <span className="text-[1.2rem] font-semibold text-foreground">
                    {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName ?? ""}` : selectedInpatient?.name}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground ml-1 mt-0.5">
                    · {selectedPatient ? selectedPatient.patientId : selectedInpatient?.ipNumber}
                  </span>
                </div>
              ) : (
                <>
                  <h1 className="text-[1.2rem] font-semibold text-foreground tracking-tight leading-none">Patients</h1>
                  <p className="text-xs text-muted-foreground mt-1">{hospitalName}</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {!selectedPatient && !selectedInpatient && (
                <>
                  <TabsList>
                    <TabsTrigger
                      value="OPD"
                      className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                      Out-Patients
                    </TabsTrigger>
                    <TabsTrigger
                      value="IPD"
                      className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                      In-Patients
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStats(true)}
                    className="gap-2 text-sm"
                  >
                    <BarChart2 className="h-4 w-4" />
                    Stats
                  </Button>
                  <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add Patient
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Date nav + Search — only shown in list view */}
        {!selectedPatient && !selectedInpatient && (
          <div className="bg-gray-50 border-b border-border shadow-sm px-6 py-2 -mx-6 mb-5 sticky top-18 z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" onClick={prevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-40 text-sm bg-white"
                />
                <Button variant="outline" size="icon-sm" onClick={nextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="relative max-w-72 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ID, name, phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loadPatients()}
                    className="pl-9 text-sm bg-white"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={loadPatients} disabled={loading}>
                  Search
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <ExistingPatientSearch
                  onSelect={(patient: SearchResult) => setExistingPatientId(patient.patientId)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Patient detail view */}
        {selectedInpatient ? (
          <div className="mt-5">
            <InPatientDetailPage
              inpatient={selectedInpatient}
              onBack={() => setSelectedInpatient(null)}
              onUpdate={async () => { await loadPatients(); setSelectedInpatient(null) }}
              variant="info"
            />
          </div>
        ) : selectedPatient ? (
          <div className="mt-5">
            <PatientDetail
              patientId={selectedPatient.patientId}
              onBack={() => setSelectedPatient(null)}
              onUpdate={loadPatients}
            />
          </div>
        ) : (
          <>
            <TabsContent value="OPD" className="mt-0">
              <PatientTable
                patients={patients}
                loading={loading}
                onRowClick={p => setSelectedPatient(p)}
                userRole={userRole}
                onEdit={p => setEditPatient(p)}
                onDelete={p => setDeleteTarget({ type: "OPD", id: p.patientId, name: `${p.firstName} ${p.lastName ?? ""}`.trim() })}
              />
            </TabsContent>
            <TabsContent value="IPD" className="mt-0">
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
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : inpatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                          <div className="font-medium">No inpatients found</div>
                          <div className="text-xs mt-1">
                            {search ? "Try a different search term" : "Use Add Patient to admit a new inpatient"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      inpatients.map(patient => {
                        const doctors = (() => {
                          try { return (JSON.parse(patient.doctorNames) as string[]).join(", ") }
                          catch { return patient.doctorNames }
                        })()
                        return (
                          <TableRow key={patient.id} className="cursor-pointer" onClick={() => setSelectedInpatient(patient)}>
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
                            <TableCell onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditInpatient(patient)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  {userRole === "ADMIN" && (
                                    <DropdownMenuItem
                                      onClick={() => setDeleteTarget({ type: "IPD", id: patient.id, name: patient.name })}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
                {!loading && inpatients.length > 0 && (
                  <div className="px-4 py-2 border-t border-border bg-muted/20">
                    <span className="text-xs text-muted-foreground">
                      {inpatients.length} patient{inpatients.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowStats(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-8px_rgba(0,0,0,0.2)] w-full max-w-md p-6 animate-zoom-in mx-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Today&apos;s Stats</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{formatDateLong(selectedDate)}</p>
              </div>
              <button
                onClick={() => setShowStats(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: "Total Patients", value: patients.length, color: "text-foreground", bg: "bg-slate-50" },
                { label: "Registered", value: registered, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "In Progress", value: inProgress, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Visited", value: visited, color: "text-green-600", bg: "bg-green-50" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3`}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-[#e2e8f0] pt-4 space-y-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Revenue Summary
              </p>
              <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Collected Today</span>
                </div>
                <span className="text-lg font-bold text-green-700">
                  &#8377;{totalRevenue.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-800">Balance Due</span>
                </div>
                <span className="text-lg font-bold text-orange-600">
                  &#8377;{totalBalance.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "OPD" ? (
        <PatientRegistrationStepper
          open={showAdd}
          onClose={() => setShowAdd(false)}
          patientType="OPD"
          onSuccess={loadPatients}
        />
      ) : (
        <InPatientAdmissionForm
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); loadPatients() }}
        />
      )}

      <AddServicesModal
        patientId={existingPatientId}
        open={!!existingPatientId}
        onClose={() => setExistingPatientId(null)}
        onSuccess={loadPatients}
      />

      {/* ── Edit OPD Patient (reuses registration stepper) ── */}
      <PatientRegistrationStepper
        open={!!editPatient}
        onClose={() => setEditPatient(null)}
        patientType="OPD"
        onSuccess={() => { setEditPatient(null); loadPatients() }}
        editPatient={editPatient}
      />

      {/* ── Edit IPD Patient (reuses admission form) ── */}
      <InPatientAdmissionForm
        open={!!editInpatient}
        onClose={() => setEditInpatient(null)}
        onSuccess={() => { setEditInpatient(null); loadPatients() }}
        editInpatient={editInpatient}
      />

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the patient record and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
