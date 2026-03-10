"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { CalendarDays, Plus, MoveRight, X, Loader2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { PatientStatusBadge } from "./PatientStatusBadge"
import { formatDate, formatCurrency, calculateAge, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  updatePatientStatus,
  movePatientToDate,
  addServiceToPatient,
  getPatientById,
  getServiceTemplates,
} from "../actions"
import type { PatientStatus } from "@/lib/types"

const STATUSES: PatientStatus[] = [
  "REGISTERED", "IN_WORKUP", "WORKUP_DONE", "WITH_DOCTOR", "VISITED",
  "COMPLETED", "MEDICAL_ONLY", "MOVED", "CANCELLED", "NO_SHOW",
]

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Online", "NEFT"]

interface Props {
  patientId: string | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function PatientActionsModal({ patientId, open, onClose, onUpdate }: Props) {
  const [patient, setPatient] = useState<Awaited<ReturnType<typeof getPatientById>> | null>(null)
  const [loading, setLoading] = useState(false)

  const [showAddService, setShowAddService] = useState(false)
  const [showMoveDate, setShowMoveDate] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [moveReason, setMoveReason] = useState("")

  const [serviceTemplates, setServiceTemplates] = useState<{ id: string; name: string; category: string; amount: number }[]>([])
  const [addedServices, setAddedServices] = useState<{ id: string; description: string; category: string; quantity: number; unitPrice: number; amount: number }[]>([])
  const [paymentMode, setPaymentMode] = useState("Cash")
  const [amountPaid, setAmountPaid] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !patientId) return
    setLoading(true)
    Promise.all([
      getPatientById(patientId),
      getServiceTemplates(),
    ]).then(([p, templates]) => {
      setPatient(p)
      setServiceTemplates(templates)
      setLoading(false)
    })
  }, [open, patientId])

  async function handleStatusChange(status: string) {
    if (!patient) return
    const result = await updatePatientStatus(patient.patientId, status)
    if (result.success) {
      toast.success("Status updated")
      setPatient(prev => prev ? { ...prev, status } : prev)
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  async function handleMoveDate() {
    if (!patient || !newDate) { toast.error("Select a new date"); return }
    setSubmitting(true)
    const result = await movePatientToDate(patient.patientId, newDate, moveReason)
    setSubmitting(false)
    if (result.success) {
      toast.success("Appointment moved")
      setShowMoveDate(false)
      setNewDate("")
      setMoveReason("")
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  function addService(template: { id: string; name: string; category: string; amount: number }) {
    const exists = addedServices.find(s => s.description === template.name)
    if (exists) return
    setAddedServices(prev => [...prev, {
      id: template.id,
      description: template.name,
      category: template.category,
      quantity: 1,
      unitPrice: template.amount,
      amount: template.amount,
    }])
  }

  async function handleAddServices() {
    if (!patient || addedServices.length === 0) {
      toast.error("Add at least one service"); return
    }
    const subtotal = addedServices.reduce((s, i) => s + i.amount, 0)
    if (amountPaid > subtotal - discount) {
      toast.error("Amount received cannot exceed total"); return
    }
    setSubmitting(true)
    const result = await addServiceToPatient({
      patientId: patient.patientId,
      services: addedServices,
      paymentMode,
      amountPaid,
      discount,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Services added successfully")
      setShowAddService(false)
      setAddedServices([])
      setAmountPaid(0)
      setDiscount(0)
      const updated = await getPatientById(patient.patientId)
      setPatient(updated)
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  const subtotal = addedServices.reduce((s, i) => s + i.amount, 0)
  const total = subtotal - discount

  if (!patient && !loading) return null

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ) : patient ? (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm">
                    {getInitials(`${patient.firstName} ${patient.lastName ?? ""}`)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-base">
                    {patient.firstName} {patient.lastName}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{patient.patientId}</p>
                </div>
              </div>
              <PatientStatusBadge status={patient.status as PatientStatus} />
            </div>
          ) : null}
        </SheetHeader>

        {!loading && patient && (
          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="info" className="mt-1">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                <TabsTrigger value="receipts" className="flex-1">Receipts</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="space-y-4">
                {/* Patient details grid */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  {[
                    ["Phone", patient.phone],
                    ["Age / Gender", `${patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"} / ${patient.gender}`],
                    ["Date of Birth", formatDate(patient.dateOfBirth)],
                    ["Appointment", formatDate(patient.appointmentDate)],
                    ["Doctor", patient.doctorName ?? "—"],
                    ["Department", patient.department ?? "—"],
                    ["Referred By", patient.referredBy ?? "—"],
                    ["Guardian", patient.guardianName ? `${patient.guardianName} (${patient.guardianRelation ?? ""})` : "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {patient.address && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                    <p className="text-sm">{patient.address}</p>
                  </div>
                )}

                <Separator />

                {/* Change status */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Change Status
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(s)}
                        className="h-7 rounded-full text-xs px-2.5 hover:border-primary hover:text-primary"
                      >
                        {s.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <Separator />
                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => { setShowAddService(true); setShowMoveDate(false) }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Services / Receipt
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => { setShowMoveDate(true); setShowAddService(false) }}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Move Appointment
                  </Button>
                </div>

                {/* Add service panel */}
                {showAddService && (
                  <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold">Add Services</p>
                      <Button variant="ghost" size="icon-sm" onClick={() => setShowAddService(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                      {serviceTemplates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => addService(t)}
                          className="text-left rounded-lg border border-border bg-white p-2 hover:border-primary hover:bg-primary/5 transition-all text-xs"
                        >
                          <p className="font-medium text-foreground">{t.name}</p>
                          <p className="text-muted-foreground">{formatCurrency(t.amount)}</p>
                        </button>
                      ))}
                    </div>

                    {addedServices.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1">
                          {addedServices.map(s => (
                            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{s.description}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-medium">{formatCurrency(s.amount)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setAddedServices(prev => prev.filter(x => x.id !== s.id))}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total</span>
                          <span>{formatCurrency(total)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Payment Mode</Label>
                            <Select value={paymentMode} onValueChange={setPaymentMode}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Amount Received</Label>
                            <Input
                              type="number"
                              value={amountPaid}
                              onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                        </div>

                        <Button size="sm" className="w-full" onClick={handleAddServices} disabled={submitting}>
                          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Save Services
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Move date panel */}
                {showMoveDate && (
                  <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold">Move Appointment</p>
                      <Button variant="ghost" size="icon-sm" onClick={() => setShowMoveDate(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(patient.appointmentDate)}</span>
                      <MoveRight className="h-4 w-4" />
                      <Input
                        type="date"
                        value={newDate}
                        onChange={e => setNewDate(e.target.value)}
                        className="h-8 w-36"
                      />
                    </div>
                    <Textarea
                      value={moveReason}
                      onChange={e => setMoveReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="h-14"
                    />
                    <Button size="sm" className="w-full" onClick={handleMoveDate} disabled={submitting}>
                      {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Move Appointment
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Receipts tab */}
              <TabsContent value="receipts" className="space-y-3">
                {patient.prescriptions && patient.prescriptions.filter(p => p.total > 0).length > 0 ? (
                  patient.prescriptions.filter(p => p.total > 0).map(prescription => (
                    <div key={prescription.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="px-4 py-2.5 bg-surface flex justify-between items-center border-b border-border">
                        <span className="text-xs font-mono font-medium">
                          {prescription.prescriptionNumber ?? "—"}
                        </span>
                        <span className={`text-xs font-medium ${prescription.balanceDue > 0 ? "text-destructive" : "text-success"}`}>
                          {prescription.balanceDue > 0 ? `Due: ${formatCurrency(prescription.balanceDue)}` : "Paid"}
                        </span>
                      </div>
                      <div className="p-3 space-y-1">
                        {prescription.items && prescription.items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs">
                            <span className="text-foreground">{item.description}</span>
                            <span className="text-muted-foreground">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        <Separator className="my-1.5" />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total</span>
                          <span>{formatCurrency(prescription.total)}</span>
                        </div>
                        {prescription.discount > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Discount</span>
                            <span>-{formatCurrency(prescription.discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Received</span>
                          <span>{formatCurrency(prescription.amountPaid)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No receipts yet
                  </div>
                )}
              </TabsContent>

              {/* History tab */}
              <TabsContent value="history" className="space-y-2">
                {patient.prescriptions && patient.prescriptions.length > 0 ? (
                  patient.prescriptions.map(p => (
                    <div key={p.id} className="flex items-start gap-3 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-border shrink-0 mt-1.5" />
                      <div>
                        <span className="text-foreground font-medium">{p.status}</span>
                        <span className="text-muted-foreground ml-1.5">{formatDate(p.prescriptionDate)}</span>
                        {p.prescriptionNumber && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{p.prescriptionNumber}</p>
                        )}
                        {p.total > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatCurrency(p.total)}
                            {p.balanceDue > 0 && ` · Due: ${formatCurrency(p.balanceDue)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No history
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
