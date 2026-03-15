"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Plus, BarChart2, TrendingUp, IndianRupee, X,
  MoreVertical, Pencil, Trash2, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BreadcrumbHeader, FilterBar, DateNavigator, SearchInput } from "@/components/layout/header"
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

export function PatientsPage() {
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
        {(selectedPatient || selectedInpatient) ? (
          <BreadcrumbHeader
            onBack={() => { setSelectedPatient(null); setSelectedInpatient(null) }}
            backLabel="Patients"
            currentLabel={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName ?? ""}`.trim() : selectedInpatient?.name ?? ""}
            subtitle={`· ${selectedPatient ? selectedPatient.patientId : selectedInpatient?.ipNumber}`}
          />
        ) : (
          <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Patients</h1>
              <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Registration & management</p>
            </div>
            <div className="flex items-center gap-2.5">
              <TabsList className="bg-muted/50 border border-border/40">
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
              <button
                onClick={() => setShowStats(true)}
                className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-border/60 bg-white hover:bg-muted/40 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Stats
              </button>
              <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5 h-9">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </div>
          </div>
        )}

        {/* Date nav + Search — only shown in list view */}
        {!selectedPatient && !selectedInpatient && (
          <FilterBar>
            <div className="flex items-center gap-3">
              <DateNavigator
                date={selectedDate}
                onDateChange={setSelectedDate}
                onPrev={prevDay}
                onNext={nextDay}
                onToday={() => setSelectedDate(todayISO())}
                isToday={selectedDate === todayISO()}
              />
              <div className="filter-divider" />
              <SearchInput
                value={search}
                onChange={setSearch}
                onSubmit={loadPatients}
                placeholder="Search by ID, name, phone..."
                className="w-64"
              />
            </div>
            <ExistingPatientSearch
              onSelect={(patient: SearchResult) => setExistingPatientId(patient.patientId)}
            />
          </FilterBar>
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
              <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">IP Number</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Patient</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Doctor(s)</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Operation</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Admission</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Balance</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="hover:bg-transparent">
                          <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                          <TableCell><div className="space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-24" /></div></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-7 w-7 rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : inpatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                          <div className="text-3xl mb-3">🏥</div>
                          <div className="font-medium text-foreground">No inpatients found</div>
                          <div className="text-xs mt-1.5">
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
                          <TableRow key={patient.id} className="cursor-pointer group hover:bg-primary/[0.02] transition-colors" onClick={() => setSelectedInpatient(patient)}>
                            <TableCell>
                              <span className="font-mono text-xs bg-muted/60 px-2 py-0.5 rounded font-semibold text-foreground">
                                {patient.ipNumber}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-sm text-foreground">{patient.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {patient.age}y · {patient.gender.charAt(0)} · <span className="tabular-nums">{patient.phone}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {doctors || <span className="text-muted-foreground/50">—</span>}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {patient.operationName || (
                                  <span className="text-muted-foreground/50 italic text-xs">Not assigned</span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground tabular-nums">
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
                                className={`font-semibold text-sm tabular-nums ${
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
                                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
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
