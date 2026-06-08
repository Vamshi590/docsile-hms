"use client"

import { useState, useEffect, useRef } from "react"
import { RefreshCw } from "lucide-react"
import { BreadcrumbHeader, FilterBar, DateNavigator, SearchInput, StatBadge } from "@/components/layout/header"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EyeReadingForm } from "./EyeReadingForm"
import { SightTypePicker } from "./SightTypePicker"
import { AskSithaAI } from "../../doctor/components/AskSithaAI"
import { getWorkupQueue } from "../actions"
import { cn, formatDate, calculateAge, todayISO, toLocalDateISO } from "@/lib/utils"

type QueueItem = Awaited<ReturnType<typeof getWorkupQueue>>[0]

export function WorkupPage({
  initialQueue,
  initialDate,
}: {
  initialQueue: QueueItem[]
  initialDate: string
}) {
  const [date, setDate] = useState(initialDate)
  const [search, setSearch] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<QueueItem | null>(null)
  const [sightType, setSightType] = useState<string>("")

  // Whenever a different patient is selected, seed sightType from their last
  // saved present prescription so the picker shows the existing selection.
  useEffect(() => {
    if (!selected) { setSightType(""); return }
    try {
      const raw = selected.eyeReadings?.[0]?.presentPrescription
      const parsed = raw ? JSON.parse(raw) : null
      setSightType((parsed?.sightType as string) ?? "")
    } catch {
      setSightType("")
    }
  }, [selected])

  async function loadQueue() {
    setLoading(true)
    const data = await getWorkupQueue(date)
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
      {/* Sticky page header */}
      {selected ? (
        <BreadcrumbHeader
          onBack={() => setSelected(null)}
          backLabel="Refraction"
          currentLabel={`${selected.firstName} ${selected.lastName ?? ""}`.trim()}
        />
      ) : (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 pl-12 md:pl-6 pr-3 md:pr-6 py-2.5 md:py-4 -mx-3 md:-mx-6 -mt-3 md:-mt-6 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-lg font-semibold text-foreground tracking-tight leading-tight md:leading-none truncate">Refraction</h1>
              <p className="hidden md:block text-[13px] text-muted-foreground mt-1.5 leading-none">Pre-consultation assessment</p>
            </div>
            <button
              onClick={loadQueue}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <StatBadge value={queue.length} label="Total" />
            <StatBadge value={queue.filter(p => ["REGISTERED", "IN_WORKUP"].includes(p.status)).length} label="Optometrist" variant="destructive" />
            <StatBadge value={queue.filter(p => ["WORKUP_DONE", "WITH_DOCTOR"].includes(p.status)).length} label="Doctor" variant="warning" />
            <StatBadge value={queue.filter(p => ["COMPLETED", "MEDICAL_ONLY"].includes(p.status)).length} label="Completed" variant="success" />
          </div>
        </div>
      )}

      {/* Date nav + Search — only shown in list view */}
      {!selected && (
        <FilterBar>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full md:w-auto">
            <DateNavigator
              date={date}
              onDateChange={setDate}
              onPrev={prevDay}
              onNext={nextDay}
              onToday={() => setDate(todayISO())}
              isToday={date === todayISO()}
            />
            <div className="filter-divider hidden md:block" />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, ID, phone..."
              className="w-full md:w-64"
            />
          </div>
        </FilterBar>
      )}

      {/* Inline detail view */}
      {selected ? (
        <div className="mt-5 flex gap-4">

          {/* Eye reading form */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border overflow-hidden">
            <EyeReadingForm
              patientId={selected.patientId}
              existingReading={
                selected.eyeReadings?.[0]
                  ? JSON.stringify({
                      autoRefractometer: selected.eyeReadings[0].autoRefractometer
                        ? JSON.parse(selected.eyeReadings[0].autoRefractometer) : null,
                      previousPrescription: selected.eyeReadings[0].previousPrescription
                        ? JSON.parse(selected.eyeReadings[0].previousPrescription) : null,
                      presentPrescription: selected.eyeReadings[0].presentPrescription
                        ? JSON.parse(selected.eyeReadings[0].presentPrescription) : null,
                      clinicalFindings: selected.eyeReadings[0].clinicalFindings
                        ? JSON.parse(selected.eyeReadings[0].clinicalFindings) : null,
                    })
                  : null
              }
              sightTypeValue={sightType}
              onSightTypeChange={setSightType}
              hideSightType
              onSaved={async () => {
                const data = await getWorkupQueue(date)
                setQueue(data)
                setSelected(null)
              }}
            />
          </div>

          {/* Right column: Sight Type + Ask Sitha AI — hidden on mobile/tablet */}
          <div className="hidden lg:flex w-80 shrink-0 sticky top-4 self-start flex-col space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5">
            <SightTypePicker value={sightType} onChange={setSightType} />
            <AskSithaAI patientId={selected.patientId} module="workup" />
          </div>
        </div>
      ) : (
        /* Queue table */
        loading ? (
          <>
          <div className="sm:hidden space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-5 w-16 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="hidden sm:block rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  <TableHead className="w-12 text-center">Token</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Age / Gender</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Appointment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell className="text-center"><Skeleton className="h-6 w-7 rounded mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-white py-14 px-6 text-center shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/no-refraction.svg"
              alt=""
              className="mx-auto mb-6 h-44 w-auto select-none"
              draggable={false}
            />
            <p className="text-base font-semibold text-foreground">Queue is clear</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              No patients are waiting for refraction right now. New patients show up here automatically after registration.
            </p>
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map((patient, i) => {
              const age = patient.age ?? calculateAge(patient.dateOfBirth)
              const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
              const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"
              const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                REGISTERED:   { label: "Optometrist",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
                IN_WORKUP:    { label: "Optometrist",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
                WORKUP_DONE:  { label: "Doctor",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
                WITH_DOCTOR:  { label: "Doctor",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
                COMPLETED:    { label: "Completed",    bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
                MEDICAL_ONLY: { label: "Medical Only", bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
              }
              const sc = statusConfig[patient.status] ?? { label: patient.status, bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" }
              return (
                <button
                  key={patient.id}
                  onClick={() => setSelected(patient)}
                  className="w-full text-left rounded-xl border border-border/60 bg-white p-3 shadow-sm active:bg-primary/[0.03] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-6 min-w-7 rounded bg-primary/10 border border-primary/20 border-dashed text-xs font-bold text-primary tabular-nums px-1.5 shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
                        {patient.patientId}
                      </span>
                    </div>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                      sc.bg, sc.text,
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                      {sc.label}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-foreground truncate">{fullName}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {age != null && (
                      <span className="tabular-nums">{age}y · {genderShort}</span>
                    )}
                    {patient.phone && <span className="tabular-nums">{patient.phone}</span>}
                    <span className="ml-auto whitespace-nowrap">{formatDate(patient.appointmentDate)}</span>
                  </div>
                </button>
              )
            })}
            <div className="px-1 pt-1 text-xs text-muted-foreground">
              {filtered.length} patient{filtered.length !== 1 ? "s" : ""} in queue
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  <TableHead className="w-12 text-center">Token</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Age / Gender</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Appointment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((patient, i) => {
                  const age = patient.age ?? calculateAge(patient.dateOfBirth)
                  const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
                  const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"
                  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                    REGISTERED:   { label: "Optometrist",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
                    IN_WORKUP:    { label: "Optometrist",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
                    WORKUP_DONE:  { label: "Doctor",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
                    WITH_DOCTOR:  { label: "Doctor",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
                    COMPLETED:    { label: "Completed",    bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
                    MEDICAL_ONLY: { label: "Medical Only", bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
                  }
                  const sc = statusConfig[patient.status] ?? { label: patient.status, bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" }
                  return (
                    <TableRow
                      key={patient.id}
                      onClick={() => setSelected(patient)}
                      className="cursor-pointer group hover:bg-primary/[0.02] transition-colors"
                    >
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center h-6 min-w-7 rounded bg-primary/10 border border-primary/20 border-dashed text-xs font-bold text-primary tabular-nums px-1.5">
                          {i + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {patient.patientId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm text-foreground">{fullName}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell whitespace-nowrap">
                        {age ? (
                          <span className="inline-flex items-baseline gap-1 text-sm text-foreground">
                            <span className="font-medium tabular-nums">{age}</span>
                            <span className="font-normal">y</span>
                            <span className="text-foreground/30 mx-0.5">·</span>
                            <span className="font-medium">{genderShort}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-foreground tabular-nums">
                        {patient.phone || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                          sc.bg, sc.text,
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-medium text-foreground whitespace-nowrap">
                        {formatDate(patient.appointmentDate)}
                      </TableCell>
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
          </>
        )
      )}
    </>
  )
}
