"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Plus, X, Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { getPatientWithLastVisit, getServiceTemplates, addServiceToPatient } from "../actions"

type ServiceItem = {
  id: string
  description: string
  category: string
  quantity: number
  unitPrice: number
  amount: number
}

type ServiceTemplate = {
  id: string
  name: string
  category: string
  amount: number
  discount: number
}

type PatientInfo = Awaited<ReturnType<typeof getPatientWithLastVisit>>

const CATEGORIES = ["All", "Consultation", "Diagnostic", "Procedure", "Medicine", "Other"]
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Online", "NEFT"]

interface Props {
  patientId: string | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddServicesModal({ patientId, open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [patient, setPatient] = useState<PatientInfo>(null)

  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([])
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([])
  const [showCustom, setShowCustom] = useState(false)
  const [customService, setCustomService] = useState({ name: "", category: "Consultation", amount: "" })

  const [paymentMode, setPaymentMode] = useState("Cash")
  const [discount, setDiscount] = useState(0)
  const [amountPaid, setAmountPaid] = useState(0)

  const subtotal = selectedServices.reduce((s, item) => s + item.amount, 0)
  const total = subtotal - discount
  const balanceDue = total - amountPaid

  // Auto-set amount paid to total when total changes
  useEffect(() => {
    if (total >= 0) {
      setAmountPaid(total)
    }
  }, [total])

  // Load patient and templates when modal opens
  useEffect(() => {
    if (!open || !patientId) return

    setSelectedServices([])
    setDiscount(0)
    setAmountPaid(0)
    setSelectedCategory("All")
    setShowCustom(false)

    async function load() {
      setLoading(true)
      const [patientData, templates] = await Promise.all([
        getPatientWithLastVisit(patientId!),
        getServiceTemplates(),
      ])
      setPatient(patientData)
      setServiceTemplates(templates.map(t => ({ ...t, discount: (t as any).discount ?? 0 })) as ServiceTemplate[])
      setLoading(false)
    }
    load()
  }, [open, patientId])

  function addService(template: ServiceTemplate) {
    const exists = selectedServices.find(s => s.description === template.name)
    if (exists) return
    const serviceDiscount = template.discount || 0
    setSelectedServices(prev => [...prev, {
      id: template.id,
      description: template.name,
      category: template.category,
      quantity: 1,
      unitPrice: template.amount,
      amount: template.amount,
    }])
    if (serviceDiscount > 0) {
      setDiscount(prev => prev + serviceDiscount)
    }
  }

  function removeService(id: string) {
    const template = serviceTemplates.find(t => t.id === id)
    if (template && template.discount > 0) {
      setDiscount(prev => Math.max(0, prev - template.discount))
    }
    setSelectedServices(prev => prev.filter(s => s.id !== id))
  }

  function updateService(id: string, field: "quantity" | "unitPrice", value: number) {
    setSelectedServices(prev => prev.map(s => {
      if (s.id !== id) return s
      const qty = field === "quantity" ? value : s.quantity
      const price = field === "unitPrice" ? value : s.unitPrice
      return { ...s, [field]: value, amount: qty * price }
    }))
  }

  function addCustomService() {
    if (!customService.name.trim() || !customService.amount) return
    setSelectedServices(prev => [...prev, {
      id: `custom-${Date.now()}`,
      description: customService.name.trim(),
      category: customService.category,
      quantity: 1,
      unitPrice: parseFloat(customService.amount),
      amount: parseFloat(customService.amount),
    }])
    setCustomService({ name: "", category: "Consultation", amount: "" })
    setShowCustom(false)
  }

  async function handleSubmit() {
    if (!patient || selectedServices.length === 0) {
      toast.error("Please add at least one service")
      return
    }

    setSubmitting(true)
    const result = await addServiceToPatient({
      patientId: patient.patientId,
      services: selectedServices.map(s => ({
        serviceId: s.id.startsWith("custom-") ? undefined : s.id,
        description: s.description,
        category: s.category,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.amount,
      })),
      paymentMode,
      amountPaid,
      discount,
    })
    setSubmitting(false)

    if (result.success) {
      toast.success("Services added successfully")
      onSuccess()
      onClose()
    } else {
      toast.error(result.error)
    }
  }

  const filteredTemplates = selectedCategory === "All"
    ? serviceTemplates
    : serviceTemplates.filter(s => s.category === selectedCategory)

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Add Services to Existing Patient</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : patient ? (
            <div className="space-y-5">
              {/* Patient Info Card */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {patient.patientId}
                      </span>
                      <span className="text-base font-semibold text-foreground">
                        {patient.fullName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                      <span>{patient.phone}</span>
                      <span>{patient.age ? `${patient.age}Y` : ""} {patient.gender}</span>
                    </div>
                  </div>
                  <div className="text-right bg-white rounded-lg px-3 py-2 border border-blue-100">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Last Visit</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {formatDate(patient.lastVisitDate)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{patient.daysSinceLastVisit} days ago</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={selectedCategory === cat ? "default" : "ghost"}
                    onClick={() => setSelectedCategory(cat)}
                    className="rounded-full text-xs h-7 px-3"
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              {/* Service grid */}
              {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {filteredTemplates.map(template => {
                    const isSelected = selectedServices.some(s => s.description === template.name)
                    return (
                      <button
                        key={template.id}
                        onClick={() => addService(template)}
                        className={cn(
                          "flex items-start justify-between rounded-xl p-3 border text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-white hover:border-primary/40 hover:bg-surface"
                        )}
                      >
                        <div>
                          <p className={cn("text-sm font-medium", isSelected ? "text-primary" : "text-foreground")}>
                            {template.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{template.category}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(template.amount)}
                          </span>
                          {template.discount > 0 && (
                            <p className="text-xs text-green-600">-{formatCurrency(template.discount)} off</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No services in this category.{" "}
                  <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setSelectedCategory("All")}>
                    Show all
                  </Button>
                </div>
              )}

              {/* Add custom service */}
              {!showCustom ? (
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm gap-1"
                  onClick={() => setShowCustom(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add custom service
                </Button>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-surface p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Service name"
                      value={customService.name}
                      onChange={e => setCustomService(prev => ({ ...prev, name: e.target.value }))}
                      className="focus-visible:ring-1 focus-visible:ring-gray-200"
                    />
                    <Select
                      value={customService.category}
                      onValueChange={v => setCustomService(prev => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter(c => c !== "All").map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={customService.amount}
                      onChange={e => setCustomService(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-36"
                    />
                    <Button size="sm" onClick={addCustomService}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Selected services & Payment */}
              {selectedServices.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Selected Services
                    </p>
                    <div className="space-y-1.5">
                      {selectedServices.map(service => (
                        <div key={service.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{service.description}</p>
                            <p className="text-xs text-muted-foreground">{service.category}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="number"
                              value={service.quantity}
                              onChange={e => updateService(service.id, "quantity", parseInt(e.target.value) || 1)}
                              className="h-7 w-12 text-center px-1"
                              min={1}
                            />
                            <span className="text-muted-foreground text-xs">x</span>
                            <Input
                              type="number"
                              value={service.unitPrice}
                              onChange={e => updateService(service.id, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="h-7 w-20 text-right px-2"
                            />
                            <span className="text-sm font-medium w-16 text-right">
                              {formatCurrency(service.amount)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeService(service.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
                      Payment Details
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <Input
                        type="number"
                        value={discount}
                        onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                        className="h-7 w-24 text-right bg-white"
                        min={0}
                        max={subtotal}
                      />
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Payment Mode</Label>
                        <Select value={paymentMode} onValueChange={setPaymentMode}>
                          <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_MODES.map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Amount Received</Label>
                        <Input
                          type="number"
                          value={amountPaid}
                          onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm bg-white"
                          min={0}
                          max={total}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Balance Due</Label>
                        <Input
                          value={formatCurrency(balanceDue)}
                          readOnly
                          className={cn("h-8 text-sm bg-muted", balanceDue > 0 ? "text-destructive font-medium" : "text-foreground")}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Patient not found
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || selectedServices.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add Services
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
