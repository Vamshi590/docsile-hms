"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Search, User, FileText, AlertTriangle, CheckCircle2, Filter, Loader2, FlaskConical, ChevronDown, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { getPatientInvestigations, createLabBills, getLabBills } from "../actions"
import type { LabWithCount } from "./LabsPage"
import { LabBillCard } from "./LabBillCard"
import { toast } from "sonner"

// ── Types ────────────────────────────────────────────────────────────────────

type PatientInfo = {
  patientId: string
  name: string
  age: number | null
  gender: string
  phone: string
  doctorName: string | null
}

type PrescriptionInfo = {
  id: string
  prescriptionNumber: string | null
  doctorName: string | null
  prescriptionDate: Date
}

type LabGroup = {
  lab: { id: string; name: string; location: string | null }
  items: { investigationId: string; name: string; amount: number }[]
}

type ExistingBill = {
  id: string
  billNumber: string
  labName: string
  total: number
  status: string
  items: string[]
}

type BillFormData = {
  labId: string
  items: { investigationId: string; name: string; amount: number }[]
  discount: number
  discountReason?: string
  paymentMode: string
  amountPaid: number
}

type LabBillRow = {
  id: string
  billNumber: string
  createdAt: Date
  subtotal: number
  discount: number
  total: number
  amountPaid: number
  balanceDue: number
  status: string
  paymentMode: string | null
  lab: { name: string }
  patient: { patientId: string; firstName: string; lastName: string | null; phone: string }
  items: { name: string; amount: number }[]
}

type LabOption = { id: string; name: string }

const STATUS_COLORS: Record<string, "success" | "warning" | "secondary" | "info"> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "secondary",
  CANCELLED: "secondary",
}

// ── Component ────────────────────────────────────────────────────────────────

export function LabBillingTab({ labs: parentLabs }: { labs: LabWithCount[] }) {
  // ── Billing state
  const [searchId, setSearchId] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [prescription, setPrescription] = useState<PrescriptionInfo | null>(null)
  const [labGroups, setLabGroups] = useState<LabGroup[]>([])
  const [unassigned, setUnassigned] = useState<{ name: string; alreadyBilled: boolean }[]>([])
  const [existingBills, setExistingBills] = useState<ExistingBill[]>([])
  const [billForms, setBillForms] = useState<Map<string, BillFormData>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [completedBills, setCompletedBills] = useState<{ billNumber: string; labName: string; total: number }[]>([])

  // ── History state
  const [bills, setBills] = useState<LabBillRow[]>([])
  const labs: LabOption[] = parentLabs.map((l) => ({ id: l.id, name: l.name }))
  const [historyLoading, setHistoryLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterLabId, setFilterLabId] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterPatient, setFilterPatient] = useState("")
  const [expandedBill, setExpandedBill] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // ── Load history (only when history panel is opened)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const billsData = await getLabBills({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      labId: filterLabId && filterLabId !== "all" ? filterLabId : undefined,
      status: filterStatus && filterStatus !== "all" ? filterStatus : undefined,
      patientId: filterPatient || undefined,
    })
    setBills(billsData as LabBillRow[])
    setHistoryLoading(false)
    setHistoryLoaded(true)
  }, [dateFrom, dateTo, filterLabId, filterStatus, filterPatient])

  // Load today's bills on mount, then reload when filters change or panel is opened
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // ── Billing handlers
  async function handleSearch() {
    if (!searchId.trim()) return
    setSearchLoading(true)
    setCompletedBills([])
    const result = await getPatientInvestigations(searchId.trim())
    if (!result.success) {
      toast.error(result.error)
      resetBillingState()
    } else {
      setPatient(result.data.patient)
      setPrescription(result.data.prescription as PrescriptionInfo | null)
      setLabGroups(result.data.labGroups)
      setUnassigned(result.data.unassigned)
      setExistingBills((result.data as { existingBills?: ExistingBill[] }).existingBills ?? [])

      const forms = new Map<string, BillFormData>()
      for (const group of result.data.labGroups) {
        forms.set(group.lab.id, {
          labId: group.lab.id,
          items: [...group.items],
          discount: 0,
          paymentMode: "Cash",
          amountPaid: group.items.reduce((s, i) => s + i.amount, 0),
        })
      }
      setBillForms(forms)
    }
    setSearchLoading(false)
  }

  function resetBillingState() {
    setPatient(null)
    setPrescription(null)
    setLabGroups([])
    setUnassigned([])
    setExistingBills([])
    setBillForms(new Map())
  }

  function updateBillForm(labId: string, updates: Partial<BillFormData>) {
    setBillForms((prev) => {
      const next = new Map(prev)
      const existing = next.get(labId)
      if (existing) next.set(labId, { ...existing, ...updates })
      return next
    })
  }

  function removeItem(labId: string, investigationId: string) {
    setBillForms((prev) => {
      const next = new Map(prev)
      const existing = next.get(labId)
      if (existing) {
        const newItems = existing.items.filter((i) => i.investigationId !== investigationId)
        const newSubtotal = newItems.reduce((s, i) => s + i.amount, 0)
        next.set(labId, {
          ...existing,
          items: newItems,
          amountPaid: Math.min(existing.amountPaid, Math.max(0, newSubtotal - existing.discount)),
        })
      }
      return next
    })
  }

  async function handleProcessAll() {
    if (!patient || !prescription) return
    const bills = Array.from(billForms.values()).filter((b) => b.items.length > 0)
    if (bills.length === 0) { toast.error("No items to bill"); return }

    setSubmitting(true)
    const result = await createLabBills({
      patientId: patient.patientId,
      prescriptionId: prescription.id,
      bills,
    })
    if (result.success) {
      toast.success(`${result.data.length} lab bill(s) created`)
      setCompletedBills(result.data)
      setLabGroups([])
      setBillForms(new Map())
      loadHistory()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  async function handleProcessSingle(labId: string) {
    if (!patient || !prescription) return
    const bill = billForms.get(labId)
    if (!bill || bill.items.length === 0) return

    setSubmitting(true)
    const result = await createLabBills({
      patientId: patient.patientId,
      prescriptionId: prescription.id,
      bills: [bill],
    })
    if (result.success) {
      toast.success("Lab bill created")
      setCompletedBills((prev) => [...prev, ...result.data])
      setLabGroups((prev) => prev.filter((g) => g.lab.id !== labId))
      setBillForms((prev) => { const next = new Map(prev); next.delete(labId); return next })
      loadHistory()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  return (
    <>
      {/* ─── BILLING SECTION ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-100 bg-white p-5 space-y-5">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider px-1">
          Generate Lab Bills
        </p>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter Patient ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 bg-white"
            />
          </div>
          <Button onClick={handleSearch} disabled={searchLoading} size="sm">
            {searchLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Search
          </Button>
          {patient && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { resetBillingState(); setSearchId(""); setCompletedBills([]) }}>
              Clear
            </Button>
          )}
        </div>

        {/* Patient Info Card */}
        {patient && (
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{patient.name}</span>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-medium">{patient.patientId}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[
                    patient.age && `${patient.age}y`,
                    patient.gender,
                    patient.phone,
                    patient.doctorName && `Dr. ${patient.doctorName}`,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              {prescription && (
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-mono">{prescription.prescriptionNumber}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(prescription.prescriptionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing Bills Warning */}
        {existingBills.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium mb-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Existing lab bills found for this prescription
            </div>
            {existingBills.map((bill) => (
              <div key={bill.id} className="text-xs text-yellow-700 ml-6">
                {bill.billNumber} — {bill.labName} — ₹{bill.total.toLocaleString("en-IN")} ({bill.status})
              </div>
            ))}
          </div>
        )}

        {/* Completed Bills Success */}
        {completedBills.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-2 text-green-800 text-sm font-medium mb-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Bills Created Successfully
            </div>
            {completedBills.map((bill) => (
              <div key={bill.billNumber} className="text-xs text-green-700 ml-6">
                {bill.billNumber} — {bill.labName} — ₹{bill.total.toLocaleString("en-IN")}
              </div>
            ))}
          </div>
        )}

        {/* No investigations */}
        {patient && !prescription && (
          <div className="rounded-xl border border-border bg-white py-12 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">No prescription with investigations found</p>
          </div>
        )}
        {patient && prescription && labGroups.length === 0 && unassigned.length === 0 && completedBills.length === 0 && (
          <div className="rounded-xl border border-border bg-white py-12 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">No investigations in the latest prescription</p>
          </div>
        )}

        {/* Lab Bill Cards */}
        {labGroups.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Auto-Segregated Bills ({labGroups.length} lab{labGroups.length !== 1 ? "s" : ""})
              </p>
              {labGroups.length > 1 && (
                <Button onClick={handleProcessAll} disabled={submitting} size="sm">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Process All
                </Button>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {labGroups.map((group) => {
                const form = billForms.get(group.lab.id)
                if (!form) return null
                return (
                  <LabBillCard
                    key={group.lab.id}
                    lab={group.lab}
                    items={form.items}
                    discount={form.discount}
                    discountReason={form.discountReason}
                    paymentMode={form.paymentMode}
                    amountPaid={form.amountPaid}
                    onUpdateDiscount={(v) => updateBillForm(group.lab.id, { discount: v })}
                    onUpdateDiscountReason={(v) => updateBillForm(group.lab.id, { discountReason: v })}
                    onUpdatePaymentMode={(v) => updateBillForm(group.lab.id, { paymentMode: v })}
                    onUpdateAmountPaid={(v) => updateBillForm(group.lab.id, { amountPaid: v })}
                    onRemoveItem={(invId) => removeItem(group.lab.id, invId)}
                    onProcess={() => handleProcessSingle(group.lab.id)}
                    submitting={submitting}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Unassigned Investigations */}
        {unassigned.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-center gap-2 text-orange-800 text-sm font-medium mb-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Unassigned Investigations (not mapped to any lab)
            </div>
            {unassigned.map((inv) => (
              <div key={inv.name} className="text-xs text-orange-700 ml-6">
                {inv.name}
                {inv.alreadyBilled && <span className="ml-1 text-orange-500">(already billed)</span>}
              </div>
            ))}
            <p className="text-xs text-orange-600 mt-2 ml-6">
              Configure these in the Lab Configuration tab to enable billing.
            </p>
          </div>
        )}
      </div>

      {/* ─── HISTORY SECTION ─────────────────────────────────────────────── */}
      {/* Collapsible Filters */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Lab Bills History</span>
            {!historyLoading && bills.length > 0 && (
              <Badge variant="secondary" className="text-xs">{bills.length}</Badge>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", historyOpen && "rotate-180")} />
        </button>

        {historyOpen && (
          <div className="border-t border-border px-5 py-3 bg-gray-50/50">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">From</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 bg-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">To</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 bg-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Lab</label>
                <Select value={filterLabId} onValueChange={setFilterLabId}>
                  <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All Labs" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Labs</SelectItem>
                    {labs.map((lab) => <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Patient</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Patient ID..."
                    value={filterPatient}
                    onChange={(e) => setFilterPatient(e.target.value)}
                    className="h-9 w-40 pl-8 bg-white text-sm"
                  />
                </div>
              </div>
              <div className="pt-5">
                <Button variant="outline" size="sm" onClick={loadHistory} className="h-9">
                  <Filter className="h-3.5 w-3.5 mr-1" /> Apply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Table (always visible) */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>Bill #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Lab</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  <FlaskConical className="h-9 w-9 mx-auto mb-3 opacity-40" />
                  <div className="font-medium">No lab bills found</div>
                  <div className="text-xs mt-1">Lab bills will appear here once created</div>
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <React.Fragment key={bill.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}
                  >
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-medium">
                        {bill.billNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{bill.patient.firstName} {bill.patient.lastName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{bill.patient.patientId}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{bill.lab.name}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium">₹{bill.total.toLocaleString("en-IN")}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium text-green-600">
                        ₹{bill.amountPaid.toLocaleString("en-IN")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-medium ${bill.balanceDue > 0 ? "text-orange-600" : "text-green-600"}`}>
                        {bill.balanceDue > 0 ? `₹${bill.balanceDue.toLocaleString("en-IN")}` : "Nil"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[bill.status] ?? "secondary"}>
                        {bill.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedBill === bill.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 px-8 py-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1.5">Investigations:</div>
                        <div className="space-y-0.5">
                          {bill.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm max-w-md">
                              <span>{item.name}</span>
                              <span className="font-medium">₹{item.amount.toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                        </div>
                        {bill.discount > 0 && (
                          <div className="flex justify-between text-sm mt-1.5 text-muted-foreground max-w-md">
                            <span>Discount</span>
                            <span>-₹{bill.discount.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {bill.paymentMode && (
                          <div className="text-xs text-muted-foreground mt-2">Payment: {bill.paymentMode}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
        {!historyLoading && bills.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {bills.length} bill{bills.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
