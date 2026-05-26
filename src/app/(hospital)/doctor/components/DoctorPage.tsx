"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Loader2, Printer, Settings2, Settings, RefreshCw, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateUserPreferences } from "@/lib/user-preferences"
import { BreadcrumbHeader, FilterBar, DateNavigator, SearchInput, StatBadge } from "@/components/layout/header"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { PrescriptionForm, type PrescriptionFormHandle, type PrescriptionReferenceData } from "./PrescriptionForm"
import { PrintReceiptsModal } from "./PrintReceiptsModal"
import { AskSithaAI } from "./AskSithaAI"
import { EyeReadingForm, type EyeReadingFormHandle } from "../../workup/components/EyeReadingForm"
import { getDoctorQueue, getPatientForConsultation, getReceiptData } from "../actions"
import { cn, formatDate, formatCurrency, calculateAge, todayISO, toLocalDateISO } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { printReceiptsHtml } from "@/lib/print-receipts"
import { QuickPrintRenderer } from "./QuickPrintRenderer"
import type { DefaultPrintConfig } from "@/lib/default-print"

type QueueItem = Awaited<ReturnType<typeof getDoctorQueue>>[0]
type PatientDetail = Awaited<ReturnType<typeof getPatientForConsultation>>

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent " +
  "text-muted-foreground hover:text-foreground transition-colors " +
  "data-[state=active]:border-primary data-[state=active]:text-primary " +
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"

// All columns the queue table can render. Grouped for the column-customizer
// popover so the doctor can pick from a comprehensive list of patient + visit
// + receipt fields. Every field here is already in the queue row payload
// (no extra queries needed).
const QUEUE_COLUMNS = [
  // Patient
  { key: "sno",              label: "Token #",         group: "Patient", alwaysOn: true },
  { key: "patientId",        label: "Patient ID",      group: "Patient", alwaysOn: true },
  { key: "patient",          label: "Name",            group: "Patient", alwaysOn: true },
  { key: "age",              label: "Age / Gender",    group: "Patient" },
  { key: "dateOfBirth",      label: "DOB",             group: "Patient" },
  { key: "phone",            label: "Phone",           group: "Patient" },
  { key: "email",            label: "Email",           group: "Patient" },
  { key: "address",          label: "Address",         group: "Patient" },
  { key: "guardian",         label: "Guardian",        group: "Patient" },
  { key: "emergencyContact", label: "Emergency",       group: "Patient" },
  { key: "referredBy",       label: "Referred By",     group: "Patient" },
  { key: "patientType",      label: "Type",            group: "Patient" },
  { key: "registeredOn",     label: "Registered On",   group: "Patient" },
  { key: "appointmentDate",  label: "Appointment",     group: "Patient" },

  // Today's visit / clinical
  { key: "doctor",           label: "Doctor",          group: "Visit" },
  { key: "department",       label: "Department",      group: "Visit" },
  { key: "vitals",           label: "Vitals",          group: "Visit" },
  { key: "complaint",        label: "Complaint",       group: "Visit" },
  { key: "diagnosis",        label: "Diagnosis",       group: "Visit" },
  { key: "followUp",         label: "Follow-up",       group: "Visit" },
  { key: "prescriptionNo",   label: "Rx Number",       group: "Visit" },
  { key: "status",           label: "Status",          group: "Visit" },

  // Today's receipt / billing
  { key: "service",          label: "Services",        group: "Receipt" },
  { key: "subtotal",         label: "Subtotal",        group: "Receipt" },
  { key: "discount",         label: "Discount",        group: "Receipt" },
  { key: "total",            label: "Total",           group: "Receipt" },
  { key: "paid",             label: "Paid",            group: "Receipt" },
  { key: "balance",          label: "Balance",         group: "Receipt" },
  { key: "paymentMode",      label: "Payment Mode",    group: "Receipt" },
  { key: "paymentDate",      label: "Payment Date",    group: "Receipt" },
  { key: "labs",             label: "Labs",            group: "Receipt" },
  { key: "labAmount",        label: "Lab Amount",      group: "Receipt" },

  // Actions
  { key: "print",            label: "Print",           group: "Actions", alwaysOn: true },
] as const

type ColumnKey = (typeof QUEUE_COLUMNS)[number]["key"]
type ColumnGroup = (typeof QUEUE_COLUMNS)[number]["group"]

const COLUMN_BY_KEY = Object.fromEntries(QUEUE_COLUMNS.map(c => [c.key, c])) as Record<ColumnKey, typeof QUEUE_COLUMNS[number]>

const DEFAULT_COLUMNS: ColumnKey[] = [
  "sno", "patientId", "patient", "age", "phone", "doctor", "service", "total", "status", "print",
]

// Right-aligned numeric columns
const NUMERIC_COLS = new Set<ColumnKey>(["subtotal", "discount", "total", "paid", "balance", "labAmount"])

export function DoctorPage({
  initialQueue,
  initialDate,
  initialReferenceData,
  initialColumns,
  initialDefaultPrint,
  workupEnabled,
  vitalsExtended,
}: {
  initialQueue: QueueItem[]
  initialDate: string
  initialReferenceData: PrescriptionReferenceData
  /** User's saved column preference from DB. null when the user has never customized. */
  initialColumns: string[] | null
  initialDefaultPrint: DefaultPrintConfig
  /** When false, hide the Workup tab — general hospitals don't do refraction. */
  workupEnabled: boolean
  /** When true, show Height/Weight/BMI inputs in the prescription's vitals row. */
  vitalsExtended: boolean
}) {
  const [date, setDate] = useState(initialDate)
  const [search, setSearch] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue)
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<QueueItem | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null)
  // When true, the queue table renders with Ask Sitha AI as a sticky right
  // column instead of opening a slide-out sheet. Only relevant when no patient
  // is selected — once a patient is open the chat is already visible inline.
  const [chatOpen, setChatOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [referenceData, setReferenceData] = useState<PrescriptionReferenceData>(initialReferenceData)

  const [printPatient, setPrintPatient] = useState<{ patientId: string; name: string } | null>(null)

  const router = useRouter()
  const [defaultPrint] = useState<DefaultPrintConfig>(initialDefaultPrint)
  const [quickPrintData, setQuickPrintData] = useState<{
    data: Awaited<ReturnType<typeof getReceiptData>>
    patientName: string
  } | null>(null)
  const [quickPrinting, setQuickPrinting] = useState<string | null>(null)
  const quickPrintRef = useRef<HTMLDivElement>(null)

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    const validKeys = new Set(QUEUE_COLUMNS.map(c => c.key))
    // Start from saved prefs (filtered to known keys) or fall back to defaults.
    const base: ColumnKey[] = initialColumns
      ? (initialColumns.filter(k => validKeys.has(k as ColumnKey)) as ColumnKey[])
      : [...DEFAULT_COLUMNS]
    // Always-on columns must be present even if missing from saved prefs (e.g. user
    // saved before we added a locked column).
    const alwaysOn = QUEUE_COLUMNS.filter(c => "alwaysOn" in c && c.alwaysOn).map(c => c.key)
    const merged = [...base]
    for (const key of alwaysOn) {
      if (!merged.includes(key)) merged.push(key)
    }
    return merged
  })

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      // Fire-and-forget save to DB; optimistic UI is fine here. If the network
      // call fails the next page load just re-reads the previous value.
      updateUserPreferences({ doctorColumns: next }).catch(() => {
        toast.error("Could not save column preference")
      })
      return next
    })
  }

  function isColumnVisible(key: ColumnKey) {
    return visibleColumns.includes(key)
  }

  // Order columns for display: render in QUEUE_COLUMNS-defined order, not the
  // (mutable) order in `visibleColumns`. This keeps the table layout stable as
  // users toggle things on/off.
  const orderedVisibleColumns: ColumnKey[] = QUEUE_COLUMNS
    .map(c => c.key)
    .filter(k => visibleColumns.includes(k))

  const eyeReadingRef = useRef<EyeReadingFormHandle>(null)
  const prescriptionRef = useRef<PrescriptionFormHandle>(null)

  async function loadQueue() {
    setLoading(true)
    const data = await getDoctorQueue(date)
    setQueue(data)
    setLoading(false)
  }

  const skipFirstLoad = useRef(true)
  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false
      return
    }
    loadQueue()
  }, [date])

  async function openPatient(row: QueueItem) {
    setSelectedRow(row)
    setSelectedPatient(null)
    setLoadingDetail(true)
    const p = await getPatientForConsultation(row.patientId, date)
    setSelectedPatient(p)
    setLoadingDetail(false)
  }

  function closeDetail() {
    setSelectedRow(null)
    setSelectedPatient(null)
  }

  async function handleQuickPrint(patient: QueueItem) {
    if (defaultPrint.items.length === 0) return
    const patientName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
    setQuickPrinting(patient.patientId)
    try {
      const data = await getReceiptData(patient.patientId)
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
      setQuickPrinting(null)
    }
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
          <div className="flex items-center gap-2.5">
            <StatBadge value={queue.length} label="in queue" variant="info" />
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
          </div>
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
          {/* Column customizer + settings */}
          <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <Settings2 className="h-3.5 w-3.5" /> Columns
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <p className="text-xs font-semibold text-foreground">Configure columns</p>
                <button
                  onClick={() => {
                    setVisibleColumns(DEFAULT_COLUMNS)
                    updateUserPreferences({ doctorColumns: DEFAULT_COLUMNS }).catch(() => {
                      toast.error("Could not save column preference")
                    })
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Reset
                </button>
              </div>
              {(["Patient", "Visit", "Receipt", "Actions"] as ColumnGroup[]).map(group => (
                <div key={group} className="pt-2 first:pt-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                    {group}
                  </p>
                  {QUEUE_COLUMNS.filter(c => c.group === group).map(col => {
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
                </div>
              ))}
            </PopoverContent>
          </Popover>
          <button
            onClick={() => router.push("/settings?tab=print-defaults")}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Print settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          </div>
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

              // Smart default: if the optometrist has already filled any of the
              // workup readings, drop the doctor straight into the prescription.
              // Otherwise start them on the workup tab so they can fill what's missing.
              const workupStarted = !!(
                todayEyeReading?.autoRefractometer ||
                todayEyeReading?.glassesReading ||
                todayEyeReading?.previousPrescription
              )
              // General hospitals don't do refraction — always default to prescription.
              const defaultTab: "workup" | "prescription" = !workupEnabled
                ? "prescription"
                : workupStarted
                  ? "prescription"
                  : "workup"

              return (
            <div className="flex gap-4">
              {/* ── Left: Prescription Form Card ── */}
              <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border">
                <Tabs defaultValue={defaultTab}>
                  {/* Tab header */}
                  <div className="px-6 pt-4 pb-0 border-b border-border flex justify-between items-center">
                    <TabsList className="bg-transparent h-auto p-0 rounded-none gap-1 -mb-px">
                      {workupEnabled && (
                        <TabsTrigger value="workup" className={TAB_CLASS}>Workup Data</TabsTrigger>
                      )}
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

                  {/* ── Workup tab (eye-specialty only) ── */}
                  {workupEnabled && (
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
                  )}

                  {/* ── Prescription tab ── */}
                  <TabsContent value="prescription" className="px-6 py-5 mt-0">
                    <PrescriptionForm
                      ref={prescriptionRef}
                      patientId={selectedPatient.patientId}
                      patientName={`${selectedPatient.firstName} ${selectedPatient.lastName ?? ""}`.trim()}
                      existingPrescription={existingForForm}
                      referenceData={referenceData}
                      onReferenceDataChange={setReferenceData}
                      vitalsExtended={vitalsExtended}
                      onSaved={() => { closeDetail(); loadQueue() }}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Right: History + Ask Sitha AI ── */}
              <div className="w-80 shrink-0 sticky top-4 self-start space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5">
                {/* History card */}
                <div className="bg-white rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 pt-4 pb-2 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">History</h3>
                  </div>
                  <div className="p-4 space-y-4">
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
                        <div className="text-center py-12 text-muted-foreground text-sm">
                          <p>No previous prescription history</p>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Ask Sitha AI */}
                <AskSithaAI patientId={selectedPatient.patientId} module="doctor" />
              </div>
            </div>
              )
            })()
          ) : null}
        </div>
      ) : (
        /* ── Queue table (with optional Ask Sitha column) ── */
        <div className={cn(chatOpen && "flex gap-4 items-start")}>
        <div className={cn(chatOpen && "flex-1 min-w-0")}>
        {loading ? (
          <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  {orderedVisibleColumns.map(k => (
                    <TableHead
                      key={k}
                      className={cn(
                        k === "sno" && "w-12 text-center",
                        k === "print" && "w-10",
                        NUMERIC_COLS.has(k) && "text-right",
                      )}
                    >
                      {k === "print" ? "" : COLUMN_BY_KEY[k].label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {orderedVisibleColumns.map(k => (
                      <TableCell key={k} className={cn(k === "sno" && "text-center", NUMERIC_COLS.has(k) && "text-right")}>
                        <Skeleton className={cn(
                          "rounded",
                          k === "sno" && "h-6 w-7 mx-auto",
                          k === "print" && "h-6 w-6",
                          k !== "sno" && k !== "print" && "h-4 w-24",
                        )} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-white py-14 px-6 text-center shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/no-doctor-queue.svg"
              alt=""
              className="mx-auto mb-6 h-44 w-auto select-none"
              draggable={false}
            />
            <p className="text-base font-semibold text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              No patients are waiting for the doctor right now. They show up here automatically once refraction is complete.
            </p>
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
          <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  {orderedVisibleColumns.map(k => (
                    <TableHead
                      key={k}
                      className={cn(
                        "whitespace-nowrap",
                        k === "sno" && "w-12 text-center",
                        k === "print" && "w-10",
                        k === "service" && "w-44",
                        NUMERIC_COLS.has(k) && "text-right",
                      )}
                    >
                      {k === "print" ? "" : COLUMN_BY_KEY[k].label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((patient, i) => {
                  const age = patient.age ?? calculateAge(patient.dateOfBirth)
                  const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
                  const rx = patient.prescriptions?.[0]
                  const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"
                  const serviceNames = rx?.items?.map((it: { description: string }) => it.description) ?? []
                  const labBills = patient.labBills ?? []
                  const labTotal = labBills.reduce((sum: number, lb: { total: number }) => sum + lb.total, 0)
                  const guardian = [patient.guardianName, patient.guardianRelation && `(${patient.guardianRelation})`].filter(Boolean).join(" ")
                  const vitals = rx ? [
                    rx.temperature && `${rx.temperature}°F`,
                    rx.pulseRate && `${rx.pulseRate}bpm`,
                    rx.spo2 && `${rx.spo2}%`,
                  ].filter(Boolean).join(" · ") : ""

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

                  const dash = <span className="text-muted-foreground/50">—</span>
                  const text = (v: string | null | undefined, mono = false) =>
                    v ? <span className={cn("text-sm text-foreground", mono && "tabular-nums")}>{v}</span> : dash
                  const num = (v: number | null | undefined) =>
                    typeof v === "number" && v !== 0
                      ? <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(v)}</span>
                      : dash

                  function renderCell(k: ColumnKey) {
                    switch (k) {
                      case "sno":
                        return (
                          <span className="inline-flex items-center justify-center h-6 min-w-7 rounded bg-primary/10 border border-primary/20 border-dashed text-xs font-bold text-primary tabular-nums px-1.5">
                            {i + 1}
                          </span>
                        )
                      case "patientId":
                        return (
                          <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded">
                            {patient.patientId}
                          </span>
                        )
                      case "patient":
                        return <span className="font-semibold text-sm text-foreground whitespace-nowrap">{fullName}</span>
                      case "age":
                        return age ? (
                          <span className="inline-flex items-baseline gap-1 text-sm text-foreground whitespace-nowrap">
                            <span className="font-medium tabular-nums">{age}</span>
                            <span className="font-normal">y</span>
                            <span className="text-foreground/30 mx-0.5">·</span>
                            <span className="font-medium">{genderShort}</span>
                          </span>
                        ) : dash
                      case "dateOfBirth":
                        return patient.dateOfBirth ? text(formatDate(patient.dateOfBirth), true) : dash
                      case "phone":
                        return text(patient.phone, true)
                      case "email":
                        return text(patient.email)
                      case "address":
                        return patient.address ? <span className="text-xs text-foreground max-w-[220px] truncate inline-block align-middle" title={patient.address}>{patient.address}</span> : dash
                      case "guardian":
                        return text(guardian)
                      case "emergencyContact":
                        return text(patient.emergencyContact, true)
                      case "referredBy":
                        return text(patient.referredBy)
                      case "patientType":
                        return (
                          <span className={cn(
                            "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                            patient.patientType === "IP" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-sky-700",
                          )}>
                            {patient.patientType}
                          </span>
                        )
                      case "registeredOn":
                        return text(formatDate(patient.createdAt), true)
                      case "appointmentDate":
                        return patient.appointmentDate ? text(formatDate(patient.appointmentDate), true) : dash
                      case "doctor":
                        return text(rx?.doctorName ?? null)
                      case "department":
                        return text(rx?.department ?? null)
                      case "vitals":
                        return text(vitals || null, true)
                      case "complaint":
                        return rx?.presentComplaint
                          ? <span className="text-xs text-foreground max-w-[200px] truncate inline-block align-middle" title={rx.presentComplaint}>{rx.presentComplaint}</span>
                          : dash
                      case "diagnosis":
                        return rx?.diagnosis
                          ? <span className="text-xs font-medium text-foreground max-w-[200px] truncate inline-block align-middle" title={rx.diagnosis}>{rx.diagnosis}</span>
                          : dash
                      case "followUp":
                        return rx?.followUpDate ? text(formatDate(rx.followUpDate), true) : dash
                      case "prescriptionNo":
                        return rx?.prescriptionNumber
                          ? <span className="font-mono text-xs text-foreground">{rx.prescriptionNumber}</span>
                          : dash
                      case "service":
                        return serviceNames.length === 0 ? dash : (
                          <Tooltip delayDuration={150}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1 max-w-[200px] cursor-default">
                                <span className="inline-flex items-center h-6 px-2 rounded-md bg-muted/70 border border-border/40 text-[12px] font-medium text-foreground truncate">
                                  {serviceNames[0]}
                                </span>
                                {serviceNames.length > 1 && (
                                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md bg-muted/70 border border-border/40 text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                                    +{serviceNames.length - 1}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-xs px-3 py-2">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Services ({serviceNames.length})
                              </p>
                              <ul className="space-y-1 text-xs">
                                {serviceNames.map((name: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                                    <span className="text-foreground">{name}</span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )
                      case "subtotal":  return num(rx?.subtotal)
                      case "discount":  return num(rx?.discount)
                      case "total":     return num(rx?.total)
                      case "paid":      return num(rx?.amountPaid)
                      case "balance":
                        return typeof rx?.balanceDue === "number" && rx.balanceDue > 0
                          ? <span className="text-sm font-semibold tabular-nums text-red-700">{formatCurrency(rx.balanceDue)}</span>
                          : (typeof rx?.balanceDue === "number" ? <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(0)}</span> : dash)
                      case "paymentMode":
                        return text(rx?.paymentMode ?? null)
                      case "paymentDate":
                        return rx?.paymentDate ? text(formatDate(rx.paymentDate), true) : dash
                      case "labs":
                        return labBills.length === 0 ? dash : (
                          <span className="text-xs text-foreground">
                            {labBills.map((lb: { lab: { name: string } }) => lb.lab.name).join(", ")}
                          </span>
                        )
                      case "labAmount":
                        return labBills.length === 0 ? dash : labBills.length === 1 ? (
                          <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(labBills[0].total)}</span>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-medium tabular-nums text-foreground cursor-default underline decoration-dashed underline-offset-2 decoration-muted-foreground/40">
                                {formatCurrency(labTotal)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="end" className="px-3 py-2">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Lab breakdown
                              </p>
                              <ul className="space-y-1 text-xs">
                                {labBills.map((lb: { id: string; lab: { name: string }; total: number }) => (
                                  <li key={lb.id} className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">{lb.lab.name}</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(lb.total)}</span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )
                      case "status":
                        return (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
                            sc.bg, sc.text,
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                            {sc.label}
                          </span>
                        )
                      case "print":
                        return (
                          <div className="flex items-center gap-0.5">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={defaultPrint.items.length === 0 || quickPrinting === patient.patientId}
                              className={
                                defaultPrint.items.length === 0
                                  ? "text-muted-foreground/40"
                                  : "text-primary opacity-70 group-hover:opacity-100 transition-opacity"
                              }
                              title={
                                defaultPrint.items.length === 0
                                  ? "Configure defaults in Settings → Print Defaults"
                                  : "Quick print (default receipts)"
                              }
                              onClick={e => {
                                e.stopPropagation()
                                handleQuickPrint(patient)
                              }}
                            >
                              {quickPrinting === patient.patientId
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Zap className="h-4 w-4" />}
                            </Button>
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
                          </div>
                        )
                    }
                  }

                  return (
                    <TableRow
                      key={patient.id}
                      onClick={() => openPatient(patient)}
                      className="cursor-pointer group hover:bg-primary/[0.02] transition-colors"
                    >
                      {orderedVisibleColumns.map(k => (
                        <TableCell
                          key={k}
                          className={cn(
                            k === "sno" && "text-center",
                            NUMERIC_COLS.has(k) && "text-right",
                            (k === "phone" || k === "emergencyContact" || k === "dateOfBirth" || k === "registeredOn" || k === "appointmentDate" || k === "paymentDate" || k === "followUp") && "whitespace-nowrap",
                          )}
                        >
                          {renderCell(k)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {filtered.length} patient{filtered.length !== 1 ? "s" : ""} in queue
              </span>
            </div>
          </div>
          </TooltipProvider>
        )}
        </div>
        {chatOpen && (
          <div className="w-80 shrink-0 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5">
            <AskSithaAI patientId={null} module="doctor" />
          </div>
        )}
        </div>
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
