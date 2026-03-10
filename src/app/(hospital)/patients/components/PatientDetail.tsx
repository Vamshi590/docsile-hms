"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { CalendarDays, Plus, MoveRight, X, Loader2 } from "lucide-react"
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
  patientId: string
  onBack: () => void
  onUpdate: () => void
}

export function PatientDetail({ patientId, onBack, onUpdate }: Props) {
  const [patient, setPatient] = useState<Awaited<ReturnType<typeof getPatientById>> | null>(null)
  const [loading, setLoading] = useState(true)

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
    setLoading(true)
    Promise.all([
      getPatientById(patientId),
      getServiceTemplates(),
    ]).then(([p, templates]) => {
      setPatient(p)
      setServiceTemplates(templates)
      setLoading(false)
    })
  }, [patientId])

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

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-muted rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-64 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Patient not found.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
              {getInitials(`${patient.firstName} ${patient.lastName ?? ""}`)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold text-foreground leading-tight">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{patient.patientId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            {patient.phone && <span>{patient.phone}</span>}
            <span>
              {patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"} yrs · {patient.gender}
            </span>
            {patient.doctorName && <span>{patient.doctorName}</span>}
          </div>
          {(() => {
            const totalDue = patient.prescriptions?.reduce((sum, p) => sum + (p.balanceDue ?? 0), 0) ?? 0
            return totalDue > 0 ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1.5">
                <span className="text-xs font-medium text-destructive/70">Due</span>
                <span className="text-sm font-bold text-destructive">{formatCurrency(totalDue)}</span>
              </div>
            ) : patient.prescriptions && patient.prescriptions.some(p => p.total > 0) ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5">
                <span className="text-xs font-medium text-green-600">No Dues</span>
              </div>
            ) : null
          })()}
          <PatientStatusBadge status={patient.status as PatientStatus} />
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: Info / Receipts / History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border overflow-hidden">
          <Tabs defaultValue="info">
            <div className="border-b border-border px-4 pt-3">
              <TabsList className="h-9 bg-transparent p-0 gap-1">
                {["info", "receipts", "history"].map(t => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="h-8 rounded-md capitalize text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Info tab */}
            <TabsContent value="info" className="p-5 space-y-5 mt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
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
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {patient.address && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                  <p className="text-sm">{patient.address}</p>
                </div>
              )}
            </TabsContent>

            {/* Receipts tab */}
            <TabsContent value="receipts" className="p-5 space-y-3 mt-0">
              {patient.prescriptions && patient.prescriptions.filter(p => p.total > 0).length > 0 ? (
                patient.prescriptions.filter(p => p.total > 0).map(prescription => (
                  <div key={prescription.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 flex justify-between items-center border-b border-border">
                      <span className="text-xs font-mono font-medium">
                        {prescription.prescriptionNumber ?? "—"}
                      </span>
                      <span className={`text-xs font-medium ${prescription.balanceDue > 0 ? "text-destructive" : "text-green-600"}`}>
                        {prescription.balanceDue > 0 ? `Due: ${formatCurrency(prescription.balanceDue)}` : "Paid"}
                      </span>
                    </div>
                    <div className="p-4 space-y-1.5">
                      {prescription.items && prescription.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.description}</span>
                          <span className="text-muted-foreground">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <Separator className="my-2" />
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
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No receipts yet
                </div>
              )}
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="p-5 space-y-3 mt-0">
              {patient.prescriptions && patient.prescriptions.length > 0 ? (
                <div className="space-y-3">
                  {patient.prescriptions.map(p => (
                    <div key={p.id} className="flex items-start gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0 mt-1.5" />
                      <div>
                        <span className="font-medium text-foreground">{p.status}</span>
                        <span className="text-muted-foreground ml-2">{formatDate(p.prescriptionDate)}</span>
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
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No history
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">

          {/* Add Services */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Add Services
              </p>
              {!showAddService && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowAddService(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            </div>

            {!showAddService ? (
              <p className="text-xs text-muted-foreground">Click Add to create a new service receipt.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
                  {serviceTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => addService(t)}
                      className="text-left rounded-lg border border-border bg-gray-50 px-3 py-2 hover:border-primary hover:bg-primary/5 transition-all text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-muted-foreground">{formatCurrency(t.amount)}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {addedServices.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      {addedServices.map(s => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-xs">{s.description}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-medium">{formatCurrency(s.amount)}</span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setAddedServices(prev => prev.filter(x => x.id !== s.id))}
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
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
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 text-xs" onClick={handleAddServices} disabled={submitting}>
                          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                          Save Receipt
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => { setShowAddService(false); setAddedServices([]); setAmountPaid(0); setDiscount(0) }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {addedServices.length === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowAddService(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Move Appointment */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Move Appointment
              </p>
              {!showMoveDate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowMoveDate(true)}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Move
                </Button>
              )}
            </div>

            {!showMoveDate ? (
              <p className="text-xs text-muted-foreground">
                Currently: {formatDate(patient.appointmentDate)}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs">{formatDate(patient.appointmentDate)}</span>
                  <MoveRight className="h-3.5 w-3.5 shrink-0" />
                  <Input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Textarea
                  value={moveReason}
                  onChange={e => setMoveReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="h-14 text-xs resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 text-xs" onClick={handleMoveDate} disabled={submitting}>
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Confirm Move
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => { setShowMoveDate(false); setNewDate(""); setMoveReason("") }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
