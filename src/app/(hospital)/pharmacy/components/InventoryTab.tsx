"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Search,
  Filter,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  getStock,
  getMedicines,
  createMedicine,
  addStock,
  updateStock,
  getStockSummary,
  getSuppliers,
} from "../actions"

type StockItem = Awaited<ReturnType<typeof getStock>>[number]
type Medicine = Awaited<ReturnType<typeof getMedicines>>[number]
type Supplier = Awaited<ReturnType<typeof getSuppliers>>[number]

const CATEGORIES = ["Tablet", "Capsule", "Syrup", "Injection", "Drops", "Cream", "Ointment", "Powder", "Inhaler", "Surgical", "Consumable", "Other"]

const EMPTY_MED_FORM = {
  name: "", genericName: "", manufacturer: "", category: "", dosageForm: "",
  strength: "", unitOfMeasure: "Nos", hsnCode: "", gstPercent: 12, scheduleType: "",
}

const EMPTY_STOCK_FORM = {
  medicineId: "", batchNumber: "",
  packs: 0,          // number of packs/strips purchased
  packSize: 1,       // units per pack (e.g., 10 tablets per strip)
  mrpPerPack: 0,     // MRP printed on the pack
  costPerPack: 0,    // purchase price per pack
  gstPercent: 12,
  expiryMonth: "",
  supplierId: "",
}

export function InventoryTab({ onStockChanged }: { onStockChanged?: () => void }) {
  const [stock, setStock] = useState<StockItem[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "lowStock" | "nearExpiry">("all")
  const [summary, setSummary] = useState({ totalItems: 0, lowStock: 0, nearExpiry: 0, expired: 0, stockValue: 0 })
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [showAddStock, setShowAddStock] = useState(false)
  const [loading, setLoading] = useState(false)

  const [medForm, setMedForm] = useState(EMPTY_MED_FORM)
  const [stockForm, setStockForm] = useState(EMPTY_STOCK_FORM)

  // Track inline edit values per row
  const [editValues, setEditValues] = useState<Record<string, { quantity: number; mrp: number; costPrice: number }>>({})

  const refresh = useCallback(async () => {
    const filters: { search?: string; lowStock?: boolean; nearExpiry?: boolean } = {}
    if (search) filters.search = search
    if (filter === "lowStock") filters.lowStock = true
    if (filter === "nearExpiry") filters.nearExpiry = true
    const [stockData, summaryData] = await Promise.all([getStock(filters), getStockSummary()])
    setStock(stockData)
    setSummary(summaryData)
    // Initialize edit values from stock data
    const vals: Record<string, { quantity: number; mrp: number; costPrice: number }> = {}
    stockData.forEach((item) => {
      vals[item.id] = { quantity: item.quantity, mrp: item.mrp, costPrice: item.costPrice }
    })
    setEditValues(vals)
  }, [search, filter])

  useEffect(() => { refresh() }, [refresh])

  const refreshMedicines = useCallback(() => {
    getMedicines().then(setMedicines)
  }, [])

  useEffect(() => {
    refreshMedicines()
    getSuppliers().then(setSuppliers)
  }, [refreshMedicines])

  // Inline edit handler - saves on blur
  const handleInlineChange = (id: string, field: "quantity" | "mrp" | "costPrice", value: number) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleInlineSave = async (id: string, field: "quantity" | "mrp" | "costPrice") => {
    const val = editValues[id]
    if (!val) return
    const original = stock.find((s) => s.id === id)
    if (!original) return
    const originalVal = original[field]
    const newVal = val[field]
    if (originalVal === newVal) return

    const res = await updateStock(id, { [field]: newVal })
    if (res.success) {
      toast.success("Updated", { duration: 1500 })
      // Update local stock data without full refresh
      setStock((prev) => prev.map((s) => s.id === id ? { ...s, [field]: newVal } : s))
      onStockChanged?.()
    } else {
      toast.error(res.error)
      // Revert
      setEditValues((prev) => ({
        ...prev,
        [id]: { ...prev[id], [field]: originalVal },
      }))
    }
  }

  const handleAddMedicine = async () => {
    if (!medForm.name) return toast.error("Medicine name is required")
    setLoading(true)
    const cleanData = {
      name: medForm.name,
      genericName: medForm.genericName || undefined,
      manufacturer: medForm.manufacturer || undefined,
      category: medForm.category || undefined,
      dosageForm: medForm.dosageForm || undefined,
      strength: medForm.strength || undefined,
      unitOfMeasure: medForm.unitOfMeasure || "Nos",
      hsnCode: medForm.hsnCode || undefined,
      gstPercent: medForm.gstPercent,
      scheduleType: medForm.scheduleType || undefined,
    }
    const res = await createMedicine(cleanData)
    setLoading(false)
    if (res.success) {
      toast.success("Medicine added to master list")
      setShowAddMedicine(false)
      setMedForm(EMPTY_MED_FORM)
      refreshMedicines()
    } else {
      toast.error(res.error)
    }
  }

  const handleAddStock = async () => {
    if (!stockForm.medicineId) return toast.error("Select a medicine")
    if (!stockForm.batchNumber) return toast.error("Batch number is required")
    if (stockForm.packs <= 0) return toast.error("Number of packs must be > 0")
    if (stockForm.packSize <= 0) return toast.error("Pack size must be > 0")
    if (stockForm.mrpPerPack <= 0) return toast.error("MRP is required")
    if (!stockForm.expiryMonth) return toast.error("Expiry date is required")

    const totalUnits = stockForm.packs * stockForm.packSize
    const mrpPerUnit = stockForm.mrpPerPack / stockForm.packSize
    const costPerUnit = stockForm.costPerPack / stockForm.packSize

    setLoading(true)
    const res = await addStock({
      medicineId: stockForm.medicineId,
      batchNumber: stockForm.batchNumber,
      quantity: totalUnits,
      mrp: Math.round(mrpPerUnit * 100) / 100,
      costPrice: Math.round(costPerUnit * 100) / 100,
      gstPercent: stockForm.gstPercent,
      unitsPerPack: stockForm.packSize,
      expiryDate: stockForm.expiryMonth + "-01",
      supplierId: stockForm.supplierId || undefined,
    })
    setLoading(false)
    if (res.success) {
      toast.success(`Stock added: ${totalUnits} units (${stockForm.packs} packs x ${stockForm.packSize})`)
      setShowAddStock(false)
      setStockForm(EMPTY_STOCK_FORM)
      refresh()
      onStockChanged?.()
    } else {
      toast.error(res.error)
    }
  }

  const isNearExpiry = (date: Date | string) => {
    const d = new Date(date)
    const threeMonths = new Date()
    threeMonths.setMonth(threeMonths.getMonth() + 3)
    return d <= threeMonths
  }

  const isExpired = (date: Date | string) => new Date(date) <= new Date()

  // Computed values for the stock form
  const computedTotalUnits = stockForm.packs * stockForm.packSize
  const computedMrpPerUnit = stockForm.packSize > 0 ? stockForm.mrpPerPack / stockForm.packSize : 0
  const computedCostPerUnit = stockForm.packSize > 0 ? stockForm.costPerPack / stockForm.packSize : 0

  return (
    <div className="space-y-5">

      {/* Search & Actions Row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search medicine, batch, manufacturer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 border rounded-lg px-1 py-0.5 bg-muted/30">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          {(["all", "lowStock", "nearExpiry"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === f ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "lowStock" ? "Low Stock" : "Near Expiry"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Add Medicine Dialog */}
          <Dialog open={showAddMedicine} onOpenChange={(open) => { setShowAddMedicine(open); if (!open) setMedForm(EMPTY_MED_FORM) }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Add Medicine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Medicine to Master List</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="col-span-2">
                  <Label className="text-xs">Medicine Name *</Label>
                  <Input value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
                </div>
                <div>
                  <Label className="text-xs">Generic Name</Label>
                  <Input value={medForm.genericName} onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value })} placeholder="e.g. Paracetamol" />
                </div>
                <div>
                  <Label className="text-xs">Manufacturer</Label>
                  <Input value={medForm.manufacturer} onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={medForm.category || undefined} onValueChange={(v) => setMedForm({ ...medForm, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Strength</Label>
                  <Input value={medForm.strength} onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })} placeholder="e.g. 500mg" />
                </div>
                <div>
                  <Label className="text-xs">HSN Code</Label>
                  <Input value={medForm.hsnCode} onChange={(e) => setMedForm({ ...medForm, hsnCode: e.target.value })} placeholder="e.g. 3004" />
                </div>
                <div>
                  <Label className="text-xs">GST %</Label>
                  <Input type="number" value={medForm.gstPercent} onChange={(e) => setMedForm({ ...medForm, gstPercent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select value={medForm.unitOfMeasure} onValueChange={(v) => setMedForm({ ...medForm, unitOfMeasure: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Nos", "Strip", "Bottle", "Box", "Vial", "Tube", "Sachet"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Schedule</Label>
                  <Select value={medForm.scheduleType || undefined} onValueChange={(v) => setMedForm({ ...medForm, scheduleType: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["OTC", "H", "H1", "X"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddMedicine(false)}>Cancel</Button>
                <Button onClick={handleAddMedicine} disabled={loading}>
                  {loading ? "Saving..." : "Add Medicine"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Stock Dialog */}
          <Dialog open={showAddStock} onOpenChange={(open) => { setShowAddStock(open); if (!open) setStockForm(EMPTY_STOCK_FORM) }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Opening Stock</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Medicine & Batch */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Medicine *</Label>
                    {medicines.length === 0 ? (
                      <p className="text-xs text-amber-600 mt-1">No medicines in master list. Add a medicine first.</p>
                    ) : (
                      <Select value={stockForm.medicineId || undefined} onValueChange={(v) => {
                        const med = medicines.find((m) => m.id === v)
                        setStockForm({ ...stockForm, medicineId: v, gstPercent: med?.gstPercent ?? 12 })
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select Medicine" /></SelectTrigger>
                        <SelectContent>
                          {medicines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name} {m.manufacturer ? `(${m.manufacturer})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Batch Number *</Label>
                    <Input value={stockForm.batchNumber} onChange={(e) => setStockForm({ ...stockForm, batchNumber: e.target.value })} placeholder="e.g. B2024-001" />
                  </div>
                  <div>
                    <Label className="text-xs">Expiry Date *</Label>
                    <Input type="month" value={stockForm.expiryMonth} onChange={(e) => setStockForm({ ...stockForm, expiryMonth: e.target.value })} />
                  </div>
                </div>

                {/* Quantity Section */}
                <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</p>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <Label className="text-xs">No. of Packs *</Label>
                      <Input type="number" value={stockForm.packs || ""} onChange={(e) => setStockForm({ ...stockForm, packs: parseInt(e.target.value) || 0 })} placeholder="e.g. 10" />
                    </div>
                    <div>
                      <Label className="text-xs">Units / Pack *</Label>
                      <Input type="number" value={stockForm.packSize || ""} onChange={(e) => setStockForm({ ...stockForm, packSize: parseInt(e.target.value) || 1 })} placeholder="e.g. 10" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Tablets per strip, ml per bottle, etc.</p>
                    </div>
                    <div className="text-center pb-1">
                      <p className="text-xs text-muted-foreground">Total Units</p>
                      <p className="text-lg font-bold text-foreground">{computedTotalUnits}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing (per pack)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">MRP / Pack *</Label>
                      <Input type="number" step="0.01" value={stockForm.mrpPerPack || ""} onChange={(e) => setStockForm({ ...stockForm, mrpPerPack: parseFloat(e.target.value) || 0 })} placeholder="e.g. 100.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Cost / Pack</Label>
                      <Input type="number" step="0.01" value={stockForm.costPerPack || ""} onChange={(e) => setStockForm({ ...stockForm, costPerPack: parseFloat(e.target.value) || 0 })} placeholder="e.g. 80.00" />
                    </div>
                    <div>
                      <Label className="text-xs">GST %</Label>
                      <Input type="number" value={stockForm.gstPercent} onChange={(e) => setStockForm({ ...stockForm, gstPercent: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  {stockForm.packSize > 0 && stockForm.mrpPerPack > 0 && (
                    <div className="flex items-center gap-4 pt-1 text-xs">
                      <span className="text-muted-foreground">Rate/Unit: <span className="font-semibold text-foreground">{formatCurrency(computedMrpPerUnit)}</span></span>
                      {stockForm.costPerPack > 0 && (
                        <span className="text-muted-foreground">Cost/Unit: <span className="font-semibold text-foreground">{formatCurrency(computedCostPerUnit)}</span></span>
                      )}
                      {stockForm.costPerPack > 0 && computedMrpPerUnit > 0 && (
                        <span className="text-muted-foreground">Margin: <span className="font-semibold text-green-600">{((1 - computedCostPerUnit / computedMrpPerUnit) * 100).toFixed(1)}%</span></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Supplier */}
                <div>
                  <Label className="text-xs">Supplier</Label>
                  {suppliers.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">No suppliers added yet (optional)</p>
                  ) : (
                    <Select value={stockForm.supplierId || undefined} onValueChange={(v) => setStockForm({ ...stockForm, supplierId: v })}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <p className="text-xs text-red-500">*If Medicine is not Found, You Can Add it From the &quot;Add Medicine&quot; Button</p>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowAddStock(false)}>Cancel</Button>
                <Button onClick={handleAddStock} disabled={loading}>
                  {loading ? "Saving..." : "Save Stock"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stock Table - Inline Editable */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Medicine</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Batch</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Packing</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Qty (units)</th>
                <th className="text-right p-3 font-medium text-muted-foreground">MRP/Unit</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Cost/Unit</th>
                <th className="text-center p-3 font-medium text-muted-foreground">GST %</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Expiry</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    No stock items found. Add medicines and stock to get started.
                  </td>
                </tr>
              ) : (
                stock.map((item) => {
                  const ev = editValues[item.id] ?? { quantity: item.quantity, mrp: item.mrp, costPrice: item.costPrice }
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{item.medicine.name}</p>
                          {item.medicine.genericName && (
                            <p className="text-xs text-muted-foreground">{item.medicine.genericName}</p>
                          )}
                          {item.medicine.manufacturer && (
                            <p className="text-xs text-muted-foreground">{item.medicine.manufacturer}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{item.batchNumber}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {item.unitsPerPack}&apos;s
                        </Badge>
                      </td>
                      {/* Editable: Quantity */}
                      <td className="p-2">
                        <div className="flex flex-col items-end">
                          <Input
                            type="number"
                            className={`h-7 w-20 text-xs text-right ${ev.quantity <= 10 ? "border-red-300 text-red-600 font-semibold" : "border-transparent hover:border-input"} bg-transparent focus:bg-white`}
                            value={ev.quantity}
                            onChange={(e) => handleInlineChange(item.id, "quantity", parseInt(e.target.value) || 0)}
                            onBlur={() => handleInlineSave(item.id, "quantity")}
                          />
                          {ev.quantity <= 10 && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 mt-0.5">Low</Badge>
                          )}
                        </div>
                      </td>
                      {/* Editable: MRP per unit */}
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-20 text-xs text-right ml-auto border-transparent hover:border-input bg-transparent focus:bg-white"
                          value={ev.mrp}
                          onChange={(e) => handleInlineChange(item.id, "mrp", parseFloat(e.target.value) || 0)}
                          onBlur={() => handleInlineSave(item.id, "mrp")}
                        />
                      </td>
                      {/* Editable: Cost per unit */}
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-20 text-xs text-right ml-auto border-transparent hover:border-input bg-transparent focus:bg-white"
                          value={ev.costPrice}
                          onChange={(e) => handleInlineChange(item.id, "costPrice", parseFloat(e.target.value) || 0)}
                          onBlur={() => handleInlineSave(item.id, "costPrice")}
                        />
                      </td>
                      <td className="p-3 text-center text-xs">{item.gstPercent}%</td>
                      <td className="p-3">
                        <span className={isExpired(item.expiryDate) ? "text-red-600 font-semibold" : isNearExpiry(item.expiryDate) ? "text-amber-600 font-medium" : ""}>
                          {formatDate(item.expiryDate)}
                        </span>
                        {isExpired(item.expiryDate) && (
                          <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">Expired</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium text-xs">
                        {formatCurrency(ev.quantity * ev.mrp)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
