"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, MoreVertical, Pencil, Trash2, Zap, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, calculateAge } from "@/lib/utils"
import { PatientStatusBadge } from "./PatientStatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

export type PatientRow = {
  id: string
  patientId: string
  firstName: string
  lastName: string | null
  age: number | null
  dateOfBirth: Date | string | null
  gender: string
  phone: string
  status: string
  appointmentDate: Date | string
  createdAt: Date | string
  doctorName: string | null
  department: string | null
  guardianName?: string | null
  address?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prescriptions?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eyeReadings?: any[]
  [key: string]: unknown
}

interface PatientTableProps {
  patients: PatientRow[]
  onRowClick: (patient: PatientRow) => void
  loading?: boolean
  userRole?: string
  onEdit?: (patient: PatientRow) => void
  onDelete?: (patient: PatientRow) => void
  /** Trigger quick-print for completed patients. */
  onQuickPrint?: (patient: PatientRow) => void
  /** Patient ID currently being printed (shows a spinner on that row's button). */
  quickPrintingId?: string | null
  /** Whether the hospital has at least one default print item configured. */
  defaultPrintConfigured?: boolean
}

type SortKey = "patientId" | "name" | "status" | "appointmentDate" | "createdAt"

export function PatientTable({
  patients, onRowClick, loading, userRole, onEdit, onDelete,
  onQuickPrint, quickPrintingId, defaultPrintConfigured,
}: PatientTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Stable token numbers based on registration time — unaffected by column sort
  const tokenMap = new Map(
    [...patients]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((p, i) => [p.id, i + 1])
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = [...patients].sort((a, b) => {
    let av: string | number = "", bv: string | number = ""
    if (sortKey === "patientId") { av = a.patientId; bv = b.patientId }
    else if (sortKey === "name") { av = a.firstName + (a.lastName ?? ""); bv = b.firstName + (b.lastName ?? "") }
    else if (sortKey === "status") { av = a.status; bv = b.status }
    else if (sortKey === "appointmentDate") {
      av = new Date(a.appointmentDate).getTime()
      bv = new Date(b.appointmentDate).getTime()
    }
    else if (sortKey === "createdAt") {
      av = new Date(a.createdAt).getTime()
      bv = new Date(b.createdAt).getTime()
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1
    if (av > bv) return sortDir === "asc" ? 1 : -1
    return 0
  })

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-30 ml-1 text-[10px]">↕</span>
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-0.5 inline text-primary" />
      : <ChevronDown className="h-3 w-3 ml-0.5 inline text-primary" />
  }

  const sortableHeadClass = "cursor-pointer select-none hover:text-foreground transition-colors"

  const headers = (
    <TableHeader>
      <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
        <TableHead className="w-12 text-center">Token</TableHead>
        <TableHead className={cn("w-[4.5rem]", sortableHeadClass)} onClick={() => handleSort("createdAt")}>
          Time <SortIcon k="createdAt" />
        </TableHead>
        <TableHead className={sortableHeadClass} onClick={() => handleSort("patientId")}>
          Patient ID <SortIcon k="patientId" />
        </TableHead>
        <TableHead className={sortableHeadClass} onClick={() => handleSort("name")}>
          Name <SortIcon k="name" />
        </TableHead>
        <TableHead>Age / Gender</TableHead>
        <TableHead>Phone</TableHead>
        <TableHead>Doctor</TableHead>
        <TableHead className={sortableHeadClass} onClick={() => handleSort("status")}>
          Status <SortIcon k="status" />
        </TableHead>
        <TableHead>Services</TableHead>
        <TableHead>Receipt</TableHead>
        <TableHead className="w-10 text-center">Print</TableHead>
        <TableHead className="w-12"></TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <>
    {/* ── Mobile card list (hidden on md+) ── */}
    <div className="md:hidden space-y-2">
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No patients found</div>
      ) : (
        sorted.map((patient) => {
          const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ")
          const token = tokenMap.get(patient.id)
          return (
            <div
              key={patient.id}
              onClick={() => onRowClick(patient)}
              className="rounded-xl border border-border bg-white p-4 active:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    #{patient.patientId} · Token {token}
                  </p>
                </div>
                <PatientStatusBadge status={patient.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {patient.age != null && <span>Age {patient.age}</span>}
                <span>{patient.gender}</span>
                {patient.phone && <span>{patient.phone}</span>}
              </div>
              {(patient.doctorName || patient.appointmentDate) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {patient.doctorName && <span>{patient.doctorName}</span>}
                  {patient.doctorName && patient.appointmentDate && <span> · </span>}
                  {patient.appointmentDate && (
                    <span>{new Date(patient.appointmentDate).toLocaleDateString("en-IN")}</span>
                  )}
                </div>
              )}
              {(onEdit || onDelete || onQuickPrint) && (
                <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {onQuickPrint && defaultPrintConfigured && patient.status === "COMPLETED" && (
                    <button
                      onClick={() => onQuickPrint(patient)}
                      disabled={quickPrintingId === patient.id}
                      className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {quickPrintingId === patient.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Print"}
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(patient)}
                      className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && userRole === "ADMIN" && (
                    <button
                      onClick={() => onDelete(patient)}
                      className="text-xs px-2 py-1 rounded-md border border-destructive/30 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>

    {/* ── Desktop table (hidden below md) ── */}
    <div className="hidden md:block">
    {loading ? (
      <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
        <Table>
          {headers}
          <TableBody>
            {Array.from({ length: 7 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell className="text-center"><Skeleton className="h-6 w-7 rounded mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-6 w-6 rounded mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ) : patients.length === 0 ? (
      <div className="rounded-xl border border-border/60 bg-white py-14 px-6 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/no-opd-patients.svg"
          alt=""
          className="mx-auto mb-6 h-44 w-auto select-none"
          draggable={false}
        />
        <p className="text-base font-semibold text-foreground">No out-patients yet</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
          Try a different date, or click <span className="font-medium text-foreground">Add Patient</span> to register a new visit.
        </p>
      </div>
    ) : (
    <TooltipProvider delayDuration={150}>
    <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
      <Table>
        {headers}
        <TableBody>
          {sorted.map((patient) => {
            const age = patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"
            const latestInvoice = patient.prescriptions?.[0]
            const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
            const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"

            return (
              <TableRow
                key={patient.id}
                onClick={() => onRowClick(patient)}
                className="cursor-pointer group hover:bg-primary/[0.02] transition-colors"
              >
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center h-6 min-w-7 rounded bg-primary/10 border border-primary/20 border-dashed text-xs font-bold text-primary tabular-nums px-1.5">
                    {tokenMap.get(patient.id)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                  {new Date(patient.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded">
                    {patient.patientId}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-sm text-foreground">{fullName}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-baseline gap-1 text-sm text-foreground">
                    <span className="font-medium tabular-nums">{age}</span>
                    <span className="font-normal">y</span>
                    <span className="text-foreground/30 mx-0.5">·</span>
                    <span className="font-medium">{genderShort}</span>
                  </span>
                </TableCell>
                <TableCell className="text-sm text-foreground tabular-nums">{patient.phone}</TableCell>
                <TableCell>
                  {patient.doctorName ? (
                    <span className="text-sm font-medium text-foreground">
                      {patient.doctorName.startsWith("Dr") ? patient.doctorName : `Dr. ${patient.doctorName}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <PatientStatusBadge status={patient.status as never} />
                </TableCell>
                <TableCell>
                  {(() => {
                    const items = (latestInvoice?.items ?? []) as { description: string; sortOrder?: number }[]
                    if (items.length === 0) return <span className="text-muted-foreground/50">—</span>
                    const sortedItems = [...items].sort(
                      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                    )
                    const extra = sortedItems.length - 1
                    return (
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center gap-1 max-w-[200px] cursor-default">
                            <span className="inline-flex items-center h-6 px-2 rounded-md bg-muted/70 border border-border/40 text-[12px] font-medium text-foreground truncate">
                              {sortedItems[0].description}
                            </span>
                            {extra > 0 && (
                              <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md bg-muted/70 border border-border/40 text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                                +{extra}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="max-w-xs px-3 py-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Services ({sortedItems.length})
                          </p>
                          <ul className="space-y-1 text-xs">
                            {sortedItems.map((it, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-muted-foreground/60 mt-0.5">•</span>
                                <span className="text-foreground">{it.description}</span>
                              </li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  {latestInvoice ? (
                    <div>
                      <span className="font-semibold text-sm text-foreground tabular-nums">
                        {formatCurrency(latestInvoice.total)}
                      </span>
                      {latestInvoice.balanceDue > 0 && (
                        <p className="text-[11px] text-orange-600 font-medium mt-0.5 tabular-nums">
                          Due: {formatCurrency(latestInvoice.balanceDue)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                  {patient.status === "COMPLETED" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={!defaultPrintConfigured || quickPrintingId === patient.patientId}
                          className={cn(
                            "h-7 w-7 transition-opacity",
                            defaultPrintConfigured
                              ? "text-primary opacity-70 group-hover:opacity-100"
                              : "text-muted-foreground/40",
                          )}
                          onClick={() => onQuickPrint?.(patient)}
                        >
                          {quickPrintingId === patient.patientId
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Zap className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {defaultPrintConfigured
                          ? "Quick print (default receipts)"
                          : "Configure defaults in Settings → Print Defaults"}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(patient)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      {userRole === "ADMIN" && (
                        <DropdownMenuItem
                          onClick={() => onDelete?.(patient)}
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
          })}
        </TableBody>
      </Table>
      <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
        <span className="text-xs text-muted-foreground">
          {patients.length} patient{patients.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
    </TooltipProvider>
    )}
    </div>
    </>
  )
}
