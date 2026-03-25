"use client"

import { useState, useEffect, useRef } from "react"
import { Stethoscope, Loader2, Printer, Settings2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BreadcrumbHeader, FilterBar, DateNavigator, SearchInput, StatBadge } from "@/components/layout/header"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { PrescriptionForm, type PrescriptionFormHandle } from "./PrescriptionForm"
import { PrintReceiptsModal } from "./PrintReceiptsModal"
import { EyeReadingForm, type EyeReadingFormHandle } from "../../workup/components/EyeReadingForm"
import { getDoctorQueue, getPatientForConsultation } from "../actions"
import { cn, formatDate, formatCurrency, calculateAge, todayISO, toLocalDateISO } from "@/lib/utils"

type QueueItem = Awaited<ReturnType<typeof getDoctorQueue>>[0]
type PatientDetail = Awaited<ReturnType<typeof getPatientForConsultation>>

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent " +
  "text-muted-foreground hover:text-foreground transition-colors " +
  "data-[state=active]:border-primary data-[state=active]:text-primary " +
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"

const QUEUE_COLUMNS = [
  { key: "sno", label: "#", alwaysOn: true },
  { key: "patientId", label: "Patient ID", alwaysOn: true },
  { key: "patient", label: "Name", alwaysOn: true },
  { key: "age", label: "Age / Gender" },
  { key: "phone", label: "Phone" },
  { key: "referredBy", label: "Referred By" },
  { key: "service", label: "Service" },
  { key: "srReading", label: "SR Reading" },
  { key: "labAmount", label: "Lab Amount" },
  { key: "status", label: "Status" },
  { key: "print", label: "Print", alwaysOn: true },
] as const

type ColumnKey = (typeof QUEUE_COLUMNS)[number]["key"]

const DEFAULT_COLUMNS: ColumnKey[] = ["sno", "patientId", "patient", "age", "phone", "srReading", "status", "print"]

export function DoctorPage() {
  const [date, setDate] = useState(todayISO())
  const [search, setSearch] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<QueueItem | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingAll, setSavingAll] = useState(false)

  const [printPatient, setPrintPatient] = useState<{ patientId: string; name: string } | null>(null)

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("doctor-queue-columns")
        if (saved) {
          const parsed = JSON.parse(saved) as ColumnKey[]
          // Ensure newly added always-on columns are present
          const alwaysOn = QUEUE_COLUMNS.filter(c => "alwaysOn" in c && c.alwaysOn).map(c => c.key)
          const merged = [...parsed]
          for (const key of alwaysOn) {
            if (!merged.includes(key)) merged.splice(merged.indexOf("patient") ?? 1, 0, key)
          }
          return merged
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_COLUMNS
  })

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      try { localStorage.setItem("doctor-queue-columns", JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function isColumnVisible(key: ColumnKey) {
    return visibleColumns.includes(key)
  }

  const eyeReadingRef = useRef<EyeReadingFormHandle>(null)
  const prescriptionRef = useRef<PrescriptionFormHandle>(null)

  async function loadQueue() {
    setLoading(true)
    const data = await getDoctorQueue(date)
    setQueue(data)
    setLoading(false)
  }

  useEffect(() => { loadQueue() }, [date])

  async function openPatient(row: QueueItem) {
    setSelectedRow(row)
    setSelectedPatient(null)
    setLoadingDetail(true)
    const p = await getPatientForConsultation(row.patientId)
    setSelectedPatient(p)
    setLoadingDetail(false)
  }

  function closeDetail() {
    setSelectedRow(null)
    setSelectedPatient(null)
  }

  async function handleSaveAll() {
    setSavingAll(true)
    try {
      const saves: Promise<void>[] = []
      if (eyeReadingRef.current) saves.push(eyeReadingRef.current.save())
      if (prescriptionRef.current) saves.push(prescriptionRef.current.save())
      await Promise.all(saves)
    } catch (err) {
      console.error("Save all error:", err)
    } finally {
      setSavingAll(false)
    }
  }

  function prevDay() {
    const d = new Date(date + "T00:00:00")
    d.setDate(d.getDate() - 1)
    setDate(toLocalDateISO(d))
  }

  function nextDay() {
    const d = new Date(date + "T00:00:00")
    d.setDate(d.getDate() + 1)
    setDate(toLocalDateISO(d))
  }

  const filtered = search
    ? queue.filter(p =>
        p.patientId.toLowerCase().includes(search.toLowerCase()) ||
        p.firstName.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search)
      )
    : queue

  function getSRSummary(reading: QueueItem["eyeReadings"][0] | undefined) {
    if (!reading) return null
    try {
      const sr = reading.presentPrescription ? JSON.parse(reading.presentPrescription) : null
      if (!sr) return null
      return {
        re: `${sr.re?.sph || "PL"} / ${sr.re?.cyl || "DS"} × ${sr.re?.axis || "0"}`,
        le: `${sr.le?.sph || "PL"} / ${sr.le?.cyl || "DS"} × ${sr.le?.axis || "0"}`,
      }
    } catch { return null }
  }

  return (
    <>
      {/* ── Sticky page header ── */}
      {selectedRow ? (
        <BreadcrumbHeader
          onBack={closeDetail}
          backLabel="Doctor Console"
          currentLabel={`${selectedRow.firstName} ${selectedRow.lastName ?? ""}`.trim()}
        />
      ) : (
        <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Doctor Console</h1>
              <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Patient queue & consultation</p>
            </div>
            <button
              onClick={loadQueue}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <StatBadge value={queue.length} label="in queue" variant="info" />
        </div>
      )}

      {/* ── Date nav + Search — hidden when patient open ── */}
      {!selectedRow && (
        <FilterBar>
          <div className="flex items-center gap-3">
            <DateNavigator
              date={date}
              onDateChange={setDate}
              onPrev={prevDay}
              onNext={nextDay}
              onToday={() => setDate(todayISO())}
              isToday={date === todayISO()}
            />
            <div className="filter-divider" />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, ID, phone..."
              className="w-64"
            />
          </div>
          {/* Column customizer */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <Settings2 className="h-3.5 w-3.5" /> Columns
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1.5">Toggle columns</p>
              {QUEUE_COLUMNS.map(col => {
                const locked = "alwaysOn" in col && col.alwaysOn
                return (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={isColumnVisible(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                      disabled={!!locked}
                    />
                    <span className={locked ? "text-muted-foreground" : ""}>{col.label}</span>
                  </label>
                )
              })}
            </PopoverContent>
          </Popover>
        </FilterBar>
      )}

      {/* ── Inline detail view ── */}
      {selectedRow ? (
        <div className="mt-5">
          {loadingDetail ? (
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading patient data…</p>
              </div>
            </div>
          ) : selectedPatient ? (
            (() => {
              // Server already split prescriptions — use directly
              const { todayPrescription, pastPrescriptions } = selectedPatient

              // Only pass medical data to the form if the doctor has already filled it today
              const existingForForm = todayPrescription && todayPrescription.status !== "BILLING_ONLY"
                ? todayPrescription
                : null

              // eyeReadings are already filtered to today by getPatientForConsultation
              const todayEyeReading = selectedPatient.eyeReadings?.[0] ?? null

              return (
            <div className="flex gap-4">
              {/* ── Left: Prescription Form Card ── */}
              <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border overflow-hidden">
                <Tabs defaultValue="workup">
                  {/* Tab header */}
                  <div className="px-6 pt-4 pb-0 border-b border-border flex justify-between items-center">
                    <TabsList className="bg-transparent h-auto p-0 rounded-none gap-1 -mb-px">
                      <TabsTrigger value="workup" className={TAB_CLASS}>Workup Data</TabsTrigger>
                      <TabsTrigger value="prescription" className={TAB_CLASS}>Prescription</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-muted-foreground">
                        {pastPrescriptions.length > 0
                          ? `Last visit: ${formatDate(pastPrescriptions[0].prescriptionDate)}`
                          : "First visit"}
                      </span>
                      <Button size="sm" onClick={handleSaveAll} disabled={savingAll}>
                        {savingAll && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                        Save All
                      </Button>
                    </div>
                  </div>

                  {/* ── Workup tab ── */}
                  <TabsContent value="workup" className="mt-0">
                    <EyeReadingForm
                      ref={eyeReadingRef}
                      patientId={selectedPatient.patientId}
                      compact
                      existingReading={
                        todayEyeReading
                          ? JSON.stringify({
                              autoRefractometer: todayEyeReading.autoRefractometer
                                ? JSON.parse(todayEyeReading.autoRefractometer) : null,
                              glassesReading: todayEyeReading.glassesReading
                                ? JSON.parse(todayEyeReading.glassesReading) : null,
                              previousPrescription: todayEyeReading.previousPrescription
                                ? JSON.parse(todayEyeReading.previousPrescription) : null,
                              presentPrescription: todayEyeReading.presentPrescription
                                ? JSON.parse(todayEyeReading.presentPrescription) : null,
                              clinicalFindings: todayEyeReading.clinicalFindings
                                ? JSON.parse(todayEyeReading.clinicalFindings) : null,
                            })
                          : null
                      }
                      onSaved={() => loadQueue()}
                    />
                  </TabsContent>

                  {/* ── Prescription tab ── */}
                  <TabsContent value="prescription" className="px-6 py-5 mt-0">
                    <PrescriptionForm
                      ref={prescriptionRef}
                      patientId={selectedPatient.patientId}
                      patientName={`${selectedPatient.firstName} ${selectedPatient.lastName ?? ""}`.trim()}
                      existingPrescription={existingForForm}
                      onSaved={() => { closeDetail(); loadQueue() }}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Right: History Card (fixed) ── */}
              <div className="w-80 shrink-0 sticky top-4 self-start bg-white rounded-2xl border border-border overflow-hidden max-h-[calc(100vh-12rem)]">
                <div className="px-4 pt-4 pb-2 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">History</h3>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-16rem)]">
                  {/* AR Reading from today's workup */}
                  {todayEyeReading?.autoRefractometer && (
                    <ARReadingSummary arJson={todayEyeReading.autoRefractometer} />
                  )}

                  {pastPrescriptions.length > 0 ? (
                    <div className="space-y-3">
                      {pastPrescriptions.map((rx: any) => (
                        <PrescriptionHistoryCard key={rx.id} prescription={rx} />
                      ))}
                    </div>
                  ) : (
                    !todayEyeReading?.autoRefractometer && (
                      <div className="text-center py-16 text-muted-foreground text-sm">
                        <p>No previous prescription history</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
              )
            })()
          ) : null}
        </div>
      ) : (
        /* ── Queue table ── */
        loading ? (
          <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  {isColumnVisible("sno") && <TableHead className="w-12 text-center">Token</TableHead>}
                  {isColumnVisible("patientId") && <TableHead>Patient ID</TableHead>}
                  {isColumnVisible("patient") && <TableHead>Name</TableHead>}
                  {isColumnVisible("age") && <TableHead>Age / Gender</TableHead>}
                  {isColumnVisible("phone") && <TableHead>Phone</TableHead>}
                  {isColumnVisible("status") && <TableHead>Status</TableHead>}
                  {isColumnVisible("print") && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {isColumnVisible("sno") && <TableCell className="text-center"><Skeleton className="h-6 w-7 rounded mx-auto" /></TableCell>}
                    {isColumnVisible("patientId") && <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>}
                    {isColumnVisible("patient") && <TableCell><Skeleton className="h-4 w-28" /></TableCell>}
                    {isColumnVisible("age") && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                    {isColumnVisible("phone") && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                    {isColumnVisible("status") && <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>}
                    {isColumnVisible("print") && <TableCell><Skeleton className="h-6 w-6 rounded" /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-white py-20 text-center shadow-sm">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/60 mb-4">
              <Stethoscope className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No patients in queue</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Patients with Workup Done status appear here
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  {isColumnVisible("sno") && <TableHead className="w-12 text-center">Token</TableHead>}
                  {isColumnVisible("patientId") && <TableHead>Patient ID</TableHead>}
                  {isColumnVisible("patient") && <TableHead>Name</TableHead>}
                  {isColumnVisible("age") && <TableHead>Age / Gender</TableHead>}
                  {isColumnVisible("phone") && <TableHead>Phone</TableHead>}
                  {isColumnVisible("referredBy") && <TableHead>Referred By</TableHead>}
                  {isColumnVisible("service") && <TableHead className="w-40">Service</TableHead>}
                  {isColumnVisible("srReading") && <TableHead>SR Reading</TableHead>}
                  {isColumnVisible("labAmount") && <TableHead className="text-right">Lab Amount</TableHead>}
                  {isColumnVisible("status") && <TableHead>Status</TableHead>}
                  {isColumnVisible("print") && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((patient, i) => {
                  const age = patient.age ?? calculateAge(patient.dateOfBirth)
                  const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
                  const hasReading = patient.eyeReadings?.[0]
                  const hasPrescription = patient.prescriptions?.[0]
                  const srSummary = getSRSummary(hasReading)
                  const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"
                  const serviceNames = hasPrescription?.items?.map((it: { description: string }) => it.description) ?? []
                  const labBills = patient.labBills ?? []
                  const labTotal = labBills.reduce((sum: number, lb: { total: number }) => sum + lb.total, 0)

                  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                    REGISTERED:   { label: "Optometrist",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
                    IN_WORKUP:    { label: "Optometrist",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
                    WORKUP_DONE:  { label: "Doctor",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
                    WITH_DOCTOR:  { label: "Doctor",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
                    VISITED:      { label: "Visited",      bg: "bg-slate-50",  text: "text-slate-600",  dot: "bg-slate-400" },
                    COMPLETED:    { label: "Completed",    bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
                    MEDICAL_ONLY: { label: "Medical Only", bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
                  }
                  const sc = statusConfig[patient.status] ?? { label: patient.status, bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" }

                  return (
                    <TableRow
                      key={patient.id}
                      onClick={() => openPatient(patient)}
                      className="cursor-pointer group hover:bg-primary/[0.02] transition-colors"
                    >
                      {isColumnVisible("sno") && (
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center h-6 min-w-7 rounded bg-primary/10 border border-primary/20 border-dashed text-xs font-bold text-primary tabular-nums px-1.5">
                            {i + 1}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("patientId") && (
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded">
                            {patient.patientId}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("patient") && (
                        <TableCell>
                          <span className="font-semibold text-sm text-foreground">{fullName}</span>
                        </TableCell>
                      )}
                      {isColumnVisible("age") && (
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {age ? `${age}y` : "—"} / {genderShort}
                        </TableCell>
                      )}
                      {isColumnVisible("phone") && (
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {patient.phone || <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                      )}
                      {isColumnVisible("referredBy") && (
                        <TableCell className="text-sm text-muted-foreground">
                          {patient.referredBy || <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                      )}
                      {isColumnVisible("service") && (
                        <TableCell>
                          {serviceNames.length > 0 ? (
                            <div className="flex items-center gap-1 max-w-40 overflow-hidden">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/60 truncate shrink-0">
                                {serviceNames[0]}
                              </span>
                              {serviceNames.length > 1 && (
                                <span className="text-[10px] font-semibold text-muted-foreground shrink-0" title={serviceNames.slice(1).join(", ")}>
                                  +{serviceNames.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("srReading") && (
                        <TableCell>
                          {srSummary ? (
                            <div className="text-xs font-mono space-y-0.5">
                              <p><span className="font-semibold text-violet-600 w-5 inline-block">RE</span> <span className="text-foreground tabular-nums">{srSummary.re}</span></p>
                              <p><span className="font-semibold text-violet-600 w-5 inline-block">LE</span> <span className="text-foreground tabular-nums">{srSummary.le}</span></p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">No reading</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("labAmount") && (
                        <TableCell className="text-right">
                          {labBills.length > 0 ? (
                            <div className="space-y-0.5">
                              {labBills.map((lb: { id: string; lab: { name: string }; total: number }) => (
                                <p key={lb.id} className="text-xs">
                                  <span className="text-muted-foreground">{lb.lab.name}: </span>
                                  <span className="font-medium tabular-nums">{formatCurrency(lb.total)}</span>
                                </p>
                              ))}
                              {labBills.length > 1 && (
                                <p className="text-xs font-semibold border-t border-border/40 pt-0.5 tabular-nums">
                                  {formatCurrency(labTotal)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("status") && (
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                            sc.bg, sc.text,
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                            {sc.label}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("print") && (
                        <TableCell>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity"
                            onClick={e => {
                              e.stopPropagation()
                              setPrintPatient({ patientId: patient.patientId, name: fullName })
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {filtered.length} patient{filtered.length !== 1 ? "s" : ""} in queue
              </span>
            </div>
          </div>
        )
      )}

      {/* Print Receipts Modal */}
      {printPatient && (
        <PrintReceiptsModal
          open={!!printPatient}
          onClose={() => setPrintPatient(null)}
          patientId={printPatient.patientId}
          patientName={printPatient.name}
        />
      )}
    </>
  )
}

// ─── Prescription History Card ─────────────────────────────────────────────────

function ARReadingCompact({ arJson, label }: { arJson: string; label?: string }) {
  try {
    const ar = JSON.parse(arJson) as {
      re?: { sph?: string; cyl?: string; axis?: string; va?: string }
      le?: { sph?: string; cyl?: string; axis?: string; va?: string }
      pd?: string
    }
    const hasRE = ar.re && (ar.re.sph || ar.re.cyl || ar.re.axis || ar.re.va)
    const hasLE = ar.le && (ar.le.sph || ar.le.cyl || ar.le.axis || ar.le.va)
    if (!hasRE && !hasLE) return null

    return (
      <div className="text-[11px] leading-relaxed">
        {label && <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-1">{label}</p>}
        <table className="w-full">
          <thead>
            <tr className="text-muted-foreground/70">
              <th className="text-left font-medium w-6"></th>
              <th className="text-center font-medium">SPH</th>
              <th className="text-center font-medium">CYL</th>
              <th className="text-center font-medium">Axis</th>
              <th className="text-center font-medium">VA</th>
            </tr>
          </thead>
          <tbody className="font-medium">
            {hasRE && (
              <tr>
                <td className="font-semibold text-violet-600">RE</td>
                <td className="text-center tabular-nums">{ar.re?.sph || "-"}</td>
                <td className="text-center tabular-nums">{ar.re?.cyl || "-"}</td>
                <td className="text-center tabular-nums">{ar.re?.axis || "-"}</td>
                <td className="text-center tabular-nums">{ar.re?.va || "-"}</td>
              </tr>
            )}
            {hasLE && (
              <tr>
                <td className="font-semibold text-violet-600">LE</td>
                <td className="text-center tabular-nums">{ar.le?.sph || "-"}</td>
                <td className="text-center tabular-nums">{ar.le?.cyl || "-"}</td>
                <td className="text-center tabular-nums">{ar.le?.axis || "-"}</td>
                <td className="text-center tabular-nums">{ar.le?.va || "-"}</td>
              </tr>
            )}
          </tbody>
        </table>
        {ar.pd && (
          <p className="text-[10px] text-muted-foreground mt-0.5">PD: <span className="font-medium text-foreground">{ar.pd}</span></p>
        )}
      </div>
    )
  } catch {
    return null
  }
}

function ARReadingSummary({ arJson }: { arJson: string }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2.5">
      <ARReadingCompact arJson={arJson} label="AR Reading (Workup)" />
    </div>
  )
}

function PrescriptionHistoryCard({ prescription }: {
  prescription: {
    prescriptionDate: Date
    doctorName: string | null
    diagnosis: string | null
    presentComplaint: string | null
    previousHistory: string | null
    medicines: string
    investigations: string
    prescriptionNumber?: string | null
    eyeReading?: {
      autoRefractometer: string | null
      presentPrescription: string | null
    } | null
  }
}) {
  let medicines: { name: string; days: string; timing: string }[] = []
  try { medicines = JSON.parse(prescription.medicines) } catch { /* empty */ }
  let investigations: { name: string; note?: string }[] = []
  try { investigations = JSON.parse(prescription.investigations) } catch { /* empty */ }
  const hasContent = prescription.presentComplaint || prescription.previousHistory || prescription.diagnosis || medicines.length > 0 || investigations.length > 0 || prescription.eyeReading?.autoRefractometer

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-foreground">{formatDate(prescription.prescriptionDate)}</span>
          {prescription.prescriptionNumber && (
            <span className="text-[10px] font-mono text-muted-foreground/70">{prescription.prescriptionNumber}</span>
          )}
        </div>
        {prescription.doctorName && (
          <span className="text-[10px] text-muted-foreground">Dr. {prescription.doctorName}</span>
        )}
      </div>

      {!hasContent ? (
        <div className="px-3 py-3">
          <p className="text-[11px] text-muted-foreground italic">No details recorded</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {/* AR Reading — compact inline table */}
          {prescription.eyeReading?.autoRefractometer && (
            <div className="px-3 py-2 bg-violet-50/30">
              <ARReadingCompact arJson={prescription.eyeReading.autoRefractometer} label="AR" />
            </div>
          )}

          {/* Clinical notes block */}
          {(prescription.presentComplaint || prescription.previousHistory || prescription.diagnosis) && (
            <div className="px-3 py-2 space-y-1">
              {prescription.presentComplaint && (
                <div className="flex gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0 w-6 pt-px">C/O</span>
                  <span className="text-[11px] text-foreground leading-snug">{prescription.presentComplaint}</span>
                </div>
              )}
              {prescription.previousHistory && (
                <div className="flex gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0 w-6 pt-px">Hx</span>
                  <span className="text-[11px] text-foreground leading-snug">{prescription.previousHistory}</span>
                </div>
              )}
              {prescription.diagnosis && (
                <div className="flex gap-1.5">
                  <span className="text-[10px] font-semibold text-amber-600 shrink-0 w-6 pt-px">Dx</span>
                  <span className="text-[11px] font-semibold text-foreground leading-snug">{prescription.diagnosis}</span>
                </div>
              )}
            </div>
          )}

          {/* Medicines */}
          {medicines.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rx</p>
              <div className="space-y-0.5">
                {medicines.slice(0, 5).map((m, i) => (
                  <p key={i} className="text-[11px] leading-snug">
                    <span className="text-foreground">{m.name}</span>
                    {(m.timing || m.days) && (
                      <span className="text-muted-foreground">
                        {m.timing && ` ${m.timing}`}
                        {m.days && ` · ${m.days}d`}
                      </span>
                    )}
                  </p>
                ))}
                {medicines.length > 5 && (
                  <p className="text-[10px] text-muted-foreground">+{medicines.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {/* Investigations */}
          {investigations.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Inv</p>
              <div className="flex flex-wrap gap-1">
                {investigations.map((inv, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    {inv.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
