"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import {
  Plus, MoreVertical, Pencil, Trash2, Loader2, RefreshCw, UserSearch, X,
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
import { todayISO, toLocalDateISO, cn } from "@/lib/utils"
import type { InPatient } from "@/lib/types"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

type SearchResult = Awaited<ReturnType<typeof searchExistingPatients>>[0]

type StatusFilter = "ALL" | "REGISTERED" | "WORKUP" | "DOCTOR" | "DONE"

const OPD_STATUS_FILTERS: { key: StatusFilter; label: string; statuses: string[] }[] = [
  { key: "ALL",        label: "All",         statuses: [] },
  { key: "REGISTERED", label: "Registered",  statuses: ["REGISTERED"] },
  { key: "WORKUP",     label: "In Workup",   statuses: ["IN_WORKUP"] },
  { key: "DOCTOR",     label: "With Doctor", statuses: ["WORKUP_DONE", "WITH_DOCTOR"] },
  { key: "DONE",       label: "Done",        statuses: ["VISITED", "COMPLETED", "MEDICAL_ONLY"] },
]

export function PatientsPage() {
  const [tab, setTab] = useState<"OPD" | "IPD">("OPD")
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [inpatients, setInpatients] = useState<InPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [selectedInpatient, setSelectedInpatient] = useState<InPatient | null>(null)
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState("")

  const [showFindPatient, setShowFindPatient] = useState(false)
  const [editPatient, setEditPatient] = useState<PatientRow | null>(null)
  const [editInpatient, setEditInpatient] = useState<InPatient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "OPD" | "IPD"; id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInDetailView = !!(selectedPatient || selectedInpatient)

  const loadPatients = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (tab === "IPD") {
      const result = await getInPatients({
        search: debouncedSearch.trim() || undefined,
        showDischarged: true,
      })
      setInpatients(result.data as InPatient[])
    } else {
      const data = await getPatients({ date: selectedDate, search: debouncedSearch || undefined, type: tab })
      setPatients(data)
    }
    setLoading(false)
  }, [selectedDate, tab, debouncedSearch])

  useEffect(() => { loadPatients() }, [loadPatients])
  useEffect(() => { getCurrentUserRole().then(r => setUserRole(r.role)) }, [])

  // Silent auto-refresh every 60s when not in a detail view
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isInDetailView) loadPatients(true)
    }, 60_000)
    return () => clearInterval(interval)
  }, [loadPatients, isInDetailView])

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

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

  // Stat counts — always from the full unfiltered day list
  const stats = {
    total: patients.length,
    registered: patients.filter(p => p.status === "REGISTERED").length,
    workup: patients.filter(p => p.status === "IN_WORKUP").length,
    doctor: patients.filter(p => ["WORKUP_DONE", "WITH_DOCTOR"].includes(p.status)).length,
    done: patients.filter(p => ["VISITED", "COMPLETED", "MEDICAL_ONLY"].includes(p.status)).length,
  }

  // Client-side status filter on the already-fetched day's data
  const filteredPatients = statusFilter === "ALL"
    ? patients
    : patients.filter(p =>
        OPD_STATUS_FILTERS.find(f => f.key === statusFilter)?.statuses.includes(p.status) ?? true
      )

  function countForFilter(key: StatusFilter) {
    if (key === "ALL") return patients.length
    return OPD_STATUS_FILTERS.find(f => f.key === key)?.statuses.reduce(
      (sum, s) => sum + patients.filter(p => p.status === s).length, 0
    ) ?? 0
  }

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

  const StatPill = ({
    count, label, filterKey, activeColor, inactiveColor,
  }: {
    count: number
    label: string
    filterKey: StatusFilter
    activeColor: string
    inactiveColor: string
  }) => {
    if (count === 0) return null
    const isActive = statusFilter === filterKey
    return (
      <button
        onClick={() => setStatusFilter(s => s === filterKey ? "ALL" : filterKey)}
        className={cn(
          "text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums transition-all",
          isActive ? activeColor : inactiveColor
        )}
      >
        {count} {label}
      </button>
    )
  }

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "OPD" | "IPD")
          setSelectedPatient(null)
          setSelectedInpatient(null)
          setStatusFilter("ALL")
          setSearch("")
          setDebouncedSearch("")
        }}
      >
        {/* ── Header ── */}
        {isInDetailView ? (
          <BreadcrumbHeader
            onBack={() => { setSelectedPatient(null); setSelectedInpatient(null) }}
            backLabel="Patients"
            currentLabel={
              selectedPatient
                ? `${selectedPatient.firstName} ${selectedPatient.lastName ?? ""}`.trim()
                : selectedInpatient?.name ?? ""
            }
          />
        ) : (
          <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-3.5 -mx-6 -mt-6 sticky top-0 z-20">
            {/* Left: title + live stat pills */}
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none shrink-0">Patients</h1>
              {tab === "OPD" && !loading && patients.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{stats.total} total</span>
                  <StatPill count={stats.registered} label="reg" filterKey="REGISTERED"
                    activeColor="bg-blue-500 text-white" inactiveColor="bg-blue-50 text-blue-600 hover:bg-blue-100" />
                  <StatPill count={stats.workup} label="workup" filterKey="WORKUP"
                    activeColor="bg-amber-500 text-white" inactiveColor="bg-amber-50 text-amber-600 hover:bg-amber-100" />
                  <StatPill count={stats.doctor} label="doctor" filterKey="DOCTOR"
                    activeColor="bg-violet-500 text-white" inactiveColor="bg-violet-50 text-violet-600 hover:bg-violet-100" />
                  <StatPill count={stats.done} label="done" filterKey="DONE"
                    activeColor="bg-green-500 text-white" inactiveColor="bg-green-50 text-green-600 hover:bg-green-100" />
                </div>
              )}
            </div>

            {/* Right: tabs + find patient + add patient */}
            <div className="flex items-center gap-2 shrink-0">
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
              <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5 h-9">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </div>
          </div>
        )}

        {/* ── Filter bar — list view only ── */}
        {!isInDetailView && (
          <FilterBar>
            <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
              {tab === "OPD" ? (
                <>
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
                    onChange={handleSearchChange}
                    placeholder="Search by ID, name, phone..."
                    className="w-52"
                  />
                  <div className="filter-divider" />
                  {OPD_STATUS_FILTERS.map(f => {
                    const count = countForFilter(f.key)
                    return (
                      <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={cn("filter-chip", statusFilter === f.key && "active")}
                      >
                        {f.label}
                        {f.key !== "ALL" && count > 0 && (
                          <span className={cn(
                            "ml-1 text-[10px] font-bold tabular-nums",
                            statusFilter === f.key ? "text-primary" : "text-muted-foreground/60"
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </>
              ) : (
                <SearchInput
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search inpatients..."
                  className="w-64"
                />
              )}
            </div>

            {/* Right side: find existing patient + refresh */}
            <div className="flex items-center gap-2 shrink-0">
              {showFindPatient ? (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <ExistingPatientSearch
                    onSelect={(patient: SearchResult) => {
                      setExistingPatientId(patient.patientId)
                      setShowFindPatient(false)
                    }}
                  />
                  <button
                    onClick={() => setShowFindPatient(false)}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowFindPatient(true)}
                  className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-border/60 bg-white hover:bg-muted/40 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <UserSearch className="h-3.5 w-3.5" />
                  Find Patient
                </button>
              )}
              <button
                onClick={() => loadPatients()}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
            </div>
          </FilterBar>
        )}

        {/* ── Detail views ── */}
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
                patients={filteredPatients}
                loading={loading}
                onRowClick={p => setSelectedPatient(p)}
                userRole={userRole}
                onEdit={p => setEditPatient(p)}
                onDelete={p => setDeleteTarget({
                  type: "OPD",
                  id: p.patientId,
                  name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
                })}
                emptyLabel={
                  statusFilter !== "ALL"
                    ? `No ${OPD_STATUS_FILTERS.find(f => f.key === statusFilter)?.label.toLowerCase()} patients today`
                    : undefined
                }
              />
            </TabsContent>

            <TabsContent value="IPD" className="mt-4">
              <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">IP No.</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Patient</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Doctor(s)</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Operation</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Admission</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Balance</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="hover:bg-transparent">
                          <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </TableCell>
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
                            {debouncedSearch ? "Try a different search term" : "Use Add Patient to admit a new inpatient"}
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
                          <TableRow
                            key={patient.id}
                            className="cursor-pointer group hover:bg-primary/[0.025] transition-colors"
                            onClick={() => setSelectedInpatient(patient)}
                          >
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
                            <TableCell className="text-sm text-muted-foreground">
                              {doctors || <span className="text-muted-foreground/30">—</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {patient.operationName || (
                                <span className="text-muted-foreground/30 italic text-xs">Not assigned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground tabular-nums">
                              {new Date(patient.admissionDate).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              <InPatientStatusBadge status={patient.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "font-semibold text-sm tabular-nums",
                                patient.balanceAmount > 0 ? "text-orange-600" : "text-green-600"
                              )}>
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

      {/* ── Modals ── */}
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

      <PatientRegistrationStepper
        open={!!editPatient}
        onClose={() => setEditPatient(null)}
        patientType="OPD"
        onSuccess={() => { setEditPatient(null); loadPatients() }}
        editPatient={editPatient}
      />

      <InPatientAdmissionForm
        open={!!editInpatient}
        onClose={() => setEditInpatient(null)}
        onSuccess={() => { setEditInpatient(null); loadPatients() }}
        editInpatient={editInpatient}
      />

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
