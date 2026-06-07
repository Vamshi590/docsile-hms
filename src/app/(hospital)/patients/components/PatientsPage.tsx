"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/usePermissions"
import {
  Plus, BarChart2, TrendingUp, IndianRupee, X,
  MoreVertical, Pencil, Trash2, Loader2, RefreshCw,
  Users, UserPlus, Clock, CheckCircle2, Settings, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BreadcrumbHeader, FilterBar, DateNavigator, SearchInput } from "@/components/layout/header"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PatientTable, PatientRow } from "./PatientTable"
import { AskSithaAI } from "../../doctor/components/AskSithaAI"
import { PatientRegistrationStepper } from "./PatientRegistrationStepper"
import InPatientAdmissionForm from "@/app/(hospital)/inpatients/components/InPatientAdmissionForm"
import { InPatientStatusBadge } from "@/app/(hospital)/inpatients/components/InPatientStatusBadge"
import { InPatientDetailPage } from "@/app/(hospital)/inpatients/components/InPatientDetailPage"
import { PatientDetail } from "./PatientDetail"
import { ExistingPatientSearch } from "./ExistingPatientSearch"
import { AddServicesModal } from "./AddServicesModal"
import { getPatients, searchExistingPatients, deletePatient, getPatientRegistrationFormData } from "../actions"
import { getReceiptData } from "../../doctor/actions"
import { QuickPrintRenderer } from "../../doctor/components/QuickPrintRenderer"
import { printReceiptsHtml } from "@/lib/print-receipts"
import type { DefaultPrintConfig } from "@/lib/default-print"

type AddFormData = Awaited<ReturnType<typeof getPatientRegistrationFormData>>
import { getInPatients, deleteInPatient, getInPatientAdmissionFormData } from "@/app/(hospital)/inpatients/actions"

type IpdAddFormData = Awaited<ReturnType<typeof getInPatientAdmissionFormData>>
import { cn, todayISO, formatDateLong, toLocalDateISO } from "@/lib/utils"
import type { InPatient } from "@/lib/types"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

type SearchResult = Awaited<ReturnType<typeof searchExistingPatients>>[0]

type PatientsPageProps = {
  initialPatients: PatientRow[]
  initialUserRole: string
  initialDate: string
  initialSearch: string
  initialDefaultPrint: DefaultPrintConfig
}

export function PatientsPage({
  initialPatients,
  initialUserRole,
  initialDate,
  initialSearch,
  initialDefaultPrint,
}: PatientsPageProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const [tab, setTab] = useState<"OPD" | "IPD">("OPD")
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [search, setSearch] = useState(initialSearch)
  const [patients, setPatients] = useState<PatientRow[]>(initialPatients)
  const [inpatients, setInpatients] = useState<InPatient[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addFormData, setAddFormData] = useState<AddFormData | null>(null)
  const [ipdAddLoading, setIpdAddLoading] = useState(false)
  const [ipdAddFormData, setIpdAddFormData] = useState<IpdAddFormData | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  // When true, the content area renders with Ask Sitha AI as a sticky right
  // column instead of opening a slide-out sheet.
  const [chatOpen, setChatOpen] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null)
  const userRole = initialUserRole

  // Edit/Delete state
  const [editPatient, setEditPatient] = useState<PatientRow | null>(null)
  const [editInpatient, setEditInpatient] = useState<InPatient | null>(null)
  const [selectedInpatient, setSelectedInpatient] = useState<InPatient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "OPD" | "IPD"; id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Quick-print state (defaults configured in Settings → Print Defaults)
  const [defaultPrint] = useState<DefaultPrintConfig>(initialDefaultPrint)
  const [quickPrintData, setQuickPrintData] = useState<{
    data: Awaited<ReturnType<typeof getReceiptData>>
    patientName: string
  } | null>(null)
  const [quickPrintingId, setQuickPrintingId] = useState<string | null>(null)
  const quickPrintRef = useRef<HTMLDivElement>(null)

  async function handleQuickPrint(p: PatientRow) {
    if (defaultPrint.items.length === 0) return
    const patientName = `${p.firstName} ${p.lastName ?? ""}`.trim()
    setQuickPrintingId(p.patientId)
    try {
      const data = await getReceiptData(p.patientId, { latest: true })
      setQuickPrintData({ data, patientName })
      setTimeout(() => {
        const html = quickPrintRef.current?.innerHTML ?? ""
        if (!html) {
          toast.error("Nothing to print")
          return
        }
        printReceiptsHtml({ title: `Print - ${patientName}`, contentHtml: html })
        setTimeout(() => setQuickPrintData(null), 1500)
      }, 50)
    } catch (err) {
      console.error("Quick print error:", err)
      toast.error("Failed to load receipt data")
    } finally {
      setQuickPrintingId(null)
    }
  }

  async function handleAddPatientClick() {
    if (tab === "OPD") {
      if (addLoading) return
      setAddLoading(true)
      try {
        const data = await getPatientRegistrationFormData()
        setAddFormData(data)
        setShowAdd(true)
      } finally {
        setAddLoading(false)
      }
      return
    }
    // IPD
    if (ipdAddLoading) return
    setIpdAddLoading(true)
    try {
      const data = await getInPatientAdmissionFormData()
      setIpdAddFormData(data)
      setShowAdd(true)
    } finally {
      setIpdAddLoading(false)
    }
  }

  async function loadPatients() {
    setLoading(true)
    if (tab === "IPD") {
      const result = await getInPatients({
        search: search.trim() || undefined,
        recentDischargesOnly: true,
      })
      setInpatients(result.data as InPatient[])
    } else {
      const data = await getPatients({ date: selectedDate, search: search || undefined, type: tab })
      setPatients(data)
    }
    setLoading(false)
  }

  // Initial OPD data + role come from the server (see page.tsx).
  // Skip the first effect run so we don't re-fetch what we already have.
  const skipFirstLoad = useRef(true)
  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false
      return
    }
    loadPatients()
  }, [selectedDate, tab])

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
    const rxs = (p.prescriptions ?? []) as { amountPaid?: number }[]
    return sum + rxs.reduce((s, rx) => s + (rx.amountPaid ?? 0), 0)
  }, 0)
  const totalBalance = patients.reduce((sum, p) => {
    const rxs = (p.prescriptions ?? []) as { balanceDue?: number }[]
    return sum + rxs.reduce((s, rx) => s + (rx.balanceDue ?? 0), 0)
  }, 0)
  const paymentBreakdown = (() => {
    const m = new Map<string, number>()
    for (const p of patients) {
      const rxs = (p.prescriptions ?? []) as { payments?: { amount: number; paymentMode: string | null }[] }[]
      for (const rx of rxs) {
        for (const pay of rx.payments ?? []) {
          if (!pay.amount) continue
          const mode = (pay.paymentMode ?? "Other").trim() || "Other"
          m.set(mode, (m.get(mode) ?? 0) + pay.amount)
        }
      }
    }
    return Array.from(m.entries())
      .filter(([, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1])
  })()

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
          >
            <button
              onClick={() => setChatOpen(o => !o)}
              title={chatOpen ? "Hide Sitha" : "Ask Sitha AI"}
              className={cn(
                "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
                chatOpen
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {chatOpen ? "Hide Sitha" : "Ask Sitha"}
            </button>
          </BreadcrumbHeader>
        ) : (
          <div className="grid grid-cols-3 items-center bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Patients</h1>
                <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Registration & management</p>
              </div>
              <button
                onClick={loadPatients}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="flex justify-center">
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
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowStats(true)}
                className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-border/60 bg-white hover:bg-muted/40 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Stats
              </button>
              <button
                onClick={() => setChatOpen(o => !o)}
                title={chatOpen ? "Hide Sitha" : "Ask Sitha AI"}
                className={cn(
                  "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
                  chatOpen
                    ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                    : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {chatOpen ? "Hide Sitha" : "Ask Sitha"}
              </button>
              {can(tab === "IPD" ? "inpatients:create" : "patients:create") && (
                <Button
                  onClick={handleAddPatientClick}
                  disabled={addLoading || ipdAddLoading}
                  size="sm"
                  className="gap-1.5 h-9"
                >
                  {(addLoading || ipdAddLoading) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Patient
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Date nav + Search — only shown in OPD list view */}
        {!selectedPatient && !selectedInpatient && tab === "OPD" && (
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
            <div className="flex items-center gap-2">
              <ExistingPatientSearch
                onSelect={(patient: SearchResult) => setExistingPatientId(patient.patientId)}
              />
              <button
                onClick={() => router.push("/settings")}
                title="Configurations"
                aria-label="Open configurations"
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/60 bg-white hover:bg-muted/40 hover:text-foreground transition-colors text-muted-foreground"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </FilterBar>
        )}

        {/* Patient detail view + optional Sitha column */}
        <div className={cn(chatOpen && "flex gap-4 items-start")}>
        <div className={cn(chatOpen && "flex-1 min-w-0")}>
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
                onEdit={can("patients:edit") ? (p => setEditPatient(p)) : undefined}
                onDelete={can("patients:delete") ? (p => setDeleteTarget({ type: "OPD", id: p.patientId, name: `${p.firstName} ${p.lastName ?? ""}`.trim() })) : undefined}
                onQuickPrint={handleQuickPrint}
                quickPrintingId={quickPrintingId}
                defaultPrintConfigured={defaultPrint.items.length > 0}
              />
            </TabsContent>
            <TabsContent value="IPD" className="mt-4">
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
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="text-center py-12 px-6">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/illustrations/no-inpatients.svg"
                            alt=""
                            className="mx-auto mb-6 h-44 w-auto select-none"
                            draggable={false}
                          />
                          <div className="font-semibold text-base text-foreground">No in-patients admitted</div>
                          <div className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                            {search
                              ? "Try a different search term, or clear the search to see all admissions."
                              : <>Use <span className="font-medium text-foreground">Add Patient</span> to admit a new in-patient.</>}
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
                              <span className="text-sm font-medium text-foreground">
                                {doctors || <span className="font-normal text-muted-foreground/50">—</span>}
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
                              <span className="text-sm font-medium text-foreground tabular-nums">
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
                                  {can("inpatients:edit") && (
                                    <DropdownMenuItem onClick={() => setEditInpatient(patient)}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                    </DropdownMenuItem>
                                  )}
                                  {can("inpatients:delete") && (
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
        </div>
        {chatOpen && (
          <div className="w-80 shrink-0 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5 mt-5">
            <AskSithaAI
              patientId={selectedPatient?.patientId ?? selectedInpatient?.patientId ?? null}
              module={selectedInpatient ? "inpatients" : "patients"}
            />
          </div>
        )}
        </div>
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
                <h2 className="text-lg font-semibold text-foreground tracking-tight">Today&apos;s Stats</h2>
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
                {
                  label: "Total Patients", value: patients.length, Icon: Users,
                  tile: "bg-muted/40 border-border/60",
                  chip: "bg-foreground/5 text-foreground",
                  value_cls: "text-foreground",
                },
                {
                  label: "Registered", value: registered, Icon: UserPlus,
                  tile: "bg-primary/5 border-primary/15",
                  chip: "bg-primary/10 text-primary",
                  value_cls: "text-primary",
                },
                {
                  label: "In Progress", value: inProgress, Icon: Clock,
                  tile: "bg-warning/5 border-warning/15",
                  chip: "bg-warning/10 text-warning",
                  value_cls: "text-warning",
                },
                {
                  label: "Visited", value: visited, Icon: CheckCircle2,
                  tile: "bg-success/5 border-success/15",
                  chip: "bg-success/10 text-success",
                  value_cls: "text-success",
                },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.tile}`}>
                  <div className={`inline-flex items-center justify-center h-7 w-7 rounded-lg mb-2.5 ${s.chip}`}>
                    <s.Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1 leading-none">{s.label}</p>
                  <p className={`text-2xl font-semibold tabular-nums tracking-tight ${s.value_cls}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/60">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Revenue</p>
              <div className="space-y-2">
                <div className="rounded-xl border border-success/15 bg-success/5 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-success/10 text-success">
                        <IndianRupee className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Collected Today</span>
                    </div>
                    <span className="text-base font-semibold tabular-nums text-success">
                      &#8377;{totalRevenue.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {paymentBreakdown.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pl-[42px]">
                      {paymentBreakdown.map(([mode, amount]) => (
                        <span
                          key={mode}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white border border-success/20 px-2.5 py-1 text-xs"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          <span className="font-medium text-foreground">{mode}</span>
                          <span className="font-semibold tabular-nums text-success">
                            &#8377;{amount.toLocaleString("en-IN")}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-warning/15 bg-warning/5 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-warning/10 text-warning">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Balance Due</span>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-warning">
                    &#8377;{totalBalance.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "OPD" ? (
        <PatientRegistrationStepper
          open={showAdd}
          onClose={() => { setShowAdd(false); setAddFormData(null) }}
          patientType="OPD"
          onSuccess={loadPatients}
          initialData={addFormData}
        />
      ) : (
        <InPatientAdmissionForm
          open={showAdd}
          onClose={() => { setShowAdd(false); setIpdAddFormData(null) }}
          onSuccess={() => { setShowAdd(false); setIpdAddFormData(null); loadPatients() }}
          initialData={ipdAddFormData}
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

      {/* Hidden renderer for quick-print */}
      {quickPrintData && (
        <QuickPrintRenderer
          ref={quickPrintRef}
          data={quickPrintData.data}
          items={defaultPrint.items}
        />
      )}
    </>
  )
}
