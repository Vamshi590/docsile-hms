"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Check, ChevronRight, Loader2, Plus, Printer, Search, X } from "lucide-react"
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
import { getHospitalProfile } from "../../settings/actions"

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
  { num: 3, label: "Receipt" },
]

type ReceiptData = {
  prescriptionNumber: string | null
  patientId: string
  patientName: string
  patientType: string
  age: string
  gender: string
  doctorName: string
  appointmentDate: string
  services: ServiceItem[]
  subtotal: number
  discount: number
  total: number
  amountPaid: number
  balanceDue: number
  paymentMode: string
}

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

  // Receipt data (step 3)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [hospitalProfile, setHospitalProfile] = useState<Awaited<ReturnType<typeof getHospitalProfile>>>(null)

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
    setReceiptData(null)
    getHospitalProfile().then(setHospitalProfile)

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

  // ── Register: create prescription with billing then show receipt ─────────────
  async function handleRegister() {
    if (selectedServices.length === 0) { toast.error("Add at least one service"); return }
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
      setReceiptData({
        prescriptionNumber: result.data.prescriptionNumber,
        patientId: patientData.patientId,
        patientName: patientData.fullName.trim(),
        patientType,
        age: patientData.age,
        gender: patientData.gender,
        doctorName: patientData.doctorName,
        appointmentDate: patientData.appointmentDate,
        services: selectedServices,
        subtotal,
        discount,
        total,
        amountPaid,
        balanceDue,
        paymentMode,
      })
      onSuccess()
      setStep(3)
    } else {
      toast.error(result.error)
    }
  }

  function handlePrintReceipt() {
    if (!receiptData) return
    const hosp = hospitalProfile
    const hospName = hosp?.displayName || hosp?.name || "Hospital"
    const hospPhone = hosp?.phone ?? ""

    const rows = receiptData.services.map(s => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${s.description}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${s.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">₹${s.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">₹${s.amount.toFixed(2)}</td>
      </tr>`).join("")

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Receipt ${receiptData.prescriptionNumber ?? ""}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; max-width: 520px; margin: auto; }
        .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 14px; }
        .header h1 { font-size: 20px; font-weight: 700; }
        .header p { font-size: 11px; color: #555; margin-top: 2px; }
        .receipt-meta { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 12px; }
        .patient-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
        .patient-box .row { display: flex; gap: 24px; margin-bottom: 2px; }
        .patient-box .lbl { color: #888; min-width: 80px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        thead tr { background: #f2f2f2; }
        thead th { padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
        thead th:nth-child(2) { text-align: center; }
        thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
        .totals { width: 220px; margin-left: auto; }
        .totals tr td { padding: 3px 6px; font-size: 13px; }
        .totals tr td:last-child { text-align: right; font-weight: 500; }
        .totals .total-row td { font-weight: 700; font-size: 14px; border-top: 1.5px solid #111; padding-top: 6px; }
        .payment-row td { color: #555; }
        .balance-row td { color: ${receiptData.balanceDue > 0 ? "#d00" : "#080"}; font-weight: 600; }
        .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 11px; color: #888; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>
      <div class="header">
        <h1>${hospName}</h1>
        ${hospPhone ? `<p>Phone: ${hospPhone}</p>` : ""}
        <p style="margin-top:6px;font-size:13px;font-weight:600;letter-spacing:.5px">CASH RECEIPT</p>
      </div>
      <div class="receipt-meta">
        <span><strong>Receipt #:</strong> ${receiptData.prescriptionNumber ?? "—"}</span>
        <span><strong>Date:</strong> ${receiptData.appointmentDate}</span>
      </div>
      <div class="patient-box">
        <div class="row"><span class="lbl">Patient ID</span><span>${receiptData.patientId}</span></div>
        <div class="row"><span class="lbl">Name</span><span>${receiptData.patientName}</span></div>
        <div class="row">
          <span class="lbl">Age / Gender</span><span>${receiptData.age || "—"} / ${receiptData.gender}</span>
          ${receiptData.doctorName ? `<span class="lbl" style="margin-left:16px">Doctor</span><span>${receiptData.doctorName}</span>` : ""}
        </div>
        <div class="row"><span class="lbl">Type</span><span>${receiptData.patientType}</span></div>
      </div>
      <table>
        <thead><tr>
          <th>Service</th><th>Qty</th><th>Rate</th><th>Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="totals">
        <tr><td>Subtotal</td><td>₹${receiptData.subtotal.toFixed(2)}</td></tr>
        ${receiptData.discount > 0 ? `<tr><td>Discount</td><td>- ₹${receiptData.discount.toFixed(2)}</td></tr>` : ""}
        <tr class="total-row"><td>Total</td><td>₹${receiptData.total.toFixed(2)}</td></tr>
        <tr class="payment-row"><td>${receiptData.paymentMode} Received</td><td>₹${receiptData.amountPaid.toFixed(2)}</td></tr>
        <tr class="balance-row"><td>Balance Due</td><td>₹${receiptData.balanceDue.toFixed(2)}</td></tr>
      </table>
      <div class="footer">Thank you for visiting ${hospName}</div>
    </body></html>`

    const w = window.open("", "_blank", "width=600,height=700")
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  const filteredTemplates = serviceTemplates.filter(s => {
    const matchesCategory = selectedCategory === "All" || s.category === selectedCategory
    const matchesSearch = !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-2">
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

              {/* Step 3 — Receipt */}
              {step === 3 && receiptData && (
                <div className="space-y-0">
                  {/* Receipt card */}
                  <div className="rounded-xl border border-border bg-white overflow-hidden">
                    {/* Receipt header */}
                    <div className="bg-muted/40 border-b px-5 py-4 text-center">
                      <p className="text-base font-bold tracking-wide">
                        {hospitalProfile?.displayName || hospitalProfile?.name || "Hospital"}
                      </p>
                      {hospitalProfile?.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5">{hospitalProfile.phone}</p>
                      )}
                      <p className="text-xs font-semibold uppercase tracking-widest mt-2 text-primary">Cash Receipt</p>
                    </div>

                    {/* Receipt meta */}
                    <div className="flex justify-between px-5 py-3 border-b text-xs text-muted-foreground">
                      <span>Receipt # <span className="font-medium text-foreground">{receiptData.prescriptionNumber ?? "—"}</span></span>
                      <span>Date: <span className="font-medium text-foreground">{receiptData.appointmentDate}</span></span>
                    </div>

                    {/* Patient info */}
                    <div className="px-5 py-3 border-b bg-muted/20">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        {[
                          ["Patient ID", receiptData.patientId],
                          ["Name", receiptData.patientName],
                          ["Age / Gender", `${receiptData.age || "—"} / ${receiptData.gender}`],
                          ["Type", receiptData.patientType],
                          ...(receiptData.doctorName ? [["Doctor", receiptData.doctorName]] : []),
                        ].map(([lbl, val]) => (
                          <div key={lbl} className="flex gap-1.5">
                            <span className="text-muted-foreground min-w-[72px]">{lbl}</span>
                            <span className="font-medium">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Services */}
                    <div className="px-5 py-3 border-b">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b pb-1">
                            <th className="text-left pb-2 font-medium">Service</th>
                            <th className="text-center pb-2 font-medium w-10">Qty</th>
                            <th className="text-right pb-2 font-medium w-20">Rate</th>
                            <th className="text-right pb-2 font-medium w-20">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiptData.services.map(s => (
                            <tr key={s.id} className="border-b border-dashed border-border/50 last:border-0">
                              <td className="py-1.5">{s.description}</td>
                              <td className="py-1.5 text-center text-muted-foreground">{s.quantity}</td>
                              <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(s.unitPrice)}</td>
                              <td className="py-1.5 text-right font-medium">{formatCurrency(s.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="px-5 py-3 border-b">
                      <div className="ml-auto w-52 space-y-1 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span><span>{formatCurrency(receiptData.subtotal)}</span>
                        </div>
                        {receiptData.discount > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Discount</span><span>- {formatCurrency(receiptData.discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-base border-t pt-1.5 mt-1">
                          <span>Total</span><span>{formatCurrency(receiptData.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="px-5 py-3">
                      <div className="ml-auto w-52 space-y-1 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>{receiptData.paymentMode} Received</span>
                          <span className="text-foreground font-medium">{formatCurrency(receiptData.amountPaid)}</span>
                        </div>
                        <div className={cn(
                          "flex justify-between font-semibold",
                          receiptData.balanceDue > 0 ? "text-destructive" : "text-green-600"
                        )}>
                          <span>Balance Due</span><span>{formatCurrency(receiptData.balanceDue)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-xs text-muted-foreground pt-3">
                    Patient registered successfully · {receiptData.prescriptionNumber}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t bg-muted/20">
          <div className="flex items-center justify-between w-full">
            {step < 3 ? (
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
                Cancel
              </Button>
            ) : (
              <div /> /* spacer */
            )}
            <div className="flex items-center gap-2">
              {!isEditMode && step > 1 && step < 3 && (
                <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                  Back
                </Button>
              )}
              {isEditMode ? (
                <Button size="sm" onClick={handleStep1Next} disabled={savingPatient}>
                  {savingPatient && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {savingPatient ? "Saving..." : "Save Changes"}
                </Button>
              ) : step === 1 ? (
                <Button size="sm" onClick={handleStep1Next} disabled={savingPatient}>
                  {savingPatient && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {savingPatient ? "Saving..." : "Next"}
                  {!savingPatient && <ChevronRight className="h-3.5 w-3.5 ml-1" />}
                </Button>
              ) : step === 2 ? (
                <Button size="sm" onClick={handleRegister} disabled={submitting}>
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {submitting ? "Registering..." : "Confirm & Register"}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                  </Button>
                  <Button size="sm" onClick={onClose}>
                    Done
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
