"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, X } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InPatientStatusBadge, IP_STATUS_CONFIG, IP_STATUS_TRANSITIONS } from "./InPatientStatusBadge"
import { updateInPatientStatus, addInPatientPayment, dischargeInPatient } from "../actions"
import { formatDate, formatCurrency, formatDateTime, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { InPatientStatus, PaymentRecord, PackageInclusion, MedicalValues } from "@/lib/types"

type InPatient = {
  id: string
  ipNumber: string
  name: string
  age: number
  gender: string
  phone: string
  address: string | null
  dateOfBirth: Date | null
  guardianName: string | null
  admissionDate: Date
  admissionNotes: string | null
  referredBy: string | null
  department: string | null
  doctorNames: string
  onDutyDoctors: string
  operationName: string | null
  operationDate: Date | null
  operationProcedure: string | null
  operationDetails: string | null
  provisionDiagnosis: string | null
  medicalValues: string | null
  packageAmount: number
  packageInclusions: string | null
  discount: number
  netAmount: number
  totalReceivedAmount: number
  balanceAmount: number
  paymentRecords: string | null
  prescriptions: string | null
  followUpDate: Date | null
  status: string
  dischargeDate: Date | null
  dischargeNotes: string | null
  bedNumber: string | null
  wardName: string | null
}

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"]
const AMOUNT_TYPES = ["Advance", "Partial", "Final", "Refund"]

interface Props {
  inpatient: InPatient | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function InPatientDetailDrawer({ inpatient, open, onClose, onUpdate }: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [showDischarge, setShowDischarge] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState("Cash")
  const [amountType, setAmountType] = useState("Partial")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [dischargeDate, setDischargeDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()))
  const [dischargeNotes, setDischargeNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!inpatient) return null

  const doctors: string[] = (() => {
    try { return JSON.parse(inpatient.doctorNames) } catch { return [] }
  })()

  const paymentRecords: PaymentRecord[] = (() => {
    try { return JSON.parse(inpatient.paymentRecords ?? "[]") } catch { return [] }
  })()

  const packageInclusions: PackageInclusion[] = (() => {
    try { return JSON.parse(inpatient.packageInclusions ?? "[]") } catch { return [] }
  })()

  const medicalValues: MedicalValues = (() => {
    try { return JSON.parse(inpatient.medicalValues ?? "{}") } catch { return {} }
  })()

  const ipPrescriptions: Array<{ medicine: string; days: string; timing: string; note?: string }> = (() => {
    try { return JSON.parse(inpatient.prescriptions ?? "[]") } catch { return [] }
  })()

  const daysAdmitted = Math.floor(
    (Date.now() - new Date(inpatient.admissionDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  async function handleStatusChange(status: InPatientStatus) {
    const result = await updateInPatientStatus(inpatient!.id, status)
    if (result.success) {
      toast.success("Status updated")
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  async function handleAddPayment() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    setSubmitting(true)
    const result = await addInPatientPayment({
      inpatientId: inpatient!.id,
      amount: parseFloat(paymentAmount),
      paymentMode,
      amountType,
      notes: paymentNotes,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Payment recorded")
      setShowPayment(false)
      setPaymentAmount("")
      setPaymentNotes("")
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDischarge() {
    if (!dischargeDate) { toast.error("Select discharge date"); return }
    setSubmitting(true)
    const result = await dischargeInPatient({
      id: inpatient!.id,
      dischargeDate,
      dischargeNotes: dischargeNotes || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Patient discharged")
      setShowDischarge(false)
      onClose()
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  const currentStatus = inpatient.status as InPatientStatus
  const transitions = IP_STATUS_TRANSITIONS[currentStatus] ?? []

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full max-w-[680px] flex flex-col" side="right">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-sm">{getInitials(inpatient.name)}</AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-base">{inpatient.name}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{inpatient.ipNumber}</p>
              </div>
            </div>
            <InPatientStatusBadge status={currentStatus} />
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 pt-3">
            {transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary">Change Status</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {transitions.map(s => (
                    <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                      {IP_STATUS_CONFIG[s].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button size="sm" variant="secondary" onClick={() => { setShowPayment(v => !v); setShowDischarge(false) }}>
              <Plus className="h-3.5 w-3.5" /> Add Payment
            </Button>

            {(currentStatus === "READY_FOR_DISCHARGE" || currentStatus !== "DISCHARGED") && (
              <Button
                size="sm"
                variant={currentStatus === "READY_FOR_DISCHARGE" ? "default" : "secondary"}
                onClick={() => { setShowDischarge(v => !v); setShowPayment(false) }}
              >
                Discharge
              </Button>
            )}
          </div>

          {/* Add payment panel */}
          {showPayment && (
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Add Payment</p>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowPayment(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Amount (₹)</Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    max={inpatient.balanceAmount}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={amountType} onValueChange={setAmountType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AMOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={handleAddPayment} disabled={submitting}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record Payment
              </Button>
            </div>
          )}

          {/* Discharge panel */}
          {showDischarge && (
            <div className="mt-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-foreground">Discharge Patient</p>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowDischarge(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {inpatient.balanceAmount > 0 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                  Outstanding balance: {formatCurrency(inpatient.balanceAmount)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Discharge Date</Label>
                  <Input type="date" value={dischargeDate} onChange={e => setDischargeDate(e.target.value)} />
                </div>
              </div>
              <Textarea
                value={dischargeNotes}
                onChange={e => setDischargeNotes(e.target.value)}
                placeholder="Discharge notes (optional)"
                className="h-14"
              />
              <Button size="sm" className="w-full" onClick={handleDischarge} disabled={submitting}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Discharge
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Patient Info</TabsTrigger>
              <TabsTrigger value="operation" className="flex-1">Operation</TabsTrigger>
              <TabsTrigger value="billing" className="flex-1">Billing</TabsTrigger>
              <TabsTrigger value="rx" className="flex-1">Prescriptions</TabsTrigger>
            </TabsList>

            {/* Patient Info */}
            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {[
                  ["Age / Gender", `${inpatient.age} / ${inpatient.gender.charAt(0)}`],
                  ["Phone", inpatient.phone],
                  ["Guardian", inpatient.guardianName ?? "—"],
                  ["Date of Birth", formatDate(inpatient.dateOfBirth)],
                  ["Admission Date", formatDateTime(inpatient.admissionDate)],
                  ["Days Admitted", `${daysAdmitted} day${daysAdmitted !== 1 ? "s" : ""}`],
                  ["Referred By", inpatient.referredBy ?? "—"],
                  ["Department", inpatient.department ?? "—"],
                  ["On Duty Doctors", (() => {
                    try { return (JSON.parse(inpatient.onDutyDoctors) as string[]).join(", ") || "—" }
                    catch { return "—" }
                  })()],
                  ["Doctors", doctors.join(", ") || "—"],
                  ["Bed / Ward", inpatient.bedNumber ? `${inpatient.bedNumber} / ${inpatient.wardName ?? ""}` : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {inpatient.address && (
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm">{inpatient.address}</p>
                </div>
              )}
              {inpatient.admissionNotes && (
                <div>
                  <p className="text-xs text-muted-foreground">Admission Notes</p>
                  <p className="text-sm">{inpatient.admissionNotes}</p>
                </div>
              )}
            </TabsContent>

            {/* Operation */}
            <TabsContent value="operation" className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                {[
                  ["Operation", inpatient.operationName ?? "—"],
                  ["Operation Date", formatDate(inpatient.operationDate)],
                  ["Diagnosis", inpatient.provisionDiagnosis ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {inpatient.operationProcedure && (
                <div>
                  <p className="text-xs text-muted-foreground">Procedure</p>
                  <p>{inpatient.operationProcedure}</p>
                </div>
              )}
              {inpatient.operationDetails && (
                <div>
                  <p className="text-xs text-muted-foreground">Details</p>
                  <p>{inpatient.operationDetails}</p>
                </div>
              )}

              {Object.keys(medicalValues).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Medical Values
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(medicalValues).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/50 p-2.5">
                          <p className="text-xs text-muted-foreground uppercase">{k}</p>
                          <p className="font-medium text-sm">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Billing */}
            <TabsContent value="billing" className="space-y-4">
              {/* Financial summary */}
              <div className="rounded-xl border border-border bg-white p-4 space-y-2 text-sm">
                {[
                  ["Package Amount", formatCurrency(inpatient.packageAmount), ""],
                  ["Discount", `- ${formatCurrency(inpatient.discount)}`, "text-muted-foreground"],
                  ["Net Amount", formatCurrency(inpatient.netAmount), "font-semibold"],
                ].map(([label, val, cls]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cls}>{val}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total Received</span>
                  <span className="text-success">{formatCurrency(inpatient.totalReceivedAmount)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Balance Due</span>
                  <span className={inpatient.balanceAmount > 0 ? "text-destructive" : "text-success"}>
                    {formatCurrency(inpatient.balanceAmount)}
                  </span>
                </div>
              </div>

              {/* Package inclusions */}
              {packageInclusions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Package Inclusions
                  </p>
                  <div className="space-y-1">
                    {packageInclusions.map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span>{formatCurrency(item.amount)}</span>
                        </div>
                        {item.subItems?.map((sub, j) => (
                          <div key={j} className="flex justify-between text-xs text-muted-foreground pl-4">
                            <span>{sub.itemName} ×{sub.quantity}</span>
                            <span>{formatCurrency(sub.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment history */}
              {paymentRecords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Payment History
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100 hover:bg-gray-100">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentRecords.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell>{formatDate(p.date)}</TableCell>
                            <TableCell>{p.amountType}</TableCell>
                            <TableCell>{p.paymentMode}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Prescriptions */}
            <TabsContent value="rx" className="space-y-3">
              {ipPrescriptions.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    IP Medications
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100 hover:bg-gray-100">
                          <TableHead>Medicine</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Timing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ipPrescriptions.map((rx, i) => (
                          <TableRow key={i}>
                            <TableCell>{rx.medicine}</TableCell>
                            <TableCell>{rx.days}</TableCell>
                            <TableCell>{rx.timing}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No IP prescriptions
                </div>
              )}
              {inpatient.followUpDate && (
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Follow-up: </span>
                  <span className="font-medium">{formatDate(inpatient.followUpDate)}</span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
