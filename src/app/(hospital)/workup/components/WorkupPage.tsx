"use client"

import { useState, useEffect } from "react"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BreadcrumbHeader, FilterBar, DateNavigator, SearchInput, StatBadge } from "@/components/layout/header"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EyeReadingForm } from "./EyeReadingForm"
import { getWorkupQueue } from "../actions"
import { cn, formatDate, calculateAge, todayISO, toLocalDateISO } from "@/lib/utils"

type QueueItem = Awaited<ReturnType<typeof getWorkupQueue>>[0]

export function WorkupPage() {
  const [date, setDate] = useState(todayISO())
  const [search, setSearch] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<QueueItem | null>(null)

  async function loadQueue() {
    setLoading(true)
    const data = await getWorkupQueue(date)
    setQueue(data)
    setLoading(false)
  }

  useEffect(() => { loadQueue() }, [date])

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
        <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Refraction</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Pre-consultation assessment</p>
          </div>
          <div className="flex items-center gap-2">
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
        </FilterBar>
      )}

      {/* Inline detail view */}
      {selected ? (
        <div className="mt-5 space-y-5">

          {/* Identity card */}
          {/* <div className="bg-white rounded-2xl border border-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                  {getInitials(`${selected.firstName} ${selected.lastName ?? ""}`)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-semibold text-foreground leading-tight">
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{selected.patientId}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-5 text-sm text-muted-foreground">
                <span>{selected.age ?? calculateAge(selected.dateOfBirth) ?? "—"} yrs · {selected.gender?.charAt(0)}</span>
                {selected.phone && <span>{selected.phone}</span>}
                <span>{formatDate(selected.appointmentDate)}</span>
              </div>
              <PatientStatusBadge status={selected.status as PatientStatus} />
            </div>
          </div> */}

          {/* Eye reading form — full width */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <EyeReadingForm
              patientId={selected.patientId}
              existingReading={
                selected.eyeReadings?.[0]
                  ? JSON.stringify({
                      autoRefractometer: selected.eyeReadings[0].autoRefractometer
                        ? JSON.parse(selected.eyeReadings[0].autoRefractometer) : null,
                      glassesReading: selected.eyeReadings[0].glassesReading
                        ? JSON.parse(selected.eyeReadings[0].glassesReading) : null,
                      previousPrescription: selected.eyeReadings[0].previousPrescription
                        ? JSON.parse(selected.eyeReadings[0].previousPrescription) : null,
                      presentPrescription: selected.eyeReadings[0].presentPrescription
                        ? JSON.parse(selected.eyeReadings[0].presentPrescription) : null,
                      clinicalFindings: selected.eyeReadings[0].clinicalFindings
                        ? JSON.parse(selected.eyeReadings[0].clinicalFindings) : null,
                    })
                  : null
              }
              onSaved={async () => {
                const data = await getWorkupQueue(date)
                setQueue(data)
                setSelected(null)
              }}
            />
          </div>
        </div>
      ) : (
        /* Queue table */
        loading ? (
          <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
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
                  <TableHead className="text-right pr-3">Action</TableHead>
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
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 rounded-lg ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-white py-20 text-center shadow-sm">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/60 mb-4">
              <Eye className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No patients in workup queue</p>
            <p className="text-sm text-muted-foreground mt-1.5">Patients appear here after registration</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
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
                  <TableHead className="text-right pr-3">Action</TableHead>
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
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {age ? `${age}y` : "—"} / {genderShort}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground tabular-nums">
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
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(patient.appointmentDate)}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); setSelected(patient) }}
                        >
                          <Eye className="h-3.5 w-3.5" /> Open
                        </Button>
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
        )
      )}
    </>
  )
}
