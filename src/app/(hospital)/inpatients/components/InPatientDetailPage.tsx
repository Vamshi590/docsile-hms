"use client"

import React, { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  ArrowLeft, ChevronRight, Loader2, Plus, X, Printer, Search, ClipboardList,
  User, Stethoscope, CreditCard, Pill, FileText, Activity,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EditableCombobox } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InPatientStatusBadge, IP_STATUS_CONFIG, IP_STATUS_TRANSITIONS } from "./InPatientStatusBadge"
import { updateInPatientStatus, addInPatientPayment, dischargeInPatient, updateInPatientDetails, getHospitalProfileForReceipts } from "../actions"
import { getMedicineMaster } from "@/app/(hospital)/doctor/actions"
import { getInpatientTemplates } from "@/app/(hospital)/settings/actions"
import { CashReceipt } from "@/components/receipts/CashReceipt"
import { ReceiptLayout, ReceiptFooter } from "@/components/receipts/ReceiptLayout"
import { ReceiptHeader } from "@/components/receipts/ReceiptHeader"
import { PatientInfoSection } from "@/components/receipts/PatientInfoSection"
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
  onDutyDoctor: string | null
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
const AMOUNT_TYPES = ["Advance", "Partial", "Final", "Refund", "Insurance"]

const MEDICINE_TIMINGS = [
  "1-1-1", "1-1-1-1", "1-0-1", "1-0-0", "0-0-1", "0-1-0",
  "1-1-0", "0-1-1", "SOS", "BD", "TDS", "QID", "OD",
  "Tapering", "Weekly", "Monthly",
]
const MEDICINE_DAYS = [
  "1", "3", "5", "7", "10", "14", "21", "28", "30", "45", "60", "90", "Continuous",
]

const MEDICAL_VALUE_FIELDS: { key: keyof MedicalValues; label: string }[] = [
  { key: "iop", label: "IOP" },
  { key: "syringing", label: "Syringing" },
  { key: "bp", label: "B.P" },
  { key: "xst", label: "2% XST" },
  { key: "cbp", label: "CBP" },
  { key: "rbs", label: "RBS" },
  { key: "hiv", label: "HIV" },
  { key: "hbsAg", label: "HBsAg" },
  { key: "aScan", label: "A Scan" },
  { key: "preOpVision", label: "Pre-Op Vision" },
  { key: "postOpVision", label: "Post-Op Vision" },
]

const TAB_CLASS =
  "rounded-none px-4 py-3 text-sm font-medium border-b-2 border-transparent " +
  "text-muted-foreground hover:text-foreground transition-colors " +
  "data-[state=active]:border-primary data-[state=active]:text-primary " +
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"

interface Props {
  inpatient: InPatient
  onBack: () => void
  onUpdate: () => void
  variant?: "info" | "form"
}

export function InPatientDetailPage({ inpatient, onBack, onUpdate, variant = "form" }: Props) {
  // ── Payment state ──
  const [showPayment, setShowPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState("Cash")
  const [amountType, setAmountType] = useState("Partial")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // ── Prescription state (form variant) ──
  const [medicines, setMedicines] = useState<Array<{ medicine: string; days: string; timing: string; note: string }>>([])
  const [medicalValues, setMedicalValues] = useState<MedicalValues>({})
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpDays, setFollowUpDays] = useState("")
  type MedicineMasterEntry = { name: string; defaultTiming: string | null; defaultDays: string | null; note: string | null }
  const [medicineMasterFull, setMedicineMasterFull] = useState<MedicineMasterEntry[]>([])
  const [medicineOptions, setMedicineOptions] = useState<string[]>([])
  const [savingRx, setSavingRx] = useState(false)

  // ── Inpatient template state ──
  type InpatientTemplate = { id: string; code: string; name: string; operationName: string | null; provisionDiagnosis: string | null; medicines: string; followUpDays: number | null; additionalNotes: string | null }
  const [ipTemplates, setIpTemplates] = useState<InpatientTemplate[]>([])
  const [templateSearch, setTemplateSearch] = useState("")
  const [showTemplateList, setShowTemplateList] = useState(false)

  // ── Discharge state (form variant) ──
  const [dischargeDate, setDischargeDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()))
  const [dischargeNotes, setDischargeNotes] = useState("")
  const [dischargeDiagnosis, setDischargeDiagnosis] = useState("")
  const [conditionAtDischarge, setConditionAtDischarge] = useState("")
  const [dischargeMedications, setDischargeMedications] = useState("")
  const [followUpInstructions, setFollowUpInstructions] = useState("")
  const [savingDischarge, setSavingDischarge] = useState(false)

  // ── Print state ──
  const printRef = useRef<HTMLDivElement>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [printTab, setPrintTab] = useState<"bill" | "discharge">("bill")
  const [hospitalInfo, setHospitalInfo] = useState<any>(null)
  const [printLoading, setPrintLoading] = useState(false)

  // ── Parse stored JSON ──
  const doctors: string[] = (() => {
    try { return JSON.parse(inpatient.doctorNames) } catch { return [] }
  })()

  const paymentRecords: PaymentRecord[] = (() => {
    try { return JSON.parse(inpatient.paymentRecords ?? "[]") } catch { return [] }
  })()

  const packageInclusions: PackageInclusion[] = (() => {
    try { return JSON.parse(inpatient.packageInclusions ?? "[]") } catch { return [] }
  })()

  const storedMedicalValues: MedicalValues = (() => {
    try { return JSON.parse(inpatient.medicalValues ?? "{}") } catch { return {} }
  })()

  const ipPrescriptions: Array<{ medicine: string; days: string; timing: string; note?: string }> = (() => {
    try { return JSON.parse(inpatient.prescriptions ?? "[]") } catch { return [] }
  })()

  const dischargeSummary = (() => {
    try { return JSON.parse(inpatient.dischargeNotes ?? "{}") } catch { return null }
  })()

  const daysAdmitted = Math.max(0, Math.floor(
    (Date.now() - new Date(inpatient.admissionDate).getTime()) / (1000 * 60 * 60 * 24)
  ))

  // ── Load medicine master + init state ──
  useEffect(() => {
    if (variant === "form") {
      getMedicineMaster().then(meds => {
        setMedicineMasterFull(meds)
        setMedicineOptions(meds.map(m => m.name))
      })
      getInpatientTemplates().then(data => setIpTemplates(data as InpatientTemplate[]))
    }
  }, [variant])

  useEffect(() => {
    if (ipPrescriptions.length > 0) {
      setMedicines(ipPrescriptions.map(rx => ({
        medicine: rx.medicine ?? "",
        days: rx.days ?? "",
        timing: rx.timing ?? "",
        note: rx.note ?? "",
      })))
    } else {
      setMedicines([{ medicine: "", days: "", timing: "", note: "" }])
    }
    setMedicalValues(storedMedicalValues)
    setFollowUpDate(inpatient.followUpDate ? new Date(inpatient.followUpDate).toISOString().split("T")[0] : "")

    if (dischargeSummary && typeof dischargeSummary === "object" && dischargeSummary.diagnosis) {
      setDischargeDiagnosis(dischargeSummary.diagnosis ?? "")
      setConditionAtDischarge(dischargeSummary.conditionAtDischarge ?? "")
      setDischargeMedications(dischargeSummary.medications ?? "")
      setFollowUpInstructions(dischargeSummary.followUpInstructions ?? "")
      setDischargeNotes(dischargeSummary.notes ?? "")
    }
    if (inpatient.dischargeDate) {
      setDischargeDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(inpatient.dischargeDate)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inpatient.id])

  // ── Handlers ──

  const currentStatus = inpatient.status as InPatientStatus
  const transitions = IP_STATUS_TRANSITIONS[currentStatus] ?? []

  async function handleStatusChange(status: InPatientStatus) {
    const result = await updateInPatientStatus(inpatient.id, status)
    if (result.success) { toast.success("Status updated"); onUpdate() }
    else toast.error(result.error)
  }

  async function handleAddPayment() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    setSubmitting(true)
    try {
      const result = await addInPatientPayment({
        inpatientId: inpatient.id,
        amount: parseFloat(paymentAmount),
        paymentMode, amountType,
        notes: paymentNotes,
      })
      if (result.success) {
        toast.success("Payment recorded")
        setShowPayment(false)
        setPaymentAmount(""); setPaymentNotes("")
        onUpdate()
      } else toast.error(result.error)
    } catch { toast.error("Failed to add payment") }
    finally { setSubmitting(false) }
  }

  function addMedicine() {
    setMedicines(prev => [...prev, { medicine: "", days: "", timing: "", note: "" }])
  }
  function removeMedicine(i: number) {
    setMedicines(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateMedicine(i: number, field: string, value: string) {
    setMedicines(prev => prev.map((m, idx) => {
      if (idx !== i) return m
      if (field === "medicine") {
        const master = medicineMasterFull.find(x => x.name === value)
        return {
          ...m,
          medicine: value,
          timing: m.timing || (master?.defaultTiming ?? ""),
          days: m.days || (master?.defaultDays ?? ""),
          note: m.note || (master?.note ?? ""),
        }
      }
      return { ...m, [field]: value }
    }))
  }
  function updateMedicalValue(key: keyof MedicalValues, value: string) {
    setMedicalValues(prev => ({ ...prev, [key]: value }))
  }

  const filteredTemplates = templateSearch.trim()
    ? ipTemplates.filter(t =>
        t.code.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.name.toLowerCase().includes(templateSearch.toLowerCase())
      )
    : ipTemplates

  function applyTemplate(t: InpatientTemplate) {
    try {
      const meds = JSON.parse(t.medicines)
      if (meds.length > 0) setMedicines(meds.map((m: any) => ({ medicine: m.name ?? m.medicine ?? "", days: m.days ?? "", timing: m.timing ?? "", note: m.note ?? "" })))
    } catch { /* ignore */ }
    if (t.followUpDays) {
      const d = new Date()
      d.setDate(d.getDate() + t.followUpDays)
      setFollowUpDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d))
      setFollowUpDays(String(t.followUpDays))
    }
    setTemplateSearch("")
    setShowTemplateList(false)
    toast.success(`Template "${t.name}" applied`)
  }

  async function handleSavePrescription() {
    setSavingRx(true)
    try {
      const rxData = medicines.filter(m => m.medicine.trim())
      const result = await updateInPatientDetails(inpatient.id, {
        prescriptions: rxData,
        medicalValues,
        followUpDate: followUpDate || undefined,
      })
      if (result.success) { toast.success("Prescription saved"); onUpdate() }
      else toast.error(result.error)
    } catch { toast.error("Failed to save prescription") }
    finally { setSavingRx(false) }
  }

  async function handleSaveAndDischarge() {
    if (!dischargeDate) { toast.error("Select discharge date"); return }
    setSavingDischarge(true)
    try {
      // Save prescription first
      const rxData = medicines.filter(m => m.medicine.trim())
      await updateInPatientDetails(inpatient.id, {
        prescriptions: rxData,
        medicalValues,
        followUpDate: followUpDate || undefined,
      })
      // Then discharge
      const result = await dischargeInPatient({
        id: inpatient.id,
        dischargeDate,
        dischargeNotes,
        dischargeDiagnosis,
        conditionAtDischarge,
        dischargeMedications,
        followUpInstructions,
      })
      if (result.success) {
        toast.success("Patient discharged")
        onBack(); onUpdate()
      } else toast.error(result.error)
    } catch { toast.error("Failed to discharge patient") }
    finally { setSavingDischarge(false) }
  }

  async function openPrintModal(tab: "bill" | "discharge") {
    setPrintTab(tab)
    setPrintOpen(true)
    if (!hospitalInfo) {
      setPrintLoading(true)
      const data = await getHospitalProfileForReceipts()
      setHospitalInfo(data)
      setPrintLoading(false)
    }
  }

  function handlePrint() {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const printWindow = window.open("", "_blank", "width=800,height=1000")
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - ${inpatient.name}</title>
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

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      {/* ── Patient Header Card ── */}
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 shadow-sm">
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {getInitials(inpatient.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{inpatient.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{inpatient.age}y / {inpatient.gender.charAt(0)}</span>
                  <span className="text-border">|</span>
                  <span>{inpatient.phone}</span>
                  {inpatient.guardianName && (
                    <><span className="text-border">|</span><span>G: {inpatient.guardianName}</span></>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-2.5">
                  <InPatientStatusBadge status={currentStatus} />
                  <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {daysAdmitted} day{daysAdmitted !== 1 ? "s" : ""} admitted
                  </span>
                  {inpatient.bedNumber && (
                    <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                      Bed: {inpatient.bedNumber} {inpatient.wardName && `/ ${inpatient.wardName}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Dues + Actions */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Balance Due</p>
                <p className={`text-lg font-semibold tabular-nums ${inpatient.balanceAmount > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(inpatient.balanceAmount)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Paid: {formatCurrency(inpatient.totalReceivedAmount)} / {formatCurrency(inpatient.netAmount)}
                </p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-wrap gap-2">
              {variant === "info" && (
                <Button size="sm" variant="outline" onClick={() => setShowPayment(v => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Payment
                </Button>
              )}
              {variant === "form" && transitions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">Change Status</Button>
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
              </div>
            </div>
          </div>
        </div>

        {/* ── Add Payment Panel (info variant only) ── */}
        {variant === "info" && showPayment && (
          <div className="border-t border-border bg-muted/20 p-5">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold">Add Payment</p>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowPayment(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={amountType} onValueChange={setAmountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AMOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <Button size="sm" className="mt-3" onClick={handleAddPayment} disabled={submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Record Payment
            </Button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* INFO VARIANT — Read-only tabs for Patients module                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {variant === "info" && (
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <Tabs defaultValue="info">
            <TabsList className="w-full border-b rounded-none bg-transparent h-auto p-0 gap-0">
              <TabsTrigger value="info" className={TAB_CLASS}>
                <User className="h-3.5 w-3.5 mr-1.5" /> Patient Info
              </TabsTrigger>
              <TabsTrigger value="operation" className={TAB_CLASS}>
                <Stethoscope className="h-3.5 w-3.5 mr-1.5" /> Operation
              </TabsTrigger>
              <TabsTrigger value="billing" className={TAB_CLASS}>
                <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Billing
              </TabsTrigger>
              <TabsTrigger value="rx" className={TAB_CLASS}>
                <Pill className="h-3.5 w-3.5 mr-1.5" /> Prescription
              </TabsTrigger>
              <TabsTrigger value="discharge" className={TAB_CLASS}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Discharge
              </TabsTrigger>
            </TabsList>

            {/* ════ Patient Info Tab ════ */}
            <TabsContent value="info" className="p-6">
              <div className="grid grid-cols-3 gap-5">
                {([
                  ["Age / Gender", `${inpatient.age} / ${inpatient.gender.charAt(0)}`],
                  ["Phone", inpatient.phone],
                  ["Guardian", inpatient.guardianName ?? "—"],
                  ["Date of Birth", formatDate(inpatient.dateOfBirth)],
                  ["Admission Date", formatDateTime(inpatient.admissionDate)],
                  ["Days Admitted", `${daysAdmitted} day${daysAdmitted !== 1 ? "s" : ""}`],
                  ["Referred By", inpatient.referredBy ?? "—"],
                  ["Department", inpatient.department ?? "—"],
                  ["On Duty Doctor", inpatient.onDutyDoctor ?? "—"],
                  ["Doctors", doctors.join(", ") || "—"],
                  ["Bed / Ward", inpatient.bedNumber ? `${inpatient.bedNumber} / ${inpatient.wardName ?? ""}` : "—"],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              {inpatient.address && (
                <div className="mt-4 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Address</p>
                  <p className="text-sm">{inpatient.address}</p>
                </div>
              )}
              {inpatient.admissionNotes && (
                <div className="mt-3 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Admission Notes</p>
                  <p className="text-sm">{inpatient.admissionNotes}</p>
                </div>
              )}
            </TabsContent>

            {/* ════ Operation Tab ════ */}
            <TabsContent value="operation" className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {([
                  ["Operation", inpatient.operationName ?? "—"],
                  ["Operation Date", formatDate(inpatient.operationDate)],
                  ["Diagnosis", inpatient.provisionDiagnosis ?? "—"],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              {inpatient.operationProcedure && (
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Procedure</p>
                  <p className="text-sm whitespace-pre-wrap">{inpatient.operationProcedure}</p>
                </div>
              )}
              {inpatient.operationDetails && (
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Details</p>
                  <p className="text-sm whitespace-pre-wrap">{inpatient.operationDetails}</p>
                </div>
              )}
              {Object.values(storedMedicalValues).some(v => v) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    <Activity className="h-3.5 w-3.5 inline mr-1" /> Medical Examination Values
                  </p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {MEDICAL_VALUE_FIELDS.filter(f => storedMedicalValues[f.key]).map(f => (
                      <div key={f.key} className="rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2.5">
                        <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">{f.label}</p>
                        <p className="font-semibold text-sm mt-0.5">{String(storedMedicalValues[f.key])}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ════ Billing Tab ════ */}
            <TabsContent value="billing" className="p-6 space-y-5">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => openPrintModal("bill")}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Bill
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Package Amount", value: formatCurrency(inpatient.packageAmount), bg: "bg-gray-50" },
                  { label: "Discount", value: `- ${formatCurrency(inpatient.discount)}`, bg: "bg-gray-50" },
                  { label: "Net Amount", value: formatCurrency(inpatient.netAmount), bg: "bg-blue-50", border: "border-blue-100" },
                  { label: "Balance Due", value: formatCurrency(inpatient.balanceAmount), bg: inpatient.balanceAmount > 0 ? "bg-red-50" : "bg-green-50", border: inpatient.balanceAmount > 0 ? "border-red-100" : "border-green-100" },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border ${item.border ?? "border-gray-100"} ${item.bg} px-4 py-3.5`}>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
                    <p className="text-lg font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-green-100 bg-green-50/50 px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-medium">Total Received</span>
                <span className="text-sm font-bold text-green-700">{formatCurrency(inpatient.totalReceivedAmount)}</span>
              </div>

              {packageInclusions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Package Inclusions</p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packageInclusions.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <span className="font-medium text-sm">{item.name}</span>
                              {item.subItems?.map((sub, j) => (
                                <div key={j} className="text-xs text-muted-foreground pl-3 mt-0.5">
                                  {sub.itemName} x{sub.quantity}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {paymentRecords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment History</p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentRecords.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{formatDate(p.date)}</TableCell>
                            <TableCell className="text-sm">{p.amountType}</TableCell>
                            <TableCell className="text-sm">{p.paymentMode}</TableCell>
                            <TableCell className="text-right font-semibold text-sm">{formatCurrency(p.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

            </TabsContent>

            {/* ════ Prescription Tab (read-only) ════ */}
            <TabsContent value="rx" className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Pill className="h-3.5 w-3.5 inline mr-1" /> Discharge Prescription
                </p>
                {ipPrescriptions.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => openPrintModal("discharge")}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Prescription
                  </Button>
                )}
              </div>

              {Object.values(storedMedicalValues).some(v => v) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    <Activity className="h-3.5 w-3.5 inline mr-1" /> Medical Examination Values
                  </p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {MEDICAL_VALUE_FIELDS.filter(f => storedMedicalValues[f.key]).map(f => (
                      <div key={f.key} className="rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2.5">
                        <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">{f.label}</p>
                        <p className="font-semibold text-sm mt-0.5">{String(storedMedicalValues[f.key])}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ipPrescriptions.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Timing</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ipPrescriptions.map((rx, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{rx.medicine}</TableCell>
                          <TableCell>{rx.days}</TableCell>
                          <TableCell>{rx.timing}</TableCell>
                          <TableCell className="text-muted-foreground">{rx.note || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No prescription added yet</p>
                </div>
              )}

              {inpatient.followUpDate && (
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Follow-up Date</p>
                  <p className="text-sm font-semibold">{formatDate(inpatient.followUpDate)}</p>
                </div>
              )}

            </TabsContent>

            {/* ════ Discharge Summary Tab (read-only) ════ */}
            <TabsContent value="discharge" className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <FileText className="h-3.5 w-3.5 inline mr-1" /> Discharge Summary
                </p>
                {inpatient.status === "DISCHARGED" && dischargeSummary && (
                  <Button size="sm" variant="outline" onClick={() => openPrintModal("discharge")}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Summary
                  </Button>
                )}
              </div>

              {inpatient.status === "DISCHARGED" && dischargeSummary && typeof dischargeSummary === "object" && dischargeSummary.diagnosis ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Discharge Date</p>
                      <p className="text-sm font-semibold">{formatDate(inpatient.dischargeDate)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Condition at Discharge</p>
                      <p className="text-sm font-semibold">{dischargeSummary.conditionAtDischarge || "—"}</p>
                    </div>
                  </div>
                  {dischargeSummary.diagnosis && (
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Discharge Diagnosis</p>
                      <p className="text-sm whitespace-pre-wrap">{dischargeSummary.diagnosis}</p>
                    </div>
                  )}
                  {dischargeSummary.medications && (
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Medications on Discharge</p>
                      <p className="text-sm whitespace-pre-wrap">{dischargeSummary.medications}</p>
                    </div>
                  )}
                  {dischargeSummary.followUpInstructions && (
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Follow-up Instructions</p>
                      <p className="text-sm whitespace-pre-wrap">{dischargeSummary.followUpInstructions}</p>
                    </div>
                  )}
                  {dischargeSummary.notes && (
                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Additional Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{dischargeSummary.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Patient has not been discharged yet</p>
                </div>
              )}

            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FORM VARIANT — Combined Prescription + Discharge for Inpatients      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {variant === "form" && (
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="border-b border-border bg-gray-50/50 px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              Prescription & Discharge Summary
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in the medical details, prescription, and discharge information
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* ── Section 1: Medical Examination Values ── */}
            <div className="rounded-xl border border-border bg-gray-50/50 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                <Activity className="h-3.5 w-3.5 inline mr-1" /> Medical Examination Values
              </p>
              <div className="grid grid-cols-4 gap-3">
                {MEDICAL_VALUE_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      value={medicalValues[f.key] ?? ""}
                      onChange={e => updateMedicalValue(f.key, e.target.value)}
                      placeholder={f.label}
                      className="bg-white h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Quick Fill from Template ── */}
            {ipTemplates.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-700">Quick Fill from Template</p>
                  </div>
                  <p className="text-xs text-blue-600 mb-3">Search and select a predefined template to auto-fill medicines and follow-up.</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={templateSearch}
                      onChange={e => { setTemplateSearch(e.target.value); setShowTemplateList(true) }}
                      onFocus={() => setShowTemplateList(true)}
                      onBlur={() => setTimeout(() => setShowTemplateList(false), 150)}
                      placeholder="Search templates by code or name..."
                      className="pl-9 bg-white"
                    />
                    {showTemplateList && filteredTemplates.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Templates</p>
                          <p className="text-[11px] text-gray-400">{filteredTemplates.length} found</p>
                        </div>
                        {filteredTemplates.map((t) => {
                          let medCount = 0
                          try { medCount = JSON.parse(t.medicines).length } catch { /* ignore */ }
                          return (
                            <button
                              key={t.id}
                              onMouseDown={() => applyTemplate(t)}
                              className="group w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/60 text-left transition-colors duration-100 border-b border-gray-100 last:border-0"
                            >
                              <span className="h-8 w-8 flex items-center justify-center rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-[11px] font-bold shrink-0 leading-none">
                                {t.code}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[0.82rem] font-semibold text-gray-800 leading-snug truncate group-hover:text-blue-700 transition-colors">
                                  {t.name}
                                </p>
                                {t.operationName && (
                                  <p className="text-[11px] text-gray-400 leading-snug truncate mt-0.5">{t.operationName}</p>
                                )}
                              </div>
                              <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                                {medCount} med{medCount !== 1 ? "s" : ""}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Section 2: Medications ── */}
            <div className="rounded-xl border border-border bg-gray-50/50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Pill className="h-3.5 w-3.5 inline mr-1" /> Discharge Prescription
                </p>
                <Button size="sm" variant="secondary" onClick={addMedicine}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Medicine
                </Button>
              </div>
              <div className="p-4 space-y-3">
                {medicines.map((med, i) => (
                  <div key={i} className="rounded-lg border border-border bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground">Medicine {i + 1}</p>
                      {medicines.length > 1 && (
                        <Button variant="ghost" size="icon-sm" onClick={() => removeMedicine(i)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-6 w-6">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2.5" style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr" }}>
                      <EditableCombobox
                        options={medicineOptions}
                        value={med.medicine}
                        onValueChange={v => updateMedicine(i, "medicine", v)}
                        placeholder="Medicine name"
                      />
                      <EditableCombobox
                        options={MEDICINE_DAYS}
                        value={med.days}
                        onValueChange={v => updateMedicine(i, "days", v)}
                        placeholder="Days"
                      />
                      <EditableCombobox
                        options={MEDICINE_TIMINGS}
                        value={med.timing}
                        onValueChange={v => updateMedicine(i, "timing", v)}
                        placeholder="Timing"
                      />
                      <Input
                        value={med.note}
                        onChange={e => updateMedicine(i, "note", e.target.value)}
                        placeholder="Note (optional)"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 3: Follow-up Date ── */}
            <div className="rounded-xl border border-border bg-gray-50/50 p-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Days from now</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 7"
                    value={followUpDays}
                    onChange={e => {
                      const val = e.target.value
                      setFollowUpDays(val)
                      const num = parseInt(val, 10)
                      if (!isNaN(num) && num >= 0) {
                        const d = new Date()
                        d.setDate(d.getDate() + num)
                        setFollowUpDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d))
                      }
                    }}
                    className="bg-white h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Follow-up Date</Label>
                  <Input type="date" value={followUpDate} onChange={e => { setFollowUpDate(e.target.value); setFollowUpDays("") }} className="bg-white h-9" />
                </div>
              </div>
            </div>

            {/* ── Section 4: Discharge Summary ── */}
            <div className="rounded-xl border border-border bg-gray-50/50 p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <FileText className="h-3.5 w-3.5 inline mr-1" /> Discharge Summary
              </p>

              {inpatient.balanceAmount > 0 && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Outstanding balance: <strong>{formatCurrency(inpatient.balanceAmount)}</strong>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Discharge Date</Label>
                  <Input type="date" value={dischargeDate} onChange={e => setDischargeDate(e.target.value)} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Condition at Discharge</Label>
                  <Select value={conditionAtDischarge} onValueChange={setConditionAtDischarge}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>
                      {["Improved", "Stable", "Unchanged", "Worsened", "Recovered"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Discharge Diagnosis</Label>
                <Textarea
                  value={dischargeDiagnosis}
                  onChange={e => setDischargeDiagnosis(e.target.value)}
                  placeholder="Final diagnosis at discharge..."
                  className="bg-white min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Medications on Discharge</Label>
                <Textarea
                  value={dischargeMedications}
                  onChange={e => setDischargeMedications(e.target.value)}
                  placeholder="Medications prescribed on discharge..."
                  className="bg-white min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Follow-up Instructions</Label>
                <Textarea
                  value={followUpInstructions}
                  onChange={e => setFollowUpInstructions(e.target.value)}
                  placeholder="Follow-up visit schedule, precautions, diet..."
                  className="bg-white min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Additional Notes</Label>
                <Textarea
                  value={dischargeNotes}
                  onChange={e => setDischargeNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="bg-white min-h-16"
                />
              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleSavePrescription} disabled={savingRx}>
                {savingRx && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save Prescription
              </Button>
              <Button onClick={handleSaveAndDischarge} disabled={savingDischarge}>
                {savingDischarge && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save & Discharge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Print Modal                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={printOpen} onOpenChange={(open) => !open && setPrintOpen(false)}>
        <DialogContent className="max-w-217.5 max-h-[95vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-row items-center justify-between">
            <DialogTitle className="text-base">Print — {inpatient.name}</DialogTitle>
            <Button size="sm" onClick={handlePrint} disabled={printLoading} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </DialogHeader>

          {printLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <Tabs value={printTab} onValueChange={(v) => setPrintTab(v as typeof printTab)} className="flex-1 flex flex-col min-h-0">
              <div className="border-b border-border px-4">
                <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 -mb-px">
                  <TabsTrigger value="bill" className={TAB_CLASS}>Bill Summary</TabsTrigger>
                  <TabsTrigger value="discharge" className={TAB_CLASS}>Discharge Summary</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                <div ref={printRef}>
                  {(() => {
                    const hInfo = hospitalInfo ? {
                      name: hospitalInfo.name,
                      displayName: hospitalInfo.displayName,
                      address: hospitalInfo.address,
                      phone: hospitalInfo.phone,
                      email: hospitalInfo.email,
                      website: hospitalInfo.website,
                      registrationNo: hospitalInfo.registrationNo,
                      logoUrl: hospitalInfo.logoUrl,
                    } : { name: "Hospital" }

                    const pInfo = {
                      patientName: inpatient.name,
                      patientId: inpatient.ipNumber,
                      date: formatDate(inpatient.admissionDate),
                      mobile: inpatient.phone || "—",
                      gender: inpatient.gender,
                      age: String(inpatient.age),
                      address: inpatient.address || "—",
                      referredBy: inpatient.referredBy || undefined,
                      doctorName: doctors.join(", ") || "—",
                      department: inpatient.department || undefined,
                    }

                    const hospitalName = hInfo.displayName || hInfo.name

                    return (
                      <>
                        {/* Bill Summary */}
                        <TabsContent value="bill" className="mt-0">
                          <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
                            <div className="receipt-header-section">
                              <ReceiptHeader hospital={hInfo} />
                            </div>
                            <h2 className="text-sm text-center font-bold py-1 mb-2">BILL SUMMARY</h2>
                            <PatientInfoSection data={pInfo} />

                            {packageInclusions.length > 0 && (
                              <div className="pb-3 mb-4 no-break">
                                <h3 className="text-xs font-bold mb-2">PACKAGE INCLUSIONS</h3>
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr>
                                      <th className="border border-black p-2 text-left font-bold w-[10%]">S.No</th>
                                      <th className="border border-black p-2 text-left font-bold">ITEM</th>
                                      <th className="border border-black p-2 text-right font-bold w-[25%]">AMOUNT</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {packageInclusions.map((item, i) => (
                                      <tr key={i}>
                                        <td className="border border-black p-2">{i + 1}</td>
                                        <td className="border border-black p-2">{item.name}</td>
                                        <td className="border border-black p-2 text-right">{item.amount.toLocaleString("en-IN")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="pb-3 mb-4 no-break">
                              <table className="w-full border-collapse text-[11px]">
                                <tbody>
                                  <tr>
                                    <td className="border border-black p-2 font-bold">PACKAGE AMOUNT</td>
                                    <td className="border border-black p-2 text-right font-bold">{inpatient.packageAmount.toLocaleString("en-IN")}</td>
                                  </tr>
                                  {inpatient.discount > 0 && (
                                    <tr>
                                      <td className="border border-black p-2 font-bold">DISCOUNT</td>
                                      <td className="border border-black p-2 text-right font-bold">- {inpatient.discount.toLocaleString("en-IN")}</td>
                                    </tr>
                                  )}
                                  <tr>
                                    <td className="border border-black p-2 font-bold">NET AMOUNT</td>
                                    <td className="border border-black p-2 text-right font-bold">{inpatient.netAmount.toLocaleString("en-IN")}</td>
                                  </tr>
                                  <tr>
                                    <td className="border border-black p-2 font-bold">AMOUNT RECEIVED</td>
                                    <td className="border border-black p-2 text-right font-bold">{inpatient.totalReceivedAmount.toLocaleString("en-IN")}</td>
                                  </tr>
                                  <tr>
                                    <td className="border border-black p-2 font-bold">BALANCE DUE</td>
                                    <td className="border border-black p-2 text-right font-bold">{inpatient.balanceAmount.toLocaleString("en-IN")}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {paymentRecords.length > 0 && (
                              <div className="pb-3 mb-4 no-break">
                                <h3 className="text-xs font-bold mb-2">PAYMENT HISTORY</h3>
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr>
                                      <th className="border border-black p-2 text-left font-bold">DATE</th>
                                      <th className="border border-black p-2 text-left font-bold">TYPE</th>
                                      <th className="border border-black p-2 text-left font-bold">MODE</th>
                                      <th className="border border-black p-2 text-right font-bold">AMOUNT</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paymentRecords.map((p, i) => (
                                      <tr key={i}>
                                        <td className="border border-black p-2">{formatDate(p.date)}</td>
                                        <td className="border border-black p-2">{p.amountType}</td>
                                        <td className="border border-black p-2">{p.paymentMode}</td>
                                        <td className="border border-black p-2 text-right">{p.amount.toLocaleString("en-IN")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </ReceiptLayout>
                        </TabsContent>

                        {/* Discharge Summary */}
                        <TabsContent value="discharge" className="mt-0">
                          {/* ── Page 1: Admission + Clinical Details ── */}
                          <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
                            <div className="receipt-header-section">
                              <ReceiptHeader hospital={hInfo} />
                            </div>
                            <h2 className="text-sm text-center font-bold py-1 mb-2">DISCHARGE SUMMARY</h2>
                            <PatientInfoSection data={{
                              ...pInfo,
                              ...(inpatient.guardianName ? { referredBy: `Guardian: ${inpatient.guardianName}` } : {}),
                            }} />

                            <div className="pb-3 mb-4 border-b border-black no-break">
                              <h3 className="text-xs font-bold mb-3">ADMISSION DETAILS</h3>
                              <div className="text-[11px] grid grid-cols-3 gap-x-4 gap-y-2">
                                <div><div className="font-bold">ADMISSION DATE</div><div>{formatDate(inpatient.admissionDate)}</div></div>
                                <div><div className="font-bold">DISCHARGE DATE</div><div>{formatDate(inpatient.dischargeDate)}</div></div>
                                <div><div className="font-bold">DAYS STAYED</div><div>{daysAdmitted} days</div></div>
                                {inpatient.operationName && (
                                  <>
                                    <div><div className="font-bold">OPERATION</div><div>{inpatient.operationName}</div></div>
                                    <div><div className="font-bold">OPERATION DATE</div><div>{formatDate(inpatient.operationDate)}</div></div>
                                    <div><div className="font-bold">PROV. DIAGNOSIS</div><div>{inpatient.provisionDiagnosis ?? "—"}</div></div>
                                  </>
                                )}
                              </div>
                            </div>

                            {dischargeSummary && typeof dischargeSummary === "object" && (
                              <div className="pb-3 mb-4 border-b border-black no-break">
                                <h3 className="text-xs font-bold mb-3">CLINICAL DETAILS</h3>
                                <div className="text-[11px] space-y-2">
                                  {dischargeSummary.diagnosis && (
                                    <div><div className="font-bold">DISCHARGE DIAGNOSIS</div><div className="whitespace-pre-wrap">{dischargeSummary.diagnosis}</div></div>
                                  )}
                                  {dischargeSummary.conditionAtDischarge && (
                                    <div><div className="font-bold">CONDITION AT DISCHARGE</div><div>{dischargeSummary.conditionAtDischarge}</div></div>
                                  )}
                                  {dischargeSummary.medications && (
                                    <div><div className="font-bold">MEDICATIONS ON DISCHARGE</div><div className="whitespace-pre-wrap">{dischargeSummary.medications}</div></div>
                                  )}
                                  {dischargeSummary.followUpInstructions && (
                                    <div><div className="font-bold">FOLLOW-UP INSTRUCTIONS</div><div className="whitespace-pre-wrap">{dischargeSummary.followUpInstructions}</div></div>
                                  )}
                                  {dischargeSummary.notes && (
                                    <div><div className="font-bold">ADDITIONAL NOTES</div><div className="whitespace-pre-wrap">{dischargeSummary.notes}</div></div>
                                  )}
                                </div>
                              </div>
                            )}

                            {ipPrescriptions.length > 0 && (
                              <div className="pb-3 mb-4 border-b border-black no-break">
                                <h3 className="text-xs font-bold mb-2">DISCHARGE PRESCRIPTION</h3>
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr>
                                      <th className="border border-black p-2 text-left font-bold w-[8%]">#</th>
                                      <th className="border border-black p-2 text-left font-bold">MEDICINE</th>
                                      <th className="border border-black p-2 text-center font-bold w-[15%]">TIMING</th>
                                      <th className="border border-black p-2 text-center font-bold w-[15%]">DAYS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ipPrescriptions.map((rx, i) => (
                                      <tr key={i}>
                                        <td className="border border-black p-2">{i + 1}</td>
                                        <td className="border border-black p-2">{rx.medicine}</td>
                                        <td className="border border-black p-2 text-center">{rx.timing}</td>
                                        <td className="border border-black p-2 text-center">{rx.days}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {inpatient.followUpDate && (
                              <div className="text-[11px] mt-3 no-break">
                                <span className="font-bold">FOLLOW-UP DATE: </span>
                                <span>{formatDate(inpatient.followUpDate)}</span>
                              </div>
                            )}
                          </ReceiptLayout>

                          {/* ── Page 2: Medical Examination Values ── */}
                          {Object.values(storedMedicalValues).some(v => v) && (
                            <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
                              <div className="receipt-header-section">
                                <ReceiptHeader hospital={hInfo} />
                              </div>
                              <h2 className="text-sm text-center font-bold py-1 mb-2">DISCHARGE SUMMARY — contd.</h2>

                              <div className="pb-3 mb-4 no-break">
                                <h3 className="text-xs font-bold mb-2">MEDICAL EXAMINATION VALUES</h3>
                                {(() => {
                                  const filledFields = MEDICAL_VALUE_FIELDS.filter(f => storedMedicalValues[f.key])
                                  const chunkSize = 3
                                  const chunks: typeof filledFields[] = []
                                  for (let i = 0; i < filledFields.length; i += chunkSize) {
                                    chunks.push(filledFields.slice(i, i + chunkSize))
                                  }
                                  return (
                                    <table className="w-full border-collapse text-[11px]">
                                      <tbody>
                                        {chunks.map((chunk, ci) => (
                                          <React.Fragment key={ci}>
                                            <tr>
                                              {chunk.map(f => (
                                                <th key={f.key} className="border border-black p-2 text-center font-bold bg-gray-50">{f.label.toUpperCase()}</th>
                                              ))}
                                              {chunk.length < chunkSize && Array.from({ length: chunkSize - chunk.length }).map((_, i) => (
                                                <th key={`empty-h-${i}`} className="border border-black p-2"></th>
                                              ))}
                                            </tr>
                                            <tr>
                                              {chunk.map(f => (
                                                <td key={f.key} className="border border-black p-2 text-center">{String(storedMedicalValues[f.key])}</td>
                                              ))}
                                              {chunk.length < chunkSize && Array.from({ length: chunkSize - chunk.length }).map((_, i) => (
                                                <td key={`empty-v-${i}`} className="border border-black p-2"></td>
                                              ))}
                                            </tr>
                                          </React.Fragment>
                                        ))}
                                      </tbody>
                                    </table>
                                  )
                                })()}
                              </div>
                            </ReceiptLayout>
                          )}
                        </TabsContent>
                      </>
                    )
                  })()}
                </div>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
