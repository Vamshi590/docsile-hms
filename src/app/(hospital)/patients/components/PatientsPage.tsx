"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "sonner"
import {
  Plus, MoreVertical, Pencil, Trash2, Loader2,
  RefreshCw, UserSearch, X, SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BreadcrumbHeader, DateNavigator, SearchInput } from "@/components/layout/header"
import { Popover, PopoverContent, PopoverTrigger, PopoverArrow } from "@/components/ui/popover"
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
import { todayISO, toLocalDateISO, cn, calculateAge } from "@/lib/utils"
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
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE" | "OTHER">("ALL")
  const [doctorFilter, setDoctorFilter] = useState("ALL")
  const [ageRange, setAgeRange] = useState<[number, number]>([0, 100])
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [inpatients, setInpatients] = useState<InPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showFindPatient, setShowFindPatient] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [selectedInpatient, setSelectedInpatient] = useState<InPatient | null>(null)
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState("")

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isInDetailView) loadPatients(true)
    }, 60_000)
    return () => clearInterval(interval)
  }, [loadPatients, isInDetailView])

  function handleTabChange(next: "OPD" | "IPD") {
    setTab(next)
    setSelectedPatient(null)
    setSelectedInpatient(null)
    setStatusFilter("ALL")
    setGenderFilter("ALL")
    setDoctorFilter("ALL")
    setAgeRange([0, 100])
    setSearch("")
    setDebouncedSearch("")
  }

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

  const stats = {
    total: patients.length,
    registered: patients.filter(p => p.status === "REGISTERED").length,
    workup: patients.filter(p => p.status === "IN_WORKUP").length,
    doctor: patients.filter(p => ["WORKUP_DONE", "WITH_DOCTOR"].includes(p.status)).length,
    done: patients.filter(p => ["VISITED", "COMPLETED", "MEDICAL_ONLY"].includes(p.status)).length,
  }

  const doctorOptions = useMemo(
    () => Array.from(new Set(patients.map(p => p.doctorName).filter(Boolean) as string[])).sort(),
    [patients]
  )

  const filteredPatients = useMemo(() => patients.filter(p => {
    if (statusFilter !== "ALL" && !(OPD_STATUS_FILTERS.find(f => f.key === statusFilter)?.statuses.includes(p.status) ?? false)) return false
    if (genderFilter !== "ALL" && p.gender !== genderFilter) return false
    if (doctorFilter !== "ALL" && p.doctorName !== doctorFilter) return false
    const age = p.age ?? calculateAge(p.dateOfBirth) ?? null
    if (age !== null && (age < ageRange[0] || age > ageRange[1])) return false
    return true
  }), [patients, statusFilter, genderFilter, doctorFilter, ageRange])

  function countForFilter(key: StatusFilter) {
    if (key === "ALL") return patients.length
    return OPD_STATUS_FILTERS.find(f => f.key === key)?.statuses.reduce(
      (sum, s) => sum + patients.filter(p => p.status === s).length, 0
    ) ?? 0
  }

  const activeFilterCount = [
    statusFilter !== "ALL",
    genderFilter !== "ALL",
    doctorFilter !== "ALL",
    ageRange[0] !== 0 || ageRange[1] !== 100,
  ].filter(Boolean).length

  function clearAllFilters() {
    setStatusFilter("ALL")
    setGenderFilter("ALL")
    setDoctorFilter("ALL")
    setAgeRange([0, 100])
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
      <Tabs value={tab} onValueChange={v => handleTabChange(v as "OPD" | "IPD")}>
        {/* ─── Global Header ─────────────────────────────────────────────── */}
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
          <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 rounded-b-2xl px-6 py-3.5 -mx-6 -mt-6 mb-5 sticky top-0 z-20">
            {/* Left: title + live stat pills (global summary) */}
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none shrink-0">Patients</h1>
              {tab === "OPD" && !loading && patients.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{stats.total} total</span>
                  {stats.registered > 0 && (
                    <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold tabular-nums">
                      {stats.registered} reg
                    </span>
                  )}
                  {stats.workup > 0 && (
                    <span className="text-[11px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold tabular-nums">
                      {stats.workup} workup
                    </span>
                  )}
                  {stats.doctor > 0 && (
                    <span className="text-[11px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold tabular-nums">
                      {stats.doctor} doctor
                    </span>
                  )}
                  {stats.done > 0 && (
                    <span className="text-[11px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-semibold tabular-nums">
                      {stats.done} done
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: tab switcher + primary action */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Pill toggle */}
              <div className="relative inline-flex items-center bg-slate-100 border border-slate-200/80 rounded-full p-1 shadow-inner">
                {/* Sliding indicator — only `left` transitions, no squish */}
                <div
                  aria-hidden
                  className="absolute top-1 bottom-1 rounded-full bg-primary shadow-md transition-[left] duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  style={{
                    left: tab === "OPD" ? "4px" : "calc(50%)",
                    width: "calc(50% - 4px)",
                  }}
                />
                {(["OPD", "IPD"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => handleTabChange(t)}
                    className="relative z-10 w-[108px] text-center py-1.5 rounded-full text-sm font-medium select-none focus-visible:outline-none"
                  >
                    <span className={cn(
                      "transition-colors duration-200",
                      tab === t ? "text-white" : "text-slate-500 hover:text-slate-700"
                    )}>
                      {t === "OPD" ? "Out-Patients" : "In-Patients"}
                    </span>
                  </button>
                ))}
              </div>
              <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5 h-9">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </div>
          </div>
        )}

        {/* ─── Detail views ──────────────────────────────────────────────── */}
        {selectedInpatient ? (
          <div>
            <InPatientDetailPage
              inpatient={selectedInpatient}
              onBack={() => setSelectedInpatient(null)}
              onUpdate={async () => { await loadPatients(); setSelectedInpatient(null) }}
              variant="info"
            />
          </div>
        ) : selectedPatient ? (
          <div>
            <PatientDetail
              patientId={selectedPatient.patientId}
              onBack={() => setSelectedPatient(null)}
              onUpdate={loadPatients}
            />
          </div>
        ) : (
          <>
            {/* Blur overlay for filter popover */}
            {filterOpen && (
              <div className="fixed inset-0 z-10 backdrop-blur-[2px] bg-background/20 pointer-events-none" />
            )}

            {/* ─── OPD ─────────────────────────────────────────────────── */}
            <TabsContent value="OPD" className="mt-0">
              {/* Table controls — right above the table */}
              <div className="flex items-center justify-between gap-3 mb-3">
                {/* Left: date + search + filter */}
                <div className="flex items-center gap-2">
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
                    placeholder="Search by name, ID, phone..."
                    className="w-52"
                  />

                  {/* Filter panel */}
                  <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "h-8 px-3 flex items-center gap-1.5 rounded-full border text-sm font-medium transition-all",
                        activeFilterCount > 0
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border/60 bg-white text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}>
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filters
                        {activeFilterCount > 0 && (
                          <span className="h-4 min-w-4 px-0.5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                            {activeFilterCount}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-96 p-0 rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
                    >
                      <PopoverArrow className="fill-slate-300" width={16} height={8} />
                      <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">Filters</p>
                        {activeFilterCount > 0 && (
                          <button
                            onClick={clearAllFilters}
                            className="text-[11px] text-primary hover:text-primary/70 font-medium transition-colors"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="p-4 space-y-5">

                        {/* Status */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</p>
                          <div className="flex flex-wrap gap-1.5">
                            {OPD_STATUS_FILTERS.map(f => {
                              const count = countForFilter(f.key)
                              const isActive = statusFilter === f.key
                              return (
                                <button
                                  key={f.key}
                                  onClick={() => setStatusFilter(f.key)}
                                  className={cn(
                                    "h-7 px-2.5 rounded-full text-xs font-medium transition-all border",
                                    isActive
                                      ? "bg-primary text-white border-primary shadow-sm"
                                      : "bg-white text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                                  )}
                                >
                                  {f.label}
                                  {f.key !== "ALL" && count > 0 && (
                                    <span className={cn("ml-1.5 tabular-nums", isActive ? "text-white/70" : "text-muted-foreground/60")}>
                                      {count}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Gender */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Gender</p>
                          <div className="flex gap-1.5">
                            {(["ALL", "MALE", "FEMALE", "OTHER"] as const).map(g => (
                              <button
                                key={g}
                                onClick={() => setGenderFilter(g)}
                                className={cn(
                                  "h-7 px-2.5 rounded-full text-xs font-medium transition-all border flex-1",
                                  genderFilter === g
                                    ? "bg-primary text-white border-primary shadow-sm"
                                    : "bg-white text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                                )}
                              >
                                {g === "ALL" ? "All" : g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Age range */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Age Range</p>
                            <span className="text-[11px] font-semibold text-foreground tabular-nums">
                              {ageRange[0]}–{ageRange[1]}y
                            </span>
                          </div>
                          <div className="relative h-5 flex items-center">
                            <div className="absolute left-0 right-0 h-1.5 bg-muted rounded-full" />
                            <div
                              className="absolute h-1.5 bg-primary rounded-full"
                              style={{
                                left: `${ageRange[0]}%`,
                                right: `${100 - ageRange[1]}%`,
                              }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={ageRange[0]}
                              onChange={e => {
                                const v = Number(e.target.value)
                                if (v <= ageRange[1]) setAgeRange([v, ageRange[1]])
                              }}
                              className="absolute w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={ageRange[1]}
                              onChange={e => {
                                const v = Number(e.target.value)
                                if (v >= ageRange[0]) setAgeRange([ageRange[0], v])
                              }}
                              className="absolute w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground/60">0</span>
                            <span className="text-[10px] text-muted-foreground/60">100</span>
                          </div>
                        </div>

                        {/* Doctor */}
                        {doctorOptions.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Doctor</p>
                            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                              <button
                                onClick={() => setDoctorFilter("ALL")}
                                className={cn(
                                  "text-left h-7 px-2.5 rounded-full text-xs font-medium transition-all border",
                                  doctorFilter === "ALL"
                                    ? "bg-primary text-white border-primary shadow-sm"
                                    : "bg-white text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                                )}
                              >
                                All doctors
                              </button>
                              {doctorOptions.map(d => (
                                <button
                                  key={d}
                                  onClick={() => setDoctorFilter(d)}
                                  className={cn(
                                    "text-left h-7 px-2.5 rounded-full text-xs font-medium transition-all border truncate",
                                    doctorFilter === d
                                      ? "bg-primary text-white border-primary shadow-sm"
                                      : "bg-white text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                                  )}
                                  title={d}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right: find existing patient + refresh */}
                <div className="flex items-center gap-2">
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
                        className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFindPatient(true)}
                      className="h-8 px-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-white hover:bg-muted/40 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <UserSearch className="h-3.5 w-3.5" />
                      Find Patient
                    </button>
                  )}
                  <button
                    onClick={() => loadPatients()}
                    className="h-8 w-8 flex items-center justify-center rounded-full border border-border/60 bg-white hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  </button>
                </div>
              </div>

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
                  activeFilterCount > 0
                    ? "No patients match the selected filters"
                    : undefined
                }
              />
            </TabsContent>

            {/* ─── IPD ─────────────────────────────────────────────────── */}
            <TabsContent value="IPD" className="mt-0">
              {/* Table controls */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <SearchInput
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search by name, IP number, phone..."
                  className="w-64"
                />
                <button
                  onClick={() => loadPatients()}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 bg-white hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                </button>
              </div>

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
                              <span
                                className={`font-semibold text-sm tabular-nums ${patient.balanceAmount > 0
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

      {/* ─── Modals ─────────────────────────────────────────────────────── */}
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
