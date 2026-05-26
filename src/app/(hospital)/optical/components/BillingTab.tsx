"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/usePermissions"
import { Eye, Loader2, Plus, Printer, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency, todayISO } from "@/lib/utils"
import {
  getPatientWithARReading,
  searchOpticalStock,
  createOpticalBill,
  getOpticalBills,
} from "../actions"
import { OpticalBillPrintModal, type OpticalBillForPrint } from "./OpticalBillPrintModal"

type EyeValue = { sph?: string; cyl?: string; axis?: string; va?: string; add?: string; vacph?: string }
type ReadingData = { re?: EyeValue; le?: EyeValue; pd?: string } | null

type PatientInfo = {
  patientId: string
  name: string
  age: number | null
  gender: string
  phone: string
  doctorName: string | null
  autoRefractometer: ReadingData
  glassesReading: ReadingData
  presentPrescription: ReadingData
  readingDate: Date | string | null
  prescriptionId: string | null
}

type StockResult = {
  stockId: string
  productId: string
  name: string
  brand: string | null
  category: string
  type: string | null
  modelNumber: string | null
  batchNumber: string | null
  quantity: number
  mrp: number
  gstPercent: number
  power: string | null
}

type BillItem = {
  stockId?: string
  itemName: string
  category: string
  eye?: string
  quantity: number
  mrp: number
  price: number
  total: number
  discountPercent: number
  amount: number
  gstPercent: number
  availableQty: number
}

type OpticalBill = {
  id: string
  billNumber: string
  billDate: Date
  patientName: string
  patientId?: string | null
  patientPhone: string | null
  gender?: string | null
  referredDoctor?: string | null
  subtotal: number
  discountPercent: number
  discountAmount: number
  billAmount: number
  paidAmount: number
  balanceDue: number
  paymentMode: string
  deliveryDate?: Date | null
  orderNotes?: string | null
  status: string
  items: {
    id: string
    itemName: string
    category: string
    eye?: string | null
    quantity: number
    mrp: number
    price: number
    total: number
    discountPercent: number
    amount: number
  }[]
}

const PAYMENT_MODES = ["CASH", "UPI", "Card", "NEFT", "Credit"]

function ReadingRow({ label, data }: { label: string; data: ReadingData }) {
  if (!data) return null
  const re = data.re
  const le = data.le
  if (!re?.sph && !le?.sph) return null

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</p>
      <div className="text-xs space-y-0.5">
        <div className="flex gap-2">
          <span className="w-6 text-muted-foreground font-medium">RE</span>
          <span>SPH: {re?.sph || "—"}</span>
          <span>CYL: {re?.cyl || "—"}</span>
          <span>AXIS: {re?.axis || "—"}</span>
          {re?.add && <span>ADD: {re.add}</span>}
          {re?.va && <span>VA: {re.va}</span>}
        </div>
        <div className="flex gap-2">
          <span className="w-6 text-muted-foreground font-medium">LE</span>
          <span>SPH: {le?.sph || "—"}</span>
          <span>CYL: {le?.cyl || "—"}</span>
          <span>AXIS: {le?.axis || "—"}</span>
          {le?.add && <span>ADD: {le.add}</span>}
          {le?.va && <span>VA: {le.va}</span>}
        </div>
        {data.pd && <div className="text-muted-foreground">PD: {data.pd}</div>}
      </div>
    </div>
  )
}

export function BillingTab() {
  const { can } = usePermissions()
  // Patient
  const [patientSearch, setPatientSearch] = useState("")
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  // Bill items
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [itemSearch, setItemSearch] = useState("")
  const [searchResults, setSearchResults] = useState<StockResult[]>([])
  const [searching, setSearching] = useState(false)

  // Custom item
  const [showCustom, setShowCustom] = useState(false)
  const [customItem, setCustomItem] = useState({ name: "", category: "Lens", price: "", eye: "" })

  // Payment
  const [discountPercent, setDiscountPercent] = useState(0)
  const [roundOff, setRoundOff] = useState(0)
  const [paymentMode, setPaymentMode] = useState("CASH")
  const [paidAmount, setPaidAmount] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState("")
  const [orderNotes, setOrderNotes] = useState("")

  // History
  const [bills, setBills] = useState<OpticalBill[]>([])
  const [historyDateFrom, setHistoryDateFrom] = useState(todayISO)
  const [historyDateTo, setHistoryDateTo] = useState(todayISO)

  // Saving
  const [saving, setSaving] = useState(false)

  // Print
  const [printBill, setPrintBill] = useState<OpticalBillForPrint | null>(null)

  // Totals
  const subtotal = billItems.reduce((s, i) => s + i.total, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const netAmount = subtotal - discountAmount
  const billAmount = Math.round(netAmount + roundOff)
  const balanceDue = billAmount - paidAmount

  useEffect(() => {
    setPaidAmount(billAmount > 0 ? billAmount : 0)
  }, [billAmount])

  useEffect(() => { loadHistory() }, [])

  // Patient lookup
  async function lookupPatient() {
    if (!patientSearch.trim()) return
    setLookingUp(true)
    const result = await getPatientWithARReading(patientSearch.trim())
    setLookingUp(false)
    if (!result) {
      toast.error("Patient not found")
      setPatientInfo(null)
      return
    }
    setPatientInfo(result)
    toast.success(`Found: ${result.name}`)
  }

  // Search items
  useEffect(() => {
    if (itemSearch.length < 2) { setSearchResults([]); return }
    const timeout = setTimeout(async () => {
      setSearching(true)
      const results = await searchOpticalStock(itemSearch)
      setSearchResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [itemSearch])

  function addToBill(stock: StockResult) {
    if (billItems.some((i) => i.stockId === stock.stockId)) {
      toast.error("Already added"); return
    }
    setBillItems((prev) => [
      ...prev,
      {
        stockId: stock.stockId,
        itemName: [stock.brand, stock.name].filter(Boolean).join(" "),
        category: stock.category,
        quantity: 1,
        mrp: stock.mrp,
        price: stock.mrp,
        total: stock.mrp,
        discountPercent: 0,
        amount: stock.mrp,
        gstPercent: stock.gstPercent,
        availableQty: stock.quantity,
      },
    ])
    setItemSearch("")
    setSearchResults([])
  }

  function addCustomItem() {
    if (!customItem.name.trim() || !customItem.price) return
    const price = parseFloat(customItem.price)
    setBillItems((prev) => [
      ...prev,
      {
        itemName: customItem.name.trim(),
        category: customItem.category,
        eye: customItem.eye || undefined,
        quantity: 1,
        mrp: price,
        price,
        total: price,
        discountPercent: 0,
        amount: price,
        gstPercent: 12,
        availableQty: 999,
      },
    ])
    setCustomItem({ name: "", category: "Lens", price: "", eye: "" })
    setShowCustom(false)
  }

  function updateItem(index: number, field: string, value: number) {
    setBillItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, [field]: value }
        if (field === "quantity" || field === "price") {
          updated.total = updated.quantity * updated.price
        }
        updated.amount = updated.total - updated.total * (updated.discountPercent / 100)
        return updated
      })
    )
  }

  function removeItem(index: number) {
    setBillItems((prev) => prev.filter((_, i) => i !== index))
  }

  function clearBill() {
    setPatientSearch("")
    setPatientInfo(null)
    setBillItems([])
    setDiscountPercent(0)
    setRoundOff(0)
    setPaymentMode("CASH")
    setPaidAmount(0)
    setDeliveryDate("")
    setOrderNotes("")
  }

  async function saveBill() {
    if (!patientInfo?.name && !patientSearch.trim()) {
      toast.error("Patient name is required"); return
    }
    if (billItems.length === 0) {
      toast.error("Add at least one item"); return
    }

    // Validate quantities
    for (const item of billItems) {
      if (item.stockId && item.quantity > item.availableQty) {
        toast.error(`Insufficient stock for ${item.itemName}`); return
      }
    }

    setSaving(true)
    const result = await createOpticalBill({
      patientName: patientInfo?.name || patientSearch.trim(),
      patientId: patientInfo?.patientId,
      patientPhone: patientInfo?.phone,
      gender: patientInfo?.gender,
      referredDoctor: patientInfo?.doctorName ?? undefined,
      prescriptionId: patientInfo?.prescriptionId ?? undefined,
      lensPrescription: patientInfo?.presentPrescription as Record<string, unknown> | undefined,
      discountPercent,
      roundOff,
      paymentMode,
      paidAmount,
      deliveryDate: deliveryDate || undefined,
      orderNotes: orderNotes || undefined,
      items: billItems.map((i) => ({
        stockId: i.stockId,
        itemName: i.itemName,
        category: i.category,
        eye: i.eye,
        quantity: i.quantity,
        mrp: i.mrp,
        price: i.price,
        total: i.total,
        discountPercent: i.discountPercent,
        amount: i.amount,
        gstPercent: i.gstPercent,
      })),
    })
    setSaving(false)

    if (result.success) {
      toast.success(`Bill ${result.data.billNumber} created — ${formatCurrency(result.data.billAmount)}`)
      clearBill()
    } else {
      toast.error(result.error)
    }
  }

  async function loadHistory() {
    try {
      const data = await getOpticalBills({
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      })
      setBills((data ?? []) as OpticalBill[])
    } catch {
      toast.error("Failed to load bill history")
    }
  }

  const hasReadings = patientInfo && (patientInfo.autoRefractometer || patientInfo.presentPrescription || patientInfo.glassesReading)

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
      {/* ── Left: Bill Form ── */}
      <div className="md:col-span-8 space-y-5">
        {/* Patient Lookup */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Patient ID (e.g. OPD-001)"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupPatient()}
              className="flex-1 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
            />
            <Button onClick={lookupPatient} disabled={lookingUp} size="sm">
              {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>

          {patientInfo && (
            <div className="flex items-start gap-4 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{patientInfo.name}</p>
                <p className="text-muted-foreground">
                  {patientInfo.age && `${patientInfo.age}y`} {patientInfo.gender} · {patientInfo.phone}
                  {patientInfo.doctorName && ` · Dr. ${patientInfo.doctorName}`}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => { setPatientInfo(null); setPatientSearch("") }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* AR / Prescription Readings */}
          {hasReadings && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Eye className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Eye Readings
                  {patientInfo.readingDate && (
                    <span className="font-normal normal-case text-blue-500 ml-1">
                      ({new Date(patientInfo.readingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })})
                    </span>
                  )}
                </p>
              </div>
              <ReadingRow label="Auto Refractometer" data={patientInfo.autoRefractometer} />
              <ReadingRow label="Glasses Reading" data={patientInfo.glassesReading} />
              <ReadingRow label="Present Prescription" data={patientInfo.presentPrescription} />
            </div>
          )}
        </div>

        {/* Add Items */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Items</p>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search frames, lenses, accessories..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="pl-8 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
            />
            {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}

            {searchResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((s) => (
                  <button
                    key={s.stockId}
                    onClick={() => addToBill(s)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between text-sm border-b border-border last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {s.brand && <span className="text-muted-foreground">{s.brand} </span>}
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.category}
                        {s.type && ` · ${s.type}`}
                        {s.modelNumber && ` · ${s.modelNumber}`}
                        {s.power && ` · ${s.power}`}
                        {` · Qty: ${s.quantity}`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums ml-3 shrink-0">{formatCurrency(s.mrp)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom item */}
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add custom item
            </button>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Item name (e.g. Progressive Lens)"
                  value={customItem.name}
                  onChange={(e) => setCustomItem((p) => ({ ...p, name: e.target.value }))}
                  className="flex-1 h-8 text-sm bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                  autoFocus
                />
                <Select value={customItem.category} onValueChange={(v) => setCustomItem((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="w-32 h-8 text-sm bg-white focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Frame", "Lens", "Contact Lens", "Accessory", "Fitting"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={customItem.eye || "none"} onValueChange={(v) => setCustomItem((p) => ({ ...p, eye: v === "none" ? "" : v }))}>
                  <SelectTrigger className="w-24 h-8 text-sm bg-white focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                    <SelectValue placeholder="Eye" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="RE">RE</SelectItem>
                    <SelectItem value="LE">LE</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="₹ Price"
                  value={customItem.price}
                  onChange={(e) => setCustomItem((p) => ({ ...p, price: e.target.value }))}
                  className="w-24 h-8 text-sm bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
                <Button size="sm" className="h-8 px-3" onClick={addCustomItem}>Add</Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowCustom(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bill Items Table */}
        {billItems.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase">
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-center px-2 py-2 font-medium w-16">Qty</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Price</th>
                    <th className="text-right px-2 py-2 font-medium w-16">Disc %</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <p className="font-medium truncate max-w-[280px]">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category}
                          {item.eye && ` · ${item.eye}`}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="h-7 w-14 text-center mx-auto px-1 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                          min={1}
                          max={item.availableQty}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 text-right ml-auto px-2 border-0 shadow-none focus-visible:ring-0 bg-transparent tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          type="number"
                          value={item.discountPercent}
                          onChange={(e) => updateItem(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                          className="h-7 w-14 text-right ml-auto px-1 border-0 shadow-none focus-visible:ring-0 bg-transparent tabular-nums"
                          min={0}
                          max={100}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-1 py-2">
                        <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <div className="md:hidden space-y-2">
              {billItems.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.category}
                        {item.eye && ` · ${item.eye}`}
                      </p>
                    </div>
                    <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Qty</p>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="h-7 w-full text-center px-1 border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 text-xs"
                        min={1}
                        max={item.availableQty}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Price (₹)</p>
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                        className="h-7 w-full text-right px-2 border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 tabular-nums text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Disc %</p>
                      <Input
                        type="number"
                        value={item.discountPercent}
                        onChange={(e) => updateItem(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                        className="h-7 w-full text-right px-1 border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 tabular-nums text-xs"
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-border pt-2">
                    <span className="text-xs text-muted-foreground">Amount</span>
                    <span className="font-semibold tabular-nums text-sm">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Bill History */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill History</p>
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="h-8 text-sm w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="h-8 text-sm w-40" />
            </div>
            <Button size="sm" className="h-8" onClick={loadHistory}>Search</Button>
          </div>
          {bills.length > 0 ? (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {bills.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 px-2 text-sm rounded hover:bg-muted/30">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{b.billNumber}</span>
                    <span className="ml-2 font-medium">{b.patientName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(b.billDate).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      b.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      b.status === "ORDERED" ? "bg-blue-100 text-blue-700" :
                      b.status === "READY" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-700"
                    )}>{b.status}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(b.billAmount)}</span>
                    <button
                      onClick={() => setPrintBill(b as OpticalBillForPrint)}
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Print bill"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No bills found for today.</p>
          )}
        </div>
      </div>

      {/* ── Right: Bill Summary (sticky) ── */}
      <div className="md:col-span-4">
        <div className="sticky top-24 rounded-xl border border-border bg-card p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill Summary</p>

          {/* Items count */}
          <div className="text-sm text-muted-foreground">
            {billItems.length === 0 ? "No items added" : `${billItems.length} item${billItems.length > 1 ? "s" : ""}`}
          </div>

          {billItems.length > 0 && (
            <>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Discount %</span>
                  <Input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="h-7 w-20 text-right text-sm border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 tabular-nums"
                    min={0}
                    max={100}
                  />
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Round Off</span>
                  <Input
                    type="number"
                    value={roundOff}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    className="h-7 w-20 text-right text-sm border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 tabular-nums"
                  />
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(billAmount)}</span>
                </div>
              </div>

              <Separator />

              {/* Payment */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="h-8 text-sm border-gray-200 focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Amount Received</Label>
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 tabular-nums"
                    min={0}
                  />
                </div>
                {balanceDue > 0 && (
                  <div className="flex justify-between text-sm font-medium text-destructive">
                    <span>Balance Due</span>
                    <span className="tabular-nums">{formatCurrency(balanceDue)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Delivery */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expected Delivery</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="h-8 text-sm border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Input
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Lens type, coating, etc."
                  className="h-8 text-sm border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                {can("optical:create") && (
                  <Button className="w-full" onClick={saveBill} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Save Bill
                  </Button>
                )}
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={clearBill} size="sm">
                  Clear
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    <OpticalBillPrintModal
      open={!!printBill}
      onClose={() => setPrintBill(null)}
      bill={printBill}
    />
    </>
  )
}
