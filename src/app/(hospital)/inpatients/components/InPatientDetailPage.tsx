"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  ArrowLeft, ChevronRight, Loader2, Plus, X, Printer,
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
import { InPatientStatusBadge, IP_STATUS_CONFIG, IP_STATUS_TRANSITIONS } from "./InPatientStatusBadge"
import { updateInPatientStatus, addInPatientPayment, dischargeInPatient, updateInPatientDetails } from "../actions"
import { getMedicineMaster } from "@/app/(hospital)/doctor/actions"
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
  const [medicineOptions, setMedicineOptions] = useState<string[]>([])
  const [savingRx, setSavingRx] = useState(false)

  // ── Discharge state (form variant) ──
  const [dischargeDate, setDischargeDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()))
  const [dischargeNotes, setDischargeNotes] = useState("")
  const [dischargeDiagnosis, setDischargeDiagnosis] = useState("")
  const [conditionAtDischarge, setConditionAtDischarge] = useState("")
  const [dischargeMedications, setDischargeMedications] = useState("")
  const [followUpInstructions, setFollowUpInstructions] = useState("")
  const [savingDischarge, setSavingDischarge] = useState(false)

  // ── Print refs ──
  const rxPrintRef = useRef<HTMLDivElement>(null)
  const dischargePrintRef = useRef<HTMLDivElement>(null)
  const billPrintRef = useRef<HTMLDivElement>(null)

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
      getMedicineMaster().then(meds => setMedicineOptions(meds.map(m => m.name)))
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
      setMedicines([{ medicine: "", days: "7", timing: "1-1-1", note: "" }])
    }
    setMedicalValues(storedMedicalValues)
    setFollowUpDate(inpatient.followUpDate ? formatDate(inpatient.followUpDate) : "")

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
    setMedicines(prev => [...prev, { medicine: "", days: "7", timing: "1-1-1", note: "" }])
  }
  function removeMedicine(i: number) {
    setMedicines(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateMedicine(i: number, field: string, value: string) {
    setMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }
  function updateMedicalValue(key: keyof MedicalValues, value: string) {
    setMedicalValues(prev => ({ ...prev, [key]: value }))
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

  function handlePrint(ref: React.RefObject<HTMLDivElement | null>) {
    if (!ref.current) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Print</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; font-weight: 600; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 8px 0; }
        .grid-item label { font-size: 11px; color: #666; display: block; }
        .grid-item span { font-weight: 500; }
        .meta { color: #666; font-size: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${ref.current.innerHTML}
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
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
                <Button size="sm" variant="outline" onClick={() => handlePrint(billPrintRef)}>
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

              {/* Hidden bill print content */}
              <div className="hidden">
                <div ref={billPrintRef}>
                  <h1>Bill Summary</h1>
                  <p className="meta">{inpatient.name} | {inpatient.ipNumber} | {inpatient.age}y / {inpatient.gender.charAt(0)} | Phone: {inpatient.phone}</p>
                  <p className="meta">Doctor(s): {doctors.join(", ") || "—"} | Department: {inpatient.department ?? "—"}</p>
                  <p className="meta">Admission: {formatDate(inpatient.admissionDate)}{inpatient.dischargeDate ? ` | Discharge: ${formatDate(inpatient.dischargeDate)}` : ""}</p>

                  {packageInclusions.length > 0 && (
                    <>
                      <h2>Package Inclusions</h2>
                      <table>
                        <thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
                        <tbody>
                          {packageInclusions.map((item, i) => (
                            <tr key={i}><td>{item.name}</td><td style={{ textAlign: "right" }}>{formatCurrency(item.amount)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <div className="grid" style={{ marginTop: "16px" }}>
                    <div className="grid-item"><label>Package Amount</label><span>{formatCurrency(inpatient.packageAmount)}</span></div>
                    <div className="grid-item"><label>Discount</label><span>- {formatCurrency(inpatient.discount)}</span></div>
                    <div className="grid-item"><label>Net Amount</label><span>{formatCurrency(inpatient.netAmount)}</span></div>
                  </div>

                  {paymentRecords.length > 0 && (
                    <>
                      <h2>Payment History</h2>
                      <table>
                        <thead><tr><th>Date</th><th>Type</th><th>Mode</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
                        <tbody>
                          {paymentRecords.map((p, i) => (
                            <tr key={i}><td>{formatDate(p.date)}</td><td>{p.amountType}</td><td>{p.paymentMode}</td><td style={{ textAlign: "right" }}>{formatCurrency(p.amount)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <div className="grid" style={{ marginTop: "16px" }}>
                    <div className="grid-item"><label>Total Received</label><span>{formatCurrency(inpatient.totalReceivedAmount)}</span></div>
                    <div className="grid-item"><label>Balance Due</label><span>{formatCurrency(inpatient.balanceAmount)}</span></div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ════ Prescription Tab (read-only) ════ */}
            <TabsContent value="rx" className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Pill className="h-3.5 w-3.5 inline mr-1" /> Discharge Prescription
                </p>
                {ipPrescriptions.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handlePrint(rxPrintRef)}>
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

              {/* Hidden print content */}
              <div className="hidden">
                <div ref={rxPrintRef}>
                  <h1>{inpatient.name} - Discharge Prescription</h1>
                  <p className="meta">{inpatient.ipNumber} | {inpatient.age}y / {inpatient.gender.charAt(0)} | Phone: {inpatient.phone}</p>
                  <p className="meta">Admission: {formatDate(inpatient.admissionDate)} | Doctor(s): {doctors.join(", ") || "—"}</p>
                  {inpatient.operationName && <p className="meta">Operation: {inpatient.operationName} ({formatDate(inpatient.operationDate)})</p>}

                  {Object.values(storedMedicalValues).some(v => v) && (
                    <>
                      <h2>Medical Values</h2>
                      <div className="grid">
                        {MEDICAL_VALUE_FIELDS.filter(f => storedMedicalValues[f.key]).map(f => (
                          <div key={f.key} className="grid-item">
                            <label>{f.label}</label>
                            <span>{String(storedMedicalValues[f.key])}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <h2>Medications</h2>
                  <table>
                    <thead><tr><th>#</th><th>Medicine</th><th>Days</th><th>Timing</th><th>Note</th></tr></thead>
                    <tbody>
                      {ipPrescriptions.map((rx, i) => (
                        <tr key={i}><td>{i + 1}</td><td>{rx.medicine}</td><td>{rx.days}</td><td>{rx.timing}</td><td>{rx.note || ""}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {inpatient.followUpDate && <p><strong>Follow-up Date:</strong> {formatDate(inpatient.followUpDate)}</p>}
                </div>
              </div>
            </TabsContent>

            {/* ════ Discharge Summary Tab (read-only) ════ */}
            <TabsContent value="discharge" className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <FileText className="h-3.5 w-3.5 inline mr-1" /> Discharge Summary
                </p>
                {inpatient.status === "DISCHARGED" && dischargeSummary && (
                  <Button size="sm" variant="outline" onClick={() => handlePrint(dischargePrintRef)}>
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

              {/* Hidden print content */}
              <div className="hidden">
                <div ref={dischargePrintRef}>
                  <h1>Discharge Summary</h1>
                  <p className="meta">{inpatient.name} | {inpatient.ipNumber} | {inpatient.age}y / {inpatient.gender.charAt(0)} | Phone: {inpatient.phone}</p>
                  {inpatient.guardianName && <p className="meta">Guardian: {inpatient.guardianName}</p>}
                  <p className="meta">Doctor(s): {doctors.join(", ") || "—"} | Department: {inpatient.department ?? "—"}</p>

                  <div className="grid">
                    <div className="grid-item"><label>Admission Date</label><span>{formatDate(inpatient.admissionDate)}</span></div>
                    <div className="grid-item"><label>Discharge Date</label><span>{formatDate(inpatient.dischargeDate)}</span></div>
                    <div className="grid-item"><label>Days Stayed</label><span>{daysAdmitted} days</span></div>
                  </div>

                  {inpatient.operationName && (
                    <div className="grid">
                      <div className="grid-item"><label>Operation</label><span>{inpatient.operationName}</span></div>
                      <div className="grid-item"><label>Operation Date</label><span>{formatDate(inpatient.operationDate)}</span></div>
                      <div className="grid-item"><label>Provisional Diagnosis</label><span>{inpatient.provisionDiagnosis ?? "—"}</span></div>
                    </div>
                  )}

                  {dischargeSummary && typeof dischargeSummary === "object" && (
                    <>
                      {dischargeSummary.diagnosis && <><h2>Discharge Diagnosis</h2><p>{dischargeSummary.diagnosis}</p></>}
                      {dischargeSummary.conditionAtDischarge && <><h2>Condition at Discharge</h2><p>{dischargeSummary.conditionAtDischarge}</p></>}
                      {dischargeSummary.medications && <><h2>Medications</h2><p>{dischargeSummary.medications}</p></>}
                      {dischargeSummary.followUpInstructions && <><h2>Follow-up Instructions</h2><p>{dischargeSummary.followUpInstructions}</p></>}
                      {dischargeSummary.notes && <><h2>Additional Notes</h2><p>{dischargeSummary.notes}</p></>}
                    </>
                  )}

                  {ipPrescriptions.length > 0 && (
                    <>
                      <h2>Discharge Prescription</h2>
                      <table>
                        <thead><tr><th>#</th><th>Medicine</th><th>Days</th><th>Timing</th></tr></thead>
                        <tbody>
                          {ipPrescriptions.map((rx, i) => (
                            <tr key={i}><td>{i + 1}</td><td>{rx.medicine}</td><td>{rx.days}</td><td>{rx.timing}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <div className="grid" style={{ marginTop: "40px" }}>
                    <div className="grid-item"><label>Package Amount</label><span>{formatCurrency(inpatient.packageAmount)}</span></div>
                    <div className="grid-item"><label>Net Amount</label><span>{formatCurrency(inpatient.netAmount)}</span></div>
                    <div className="grid-item"><label>Balance</label><span>{formatCurrency(inpatient.balanceAmount)}</span></div>
                  </div>
                </div>
              </div>
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
                  <Label className="text-xs">Follow-up Date</Label>
                  <Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="bg-white h-9" />
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
    </div>
  )
}
