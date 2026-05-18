"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { cn, formatCurrency, calculateAge } from "@/lib/utils"
import { PatientStatusBadge } from "./PatientStatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"

type InvoiceItem = { id: string; description: string; category?: string }

type Prescription = {
  id: string
  prescriptionNumber: string
  subtotal: number
  balanceDue: number
  total: number
  status: string
  doctorName: string | null
  prescriptionDate: string
  createdAt: string
  items?: InvoiceItem[]
}

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
  prescriptions?: Prescription[]
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
  emptyLabel?: string
}

type SortKey = "token" | "name" | "status" | "createdAt"

export function PatientTable({ patients, onRowClick, loading, userRole, onEdit, onDelete, emptyLabel }: PatientTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const tokenMap = new Map(
    [...patients]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((p, i) => [p.id, i + 1])
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const sorted = [...patients].sort((a, b) => {
    let av: string | number = "", bv: string | number = ""
    if (sortKey === "token") { av = tokenMap.get(a.id) ?? 0; bv = tokenMap.get(b.id) ?? 0 }
    else if (sortKey === "name") { av = a.firstName + (a.lastName ?? ""); bv = b.firstName + (b.lastName ?? "") }
    else if (sortKey === "status") { av = a.status; bv = b.status }
    else { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime() }
    if (av < bv) return sortDir === "asc" ? -1 : 1
    if (av > bv) return sortDir === "asc" ? 1 : -1
    return 0
  })

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-25 ml-1 text-[10px]">↕</span>
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-0.5 inline text-primary" />
      : <ChevronDown className="h-3 w-3 ml-0.5 inline text-primary" />
  }

  const sh = "cursor-pointer select-none hover:text-foreground transition-colors"

  const headers = (
    <TableHeader>
      <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
        <TableHead className={cn("w-16 text-center", sh)} onClick={() => handleSort("token")}>
          # <SortIcon k="token" />
        </TableHead>
        <TableHead className={sh} onClick={() => handleSort("name")}>
          Patient <SortIcon k="name" />
        </TableHead>
        <TableHead>Age / Gender</TableHead>
        <TableHead>Phone</TableHead>
        <TableHead>Doctor</TableHead>
        <TableHead>Services</TableHead>
        <TableHead className={sh} onClick={() => handleSort("status")}>
          Status <SortIcon k="status" />
        </TableHead>
        <TableHead className="text-right">Amount</TableHead>
        <TableHead className="w-10" />
      </TableRow>
    </TableHeader>
  )

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
        <Table>
          {headers}
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Skeleton className="h-5 w-7 rounded" />
                    <Skeleton className="h-3 w-10 rounded" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-14 rounded" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-20 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-6 w-6 rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-white py-20 text-center shadow-sm">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-base font-semibold text-foreground">{emptyLabel ?? "No patients found"}</p>
        <p className="text-sm text-muted-foreground mt-1.5">
          Try adjusting your filters or select a different date
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
      <Table>
        {headers}
        <TableBody>
          {sorted.map((patient) => {
            const age = patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"
            const invoice = patient.prescriptions?.[0]
            const services = invoice?.items ?? []
            const fullName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()
            const genderShort = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : "O"
            const token = tokenMap.get(patient.id) ?? "—"
            const time = new Date(patient.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit", minute: "2-digit", hour12: false,
            })

            return (
              <TableRow
                key={patient.id}
                onClick={() => onRowClick(patient)}
                className="cursor-pointer group hover:bg-primary/[0.025] transition-colors"
              >
                {/* # — token + registration time */}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="inline-flex items-center justify-center h-6 min-w-7 rounded bg-primary/10 border border-primary/20 border-dashed text-xs font-bold text-primary tabular-nums px-1.5">
                      {token}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums leading-none">{time}</span>
                  </div>
                </TableCell>

                {/* Patient — name + ID */}
                <TableCell>
                  <div className="font-semibold text-sm text-foreground leading-snug">{fullName}</div>
                  <span className="font-mono text-[10px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                    {patient.patientId}
                  </span>
                </TableCell>

                {/* Details — age / gender / phone */}
                <TableCell>
                  <div className="text-sm text-muted-foreground whitespace-nowrap">{age}y · {genderShort}</div>
                  <div className="text-xs text-muted-foreground/60 tabular-nums mt-0.5">{patient.phone}</div>
                </TableCell>
                <TableCell className="text-sm text-foreground tabular-nums">{patient.phone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {patient.doctorName ?? <span className="text-muted-foreground/25">—</span>}
                </TableCell>

                {/* Services */}
                <TableCell>
                  {services.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {services.slice(0, 2).map((s) => (
                        <span
                          key={s.id}
                          className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-medium leading-snug w-fit max-w-[180px] break-words"
                        >
                          {s.description}
                        </span>
                      ))}
                      {services.length > 2 && (
                        <span className="text-[10px] text-muted-foreground/50 font-medium">
                          +{services.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/25 text-sm">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <PatientStatusBadge status={patient.status as never} />
                </TableCell>

                {/* Amount */}
                <TableCell className="text-right">
                  {invoice ? (
                    <div>
                      <div className="font-semibold text-sm text-foreground tabular-nums">
                        {formatCurrency(invoice.total)}
                      </div>
                      {invoice.balanceDue > 0 && (
                        <div className="text-[11px] text-orange-600 font-medium tabular-nums mt-0.5">
                          Due: {formatCurrency(invoice.balanceDue)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/25 text-sm">—</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
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
      <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {patients.length} patient{patients.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}
