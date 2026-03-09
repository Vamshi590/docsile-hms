"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, calculateAge, getInitials } from "@/lib/utils"
import { PatientStatusBadge } from "./PatientStatusBadge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  dateOfBirth: Date | null
  gender: string
  phone: string
  status: string
  appointmentDate: Date
  createdAt: Date
  doctorName: string | null
  department: string | null
  guardianName?: string | null
  address?: string | null
  prescriptions?: {
    total: number
    amountPaid: number
    balanceDue: number
    status: string
    prescriptionNumber: string | null
  }[]
}

interface PatientTableProps {
  patients: PatientRow[]
  onRowClick: (patient: PatientRow) => void
  loading?: boolean
  userRole?: string
  onEdit?: (patient: PatientRow) => void
  onDelete?: (patient: PatientRow) => void
}

type SortKey = "patientId" | "name" | "status" | "appointmentDate" | "createdAt"

export function PatientTable({ patients, onRowClick, loading, userRole, onEdit, onDelete }: PatientTableProps) {
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
    if (sortKey !== k) return <span className="opacity-25 ml-1 text-xs">↕</span>
    return sortDir === "asc"
      ? <ChevronUp className="h-3.5 w-3.5 ml-1 inline" />
      : <ChevronDown className="h-3.5 w-3.5 ml-1 inline" />
  }

  const headers = (
    <TableHeader>
      <TableRow className="bg-gray-100 hover:bg-gray-100">
        <TableHead className="w-12">Token</TableHead>
        <TableHead className="cursor-pointer hover:text-foreground w-32" onClick={() => handleSort("createdAt")}>
          Time <SortIcon k="createdAt" />
        </TableHead>
        <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort("patientId")}>
          Patient ID <SortIcon k="patientId" />
        </TableHead>
        <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
          Name <SortIcon k="name" />
        </TableHead>
        <TableHead>Age / Gender</TableHead>
        <TableHead>Phone</TableHead>
        <TableHead>Doctor</TableHead>
        <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort("status")}>
          Status <SortIcon k="status" />
        </TableHead>
        <TableHead>Receipt</TableHead>
        <TableHead className="w-12"></TableHead>
      </TableRow>
    </TableHeader>
  )

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          {headers}
          <TableBody>
            {Array.from({ length: 7 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell><Skeleton className="h-5 w-6 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-4 w-28" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white py-20 text-center">
        <p className="text-base font-semibold text-foreground">No patients found</p>
        <p className="text-sm text-muted-foreground mt-1.5">
          Try a different date or use Add Patient to register a new patient
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
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
                className="cursor-pointer "
              >
                <TableCell>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold px-1.5">
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
                  <span className="font-bold text-foreground">{patient.patientId}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-foreground">{fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {age} / {genderShort}
                </TableCell>
                <TableCell className="font-medium text-foreground">{patient.phone}</TableCell>
                <TableCell className="text-muted-foreground">
                  {patient.doctorName ?? "—"}
                </TableCell>
                <TableCell>
                  <PatientStatusBadge status={patient.status as never} />
                </TableCell>
                <TableCell>
                  {latestInvoice ? (
                    <div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(latestInvoice.total)}
                      </span>
                      {latestInvoice.balanceDue > 0 && (
                        <p className="text-xs text-destructive mt-0.5">
                          Due: {formatCurrency(latestInvoice.balanceDue)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="h-7 w-7">
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
    </div>
  )
}
