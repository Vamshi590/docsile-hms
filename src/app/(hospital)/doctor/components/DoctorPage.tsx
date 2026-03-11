"use client"

import { useState, useEffect, useRef } from "react"
import { Stethoscope, Search, ChevronLeft, ChevronRight, ArrowLeft, Loader2, Printer, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { PatientStatusBadge } from "../../patients/components/PatientStatusBadge"
import { PrescriptionForm, type PrescriptionFormHandle } from "./PrescriptionForm"
import { PrintReceiptsModal } from "./PrintReceiptsModal"
import { EyeReadingForm, type EyeReadingFormHandle } from "../../workup/components/EyeReadingForm"
import { getDoctorQueue, getPatientForConsultation } from "../actions"
import { cn, formatDate, formatCurrency, calculateAge, todayISO, toLocalDateISO } from "@/lib/utils"
import type { PatientStatus } from "@/lib/types"

type QueueItem = Awaited<ReturnType<typeof getDoctorQueue>>[0]
type PatientDetail = Awaited<ReturnType<typeof getPatientForConsultation>>

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent " +
  "text-muted-foreground hover:text-foreground transition-colors " +
  "data-[state=active]:border-primary data-[state=active]:text-primary " +
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"

const QUEUE_COLUMNS = [
  { key: "sno", label: "#", alwaysOn: true },
  { key: "patient", label: "Patient", alwaysOn: true },
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

const DEFAULT_COLUMNS: ColumnKey[] = ["sno", "patient", "age", "phone", "srReading", "status", "print"]

export function DoctorPage({ hospitalName }: { hospitalName: string }) {
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
        if (saved) return JSON.parse(saved)
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
      <div className="bg-white border-b border-border px-6 py-4 -mx-6 -mt-6 mb-0 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            {selectedRow ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={closeDetail}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-[1.2rem] font-semibold">Doctor Console</span>
                </button>
                <span className="text-muted-foreground text-[1.2rem]">/</span>
                <span className="text-[1.2rem] font-semibold text-foreground">
                  {selectedRow.firstName} {selectedRow.lastName ?? ""}
                </span>
                <span className="text-xs font-mono text-muted-foreground ml-1 mt-0.5">
                  · {selectedRow.patientId}
                </span>
              </div>
            ) : (
              <>
                <h1 className="text-[1.2rem] font-semibold text-foreground tracking-tight leading-none">Doctor Console</h1>
                <p className="text-xs text-muted-foreground mt-1">{hospitalName}</p>
              </>
            )}
          </div>

          {!selectedRow && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 text-sm">
                <span className="font-bold text-foreground">{queue.length}</span>
                <span className="font-normal">Total</span>
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* ── Date nav + Search — hidden when patient open ── */}
      {!selectedRow && (
        <div className="bg-gray-50 border-b border-border flex justify-between items-center shadow-sm px-6 py-2 -mx-6 mb-5 sticky top-18 z-10">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-40 text-sm bg-white"
            />
            <Button variant="outline" size="icon-sm" onClick={nextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="relative flex-1 max-w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 text-sm bg-white"
              />
            </div>
          </div>
          {/* Column customizer */}
            <div className="flex justify-end px-4 py-2 border-b border-border bg-gray-50">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Columns
                  </Button>
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
            </div>

        </div>
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
                      {pastPrescriptions.map(rx => (
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
          <div className="rounded-xl border border-border bg-white divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-6 rounded" />
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-white py-20 text-center">
            <Stethoscope className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">No patients in queue</p>
            <p className="text-sm text-muted-foreground mt-1">
              Patients with Workup Done status appear here
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  {isColumnVisible("sno") && <TableHead className="w-10 text-center">#</TableHead>}
                  {isColumnVisible("patient") && <TableHead>Patient</TableHead>}
                  {isColumnVisible("age") && <TableHead>Age / Gender</TableHead>}
                  {isColumnVisible("phone") && <TableHead>Phone</TableHead>}
                  {isColumnVisible("referredBy") && <TableHead>Referred By</TableHead>}
                  {isColumnVisible("service") && <TableHead>Service</TableHead>}
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
                  return (
                    <TableRow
                      key={patient.id}
                      onClick={() => openPatient(patient)}
                      className="cursor-pointer"
                    >
                      {isColumnVisible("sno") && (
                        <TableCell className="text-center text-xs text-muted-foreground font-medium">{i + 1}</TableCell>
                      )}
                      {isColumnVisible("patient") && (
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{fullName}</p>
                            <p className="text-xs font-mono text-primary">{patient.patientId}</p>
                          </div>
                        </TableCell>
                      )}
                      {isColumnVisible("age") && (
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {age ? `${age}y` : "—"} / {genderShort}
                        </TableCell>
                      )}
                      {isColumnVisible("phone") && (
                        <TableCell className="text-sm text-muted-foreground">
                          {patient.phone || "—"}
                        </TableCell>
                      )}
                      {isColumnVisible("referredBy") && (
                        <TableCell className="text-sm text-muted-foreground">
                          {patient.referredBy || "—"}
                        </TableCell>
                      )}
                      {isColumnVisible("service") && (
                        <TableCell>
                          {serviceNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-48">
                              {serviceNames.map((name: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("srReading") && (
                        <TableCell>
                          {srSummary ? (
                            <div className="text-xs space-y-0.5">
                              <p><span className="font-semibold text-foreground w-5 inline-block">RE</span> {srSummary.re}</p>
                              <p><span className="font-semibold text-foreground w-5 inline-block">LE</span> {srSummary.le}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No reading</span>
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
                                <p className="text-xs font-semibold border-t border-border pt-0.5 tabular-nums">
                                  {formatCurrency(labTotal)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("status") && (
                        <TableCell>
                          <span className={cn("text-xs font-semibold", {
                            "text-red-600": ["REGISTERED", "IN_WORKUP"].includes(patient.status),
                            "text-yellow-600": ["WORKUP_DONE", "WITH_DOCTOR"].includes(patient.status),
                            "text-green-600": patient.status === "COMPLETED",
                            "text-blue-600": patient.status === "MEDICAL_ONLY",
                            "text-muted-foreground": patient.status === "VISITED",
                          })}>
                            {patient.status === "REGISTERED" || patient.status === "IN_WORKUP" ? "Optometrist"
                              : patient.status === "WORKUP_DONE" || patient.status === "WITH_DOCTOR" ? "Doctor"
                              : patient.status === "COMPLETED" ? "Completed"
                              : patient.status === "MEDICAL_ONLY" ? "Medical Only"
                              : patient.status}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("print") && (
                        <TableCell>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground"
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
