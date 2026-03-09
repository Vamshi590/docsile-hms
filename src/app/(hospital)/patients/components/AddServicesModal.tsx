"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Plus, X, Calendar, Clock, Search, Check } from "lucide-react"
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
  const [serviceSearch, setServiceSearch] = useState("")
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
    setServiceSearch("")
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
    if (selectedServices.find(s => s.description === template.name)) {
      removeService(template.id)
      return
    }
    setSelectedServices(prev => [...prev, {
      id: template.id,
      description: template.name,
      category: template.category,
      quantity: 1,
      unitPrice: template.amount,
      amount: template.amount,
    }])
    if (template.discount > 0) {
      setDiscount(prev => prev + template.discount)
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

  const filteredTemplates = serviceTemplates.filter(s => {
    const matchesCategory = selectedCategory === "All" || s.category === selectedCategory
    const matchesSearch = !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

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

              {/* Selected services summary */}
              {selectedServices.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Added ({selectedServices.length})
                    </p>
                    <p className="text-sm font-semibold">{formatCurrency(subtotal)}</p>
                  </div>
                  <div className="space-y-0 divide-y divide-border">
                    {selectedServices.map(service => (
                      <div key={service.id} className="flex items-center justify-between py-2.5 group">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium truncate">{service.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{service.category}</span>
                            {service.quantity > 1 && (
                              <span className="text-xs text-muted-foreground">Qty: {service.quantity}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 border border-transparent group-hover:border-border rounded-md transition-colors">
                            <Input
                              type="number"
                              value={service.quantity}
                              onChange={e => updateService(service.id, "quantity", parseInt(e.target.value) || 1)}
                              className="h-7 w-10 text-center px-0 border-0 shadow-none focus-visible:ring-0 text-xs"
                              min={1}
                            />
                            <span className="text-muted-foreground text-xs px-0.5">x</span>
                            <Input
                              type="number"
                              value={service.unitPrice}
                              onChange={e => updateService(service.id, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="h-7 w-16 text-right px-1 border-0 shadow-none focus-visible:ring-0 text-xs"
                            />
                          </div>
                          <span className="text-sm font-semibold w-20 text-right tabular-nums">
                            {formatCurrency(service.amount)}
                          </span>
                          <button
                            onClick={() => removeService(service.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & filter bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={e => setServiceSearch(e.target.value)}
                    className="pl-8 h-9 bg-gray-50 border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-400"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-36 h-9 bg-gray-50 border-gray-200 text-sm focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service list (compact rows) */}
              {filteredTemplates.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden max-h-52 overflow-y-auto">
                  {filteredTemplates.map((template, i) => {
                    const isSelected = selectedServices.some(s => s.description === template.name)
                    return (
                      <button
                        key={template.id}
                        onClick={() => addService(template)}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors",
                          i > 0 && "border-t border-gray-100",
                          isSelected
                            ? "bg-primary/5"
                            : "hover:bg-white"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn(
                            "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "border-primary bg-primary" : "border-gray-300"
                          )}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className={cn("text-sm truncate", isSelected ? "font-medium text-primary" : "text-foreground")}>
                            {template.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">{template.category}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                          <span className="text-sm font-medium tabular-nums">{formatCurrency(template.amount)}</span>
                          {template.discount > 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                              -{formatCurrency(template.discount)}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No services found.{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => { setSelectedCategory("All"); setServiceSearch("") }}
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {/* Add custom service (inline) */}
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add custom service
                </button>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Service name"
                      value={customService.name}
                      onChange={e => setCustomService(prev => ({ ...prev, name: e.target.value }))}
                      className="flex-1 h-8 text-sm bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                      autoFocus
                    />
                    <Select
                      value={customService.category}
                      onValueChange={v => setCustomService(prev => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger className="w-32 h-8 text-sm bg-white focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter(c => c !== "All").map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="₹ Amount"
                      value={customService.amount}
                      onChange={e => setCustomService(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-24 h-8 text-sm bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                    />
                    <Button size="sm" className="h-8 px-3" onClick={addCustomService}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowCustom(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment section (only when services selected) */}
              {selectedServices.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  {/* Totals */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <Input
                        type="number"
                        value={discount}
                        onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                        className="h-7 w-24 text-right text-sm bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none tabular-nums"
                        min={0}
                        max={subtotal}
                      />
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment inputs — single clean row */}
                  <div className="flex items-end gap-3">
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">Mode</Label>
                      <Select value={paymentMode} onValueChange={setPaymentMode}>
                        <SelectTrigger className="h-8 text-sm bg-white border-gray-200 focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_MODES.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">Received</Label>
                      <Input
                        type="number"
                        value={amountPaid}
                        onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none tabular-nums"
                        min={0}
                        max={total}
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">Balance</Label>
                      <div className={cn(
                        "h-8 flex items-center justify-end px-3 rounded-md text-sm font-medium tabular-nums bg-white border border-gray-200",
                        balanceDue > 0 ? "text-destructive" : "text-foreground"
                      )}>
                        {formatCurrency(balanceDue)}
                      </div>
                    </div>
                  </div>
                </div>
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
