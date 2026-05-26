"use client"

import { useState, useCallback, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Plus,
  Trash2,
  FileText,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ClipboardList,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency, formatDate, todayISO } from "@/lib/utils"
import {
  getPatientPrescription,
  searchMedicineStock,
  createPharmacyBill,
  getPharmacyBills,
  getPendingMedicines,
} from "../actions"
import { getHospitalProfileForReceipts } from "@/app/(hospital)/inpatients/actions"
import { printReceiptsHtml } from "@/lib/print-receipts"

type MedicineStock = Awaited<ReturnType<typeof searchMedicineStock>>[number]
type BillItem = {
  stockId: string
  medicineName: string
  batchNumber: string
  quantity: number
  mrp: number
  price: number
  total: number
  discountPercent: number
  amount: number
  gstPercent: number
  availableQty: number
}
type PharmacyBill = Awaited<ReturnType<typeof getPharmacyBills>>[number]
type HospitalProfileForReceipts = Awaited<ReturnType<typeof getHospitalProfileForReceipts>>

/**
 * Parse a prescription timing string into a doses-per-day count.
 * Returns null when the timing can't be reduced to a constant per-day frequency
 * (e.g. "Tapering", unrecognized free text).
 */
function timingToDosesPerDay(timing: string | undefined | null): number | null {
  if (!timing) return null
  const t = timing.trim()
  if (!t) return null
  const lower = t.toLowerCase()

  // Dose patterns like "1-1-1", "1-0-1", "1-1-1-1" — sum the digits
  if (/^\d+(\s*-\s*\d+)+$/.test(t)) {
    const sum = t.split("-").map(s => parseInt(s.trim(), 10) || 0).reduce((a, b) => a + b, 0)
    return sum > 0 ? sum : null
  }

  // "4 times/day", "4 times a day", "4x"
  const xTimes = lower.match(/(\d+)\s*(?:times?|x)\b/)
  if (xTimes) return parseInt(xTimes[1], 10) || null

  // Standard abbreviations
  if (lower === "od" || lower === "qd") return 1
  if (lower === "bd" || lower === "bid") return 2
  if (lower === "tds" || lower === "tid") return 3
  if (lower === "qid") return 4

  // Single-time-of-day words → 1
  if (/^(morning|night|evening|noon|afternoon|bedtime|hs|am|pm)$/.test(lower)) return 1

  // SOS / PRN — as-needed; conservative estimate of 1/day
  if (lower === "sos" || lower === "prn") return 1

  // Combos: "Morning, Night" / "Morning + Night" → count tokens
  if (lower.includes(",") || lower.includes("+")) {
    const parts = lower.split(/[,+]/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts.length
  }

  return null
}

function suggestedQuantity(days: string | undefined | null, timing: string | undefined | null): number | null {
  if (!days) return null
  const d = parseInt(String(days).trim(), 10)
  if (!d || d <= 0) return null
  const perDay = timingToDosesPerDay(timing)
  if (perDay == null) return null
  return d * perDay
}

/** Normalize medicine name for fuzzy comparison: lowercase, drop parenthesized text, strip punctuation, collapse whitespace. */
function normalizeMedName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Try to match a stock medicine name to a prescription line. Returns the matching prescription entry or null. */
function findPrescriptionMatch(
  stockName: string,
  meds: { name: string; days?: string; timing?: string }[],
): { name: string; days?: string; timing?: string } | null {
  const n = normalizeMedName(stockName)
  if (!n) return null
  for (const med of meds) {
    const m = normalizeMedName(med.name)
    if (!m) continue
    if (n === m) return med
    // First-two-token match handles cases like "Tobramycin Eye Drops (0.3%)" vs "Tobramycin Eye Drops 5ml"
    const nHead = n.split(" ").slice(0, 2).join(" ")
    const mHead = m.split(" ").slice(0, 2).join(" ")
    if (nHead && nHead === mHead) return med
    // Substring containment, guarded against trivially-short matches
    if (n.length >= 4 && m.includes(n)) return med
    if (m.length >= 4 && n.includes(m)) return med
  }
  return null
}

/** Escape HTML special characters in user-typed strings before inlining into a print template. */
function esc(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Build a single-page A4 HTML receipt for a pharmacy bill. The string is fed
 * to `printReceiptsHtml` which wraps it in the standard receipt-page CSS.
 * User-supplied fields (patient name, medicine names, etc.) are HTML-escaped.
 */
function buildPharmacyBillHtml(bill: PharmacyBill, hp: HospitalProfileForReceipts): string {
  const hospitalName = hp?.displayName || hp?.name || "Hospital"
  const billDate = new Date(bill.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  const itemsRows = bill.items.map((it: PharmacyBill["items"][number], i: number) => `
    <tr>
      <td class="border border-black p-1 text-center">${i + 1}</td>
      <td class="border border-black p-1">${esc(it.medicineName)}</td>
      <td class="border border-black p-1">${esc(it.batchNumber)}</td>
      <td class="border border-black p-1 text-right">${it.quantity}</td>
      <td class="border border-black p-1 text-right">${(it.mrp ?? 0).toFixed(2)}</td>
      <td class="border border-black p-1 text-right">${(it.discountPercent ?? 0).toFixed(2)}</td>
      <td class="border border-black p-1 text-right">${(it.gstPercent ?? 0).toFixed(2)}</td>
      <td class="border border-black p-1 text-right">${(it.amount ?? 0).toFixed(2)}</td>
    </tr>
  `).join("")

  return `
    <div class="receipt-page">
      <!-- Hospital header -->
      <div class="border-b-2 border-black pb-2 mb-3 text-center">
        ${hp?.logoUrl ? `<img src="${esc(hp.logoUrl)}" alt="" style="height:48px;margin:0 auto 4px;" />` : ""}
        <h1 class="text-lg font-bold tracking-tight">${esc(hospitalName)}</h1>
        ${hp?.address ? `<p class="text-[10px]">${esc(hp.address)}</p>` : ""}
        ${hp?.phone || hp?.email ? `<p class="text-[10px]">${[hp.phone && `Phone: ${esc(hp.phone)}`, hp.email && `Email: ${esc(hp.email)}`].filter(Boolean).join(" · ")}</p>` : ""}
        ${hp?.registrationNo ? `<p class="text-[10px]">Reg No: ${esc(hp.registrationNo)}</p>` : ""}
      </div>

      <h2 class="text-sm text-center font-bold py-1 mb-3 border border-black">PHARMACY BILL</h2>

      <!-- Patient + bill meta -->
      <div class="grid grid-cols-2 gap-3 text-[11px] mb-3 border-b border-black pb-2">
        <div class="space-y-0.5">
          <div><strong>Bill #:</strong> ${esc(bill.billNumber)}</div>
          <div><strong>Patient:</strong> ${esc(bill.patientName)}</div>
          <div><strong>Phone:</strong> ${esc(bill.patientPhone) || "—"}</div>
          ${bill.gender ? `<div><strong>Gender:</strong> ${esc(bill.gender)}</div>` : ""}
        </div>
        <div class="space-y-0.5 text-right">
          <div><strong>Date:</strong> ${esc(billDate)}</div>
          <div><strong>Doctor:</strong> ${esc(bill.referredDoctor) || "—"}</div>
          <div><strong>Payment:</strong> ${esc(bill.paymentMode)}${bill.paymentRef ? ` · ${esc(bill.paymentRef)}` : ""}</div>
          <div><strong>Status:</strong> ${esc(bill.status)}</div>
        </div>
      </div>

      <!-- Items -->
      <table class="w-full border-collapse text-[10px] mb-3">
        <thead>
          <tr>
            <th class="border border-black p-1 text-center font-bold w-[5%]">#</th>
            <th class="border border-black p-1 text-left font-bold">MEDICINE</th>
            <th class="border border-black p-1 text-left font-bold w-[14%]">BATCH</th>
            <th class="border border-black p-1 text-right font-bold w-[7%]">QTY</th>
            <th class="border border-black p-1 text-right font-bold w-[10%]">MRP</th>
            <th class="border border-black p-1 text-right font-bold w-[8%]">DISC%</th>
            <th class="border border-black p-1 text-right font-bold w-[8%]">GST%</th>
            <th class="border border-black p-1 text-right font-bold w-[12%]">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <!-- Totals -->
      <div class="flex justify-end">
        <table class="border-collapse text-[11px]" style="min-width:250px;">
          <tbody>
            <tr>
              <td class="p-1 pr-4 font-medium">Subtotal</td>
              <td class="p-1 text-right tabular-nums">${(bill.subtotal ?? 0).toFixed(2)}</td>
            </tr>
            ${(bill.discountAmount ?? 0) > 0 ? `<tr>
              <td class="p-1 pr-4 font-medium">Discount${bill.discountPercent ? ` (${bill.discountPercent}%)` : ""}</td>
              <td class="p-1 text-right tabular-nums">- ${bill.discountAmount.toFixed(2)}</td>
            </tr>` : ""}
            ${(bill.gstAmount ?? 0) > 0 ? `<tr>
              <td class="p-1 pr-4 font-medium">GST</td>
              <td class="p-1 text-right tabular-nums">${bill.gstAmount.toFixed(2)}</td>
            </tr>` : ""}
            ${(bill.roundOff ?? 0) !== 0 ? `<tr>
              <td class="p-1 pr-4 font-medium">Round Off</td>
              <td class="p-1 text-right tabular-nums">${bill.roundOff.toFixed(2)}</td>
            </tr>` : ""}
            <tr class="border-t-2 border-black font-bold">
              <td class="p-1 pr-4">TOTAL</td>
              <td class="p-1 text-right tabular-nums">${(bill.billAmount ?? 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td class="p-1 pr-4 font-medium">Paid</td>
              <td class="p-1 text-right tabular-nums">${(bill.paidAmount ?? 0).toFixed(2)}</td>
            </tr>
            ${(bill.balanceDue ?? 0) > 0 ? `<tr class="font-bold">
              <td class="p-1 pr-4">Balance Due</td>
              <td class="p-1 text-right tabular-nums">${bill.balanceDue.toFixed(2)}</td>
            </tr>` : ""}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="mt-6 pt-3 border-t border-black text-center text-[10px] text-gray-700">
        Thank you · ${esc(hospitalName)}
      </div>
    </div>
  `
}

export function BillingTab() {
  const { can } = usePermissions()
  // Patient info
  const [patientSearch, setPatientSearch] = useState("")
  const [patientInfo, setPatientInfo] = useState<{
    patientId: string; name: string; age: number | null; gender: string;
    phone: string; email: string | null; doctorName: string | null
  } | null>(null)
  const [prescriptionMeds, setPrescriptionMeds] = useState<{ name: string; days?: string; timing?: string; note?: string }[]>([])
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null)

  // Bill form
  const [patientName, setPatientName] = useState("")
  const [gender, setGender] = useState("Male")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [referredDoctor, setReferredDoctor] = useState("")

  // Medicine search & items
  const [medSearch, setMedSearch] = useState("")
  const [medResults, setMedResults] = useState<MedicineStock[]>([])
  const [billItems, setBillItems] = useState<BillItem[]>([])
  // Bill summary
  const [discountPercent, setDiscountPercent] = useState(0)
  const [roundOff, setRoundOff] = useState(0)
  const [paymentMode, setPaymentMode] = useState("CASH")
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentRef, setPaymentRef] = useState("")

  // Bill history
  const [bills, setBills] = useState<PharmacyBill[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyDateFrom, setHistoryDateFrom] = useState(todayISO())
  const [historyDateTo, setHistoryDateTo] = useState(todayISO())

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pending medicines
  type PendingPatient = Awaited<ReturnType<typeof getPendingMedicines>>[number]
  const [pendingDate, setPendingDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  )
  const [pendingPatients, setPendingPatients] = useState<PendingPatient[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // Calculations
  // subtotal = sum of item amounts after item-level discounts (MRP inclusive of GST)
  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const afterDiscount = subtotal - discountAmount
  // Extract GST from each item's share of the after-discount amount
  const gstTotal = billItems.reduce((sum, item) => {
    const itemShare = subtotal > 0 ? (item.amount / subtotal) * afterDiscount : 0
    return sum + (itemShare * item.gstPercent) / (100 + item.gstPercent)
  }, 0)
  const taxableAmount = afterDiscount - gstTotal
  const netAmount = afterDiscount
  const billAmount = Math.round(netAmount + roundOff)

  // Default paid amount to bill total
  useEffect(() => {
    setPaidAmount(billAmount)
  }, [billAmount])

  // Search patient by ID
  const handlePatientSearch = async () => {
    if (!patientSearch) return
    setLoading(true)
    const res = await getPatientPrescription(patientSearch)
    setLoading(false)
    if (!res.success) return toast.error(res.error)

    const { patient, prescription } = res.data
    setPatientInfo(patient)
    setPatientName(patient.name)
    // DB stores gender as "MALE"/"FEMALE"/"OTHER" — Select options are titlecase.
    const g = (patient.gender ?? "").toUpperCase()
    setGender(g === "FEMALE" ? "Female" : g === "OTHER" ? "Other" : "Male")
    setPhone(patient.phone)
    setEmail(patient.email ?? "")
    setReferredDoctor(patient.doctorName ?? prescription?.doctorName ?? "")
    setPrescriptionId(prescription?.id ?? null)
    setPrescriptionMeds(prescription?.medicines ?? [])
    toast.success(`Patient found: ${patient.name}`)
  }

  // Search medicine stock for billing
  const handleMedSearch = useCallback(async (search: string) => {
    setMedSearch(search)
    if (search.length < 2) { setMedResults([]); return }
    const results = await searchMedicineStock(search)
    setMedResults(results)
  }, [])

  // Add medicine to bill
  const addToBill = (stock: MedicineStock) => {
    // Check if already added
    if (billItems.find((item) => item.stockId === stock.stockId)) {
      return toast.error("Already added to bill")
    }

    // If this stock matches a prescribed medicine, pre-fill the prescribed quantity.
    // Cap at available stock; never below 1.
    const match = findPrescriptionMatch(stock.name, prescriptionMeds)
    const suggested = match ? suggestedQuantity(match.days, match.timing) : null
    const initialQty = suggested != null
      ? Math.max(1, Math.min(suggested, stock.quantity || suggested))
      : 1

    const newItem: BillItem = {
      stockId: stock.stockId,
      medicineName: stock.name,
      batchNumber: stock.batchNumber,
      quantity: initialQty,
      mrp: stock.mrp,
      price: stock.mrp,
      total: stock.mrp * initialQty,
      discountPercent: 0,
      amount: stock.mrp * initialQty,
      gstPercent: stock.gstPercent,
      availableQty: stock.quantity,
    }
    setBillItems([...billItems, newItem])
    setMedSearch("")
    setMedResults([])
  }

  // Update bill item
  const updateItem = (idx: number, field: string, value: number) => {
    const items = [...billItems]
    const item = { ...items[idx] }
    if (field === "quantity") {
      if (value > 0 && value > item.availableQty) return toast.error(`Only ${item.availableQty} available`)
      item.quantity = value < 0 ? 0 : value
    } else if (field === "price") {
      item.price = value
    } else if (field === "discountPercent") {
      item.discountPercent = value
    }
    item.total = item.quantity * item.price
    item.amount = item.total - item.total * (item.discountPercent / 100)
    items[idx] = item
    setBillItems(items)
  }

  // Remove item
  const removeItem = (idx: number) => {
    setBillItems(billItems.filter((_, i) => i !== idx))
  }

  // Clear bill
  const clearBill = () => {
    setPatientSearch("")
    setPatientInfo(null)
    setPatientName("")
    setGender("Male")
    setPhone("")
    setEmail("")
    setReferredDoctor("")
    setPrescriptionId(null)
    setPrescriptionMeds([])
    setBillItems([])
    setDiscountPercent(0)
    setRoundOff(0)
    setPaymentMode("CASH")
    setPaidAmount(0)
    setPaymentRef("")
  }

  // Load pending medicines for a date
  const loadPending = useCallback(async (date?: string) => {
    setPendingLoading(true)
    const data = await getPendingMedicines(date ?? pendingDate)
    setPendingPatients(data)
    setPendingLoading(false)
  }, [pendingDate])

  // Auto-load pending on mount
  useEffect(() => { loadPending() }, [loadPending])

  // Auto-fill billing form from a pending patient
  const selectPendingPatient = async (p: PendingPatient) => {
    setLoading(true)
    const res = await getPatientPrescription(p.patientId)
    setLoading(false)
    if (!res.success) return toast.error(res.error)
    const { patient, prescription } = res.data
    setPatientInfo(patient)
    setPatientName(patient.name)
    const g = (patient.gender ?? "").toUpperCase()
    setGender(g === "FEMALE" ? "Female" : g === "OTHER" ? "Other" : "Male")
    setPhone(patient.phone)
    setEmail(patient.email ?? "")
    setReferredDoctor(patient.doctorName ?? prescription?.doctorName ?? "")
    setPrescriptionId(prescription?.id ?? null)
    setPrescriptionMeds(prescription?.medicines ?? [])
    toast.success(`Loaded: ${patient.name}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Save bill
  const handleSave = async () => {
    if (!patientName) return toast.error("Patient name is required")
    if (billItems.length === 0) return toast.error("Add at least one medicine")

    setSaving(true)
    const res = await createPharmacyBill({
      patientName,
      patientId: patientInfo?.patientId,
      patientPhone: phone,
      gender,
      email,
      referredDoctor,
      prescriptionId: prescriptionId ?? undefined,
      discountPercent,
      roundOff,
      paymentMode,
      paidAmount,
      paymentRef,
      items: billItems.map((item) => ({
        stockId: item.stockId,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        mrp: item.mrp,
        price: item.price,
        total: item.total,
        discountPercent: item.discountPercent,
        amount: item.amount,
        gstPercent: item.gstPercent,
      })),
    })
    setSaving(false)

    if (res.success) {
      toast.success(`Bill ${res.data.billNumber} created - ${formatCurrency(res.data.billAmount)}`)
      clearBill()
      loadPending()
    } else {
      toast.error(res.error)
    }
  }

  // Load bill history
  const loadHistory = async () => {
    const data = await getPharmacyBills({ dateFrom: historyDateFrom, dateTo: historyDateTo })
    setBills(data)
  }

  // ── Bill printing (from history rows) ──
  // Hospital profile is lazy-loaded on the first print click and cached for the
  // rest of the session so we don't refetch it on every row print.
  const [hospitalProfile, setHospitalProfile] = useState<HospitalProfileForReceipts | null>(null)
  const [printingBillId, setPrintingBillId] = useState<string | null>(null)

  async function handlePrintBill(bill: PharmacyBill) {
    setPrintingBillId(bill.id)
    try {
      let hp = hospitalProfile
      if (!hp) {
        hp = await getHospitalProfileForReceipts()
        setHospitalProfile(hp)
      }
      const html = buildPharmacyBillHtml(bill, hp)
      printReceiptsHtml({ title: `Pharmacy Bill ${bill.billNumber}`, contentHtml: html })
    } catch (err) {
      console.error("Pharmacy bill print failed:", err)
      toast.error("Could not print bill")
    } finally {
      setPrintingBillId(null)
    }
  }

  const toggleHistory = () => {
    if (!showHistory) loadHistory()
    setShowHistory(v => !v)
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">Pharmacy Billing</h3>
          <span className="text-sm text-muted-foreground">
            Bill Date: <span className="font-medium text-foreground">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearBill}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear Bill
          </Button>
          <Button variant="outline" size="sm" onClick={toggleHistory}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Bill History
            {showHistory ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Pending Medicines — only shown when there are pending items */}
      {(pendingLoading || pendingPatients.length > 0) && <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Pending Medicines</h4>
            {pendingPatients.length > 0 && (
              <Badge variant="secondary" className="text-xs">{pendingPatients.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="h-7 w-36 text-xs"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => loadPending()}
              disabled={pendingLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${pendingLoading ? "animate-spin" : ""}`} />
              {pendingLoading ? "Loading..." : "Load"}
            </Button>
          </div>
        </div>

        {pendingPatients.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Click Load to see patients with pending medicines for the selected date.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingPatients.map((p) => (
              <div
                key={p.prescriptionId}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => selectPendingPatient(p)}
              >
                <div>
                  <p className="text-sm font-medium">{p.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.patientId} &middot; {p.phone}
                    {p.doctorName && ` · Dr. ${p.doctorName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {p.medicineCount} medicine{p.medicineCount !== 1 ? "s" : ""}
                  </Badge>
                  {p.billCount > 0 && (
                    <Badge variant="secondary" className="text-xs">Partial</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>}

      <div className="grid grid-cols-12 gap-5">
        {/* Left: Bill Form */}
        <div className="col-span-8 space-y-4">
          {/* Patient Info Card */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Patient ID..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
                  className="pl-9"
                />
              </div>
              <Button size="sm" onClick={handlePatientSearch} disabled={loading}>
                {loading ? "Searching..." : "Lookup"}
              </Button>
            </div>

            {/* Prescription medicines preview */}
            {prescriptionMeds.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-700 mb-2">
                  Prescription by Dr. {referredDoctor} ({prescriptionMeds.length} medicines)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {prescriptionMeds.map((med, i) => {
                    const qty = suggestedQuantity(med.days, med.timing)
                    return (
                      <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5 bg-white border border-blue-200">
                        {med.name} {med.days ? `- ${med.days} days` : ""} {med.timing ? `(${med.timing})` : ""}
                        {qty != null && (
                          <span className="ml-1.5 font-semibold text-blue-700">· qty ~{qty}</span>
                        )}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Patient Name *</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Referred Doctor</Label>
                <Input value={referredDoctor} onChange={(e) => setReferredDoctor(e.target.value)} />
              </div>
            </div>
          </Card>

          {/* Medicine Add Row */}
          <Card className="p-4">
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medicine name to add..."
                    value={medSearch}
                    onChange={(e) => handleMedSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Search Results Dropdown */}
              {medResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {medResults.map((stock) => (
                    <button
                      key={stock.stockId}
                      onClick={() => addToBill(stock)}
                      className="w-full px-4 py-2.5 text-left hover:bg-muted/50 flex items-center justify-between border-b last:border-0 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{stock.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Batch: {stock.batchNumber} | Exp: {formatDate(stock.expiryDate)} | Qty: {stock.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(stock.mrp)}</p>
                        <p className="text-xs text-muted-foreground">GST {stock.gstPercent}%</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Bill Items Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Medicine Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Batch</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Disc. %</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                        Search and add medicines to the bill
                      </td>
                    </tr>
                  ) : (
                    billItems.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <p className="font-medium text-sm">{item.medicineName}</p>
                          <p className="text-[10px] text-muted-foreground">Avl: {item.availableQty}</p>
                        </td>
                        <td className="p-3 text-xs font-mono">{item.batchNumber}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs text-right ml-auto border-transparent hover:border-input bg-transparent focus:bg-white"
                            value={item.price}
                            onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs text-right ml-auto border-transparent hover:border-input bg-transparent focus:bg-white"
                            value={item.quantity === 0 ? "" : item.quantity}
                            onChange={(e) => updateItem(idx, "quantity", e.target.value === "" ? 0 : parseInt(e.target.value))}
                            onBlur={() => { if (item.quantity < 1) updateItem(idx, "quantity", 1) }}
                          />
                        </td>
                        <td className="p-3 text-right text-xs">{formatCurrency(item.total)}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs text-right ml-auto border-transparent hover:border-input bg-transparent focus:bg-white"
                            value={item.discountPercent}
                            onChange={(e) => updateItem(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-3 text-right font-semibold text-xs">{formatCurrency(item.amount)}</td>
                        <td className="p-2">
                          <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-700" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>

        {/* Right: Bill Summary */}
        <div className="col-span-4">
          <Card className="p-4 sticky top-28">
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal (MRP)</span>
                <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center">
                <Label className="text-xs">Discount %</Label>
                <Input
                  type="number"
                  className="w-20 h-7 text-right text-xs"
                  value={discountPercent || ""}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                />
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Discount Amt</span>
                  <span className="font-medium tabular-nums text-red-500">- {formatCurrency(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm border-t pt-2">
                <span className="text-muted-foreground">Taxable Amount</span>
                <span className="font-medium tabular-nums">{formatCurrency(taxableAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">GST</span>
                <span className="font-medium tabular-nums">{formatCurrency(gstTotal)}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Net Amount</span>
                <span className="font-medium tabular-nums">{formatCurrency(netAmount)}</span>
              </div>

              <div className="flex justify-between items-center">
                <Label className="text-xs">Round Off</Label>
                <Input
                  type="number"
                  step="0.5"
                  className="w-20 h-7 text-right text-xs"
                  value={roundOff || ""}
                  onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-semibold">Bill Amount</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(billAmount)}</span>
              </div>

              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Paid"
                    className="flex-1 h-7 text-right text-xs"
                    value={paidAmount || ""}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <Input
                  placeholder="Reference"
                  className="h-7 text-xs"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              {billAmount > 0 && paidAmount < billAmount && (
                <div className="flex justify-between items-center pt-2 border-t border-red-200 bg-red-50 -mx-4 px-4 pb-2 rounded-b-lg">
                  <span className="text-sm font-semibold text-red-600">Balance Due</span>
                  <span className="text-lg font-bold tabular-nums text-red-600">{formatCurrency(billAmount - paidAmount)}</span>
                </div>
              )}
            </div>

            {can("pharmacy:create") && (
              <div className="flex gap-2 pt-3 mt-3 border-t">
                <Button className="flex-1" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button className="flex-1 bg-indigo-500 hover:bg-indigo-600" size="sm" onClick={handleSave} disabled={saving}>
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Print
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Bill History — full width below */}
      {showHistory && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Bill History</h4>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">From</Label>
                <Input type="date" className="h-7 w-36 text-xs" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">To</Label>
                <Input type="date" className="h-7 w-36 text-xs" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadHistory}>Search</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Bill #</th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Patient</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Items</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Paid</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Due</th>
                  <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-2 text-xs font-medium text-muted-foreground w-12">Print</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">No bills found</td></tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="border-b hover:bg-muted/20">
                      <td className="p-2 font-mono text-xs">{bill.billNumber}</td>
                      <td className="p-2 text-xs">{formatDate(bill.billDate)}</td>
                      <td className="p-2">
                        <p className="font-medium text-xs">{bill.patientName}</p>
                        <p className="text-[10px] text-muted-foreground">{bill.patientPhone}</p>
                      </td>
                      <td className="p-2 text-right">{bill.items.length}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(bill.billAmount)}</td>
                      <td className="p-2 text-right text-green-600">{formatCurrency(bill.paidAmount)}</td>
                      <td className="p-2 text-right">
                        <span className={`font-medium ${bill.balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                          {bill.balanceDue > 0 ? formatCurrency(bill.balanceDue) : "Nil"}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant={bill.balanceDue > 0 ? "destructive" : "default"} className="text-[10px]">
                          {bill.balanceDue > 0 ? "DUE" : bill.status === "COMPLETED" ? "PAID" : bill.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handlePrintBill(bill)}
                          disabled={printingBillId === bill.id}
                          title="Print bill"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
