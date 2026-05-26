"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/usePermissions"
import {
  Loader2, Plus, X, Printer, Search, ClipboardList,
  User, Stethoscope, CreditCard, Pill, FileText, Activity, RotateCcw,
} from "lucide-react"
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
import { updateInPatientStatus, addInPatientPayment, dischargeInPatient, updateInPatientDetails, getHospitalProfileForReceipts } from "../actions"
import { getMedicineMaster } from "@/app/(hospital)/doctor/actions"
import { getInpatientTemplates } from "@/app/(hospital)/settings/actions"
import { getPredefinedDischarges } from "@/app/(hospital)/settings/actions"
import { AskSithaAI } from "@/app/(hospital)/doctor/components/AskSithaAI"
import { ReceiptLayout, ReceiptFooter } from "@/components/receipts/ReceiptLayout"
import { ReceiptHeader } from "@/components/receipts/ReceiptHeader"
import { PatientInfoSection } from "@/components/receipts/PatientInfoSection"
import { formatDate, formatCurrency, formatDateTime, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { InPatientStatus, PaymentRecord, PackageInclusion, MedicalValues } from "@/lib/types"

type InPatient = {
  id: string
  patientId: string
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

interface Props {
  inpatient: InPatient
  onBack: () => void
  onUpdate: () => void
  variant?: "info" | "form"
}

type DischargeTemplate = Awaited<ReturnType<typeof getPredefinedDischarges>>[number]

export function InPatientDetailPage({ inpatient, onBack, onUpdate, variant = "form" }: Props) {
  const { can } = usePermissions()

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

  // Discharge template picker state.
  const [dischargeTemplates, setDischargeTemplates] = useState<DischargeTemplate[]>([])
  const [templateQuery, setTemplateQuery] = useState("")
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)
  const [templateApplied, setTemplateApplied] = useState(false)
  const templateBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savingDischarge, setSavingDischarge] = useState(false)

  // ── Print state ──
  // `printRef` wraps the live A4 preview that's always rendered (info variant).
  // `selectedDoc` controls which document (bill/discharge) is currently shown.
  const printRef = useRef<HTMLDivElement>(null)
  const [selectedDoc, setSelectedDoc] = useState<"bill" | "discharge">("bill")
  const [hospitalInfo, setHospitalInfo] = useState<any>(null)

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
    // Info variant renders the bill/discharge previews inline, so we need
    // hospital info ready on mount (no longer lazy-loaded on Print click).
    if (variant === "info") {
      getHospitalProfileForReceipts().then(setHospitalInfo).catch(() => setHospitalInfo(null))
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

  // Fetch active discharge templates once per detail-page session.
  useEffect(() => {
    getPredefinedDischarges(false)
      .then(d => setDischargeTemplates(d as DischargeTemplate[]))
      .catch(() => setDischargeTemplates([]))
  }, [])

  const filteredDischargeTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase()
    if (!q) return dischargeTemplates.slice(0, 8)
    return dischargeTemplates
      .filter(t => t.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [templateQuery, dischargeTemplates])

  function applyDischargeTemplate(t: DischargeTemplate) {
    setDischargeDiagnosis(t.dischargeDiagnosis ?? "")
    setConditionAtDischarge(t.conditionAtDischarge ?? "")
    setFollowUpInstructions(t.followUpInstructions ?? "")
    // dischargeMedications is stored as a JSON array of prescription rows
    try {
      const parsed = JSON.parse(t.dischargeMedications ?? "[]")
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMedicines(parsed.map((m: { medicine?: string; days?: string; timing?: string; note?: string }) => ({
          medicine: m.medicine ?? "",
          days: m.days ?? "",
          timing: m.timing ?? "",
          note: m.note ?? "",
        })))
        setDischargeMedications("")
      } else {
        setDischargeMedications(t.dischargeMedications ?? "")
      }
    } catch {
      // legacy plain-text value
      setDischargeMedications(t.dischargeMedications ?? "")
    }
    setTemplateQuery(t.name)
    setTemplateDropdownOpen(false)
    setTemplateApplied(true)
  }

  function resetDischargeTemplate() {
    setDischargeDiagnosis("")
    setConditionAtDischarge("")
    setDischargeMedications("")
    setFollowUpInstructions("")
    setTemplateQuery("")
    setTemplateApplied(false)
  }

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
  // PRINT PREVIEW HELPERS (info variant)
  // Two A4 documents the inpatient page can print: Bill Summary and Discharge
  // Summary. Both render directly into the right pane of the new layout so the
  // doctor sees the bill the moment the page opens — no modal anymore.
  // ══════════════════════════════════════════════════════════════════════════════

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

  function renderBillPreview() {
    return (
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

      </ReceiptLayout>
    )
  }

  function renderDischargePreview() {
    return (
      <>
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
      </>
    )
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
              {variant === "info" && can("inpatients:edit") && (
                <Button size="sm" variant="outline" onClick={() => setShowPayment(v => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Payment
                </Button>
              )}
              {variant === "form" && transitions.length > 0 && can("inpatients:discharge") && (
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
      {/* INFO VARIANT — Document console for the Patients module              */}
      {/* Left rail: stacked detail cards; Right pane: live A4 preview         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {variant === "info" && (
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">

          {/* ── LEFT RAIL — Stacked detail cards ── */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-0.5">

            {/* Patient Info */}
            <DetailCard icon={<User className="h-3.5 w-3.5" />} title="Patient Info">
              <KVList items={[
                ["Age / Gender", `${inpatient.age} / ${inpatient.gender.charAt(0)}`],
                ["Phone", inpatient.phone],
                ["Guardian", inpatient.guardianName ?? "—"],
                ["DOB", formatDate(inpatient.dateOfBirth)],
                ["Admitted", formatDateTime(inpatient.admissionDate)],
                ["Days", `${daysAdmitted} day${daysAdmitted !== 1 ? "s" : ""}`],
                ["Referred By", inpatient.referredBy ?? "—"],
                ["Department", inpatient.department ?? "—"],
                ["Doctors", doctors.join(", ") || "—"],
                ["On Duty", (() => { try { return (JSON.parse(inpatient.onDutyDoctors) as string[]).join(", ") || "—" } catch { return "—" } })()],
                ["Bed / Ward", inpatient.bedNumber ? `${inpatient.bedNumber} / ${inpatient.wardName ?? ""}` : "—"],
              ]} />
              {inpatient.address && (
                <div className="mt-2 pt-2 border-t border-border/60">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-xs">{inpatient.address}</p>
                </div>
              )}
              {inpatient.admissionNotes && (
                <div className="mt-2 pt-2 border-t border-border/60">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Admission Notes</p>
                  <p className="text-xs whitespace-pre-wrap">{inpatient.admissionNotes}</p>
                </div>
              )}
            </DetailCard>

            {/* Operation */}
            {(inpatient.operationName || inpatient.provisionDiagnosis || inpatient.operationProcedure || inpatient.operationDetails) && (
              <DetailCard icon={<Stethoscope className="h-3.5 w-3.5" />} title="Operation">
                <KVList items={[
                  ["Operation", inpatient.operationName ?? "—"],
                  ["Date", formatDate(inpatient.operationDate)],
                  ["Diagnosis", inpatient.provisionDiagnosis ?? "—"],
                ]} />
                {inpatient.operationProcedure && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Procedure</p>
                    <p className="text-xs whitespace-pre-wrap">{inpatient.operationProcedure}</p>
                  </div>
                )}
                {inpatient.operationDetails && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Details</p>
                    <p className="text-xs whitespace-pre-wrap">{inpatient.operationDetails}</p>
                  </div>
                )}
              </DetailCard>
            )}

            {/* Medical Examination Values */}
            {Object.values(storedMedicalValues).some(v => v) && (
              <DetailCard icon={<Activity className="h-3.5 w-3.5" />} title="Medical Values">
                <div className="grid grid-cols-2 gap-1.5">
                  {MEDICAL_VALUE_FIELDS.filter(f => storedMedicalValues[f.key]).map(f => (
                    <div key={f.key} className="rounded-md bg-blue-50/60 border border-blue-100 px-2 py-1.5">
                      <p className="text-[9px] text-blue-600 font-semibold uppercase tracking-wider leading-none">{f.label}</p>
                      <p className="font-semibold text-xs mt-0.5">{String(storedMedicalValues[f.key])}</p>
                    </div>
                  ))}
                </div>
              </DetailCard>
            )}

            {/* Financial Summary */}
            <DetailCard icon={<CreditCard className="h-3.5 w-3.5" />} title="Financials">
              <div className="space-y-1.5 text-xs">
                <FinRow label="Package" value={formatCurrency(inpatient.packageAmount)} />
                {inpatient.discount > 0 && <FinRow label="Discount" value={`- ${formatCurrency(inpatient.discount)}`} />}
                <FinRow label="Net" value={formatCurrency(inpatient.netAmount)} bold />
                <FinRow label="Received" value={formatCurrency(inpatient.totalReceivedAmount)} className="text-green-700" />
                <div className="border-t border-border/60 my-1.5" />
                <FinRow
                  label="Balance Due"
                  value={formatCurrency(inpatient.balanceAmount)}
                  bold
                  className={inpatient.balanceAmount > 0 ? "text-red-600" : "text-green-700"}
                />
              </div>
              {packageInclusions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/60">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Inclusions ({packageInclusions.length})</p>
                  <ul className="space-y-0.5 text-xs">
                    {packageInclusions.map((item, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="truncate pr-2">{item.name}</span>
                        <span className="tabular-nums font-medium shrink-0">{formatCurrency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </DetailCard>


            {/* Prescription */}
            {ipPrescriptions.length > 0 && (
              <DetailCard icon={<Pill className="h-3.5 w-3.5" />} title={`Prescription (${ipPrescriptions.length})`}>
                <ul className="space-y-1.5 text-xs">
                  {ipPrescriptions.map((rx, i) => (
                    <li key={i} className="leading-snug">
                      <span className="font-medium">{i + 1}. {rx.medicine}</span>
                      {(rx.timing || rx.days) && (
                        <span className="text-muted-foreground">
                          {rx.timing && ` · ${rx.timing}`}
                          {rx.days && ` · ${rx.days}d`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {inpatient.followUpDate && (
                  <div className="mt-2 pt-2 border-t border-border/60 text-xs">
                    <span className="text-muted-foreground">Follow-up: </span>
                    <span className="font-medium">{formatDate(inpatient.followUpDate)}</span>
                  </div>
                )}
              </DetailCard>
            )}

            {/* Discharge details */}
            {inpatient.status === "DISCHARGED" && dischargeSummary && typeof dischargeSummary === "object" && dischargeSummary.diagnosis && (
              <DetailCard icon={<FileText className="h-3.5 w-3.5" />} title="Discharge Summary">
                <KVList items={[
                  ["Discharged", formatDate(inpatient.dischargeDate)],
                  ["Condition", dischargeSummary.conditionAtDischarge ?? "—"],
                ]} />
                {dischargeSummary.diagnosis && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Diagnosis</p>
                    <p className="text-xs whitespace-pre-wrap">{dischargeSummary.diagnosis}</p>
                  </div>
                )}
                {dischargeSummary.medications && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Medications</p>
                    <p className="text-xs whitespace-pre-wrap">{dischargeSummary.medications}</p>
                  </div>
                )}
                {dischargeSummary.followUpInstructions && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Follow-up</p>
                    <p className="text-xs whitespace-pre-wrap">{dischargeSummary.followUpInstructions}</p>
                  </div>
                )}
              </DetailCard>
            )}

          </div>

          {/* ── RIGHT PANE — Document preview console ── */}
          <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-white">
              <div className="flex items-center gap-1">
                {(["bill", "discharge"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDoc(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      selectedDoc === d
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {d === "bill" ? "Bill Summary" : "Discharge Summary"}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={handlePrint} disabled={!hospitalInfo} className="gap-1.5 shrink-0">
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-100 p-4 max-h-[calc(100vh-6rem)]">
              {!hospitalInfo ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading preview…</p>
                </div>
              ) : (
                <div ref={printRef}>
                  {selectedDoc === "bill" ? renderBillPreview() : renderDischargePreview()}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
      {/* FORM VARIANT — Combined Prescription + Discharge for Inpatients      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {variant === "form" && (
        <div className="flex gap-4">
        <div className="flex-1 min-w-0 rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="border-b border-border bg-gray-50/50 px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              Prescription & Discharge Summary
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in the medical details, prescription, and discharge information
            </p>
          </div>

          <div className="p-6 space-y-6 [&_input]:text-gray-900 [&_input]:font-semibold [&_input]:placeholder:text-gray-300 [&_input]:placeholder:font-normal [&_textarea]:text-gray-900 [&_textarea]:font-semibold [&_textarea]:placeholder:text-gray-300 [&_textarea]:placeholder:font-normal [&_[role=combobox]]:text-gray-900 [&_[role=combobox]]:font-semibold">
            {/* ── Discharge Summary (moved to top) ── */}
            <div className="rounded-xl border border-border bg-gray-50/50 p-5 space-y-4">
              {/* ───────── Predefined discharge picker ───────── */}
              <section className="mb-4">
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Predefined discharge
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/70">optional</span>
                    {templateApplied && (
                      <Button size="sm" variant="ghost" onClick={resetDischargeTemplate} className="h-6 gap-1 px-2 text-[11px]">
                        <RotateCcw className="h-3 w-3" /> Reset
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-white shadow-sm p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={templateQuery}
                      onChange={e => { setTemplateQuery(e.target.value); setTemplateDropdownOpen(true); setTemplateApplied(false) }}
                      onFocus={() => setTemplateDropdownOpen(true)}
                      onBlur={() => { templateBlurTimerRef.current = setTimeout(() => setTemplateDropdownOpen(false), 150) }}
                      placeholder="Search discharge templates..."
                      className="pl-9 h-9"
                    />
                    {templateDropdownOpen && filteredDischargeTemplates.length > 0 && (
                      <div
                        onMouseDown={() => { if (templateBlurTimerRef.current) clearTimeout(templateBlurTimerRef.current) }}
                        className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto"
                      >
                        {filteredDischargeTemplates.map(t => {
                          const meds = (t.dischargeMedications ?? "").split("\n")[0].slice(0, 80)
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => applyDischargeTemplate(t)}
                              className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                            >
                              <div className="text-sm font-medium text-foreground">{t.name}</div>
                              {meds && (
                                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {meds}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Pick a saved template to auto-fill the discharge fields below, or fill them manually.
                  </p>
                </div>
              </section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <FileText className="h-3.5 w-3.5 inline mr-1" /> Discharge Summary
              </p>

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
                <Label className="text-xs font-medium">Additional Notes</Label>
                <Textarea
                  value={dischargeNotes}
                  onChange={e => setDischargeNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="bg-white min-h-16"
                />
              </div>

              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  placeholder="Days from now"
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
                  className="bg-white h-9 w-32 shrink-0"
                />
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={e => { setFollowUpDate(e.target.value); setFollowUpDays("") }}
                  placeholder="Follow-up date"
                  className="bg-white h-9 flex-1"
                />
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

            {/* ── Medical Examination Values (moved to bottom) ── */}
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

            {/* ── Action Buttons ── */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {can("inpatients:discharge") && (
                <Button onClick={handleSaveAndDischarge} disabled={savingDischarge}>
                  {savingDischarge && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Save & Discharge
                </Button>
              )}
            </div>
          </div>
        </div>

          {/* Ask Sitha AI — right rail next to the discharge form */}
          <div className="w-80 shrink-0 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5">
            <AskSithaAI patientId={inpatient.patientId} module="inpatients" />
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Left-rail layout helpers ────────────────────────────────────────────────
// Small uniform building blocks used by the info-variant document console.

function DetailCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-primary">{icon}</span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{title}</p>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function KVList({ items }: { items: readonly (readonly [string, React.ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium text-foreground text-right truncate" title={typeof v === "string" ? v : undefined}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function FinRow({ label, value, bold = false, className = "" }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : "font-medium"} ${className}`}>{value}</span>
    </div>
  )
}
