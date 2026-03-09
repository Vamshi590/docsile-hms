"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Check, ChevronRight, Loader2, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { cn, calculateAge, formatCurrency, todayISO } from "@/lib/utils"
import { EditableComboboxWithAdd } from "@/components/ui/combobox"
import {
  createPatient,
  updatePatientInfo,
  createPrescriptionWithBilling,
  getNextPatientId,
  getServiceTemplates,
  getDropdownOptions,
  addDropdownOption,
} from "../actions"

type ServiceItem = {
  id: string
  description: string
  category: string
  quantity: number
  unitPrice: number
  amount: number
}

type PatientFormData = {
  patientId: string
  fullName: string
  dateOfBirth: string
  age: string
  gender: string
  phone: string
  email: string
  address: string
  guardianName: string
  referredBy: string
  doctorName: string
  department: string
  appointmentDate: string
  notes: string
}

type ServiceTemplate = {
  id: string
  name: string
  category: string
  amount: number
  discount: number
}

const STEPS = [
  { num: 1, label: "Patient Info" },
  { num: 2, label: "Services & Payment" },
  { num: 3, label: "Review" },
]

const CATEGORIES = ["All", "Consultation", "Diagnostic", "Procedure", "Medicine", "Other"]
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Online", "NEFT"]

type EditPatientData = {
  patientId: string
  firstName: string
  lastName?: string | null
  dateOfBirth?: Date | string | null
  age?: number | null
  gender: string
  phone: string
  email?: string | null
  address?: string | null
  guardianName?: string | null
  referredBy?: string | null
  doctorName?: string | null
  department?: string | null
  appointmentDate: Date | string
  notes?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  patientType: "OPD" | "IPD"
  onSuccess: () => void
  editPatient?: EditPatientData | null
}

export function PatientRegistrationStepper({ open, onClose, patientType, onSuccess, editPatient }: Props) {
  const isEditMode = !!editPatient
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [savingPatient, setSavingPatient] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Tracks the patient created at Step 1
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null)

  const [patientData, setPatientData] = useState<PatientFormData>({
    patientId: "",
    fullName: "", dateOfBirth: "", age: "",
    gender: "", phone: "", email: "", address: "",
    guardianName: "", referredBy: "",
    doctorName: "", department: "", appointmentDate: todayISO(), notes: "",
  })

  const [doctorOptions, setDoctorOptions] = useState<string[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])
  const [referredByOptions, setReferredByOptions] = useState<string[]>([])

  const [fieldDefaults, setFieldDefaults] = useState({ doctorName: "", department: "", referredBy: "" })

  // Load persisted defaults on mount
  useEffect(() => {
    setFieldDefaults({
      doctorName: localStorage.getItem("docsile_default_doctorName") ?? "",
      department: localStorage.getItem("docsile_default_department") ?? "",
      referredBy: localStorage.getItem("docsile_default_referredBy") ?? "",
    })
  }, [])

  function toggleDefault(field: "doctorName" | "department" | "referredBy", value: string) {
    if (fieldDefaults[field] === value) {
      localStorage.removeItem(`docsile_default_${field}`)
      setFieldDefaults(prev => ({ ...prev, [field]: "" }))
      toast.success("Default cleared")
    } else {
      localStorage.setItem(`docsile_default_${field}`, value)
      setFieldDefaults(prev => ({ ...prev, [field]: value }))
      toast.success(`"${value}" set as default`)
    }
  }

  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([])
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [serviceSearch, setServiceSearch] = useState("")
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([])
  const [showCustom, setShowCustom] = useState(false)
  const [customService, setCustomService] = useState({ name: "", category: "Consultation", amount: "" })

  const [paymentMode, setPaymentMode] = useState("Cash")
  const [discount, setDiscount] = useState(0)
  const [amountPaid, setAmountPaid] = useState(0)
  const [paymentNotes, setPaymentNotes] = useState("")

  const subtotal = selectedServices.reduce((s, item) => s + item.amount, 0)
  const total = subtotal - discount
  const balanceDue = total - amountPaid

  // Auto-set amount paid to total
  useEffect(() => {
    if (total >= 0) setAmountPaid(total)
  }, [total])

  // Load data when modal opens
  useEffect(() => {
    if (!open) return
    setStep(1)
    setCreatedPatientId(isEditMode ? editPatient.patientId : null)
    setSelectedServices([])
    setDiscount(0)
    setAmountPaid(0)
    setPaymentNotes("")
    setSelectedCategory("All")

    async function load() {
      setLoading(true)

      if (isEditMode) {
        // Edit mode: load dropdown options only (no next ID needed)
        const [doctors, departments, referrals] = await Promise.all([
          getDropdownOptions("doctorName"),
          getDropdownOptions("department"),
          getDropdownOptions("referredBy"),
        ])

        const fullName = [editPatient.firstName, editPatient.lastName].filter(Boolean).join(" ")
        // Use local date methods to avoid UTC timezone shift (toISOString converts to UTC, which can shift the date back by a day)
        function toLocalDateString(d: Date | string): string {
          const date = typeof d === "string" ? new Date(d) : d
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        }
        const dob = editPatient.dateOfBirth
          ? toLocalDateString(editPatient.dateOfBirth)
          : ""
        const apptDate = toLocalDateString(editPatient.appointmentDate)

        setPatientData({
          patientId: editPatient.patientId,
          fullName,
          dateOfBirth: dob,
          age: editPatient.age != null ? String(editPatient.age) : "",
          gender: editPatient.gender || "",
          phone: editPatient.phone || "",
          email: editPatient.email ?? "",
          address: editPatient.address ?? "",
          guardianName: editPatient.guardianName ?? "",
          referredBy: editPatient.referredBy ?? "",
          doctorName: editPatient.doctorName ?? "",
          department: editPatient.department ?? "",
          appointmentDate: apptDate,
          notes: editPatient.notes ?? "",
        })

        setDoctorOptions(doctors)
        setDepartmentOptions(departments)
        setReferredByOptions(referrals)
        setLoading(false)
      } else {
        // Register mode
        const [nextId, templates, doctors, departments, referrals] = await Promise.all([
          getNextPatientId(patientType),
          getServiceTemplates(),
          getDropdownOptions("doctorName"),
          getDropdownOptions("department"),
          getDropdownOptions("referredBy"),
        ])
        const savedDoctorDefault = localStorage.getItem("docsile_default_doctorName") ?? ""
        const savedDeptDefault = localStorage.getItem("docsile_default_department") ?? ""
        const savedRefDefault = localStorage.getItem("docsile_default_referredBy") ?? ""
        setFieldDefaults({ doctorName: savedDoctorDefault, department: savedDeptDefault, referredBy: savedRefDefault })
        setPatientData(prev => ({
          ...prev,
          patientId: nextId,
          appointmentDate: todayISO(),
          doctorName: savedDoctorDefault,
          department: savedDeptDefault,
          referredBy: savedRefDefault,
        }))
        setServiceTemplates(templates)
        setDoctorOptions(doctors)
        setDepartmentOptions(departments)
        setReferredByOptions(referrals)
        setLoading(false)
      }
    }
    load()
  }, [open, patientType, isEditMode])

  function handleDobChange(dob: string) {
    setPatientData(prev => {
      const age = dob ? String(calculateAge(dob) ?? "") : ""
      return { ...prev, dateOfBirth: dob, age }
    })
  }

  function handleAgeChange(age: string) {
    setPatientData(prev => {
      let dob = prev.dateOfBirth
      if (age) {
        const year = new Date().getFullYear() - parseInt(age)
        if (!isNaN(year)) dob = `${year}-01-01`
      }
      return { ...prev, age, dateOfBirth: dob }
    })
  }

  function validateStep1(): string | null {
    if (!patientData.fullName.trim()) return "Full name is required"
    if (!patientData.gender) return "Gender is required"
    if (!patientData.phone.trim()) return "Phone is required"
    if (patientData.phone.length < 10) return "Enter a valid 10-digit phone number"
    if (!patientData.appointmentDate) return "Appointment date is required"
    return null
  }

  // ── Step 1 Next: create or update the patient record ─────────────────────────
  async function handleStep1Next() {
    const err = validateStep1()
    if (err) { toast.error(err); return }

    const parts = patientData.fullName.trim().split(/\s+/)
    const firstName = parts[0] ?? ""
    const lastName = parts.slice(1).join(" ") || undefined

    const patientPayload = {
      firstName,
      lastName,
      dateOfBirth: patientData.dateOfBirth || undefined,
      age: patientData.age ? parseInt(patientData.age) : undefined,
      gender: patientData.gender as "MALE" | "FEMALE" | "OTHER",
      phone: patientData.phone.trim(),
      email: patientData.email.trim() || undefined,
      address: patientData.address.trim() || undefined,
      guardianName: patientData.guardianName.trim() || undefined,
      referredBy: patientData.referredBy.trim() || undefined,
      doctorName: patientData.doctorName.trim() || undefined,
      department: patientData.department.trim() || undefined,
      patientType,
      appointmentDate: patientData.appointmentDate,
      notes: patientData.notes.trim() || undefined,
    }

    setSavingPatient(true)

    if (isEditMode) {
      // Edit mode — update and close
      const result = await updatePatientInfo(editPatient.patientId, patientPayload)
      setSavingPatient(false)
      if (!result.success) { toast.error(result.error); return }
      toast.success("Patient updated")
      onSuccess()
      onClose()
      return
    }

    if (createdPatientId) {
      // Patient already created — update if user went back and edited
      const result = await updatePatientInfo(createdPatientId, patientPayload)
      setSavingPatient(false)
      if (!result.success) { toast.error(result.error); return }
    } else {
      // First time — create the patient
      const result = await createPatient(patientPayload)
      setSavingPatient(false)
      if (!result.success) { toast.error(result.error); return }
      setCreatedPatientId(result.data.patientId)
      setPatientData(prev => ({ ...prev, patientId: result.data.patientId }))
    }

    setStep(2)
  }

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
    if (template.discount > 0) setDiscount(prev => prev + template.discount)
  }

  function removeService(id: string) {
    const template = serviceTemplates.find(t => t.id === id)
    if (template && template.discount > 0) setDiscount(prev => Math.max(0, prev - template.discount))
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

  // ── Final Submit: create prescription with billing ────────────────────────────
  async function handleSubmit() {
    if (!createdPatientId) { toast.error("Patient not registered yet"); return }
    setSubmitting(true)

    const result = await createPrescriptionWithBilling({
      patientId: createdPatientId,
      billing: {
        paymentMode,
        amountPaid,
        discount,
        services: selectedServices.map(s => ({
          serviceId: s.id.startsWith("custom-") ? undefined : s.id,
          description: s.description,
          category: s.category,
          quantity: s.quantity,
          unitPrice: s.unitPrice,
          amount: s.amount,
        })),
        notes: paymentNotes || undefined,
      },
    })

    setSubmitting(false)

    if (result.success) {
      toast.success(`Patient ${patientData.patientId} registered successfully`)
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>
            {isEditMode ? "Edit" : "Register"} {patientType === "OPD" ? "Out-Patient" : "In-Patient"}
          </DialogTitle>

          {/* Step indicator — hidden in edit mode */}
          {!isEditMode && (
            <div className="flex items-center gap-0 mt-3">
              {STEPS.map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all",
                    step === s.num ? "bg-primary text-white" :
                      step > s.num ? "bg-primary/10 text-primary" :
                        "text-muted-foreground"
                  )}>
                    {step > s.num
                      ? <Check className="h-3 w-3" />
                      : <span>{s.num}</span>
                    }
                    <span className="hidden sm:block">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 mx-1 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Step 1 */}
              {step === 1 && (
                <div className="space-y-6 bg-white">
                  {/* ── Patient Information ── */}
                  <div className="rounded-xl border border-blue-100 bg-gray-50/50 p-4">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-4 px-1">
                      Patient Information
                    </p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.appointmentDate}
                            onChange={e => setPatientData(prev => ({ ...prev, appointmentDate: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Patient ID</Label>
                          <Input value={patientData.patientId} readOnly className="bg-muted font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Name <span className="text-destructive">*</span></Label>
                          <Input
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.fullName}
                            onChange={e => setPatientData(prev => ({ ...prev, fullName: e.target.value }))}
                            placeholder="Full name"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label>Guardian</Label>
                          <Input
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.guardianName}
                            onChange={e => setPatientData(prev => ({ ...prev, guardianName: e.target.value }))}
                            placeholder="Guardian name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Date of Birth</Label>
                          <Input
                            type="date"
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.dateOfBirth}
                            onChange={e => handleDobChange(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Age</Label>
                          <Input
                            type="number"
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.age}
                            onChange={e => handleAgeChange(e.target.value)}
                            placeholder="Age"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label>Gender <span className="text-destructive">*</span></Label>
                          <Select
                            value={patientData.gender}
                            onValueChange={v => setPatientData(prev => ({ ...prev, gender: v }))}
                          >
                            <SelectTrigger className="bg-white focus:ring-1 focus:ring-gray-200 focus:ring-offset-0 focus:outline-none">
                              <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MALE">Male</SelectItem>
                              <SelectItem value="FEMALE">Female</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Phone <span className="text-destructive">*</span></Label>
                          <Input
                            type="tel"
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.phone}
                            onChange={e => setPatientData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="10-digit mobile"
                            maxLength={10}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                            value={patientData.email}
                            onChange={e => setPatientData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@example.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Address</Label>
                        <Input
                          className="bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
                          value={patientData.address}
                          onChange={e => setPatientData(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Patient address"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Doctor Information ── */}
                  <div className="rounded-xl border border-blue-100 bg-gray-50/50 p-4">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-4 px-1">
                      Doctor Information
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Doctor Name</Label>
                        <EditableComboboxWithAdd
                          options={doctorOptions}
                          value={patientData.doctorName}
                          onValueChange={v => setPatientData(prev => ({ ...prev, doctorName: v }))}
                          placeholder="Assigned doctor"
                          defaultValue={fieldDefaults.doctorName}
                          onSetDefault={v => toggleDefault("doctorName", v)}
                          onAddOption={async (val) => {
                            const res = await addDropdownOption("doctorName", val)
                            if (res.success) setDoctorOptions(prev => [...prev, val].sort())
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Department</Label>
                        <EditableComboboxWithAdd
                          options={departmentOptions}
                          value={patientData.department}
                          onValueChange={v => setPatientData(prev => ({ ...prev, department: v }))}
                          placeholder="e.g. Ophthalmology"
                          defaultValue={fieldDefaults.department}
                          onSetDefault={v => toggleDefault("department", v)}
                          onAddOption={async (val) => {
                            const res = await addDropdownOption("department", val)
                            if (res.success) setDepartmentOptions(prev => [...prev, val].sort())
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Referred By</Label>
                        <EditableComboboxWithAdd
                          options={referredByOptions}
                          value={patientData.referredBy}
                          onValueChange={v => setPatientData(prev => ({ ...prev, referredBy: v }))}
                          placeholder="Self / Doctor name"
                          defaultValue={fieldDefaults.referredBy}
                          onSetDefault={v => toggleDefault("referredBy", v)}
                          onAddOption={async (val) => {
                            const res = await addDropdownOption("referredBy", val)
                            if (res.success) setReferredByOptions(prev => [...prev, val].sort())
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Services & Payment */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* ── Selected services (shown at top as clean list) ── */}
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

                  {/* ── Search & filter bar ── */}
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

                  {/* ── Service list (compact rows) ── */}
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

                  {/* ── Add custom service (inline) ── */}
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

                  {/* ── Payment section (only when services selected) ── */}
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
              )}

              {/* Step 3 Review */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 bg-surface border-b border-border flex justify-between items-center">
                      <h3 className="text-sm font-semibold">Patient Information</h3>
                      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setStep(1)}>Edit</Button>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
                      {[
                        ["Patient ID", patientData.patientId],
                        ["Name", patientData.fullName.trim()],
                        ["Age / Gender", `${patientData.age || "—"} / ${patientData.gender}`],
                        ["Phone", patientData.phone],
                        ["Doctor", patientData.doctorName || "—"],
                        ["Appointment", patientData.appointmentDate],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <span className="text-muted-foreground">{label}: </span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 bg-surface border-b border-border flex justify-between items-center">
                      <h3 className="text-sm font-semibold">Services & Payment</h3>
                      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setStep(2)}>Edit</Button>
                    </div>
                    <div className="p-4 space-y-1">
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between text-sm">
                          <span>{s.description} <span className="text-muted-foreground">×{s.quantity}</span></span>
                          <span className="font-medium">{formatCurrency(s.amount)}</span>
                        </div>
                      ))}
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="text-right font-medium">{formatCurrency(subtotal)}</span>
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="text-right font-medium">{formatCurrency(discount)}</span>
                        <span className="font-semibold">Total:</span>
                        <span className="text-right font-semibold">{formatCurrency(total)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Payment Mode:</span>
                        <span className="text-right font-medium">{paymentMode}</span>
                        <span className="text-muted-foreground">Amount Received:</span>
                        <span className="text-right font-medium">{formatCurrency(amountPaid)}</span>
                        <span className="text-muted-foreground">Balance Due:</span>
                        <span className={cn("text-right font-medium", balanceDue > 0 ? "text-destructive" : "text-foreground")}>
                          {formatCurrency(balanceDue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          {!isEditMode && step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {isEditMode ? (
            <Button onClick={handleStep1Next} disabled={savingPatient}>
              {savingPatient && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingPatient ? "Saving..." : "Save Changes"}
            </Button>
          ) : step === 1 ? (
            <Button onClick={handleStep1Next} disabled={savingPatient}>
              {savingPatient
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ChevronRight className="h-4 w-4" />
              }
              {savingPatient ? "Saving..." : "Next"}
            </Button>
          ) : step === 2 ? (
            <Button
              onClick={() => {
                if (selectedServices.length === 0) {
                  toast.error("Add at least one service"); return
                }
                setStep(3)
              }}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Register Patient
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
