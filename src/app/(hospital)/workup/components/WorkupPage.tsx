"use client"

import { useState, useEffect } from "react"
import { Eye, Search, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EyeReadingForm } from "./EyeReadingForm"
import { getWorkupQueue } from "../actions"
import { cn, formatDate, calculateAge, todayISO, toLocalDateISO } from "@/lib/utils"

type QueueItem = Awaited<ReturnType<typeof getWorkupQueue>>[0]

export function WorkupPage({ hospitalName }: { hospitalName: string }) {
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
      <div className="bg-white border-b border-border px-6 py-4 -mx-6 -mt-6 mb-0 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            {selected ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-[1.2rem] font-semibold">Workup</span>
                </button>
                <span className="text-muted-foreground text-[1.2rem]">/</span>
                <span className="text-[1.2rem] font-semibold text-foreground">
                  {selected.firstName} {selected.lastName ?? ""}
                </span>
                <span className="text-xs font-mono text-muted-foreground ml-1 mt-0.5">
                  · {selected.patientId}
                </span>
              </div>
            ) : (
              <>
                <h1 className="text-[1.2rem] font-semibold text-foreground tracking-tight leading-none">Workup</h1>
                <p className="text-xs text-muted-foreground mt-1">{hospitalName}</p>
              </>
            )}
          </div>

          {!selected && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 text-sm">
                <span className="font-bold text-foreground">{queue.length}</span>
                <span className="font-normal">Total</span>
              </Badge>
              <Badge variant="destructive" className="px-3 py-1.5 gap-1.5 text-sm">
                <span className="font-bold">{queue.filter(p => ["REGISTERED", "IN_WORKUP"].includes(p.status)).length}</span>
                <span className="font-normal">Optometrist</span>
              </Badge>
              <Badge variant="warning" className="px-3 py-1.5 gap-1.5 text-sm">
                <span className="font-bold">{queue.filter(p => ["WORKUP_DONE", "WITH_DOCTOR"].includes(p.status)).length}</span>
                <span className="font-normal">Doctor</span>
              </Badge>
              <Badge className="px-3 py-1.5 gap-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-100">
                <span className="font-bold">{queue.filter(p => ["COMPLETED", "MEDICAL_ONLY"].includes(p.status)).length}</span>
                <span className="font-normal">Completed</span>
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Date nav + Search — only shown in list view */}
      {!selected && (
        <div className="bg-gray-50 border-b border-border shadow-sm px-6 py-2 -mx-6 mb-5 sticky top-18 z-10">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 text-sm bg-white" />
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
        </div>
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
            <Eye className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">No patients in workup queue</p>
            <p className="text-sm text-muted-foreground mt-1">Patients appear here after registration</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden sm:table-cell">Age / Gender</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Appointment</TableHead>
                  <TableHead className="text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((patient, i) => {
                  const age = patient.age ?? calculateAge(patient.dateOfBirth)
                  const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
                  const hasReading = patient.eyeReadings?.[0]
                  const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"
                  return (
                    <TableRow
                      key={patient.id}
                      onClick={() => setSelected(patient)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-center text-xs text-muted-foreground font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{fullName}</p>
                            <p className="text-xs font-mono text-primary">{patient.patientId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {age ? `${age}y` : "—"} / {genderShort}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {patient.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold", {
                          "text-red-600": ["REGISTERED", "IN_WORKUP"].includes(patient.status),
                          "text-yellow-600": ["WORKUP_DONE", "WITH_DOCTOR"].includes(patient.status),
                          "text-green-600": patient.status === "COMPLETED",
                          "text-blue-600": patient.status === "MEDICAL_ONLY",
                        })}>
                          {["REGISTERED", "IN_WORKUP"].includes(patient.status) ? "Optometrist"
                            : ["WORKUP_DONE", "WITH_DOCTOR"].includes(patient.status) ? "Doctor"
                            : patient.status === "COMPLETED" ? "Completed"
                            : patient.status === "MEDICAL_ONLY" ? "Medical Only"
                            : patient.status}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(patient.appointmentDate)}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={e => { e.stopPropagation(); setSelected(patient) }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </>
  )
}
