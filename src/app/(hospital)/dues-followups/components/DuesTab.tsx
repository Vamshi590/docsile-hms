"use client"

import React, { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, IndianRupee, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { FilterBar, SearchInput } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { WhatsAppButton } from "./WhatsAppButton"
import { getDues, markDueAsPaid } from "../actions"
import type { DueRecord, DuesSummary } from "../actions"
import { formatDateLong, formatCurrency } from "@/lib/utils"

export function DuesTab({ refreshRef }: { refreshRef?: React.MutableRefObject<(() => void) | null> }) {
  const [dues, setDues] = useState<DueRecord[]>([])
  const [summary, setSummary] = useState<DuesSummary>({
    totalOutstanding: 0, opdCount: 0, opdTotal: 0, ipdCount: 0, ipdTotal: 0, labCount: 0, labTotal: 0, pharmacyCount: 0, pharmacyTotal: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "OPD" | "IPD" | "LAB" | "PHARMACY">("ALL")
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [payTarget, setPayTarget] = useState<DueRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadDues = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getDues({
        search: search.trim() || undefined,
        type: typeFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
      })
      setDues(result.dues)
      setSummary(result.summary)
    } catch {
      toast.error("Failed to load dues")
    }
    setLoading(false)
  }, [search, typeFilter, dateFrom, dateTo, sortBy])

  useEffect(() => { loadDues() }, [loadDues])

  // Expose refresh to parent
  useEffect(() => {
    if (refreshRef) refreshRef.current = loadDues
    return () => { if (refreshRef) refreshRef.current = null }
  }, [refreshRef, loadDues])

  async function handleMarkPaid() {
    if (!payTarget) return
    setSubmitting(true)
    const result = await markDueAsPaid(payTarget.id, payTarget.type)
    setSubmitting(false)
    if (result.success) {
      toast.success(`${payTarget.patientName}'s due marked as paid`)
      setPayTarget(null)
      loadDues()
    } else {
      toast.error(result.error)
    }
  }

  function getDueWhatsAppMessage(due: DueRecord) {
    return `Hello ${due.patientName}, this is a reminder. You have an outstanding balance of Rs. ${due.balanceDue.toLocaleString("en-IN")} for services on ${formatDateLong(due.date)}. Please arrange for payment at your earliest convenience. Thank you.`
  }

  return (
    <div>
      {/* Filters */}
      <FilterBar className="top-16">
        <div className="flex items-center gap-2.5 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            onSubmit={loadDues}
            placeholder="Search name, phone, ID..."
            className="w-56"
          />
          <div className="filter-divider" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "ALL" | "OPD" | "IPD" | "LAB" | "PHARMACY")}>
            <SelectTrigger className="w-32 text-sm bg-white h-8 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="OPD">OPD</SelectItem>
              <SelectItem value="IPD">IPD</SelectItem>
              <SelectItem value="LAB">Lab</SelectItem>
              <SelectItem value="PHARMACY">Pharmacy</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-40 text-sm bg-white h-8 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="amount_desc">Highest Due</SelectItem>
              <SelectItem value="amount_asc">Lowest Due</SelectItem>
            </SelectContent>
          </Select>
          <div className="filter-divider" />
          <DatePicker
            value={dateFrom}
            onChange={(d) => setDateFrom(d)}
            className="w-36 text-sm bg-white h-8 border-border/60"
            placeholder="From"
          />
          <DatePicker
            value={dateTo}
            onChange={(d) => setDateTo(d)}
            className="w-36 text-sm bg-white h-8 border-border/60"
            placeholder="To"
          />
        </div>
      </FilterBar>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Total Outstanding</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">OPD Dues</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary.opdTotal)}</p>
          <p className="text-xs text-muted-foreground">{summary.opdCount} patient{summary.opdCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">IPD Dues</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary.ipdTotal)}</p>
          <p className="text-xs text-muted-foreground">{summary.ipdCount} patient{summary.ipdCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Lab Dues</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary.labTotal)}</p>
          <p className="text-xs text-muted-foreground">{summary.labCount} bill{summary.labCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Pharmacy Dues</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary.pharmacyTotal)}</p>
          <p className="text-xs text-muted-foreground">{summary.pharmacyCount} bill{summary.pharmacyCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Dues Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>Patient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Services / Package</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : dues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  <IndianRupee className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <div className="font-medium">No outstanding dues</div>
                  <div className="text-xs mt-1">All payments are up to date</div>
                </TableCell>
              </TableRow>
            ) : (
              dues.map((due) => (
                <TableRow key={`${due.type}-${due.id}`}>
                  <TableCell>
                    <div className="font-medium text-sm">{due.patientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {due.uhid} &middot; {due.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={due.type === "LAB" ? "info" : due.type === "OPD" ? "secondary" : due.type === "PHARMACY" ? "warning" : "outline"} className="text-xs">
                      {due.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-48">
                      {due.services}
                    </span>
                    {due.prescriptionNumber && (
                      <div className="text-[10px] font-mono text-muted-foreground/70">{due.prescriptionNumber}</div>
                    )}
                    {due.labBillNumber && (
                      <div className="text-[10px] font-mono text-muted-foreground/70">{due.labBillNumber}</div>
                    )}
                    {due.pharmacyBillNumber && (
                      <div className="text-[10px] font-mono text-muted-foreground/70">{due.pharmacyBillNumber}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(due.totalAmount)}</TableCell>
                  <TableCell className="text-right text-sm text-green-600">{formatCurrency(due.amountPaid)}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-sm text-red-600">{formatCurrency(due.balanceDue)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{formatDateLong(due.date)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <WhatsAppButton phone={due.phone} message={getDueWhatsAppMessage(due)} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Mark as Paid"
                        onClick={() => setPayTarget(due)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && dues.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {dues.length} record{dues.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Mark as Paid Confirmation */}
      <AlertDialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{payTarget?.patientName}</strong>&apos;s outstanding balance of{" "}
              <strong>{formatCurrency(payTarget?.balanceDue ?? 0)}</strong> as fully paid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid} className="bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark as Paid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
