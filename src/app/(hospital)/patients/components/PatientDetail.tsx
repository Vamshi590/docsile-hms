"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  CalendarDays, Plus, MoveRight, X, Loader2, Printer, Phone, User,
  Stethoscope, Building2, UserCheck, MapPin, Clock, Eye, FileText,
  Receipt, ChevronDown, ChevronUp, BadgeIndianRupee, CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { PatientStatusBadge } from "./PatientStatusBadge"
import { CashReceipt } from "@/components/receipts/CashReceipt"
import { PrescriptionReceipt } from "@/components/receipts/PrescriptionReceipt"
import { ReadingsReceipt } from "@/components/receipts/ReadingsReceipt"
import { ClinicalFindingsReceipt } from "@/components/receipts/ClinicalFindingsReceipt"
import { ReadingsAndFindings } from "@/components/receipts/ReadingsAndFindings"
import { formatDate, formatCurrency, calculateAge, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  updatePatientStatus,
  movePatientToDate,
  addServiceToPatient,
  getPatientById,
  getServiceTemplates,
  getPatientReceiptData,
} from "../actions"
import type { PatientStatus } from "@/lib/types"

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Online", "NEFT"]

const TAB_CLASS =
  "rounded-none px-3 py-2 text-xs font-medium border-b-2 border-transparent " +
  "text-muted-foreground hover:text-foreground transition-colors " +
  "data-[state=active]:border-primary data-[state=active]:text-primary " +
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"

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

  // Print modal state
  const [printOpen, setPrintOpen] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)
  const [receiptData, setReceiptData] = useState<Awaited<ReturnType<typeof getPatientReceiptData>> | null>(null)
  const [printTab, setPrintTab] = useState("cash")
  const [readingsSubTab, setReadingsSubTab] = useState<"readings" | "clinical" | "both">("both")
  const printRef = useRef<HTMLDivElement>(null)

  // Existing services expand
  const [expandedPrescriptionId, setExpandedPrescriptionId] = useState<string | null>(null)

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
      setPatient((prev: any) => prev ? { ...prev, status } : prev)
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

  async function openPrintModal() {
    if (!patient) return
    setPrintOpen(true)
    setPrintLoading(true)
    const data = await getPatientReceiptData(patient.patientId)
    setReceiptData(data)
    setPrintLoading(false)
  }

  function handlePrint() {
    if (!printRef.current || !patient) return
    const content = printRef.current.innerHTML
    const patientName = `${patient.firstName} ${patient.lastName ?? ""}`.trim()

    const printWindow = window.open("", "_blank", "width=800,height=1000")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - ${patientName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            @page { size: A4 portrait; margin: 0; }
            .receipt-page {
              width: 210mm;
              min-height: 297mm;
              padding: 8mm;
              page-break-after: always;
            }
            .receipt-page:last-child { page-break-after: auto; }
            .no-break { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 1000)
  }

  const subtotal = addedServices.reduce((s, i) => s + i.amount, 0)
  const total = subtotal - discount

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-muted rounded-2xl" />
          <div className="h-72 bg-muted rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <User className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Patient not found</p>
      </div>
    )
  }

  const totalDue = patient.prescriptions?.reduce((sum: any, p: any) => sum + (p.balanceDue ?? 0), 0) ?? 0
  const hasBilledPrescriptions = patient.prescriptions && patient.prescriptions.some((p: any) => p.total > 0)
  const hasEyeReadings = patient.eyeReadings && patient.eyeReadings.length > 0
  const canPrint = hasBilledPrescriptions || hasEyeReadings

  // All prescriptions with billing
  const billedPrescriptions = (patient.prescriptions ?? []).filter((p: any) => p.total > 0)

  // ─── Build receipt data for print modal ───
  const rPatient = receiptData?.patient
  const rHospital = receiptData?.hospital
  const rPrescription = receiptData?.prescription
  const rEyeReading = receiptData?.eyeReading

  const patientInfo = rPatient ? {
    patientName: `${rPatient.firstName} ${rPatient.lastName ?? ""}`.trim(),
    patientId: rPatient.patientId,
    date: formatDate(rPrescription?.prescriptionDate ?? rPatient.appointmentDate),
    mobile: rPatient.phone || "—",
    gender: rPatient.gender,
    age: String(rPatient.age ?? calculateAge(rPatient.dateOfBirth) ?? "—"),
    address: rPatient.address || "—",
    referredBy: rPatient.referredBy || undefined,
    receiptNo: rPrescription?.prescriptionNumber || undefined,
    doctorName: rPrescription?.doctorName || rPatient.doctorName || "—",
    department: rPrescription?.department || rPatient.department || undefined,
  } : null

  const hospitalInfo = rHospital ? {
    name: rHospital.name,
    displayName: rHospital.displayName,
    address: rHospital.address,
    phone: rHospital.phone,
    email: rHospital.email,
    website: rHospital.website,
    registrationNo: rHospital.registrationNo,
    logoUrl: rHospital.logoUrl,
  } : { name: "Hospital" }

  // Parse medicines
  let medicines: { name: string; timing: string; days: string; note?: string }[] = []
  if (rPrescription?.medicines) {
    try { medicines = JSON.parse(rPrescription.medicines) } catch { /* empty */ }
  }

  // Parse investigations
  let investigations: string[] = []
  if (rPrescription?.investigations) {
    try {
      const parsed = JSON.parse(rPrescription.investigations)
      investigations = parsed.map((i: { name: string }) => i.name)
    } catch { /* empty */ }
  }

  // Parse eye reading data
  let arReading: { rightEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string }; leftEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string } } | undefined
  let previousGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let presentGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let clinicalFindings: { rightEye: any; leftEye: any } | undefined

  if (rEyeReading) {
    if (rEyeReading.autoRefractometer) {
      try {
        const ar = JSON.parse(rEyeReading.autoRefractometer)
        arReading = {
          rightEye: { sph: ar.re?.sph || "", cyl: ar.re?.cyl || "", axis: ar.re?.axis || "", va: ar.re?.va || "", vacPh: ar.re?.vacPh || "" },
          leftEye: { sph: ar.le?.sph || "", cyl: ar.le?.cyl || "", axis: ar.le?.axis || "", va: ar.le?.va || "", vacPh: ar.le?.vacPh || "" },
        }
      } catch { /* empty */ }
    }
    if (rEyeReading.previousPrescription) {
      try {
        const pg = JSON.parse(rEyeReading.previousPrescription)
        previousGlass = {
          dist: {
            rightEye: { sph: pg.re?.sph || "", cyl: pg.re?.cyl || "", axis: pg.re?.axis || "", va: pg.re?.va || "" },
            leftEye: { sph: pg.le?.sph || "", cyl: pg.le?.cyl || "", axis: pg.le?.axis || "", va: pg.le?.va || "" },
          },
          near: {
            rightEye: { sph: pg.reNear?.sph || "", cyl: pg.reNear?.cyl || "", axis: pg.reNear?.axis || "", va: pg.reNear?.va || "" },
            leftEye: { sph: pg.leNear?.sph || "", cyl: pg.leNear?.cyl || "", axis: pg.leNear?.axis || "", va: pg.leNear?.va || "" },
          },
        }
      } catch { /* empty */ }
    }
    if (rEyeReading.presentPrescription) {
      try {
        const pp = JSON.parse(rEyeReading.presentPrescription)
        presentGlass = {
          dist: {
            rightEye: { sph: pp.re?.sph || "", cyl: pp.re?.cyl || "", axis: pp.re?.axis || "", va: pp.re?.va || "" },
            leftEye: { sph: pp.le?.sph || "", cyl: pp.le?.cyl || "", axis: pp.le?.axis || "", va: pp.le?.va || "" },
          },
          near: {
            rightEye: { sph: pp.reNear?.sph || "", cyl: pp.reNear?.cyl || "", axis: pp.reNear?.axis || "", va: pp.reNear?.va || "" },
            leftEye: { sph: pp.leNear?.sph || "", cyl: pp.leNear?.cyl || "", axis: pp.leNear?.axis || "", va: pp.leNear?.va || "" },
          },
        }
      } catch { /* empty */ }
    }
    if (rEyeReading.clinicalFindings) {
      try {
        const cf = JSON.parse(rEyeReading.clinicalFindings)
        const defaultEye = {
          lids: "Normal", conjunctiva: "Normal", cornea: "Clear", ac: "Normal",
          iris: "Normal", pupil: "Normal", lens: "Clear", tension: "—",
          fundus: "—", opticDisk: "Normal", macula: "—", vessels: "—",
          peripheralRetina: "—", retinoscopy: "—", retino1: "—", retino2: "—", retino3: "—", retino4: "—",
        }
        clinicalFindings = {
          rightEye: { ...defaultEye, ...cf.re },
          leftEye: { ...defaultEye, ...cf.le },
        }
      } catch { /* empty */ }
    }
  }

  return (
    <div className="space-y-5">
      {/* ─── Patient Header Card ─── */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className={`h-1 ${
          patient.status === "COMPLETED" ? "bg-green-500" :
          patient.status === "VISITED" || patient.status === "MEDICAL_ONLY" ? "bg-blue-500" :
          patient.status === "CANCELLED" || patient.status === "NO_SHOW" ? "bg-red-500" :
          patient.status === "MOVED" ? "bg-amber-500" :
          "bg-primary"
        }`} />

        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/10">
                <AvatarFallback className="text-lg font-bold bg-primary/5 text-primary">
                  {getInitials(`${patient.firstName} ${patient.lastName ?? ""}`)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">
                    {patient.firstName} {patient.lastName}
                  </h2>
                  <PatientStatusBadge status={patient.status as PatientStatus} />
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                  <span className="font-mono text-xs text-black font-semibold bg-muted px-2 py-0.5 rounded">{patient.patientId}</span>
                  {patient.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {patient.phone}
                    </span>
                  )}
                  <span>
                    {patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"} yrs &middot; {patient.gender}
                  </span>
                  {patient.doctorName && (
                    <span className="flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" />
                      {patient.doctorName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {totalDue > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2">
                  <BadgeIndianRupee className="h-4 w-4 text-red-400" />
                  <div>
                    <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider">Balance Due</p>
                    <p className="text-lg font-bold text-red-600 leading-tight">{formatCurrency(totalDue)}</p>
                  </div>
                </div>
              ) : hasBilledPrescriptions ? (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2">
                  <BadgeIndianRupee className="h-4 w-4 text-green-400" />
                  <div>
                    <p className="text-[10px] font-medium text-green-500 uppercase tracking-wider">Payment</p>
                    <p className="text-sm font-semibold text-green-600 leading-tight">No Dues</p>
                  </div>
                </div>
              ) : null}

              {canPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={openPrintModal}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─── Left: Info / Receipts / History ─── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border overflow-hidden">
          <Tabs defaultValue="info">
            <div className="border-b border-border px-5 pt-3">
              <TabsList className="h-10 bg-transparent p-0 gap-1">
                {[
                  { value: "info", label: "Info", icon: User },
                  { value: "receipts", label: "Receipts", icon: Receipt },
                  { value: "history", label: "History", icon: Clock },
                ].map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="h-9 rounded-lg text-sm gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ─ Info Tab ─ */}
            <TabsContent value="info" className="p-5 mt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
                {([
                  { icon: Phone, label: "Phone", value: patient.phone },
                  { icon: User, label: "Age / Gender", value: `${patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"} / ${patient.gender}` },
                  { icon: CalendarDays, label: "Date of Birth", value: formatDate(patient.dateOfBirth) },
                  { icon: CalendarDays, label: "Appointment", value: formatDate(patient.appointmentDate) },
                  { icon: Stethoscope, label: "Doctor", value: patient.doctorName ?? "—" },
                  { icon: Building2, label: "Department", value: patient.department ?? "—" },
                  { icon: UserCheck, label: "Referred By", value: patient.referredBy ?? "—" },
                  { icon: User, label: "Guardian", value: patient.guardianName ? `${patient.guardianName} (${patient.guardianRelation ?? ""})` : "—" },
                ] as const).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="group">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3 text-muted-foreground/60" />
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                    </div>
                    <p className="text-sm font-medium text-foreground pl-4.5">{value}</p>
                  </div>
                ))}
              </div>
              {patient.address && (
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3 w-3 text-muted-foreground/60" />
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Address</p>
                  </div>
                  <p className="text-sm text-foreground pl-4.5">{patient.address}</p>
                </div>
              )}

              {hasEyeReadings && (
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye className="h-3.5 w-3.5 text-blue-500" />
                    <p className="text-xs font-semibold text-foreground">Eye Readings Available</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5.5">
                    Last reading: {formatDate((patient.eyeReadings as any)[0]?.readingDate)}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ─ Receipts Tab ─ */}
            <TabsContent value="receipts" className="p-5 mt-0">
              {billedPrescriptions.length > 0 ? (
                <div className="space-y-3">
                  {billedPrescriptions.map((prescription: any) => (
                    <div key={prescription.id} className="rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors">
                      <div className="px-4 py-3 bg-gray-50/80 flex justify-between items-center border-b border-border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-xs font-mono font-semibold text-foreground">
                              {prescription.prescriptionNumber ?? "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-2">
                              {formatDate(prescription.prescriptionDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            prescription.balanceDue > 0
                              ? "bg-red-50 text-red-600"
                              : "bg-green-50 text-green-600"
                          }`}>
                            {prescription.balanceDue > 0 ? `Due: ${formatCurrency(prescription.balanceDue)}` : "Paid"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={openPrintModal}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4">
                        {prescription.items && prescription.items.length > 0 && (
                          <div className="space-y-1.5">
                            {prescription.items.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-foreground">{item.description}</span>
                                <span className="text-muted-foreground font-medium">{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <Separator className="my-3" />
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm font-semibold">
                            <span>Total</span>
                            <span>{formatCurrency(prescription.subtotal ?? prescription.total ?? 0)}</span>
                          </div>
                          {prescription.discount > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Discount</span>
                              <span className="text-green-600">-{formatCurrency(prescription.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Received ({prescription.paymentMode ?? "—"})</span>
                            <span>{formatCurrency(prescription.amountPaid)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Receipt className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No receipts yet</p>
                  <p className="text-xs mt-1">Add services to generate receipts</p>
                </div>
              )}
            </TabsContent>

            {/* ─ History Tab ─ */}
            <TabsContent value="history" className="p-5 mt-0">
              {patient.prescriptions && patient.prescriptions.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-1.75 top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {patient.prescriptions.map((p: any) => (
                      <div key={p.id} className="flex items-start gap-3.5 relative">
                        <div className={`h-3.75 w-3.75 rounded-full border-2 shrink-0 z-10 ${
                          p.status === "COMPLETED" ? "bg-green-500 border-green-200" :
                          p.status === "BILLING_ONLY" ? "bg-blue-500 border-blue-200" :
                          "bg-primary border-primary/20"
                        }`} />
                        <div className="flex-1 -mt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{p.status}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(p.prescriptionDate)}</span>
                          </div>
                          {p.prescriptionNumber && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{p.prescriptionNumber}</p>
                          )}
                          {p.total > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium text-foreground">{formatCurrency(p.total)}</span>
                              {p.balanceDue > 0 && (
                                <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                  Due: {formatCurrency(p.balanceDue)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Clock className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No history</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ─── Right Sidebar: Actions ─── */}
        <div className="space-y-4">

          {/* ─ Print Documents ─ */}
          {canPrint && (
            <div className="bg-white rounded-2xl border border-border p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Print Documents
              </p>
              <div className="space-y-2">
                {hasBilledPrescriptions && (
                  <button
                    onClick={openPrintModal}
                    className="w-full text-left rounded-lg border border-border bg-gray-50/50 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Cash Receipt</p>
                          <p className="text-[10px] text-muted-foreground">Bills & service receipts</p>
                        </div>
                      </div>
                      <Printer className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </button>
                )}

                {(patient.prescriptions ?? []).some((p: any) => p.status !== "BILLING_ONLY" && p.doctorName) && (
                  <button
                    onClick={openPrintModal}
                    className="w-full text-left rounded-lg border border-border bg-gray-50/50 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Prescription</p>
                          <p className="text-[10px] text-muted-foreground">Medicines & diagnosis</p>
                        </div>
                      </div>
                      <Printer className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </button>
                )}

                {hasEyeReadings && (
                  <button
                    onClick={openPrintModal}
                    className="w-full text-left rounded-lg border border-border bg-gray-50/50 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5 text-blue-500 group-hover:text-primary" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Readings & Findings</p>
                          <p className="text-[10px] text-muted-foreground">Eye readings & clinical findings</p>
                        </div>
                      </div>
                      <Printer className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─ Add Services ─ */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Services
              </p>
              {!showAddService && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowAddService(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add New
                </Button>
              )}
            </div>

            {/* Already-added services from prescriptions */}
            {billedPrescriptions.length > 0 && !showAddService && (
              <div className="space-y-2 mb-3">
                {billedPrescriptions.map((rx: any) => {
                  const isExpanded = expandedPrescriptionId === rx.id
                  return (
                    <div key={rx.id} className="rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => setExpandedPrescriptionId(isExpanded ? null : rx.id)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-mono font-medium text-foreground">{rx.prescriptionNumber ?? "Receipt"}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            rx.balanceDue > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          }`}>
                            {rx.balanceDue > 0 ? "Due" : "Paid"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{formatCurrency(rx.total)}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </button>
                      {isExpanded && rx.items && rx.items.length > 0 && (
                        <div className="px-3 py-2 border-t border-border bg-white">
                          <div className="space-y-1">
                            {rx.items.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{item.description}</span>
                                <span className="font-medium">{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                          <Separator className="my-1.5" />
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Paid</span>
                            <span className="font-medium text-green-600">{formatCurrency(rx.amountPaid)}</span>
                          </div>
                          {rx.balanceDue > 0 && (
                            <div className="flex justify-between text-xs mt-0.5">
                              <span className="text-muted-foreground">Due</span>
                              <span className="font-medium text-red-600">{formatCurrency(rx.balanceDue)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!showAddService ? (
              billedPrescriptions.length === 0 && (
                <p className="text-xs text-muted-foreground">No services added yet. Click Add New to create a service receipt.</p>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {serviceTemplates.map(t => {
                    const isAdded = addedServices.some(s => s.description === t.name)
                    return (
                      <button
                        key={t.id}
                        onClick={() => addService(t)}
                        disabled={isAdded}
                        className={`text-left rounded-lg border px-3 py-2 transition-all text-xs ${
                          isAdded
                            ? "border-primary/30 bg-primary/5 opacity-60 cursor-not-allowed"
                            : "border-border bg-gray-50/50 hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-foreground">{t.name}</p>
                          <p className="text-muted-foreground">{formatCurrency(t.amount)}</p>
                        </div>
                        {t.category && <p className="text-[10px] text-muted-foreground mt-0.5">{t.category}</p>}
                      </button>
                    )
                  })}
                </div>

                {addedServices.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selected Services</p>
                      {addedServices.map(s => (
                        <div key={s.id} className="flex items-center justify-between gap-2 bg-primary/5 rounded-lg px-2.5 py-1.5">
                          <span className="truncate text-xs font-medium">{s.description}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-semibold">{formatCurrency(s.amount)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setAddedServices(prev => prev.filter(x => x.id !== s.id))}
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 mt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-muted-foreground">Discount</span>
                          <Input
                            type="number"
                            value={discount}
                            onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                            className="h-6 w-20 text-xs text-right"
                          />
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>Total</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment Mode</Label>
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
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount Received</Label>
                          <Input
                            type="number"
                            value={amountPaid}
                            onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 text-xs h-9" onClick={handleAddServices} disabled={submitting}>
                          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
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

          {/* ─ Move Appointment ─ */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Current: <span className="font-medium text-foreground">{formatDate(patient.appointmentDate)}</span></span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">{formatDate(patient.appointmentDate)}</span>
                  <MoveRight className="h-3.5 w-3.5 shrink-0 text-primary" />
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
                  <Button size="sm" className="flex-1 text-xs h-9" onClick={handleMoveDate} disabled={submitting}>
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
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

      {/* ─── Print Receipts Modal (same approach as doctor's PrintReceiptsModal) ─── */}
      <Dialog open={printOpen} onOpenChange={() => { setPrintOpen(false); setReceiptData(null) }}>
        <DialogContent className="max-w-[870px] max-h-[95vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-row items-center justify-between">
            <DialogTitle className="text-base">
              Print Receipts — {patient.firstName} {patient.lastName ?? ""}
            </DialogTitle>
            <Button size="sm" onClick={handlePrint} disabled={printLoading} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </DialogHeader>

          {printLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading receipt data...</p>
            </div>
          ) : receiptData ? (
            <Tabs value={printTab} onValueChange={setPrintTab} className="flex-1 flex flex-col min-h-0">
              <div className="border-b border-border px-4">
                <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 -mb-px">
                  <TabsTrigger value="cash" className={TAB_CLASS}>Cash Receipt</TabsTrigger>
                  <TabsTrigger value="prescription" className={TAB_CLASS}>Prescription</TabsTrigger>
                  <TabsTrigger value="readings" className={TAB_CLASS}>Readings & Findings</TabsTrigger>
                  <TabsTrigger value="report" className={TAB_CLASS}>Report</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                <div ref={printRef}>
                  {/* Cash Receipt */}
                  <TabsContent value="cash" className="mt-0">
                    {patientInfo && rPrescription ? (
                      <CashReceipt
                        hospital={hospitalInfo}
                        patient={patientInfo}
                        payment={{
                          mode: rPrescription.paymentMode || "Cash",
                          totalAmount: rPrescription.subtotal ?? rPrescription.total ?? 0,
                          discount: rPrescription.discount ?? 0,
                          amountReceived: rPrescription.amountPaid ?? 0,
                          amountDue: rPrescription.balanceDue ?? 0,
                          paidFor: rPrescription.items?.map((i: any) => i.description).join(", ") || undefined,
                        }}
                        items={rPrescription.items?.map((i: any) => ({ description: i.description, amount: i.amount })) || undefined}
                      />
                    ) : (
                      <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
                        No billing data available for this patient
                      </div>
                    )}
                  </TabsContent>

                  {/* Prescription Receipt */}
                  <TabsContent value="prescription" className="mt-0">
                    {patientInfo ? (
                      <PrescriptionReceipt
                        hospital={hospitalInfo}
                        patient={patientInfo}
                        vitals={rPrescription ? {
                          temperature: rPrescription.temperature ? String(rPrescription.temperature) : undefined,
                          pulseRate: rPrescription.pulseRate ? String(rPrescription.pulseRate) : undefined,
                          spo2: rPrescription.spo2 ? String(rPrescription.spo2) : undefined,
                        } : undefined}
                        history={rPrescription ? {
                          presentComplaint: rPrescription.presentComplaint || undefined,
                          previousHistory: rPrescription.previousHistory || undefined,
                          diagnosis: rPrescription.diagnosis || undefined,
                        } : undefined}
                        medicines={medicines}
                        investigations={investigations}
                        advice={rPrescription?.additionalNotes || undefined}
                        followUpDate={rPrescription?.followUpDate ? formatDate(rPrescription.followUpDate) : undefined}
                        notes={rPrescription?.notes || undefined}
                      />
                    ) : (
                      <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
                        No prescription data available
                      </div>
                    )}
                  </TabsContent>

                  {/* Readings & Findings */}
                  <TabsContent value="readings" className="mt-0 space-y-4">
                    <div className="flex gap-1 bg-white rounded-lg border p-1 w-fit mx-auto">
                      {(["readings", "clinical", "both"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setReadingsSubTab(t)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            readingsSubTab === t
                              ? "bg-primary text-white"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t === "readings" ? "Readings" : t === "clinical" ? "Clinical Findings" : "Both"}
                        </button>
                      ))}
                    </div>

                    {readingsSubTab === "readings" && patientInfo && (
                      <ReadingsReceipt
                        hospital={hospitalInfo}
                        patient={patientInfo}
                        arReading={arReading}
                        previousGlass={previousGlass}
                        presentGlass={presentGlass}
                      />
                    )}

                    {readingsSubTab === "clinical" && clinicalFindings && (
                      <ClinicalFindingsReceipt
                        hospital={hospitalInfo}
                        rightEye={clinicalFindings.rightEye}
                        leftEye={clinicalFindings.leftEye}
                      />
                    )}

                    {readingsSubTab === "both" && patientInfo && (
                      <ReadingsAndFindings
                        hospital={hospitalInfo}
                        patient={patientInfo}
                        arReading={arReading}
                        previousGlass={previousGlass}
                        presentGlass={presentGlass}
                        clinicalFindings={clinicalFindings}
                      />
                    )}

                    {!rEyeReading && (
                      <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
                        No eye reading data available for this patient
                      </div>
                    )}
                  </TabsContent>

                  {/* Full Report */}
                  <TabsContent value="report" className="mt-0 space-y-0">
                    {patientInfo && (
                      <>
                        <PrescriptionReceipt
                          hospital={hospitalInfo}
                          patient={patientInfo}
                          vitals={rPrescription ? {
                            temperature: rPrescription.temperature ? String(rPrescription.temperature) : undefined,
                            pulseRate: rPrescription.pulseRate ? String(rPrescription.pulseRate) : undefined,
                            spo2: rPrescription.spo2 ? String(rPrescription.spo2) : undefined,
                          } : undefined}
                          history={rPrescription ? {
                            presentComplaint: rPrescription.presentComplaint || undefined,
                            previousHistory: rPrescription.previousHistory || undefined,
                            diagnosis: rPrescription.diagnosis || undefined,
                          } : undefined}
                          medicines={medicines}
                          investigations={investigations}
                          advice={rPrescription?.additionalNotes || undefined}
                          followUpDate={rPrescription?.followUpDate ? formatDate(rPrescription.followUpDate) : undefined}
                          notes={rPrescription?.notes || undefined}
                        />
                        {rEyeReading && (
                          <ReadingsAndFindings
                            hospital={hospitalInfo}
                            patient={patientInfo}
                            arReading={arReading}
                            previousGlass={previousGlass}
                            presentGlass={presentGlass}
                            clinicalFindings={clinicalFindings}
                          />
                        )}
                      </>
                    )}
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
