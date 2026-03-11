"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency, formatDate, todayISO } from "@/lib/utils"
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  updatePOStatus,
  getSuppliers,
  getMedicines,
} from "../actions"

type PO = Awaited<ReturnType<typeof getPurchaseOrders>>[number]
type Supplier = Awaited<ReturnType<typeof getSuppliers>>[number]
type Medicine = Awaited<ReturnType<typeof getMedicines>>[number]

type POItemForm = {
  medicineId: string
  medicineName: string
  batchNumber: string
  quantity: number
  costPrice: number
  mrp: number
  gstPercent: number
  expiryDate: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ORDERED: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}

export function PurchaseOrdersTab() {
  const [orders, setOrders] = useState<PO[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [showCreate, setShowCreate] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [expandedPO, setExpandedPO] = useState<string | null>(null)
  const [selectedPO, setSelectedPO] = useState<PO | null>(null)
  const [loading, setLoading] = useState(false)

  // Create PO form
  const [poForm, setPOForm] = useState({
    supplierId: "",
    expectedDate: "",
    invoiceNumber: "",
    invoiceDate: "",
    notes: "",
    discount: 0,
    paymentMode: "",
    amountPaid: 0,
  })
  const [poItems, setPOItems] = useState<POItemForm[]>([])

  // Receive items form
  const [receiveItems, setReceiveItems] = useState<{
    itemId: string
    medicineName: string
    orderedQty: number
    receivedQty: number
    newReceivedQty: number
    batchNumber: string
    expiryDate: string
    mrp: number
    costPrice: number
  }[]>([])

  const refresh = useCallback(async () => {
    const data = await getPurchaseOrders(statusFilter ? { status: statusFilter } : undefined)
    setOrders(data)
  }, [statusFilter])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    getSuppliers().then(setSuppliers)
    getMedicines().then(setMedicines)
  }, [])

  // Add item to PO
  const addPOItem = () => {
    setPOItems([...poItems, {
      medicineId: "", medicineName: "", batchNumber: "", quantity: 0,
      costPrice: 0, mrp: 0, gstPercent: 12, expiryDate: "",
    }])
  }

  const updatePOItem = (idx: number, updates: Partial<POItemForm>) => {
    const items = [...poItems]
    items[idx] = { ...items[idx], ...updates }
    setPOItems(items)
  }

  const removePOItem = (idx: number) => {
    setPOItems(poItems.filter((_, i) => i !== idx))
  }

  // Calculate PO totals
  const poSubtotal = poItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)
  const poGst = poItems.reduce((sum, item) => sum + (item.quantity * item.costPrice * item.gstPercent) / 100, 0)
  const poTotal = poSubtotal + poGst - poForm.discount

  // Create PO
  const handleCreatePO = async () => {
    if (!poForm.supplierId) return toast.error("Select a supplier")
    if (poItems.length === 0) return toast.error("Add at least one item")
    if (poItems.some((item) => !item.medicineId || item.quantity <= 0)) {
      return toast.error("All items must have medicine and quantity")
    }

    setLoading(true)
    const res = await createPurchaseOrder({
      ...poForm,
      items: poItems.map((item) => ({
        medicineId: item.medicineId,
        batchNumber: item.batchNumber || undefined,
        quantity: item.quantity,
        costPrice: item.costPrice,
        mrp: item.mrp,
        gstPercent: item.gstPercent,
        expiryDate: item.expiryDate || undefined,
      })),
    })
    setLoading(false)

    if (res.success) {
      toast.success(`Purchase Order ${res.data.orderNumber} created`)
      setShowCreate(false)
      setPOForm({ supplierId: "", expectedDate: "", invoiceNumber: "", invoiceDate: "", notes: "", discount: 0, paymentMode: "", amountPaid: 0 })
      setPOItems([])
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  // Open receive dialog
  const openReceive = (po: PO) => {
    setSelectedPO(po)
    setReceiveItems(
      po.items.map((item) => ({
        itemId: item.id,
        medicineName: item.medicine.name,
        orderedQty: item.quantity,
        receivedQty: item.receivedQty,
        newReceivedQty: item.quantity - item.receivedQty,
        batchNumber: item.batchNumber ?? "",
        expiryDate: item.expiryDate ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(item.expiryDate)) : "",
        mrp: item.mrp,
        costPrice: item.costPrice,
      }))
    )
    setShowReceive(true)
  }

  // Receive PO items
  const handleReceive = async () => {
    if (!selectedPO) return
    const itemsToReceive = receiveItems
      .filter((item) => item.newReceivedQty > 0)
      .map((item) => ({
        itemId: item.itemId,
        receivedQty: item.newReceivedQty,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        mrp: item.mrp,
        costPrice: item.costPrice,
      }))

    if (itemsToReceive.length === 0) return toast.error("No items to receive")
    if (itemsToReceive.some((item) => !item.batchNumber || !item.expiryDate)) {
      return toast.error("All items need batch number and expiry date")
    }

    setLoading(true)
    const res = await receivePurchaseOrder(selectedPO.id, itemsToReceive)
    setLoading(false)

    if (res.success) {
      toast.success("Items received and added to stock")
      setShowReceive(false)
      setSelectedPO(null)
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  const handleCancelPO = async (poId: string) => {
    if (!confirm("Cancel this purchase order?")) return
    const res = await updatePOStatus(poId, "CANCELLED")
    if (res.success) {
      toast.success("PO cancelled")
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 border rounded-lg px-1 py-0.5 bg-muted/30">
          {["", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === s ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={() => { setShowCreate(true); setPOItems([{ medicineId: "", medicineName: "", batchNumber: "", quantity: 0, costPrice: 0, mrp: 0, gstPercent: 12, expiryDate: "" }]); setPOForm({ supplierId: "", expectedDate: "", invoiceNumber: "", invoiceDate: "", notes: "", discount: 0, paymentMode: "", amountPaid: 0 }) }}>
          <Plus className="h-4 w-4 mr-1.5" /> New Purchase Order
        </Button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card className="p-12">
          <CardContent className="p-0 text-center text-muted-foreground">
            No purchase orders found. Create your first purchase order.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((po) => (
            <Card key={po.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedPO(expandedPO === po.id ? null : po.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{po.orderNumber}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[po.status] ?? ""}`}>
                        {po.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {po.supplier.name} | {formatDate(po.orderDate)} | {po.items.length} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(po.totalAmount)}</p>
                    {po.balanceDue > 0 && (
                      <p className="text-xs text-red-500">Due: {formatCurrency(po.balanceDue)}</p>
                    )}
                  </div>
                  {expandedPO === po.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {expandedPO === po.id && (
                <div className="border-t px-4 pb-4">
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Medicine</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qty</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">Received</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">Cost</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">MRP</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">GST %</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2 text-xs font-medium">{item.medicine.name}</td>
                          <td className="p-2 text-xs text-right">{item.quantity}</td>
                          <td className="p-2 text-xs text-right">
                            {item.receivedQty}
                            {item.receivedQty >= item.quantity && <Check className="inline h-3 w-3 ml-1 text-emerald-500" />}
                          </td>
                          <td className="p-2 text-xs text-right">{formatCurrency(item.costPrice)}</td>
                          <td className="p-2 text-xs text-right">{formatCurrency(item.mrp)}</td>
                          <td className="p-2 text-xs text-center">{item.gstPercent}%</td>
                          <td className="p-2 text-xs text-right font-medium">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td colSpan={5}></td>
                        <td className="p-2 text-xs text-right font-medium">Subtotal:</td>
                        <td className="p-2 text-xs text-right font-medium">{formatCurrency(po.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={5}></td>
                        <td className="p-2 text-xs text-right">GST:</td>
                        <td className="p-2 text-xs text-right">{formatCurrency(po.gstAmount)}</td>
                      </tr>
                      {po.discount > 0 && (
                        <tr>
                          <td colSpan={5}></td>
                          <td className="p-2 text-xs text-right">Discount:</td>
                          <td className="p-2 text-xs text-right text-red-500">-{formatCurrency(po.discount)}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={5}></td>
                        <td className="p-2 text-xs text-right font-semibold">Total:</td>
                        <td className="p-2 text-xs text-right font-semibold">{formatCurrency(po.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {po.notes && (
                    <p className="text-xs text-muted-foreground mt-2">Notes: {po.notes}</p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {(po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED") && (
                      <Button size="sm" onClick={() => openReceive(po)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Receive Items
                      </Button>
                    )}
                    {po.status === "ORDERED" && (
                      <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleCancelPO(po.id)}>
                        Cancel PO
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create PO Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <Label className="text-xs">Supplier *</Label>
              <Select value={poForm.supplierId || undefined} onValueChange={(v) => setPOForm({ ...poForm, supplierId: v })}>
                <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Invoice Number</Label>
              <Input value={poForm.invoiceNumber} onChange={(e) => setPOForm({ ...poForm, invoiceNumber: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Invoice Date</Label>
              <Input type="date" value={poForm.invoiceDate} onChange={(e) => setPOForm({ ...poForm, invoiceDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Expected Delivery</Label>
              <Input type="date" value={poForm.expectedDate} onChange={(e) => setPOForm({ ...poForm, expectedDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={poForm.notes} onChange={(e) => setPOForm({ ...poForm, notes: e.target.value })} />
            </div>
          </div>

          {/* PO Items */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Order Items</h4>
              <Button variant="outline" size="sm" onClick={addPOItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Medicine</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground w-24">Batch</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground w-16">Qty</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">Cost</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">MRP</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground w-16">GST %</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground w-28">Expiry</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {poItems.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-1.5">
                        <Select value={item.medicineId || undefined} onValueChange={(v) => {
                          const med = medicines.find((m) => m.id === v)
                          updatePOItem(idx, { medicineId: v, medicineName: med?.name ?? "", gstPercent: med?.gstPercent ?? 12 })
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {medicines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1.5">
                        <Input className="h-8 text-xs" value={item.batchNumber} onChange={(e) => updatePOItem(idx, { batchNumber: e.target.value })} />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" className="h-8 text-xs text-right" value={item.quantity || ""} onChange={(e) => updatePOItem(idx, { quantity: parseInt(e.target.value) || 0 })} />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" step="0.01" className="h-8 text-xs text-right" value={item.costPrice || ""} onChange={(e) => updatePOItem(idx, { costPrice: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" step="0.01" className="h-8 text-xs text-right" value={item.mrp || ""} onChange={(e) => updatePOItem(idx, { mrp: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" className="h-8 text-xs text-right" value={item.gstPercent} onChange={(e) => updatePOItem(idx, { gstPercent: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="p-1.5">
                        <Input type="month" className="h-8 text-xs" value={item.expiryDate ? item.expiryDate.substring(0, 7) : ""} onChange={(e) => updatePOItem(idx, { expiryDate: e.target.value ? e.target.value + "-01" : "" })} />
                      </td>
                      <td className="p-1.5 text-right text-xs font-medium">
                        {formatCurrency(item.quantity * item.costPrice * (1 + item.gstPercent / 100))}
                      </td>
                      <td className="p-1.5">
                        <Button variant="ghost" size="icon-sm" className="text-red-500" onClick={() => removePOItem(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PO Totals */}
            <div className="flex justify-end mt-3">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(poSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST:</span>
                  <span>{formatCurrency(poGst)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Discount:</span>
                  <Input
                    type="number"
                    className="w-24 h-7 text-xs text-right"
                    value={poForm.discount || ""}
                    onChange={(e) => setPOForm({ ...poForm, discount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex justify-between font-semibold border-t pt-1.5">
                  <span>Total:</span>
                  <span>{formatCurrency(poTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">Paid:</span>
                  <Input
                    type="number"
                    className="w-24 h-7 text-xs text-right"
                    value={poForm.amountPaid || ""}
                    onChange={(e) => setPOForm({ ...poForm, amountPaid: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => { setShowCreate(false); setPOItems([]) }}>Cancel</Button>
            <Button onClick={handleCreatePO} disabled={loading}>
              {loading ? "Creating..." : "Create Purchase Order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive Items Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Items - {selectedPO?.orderNumber}</DialogTitle>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Medicine</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground w-16">Ordered</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">Already Rcvd</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">Receiving</th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground w-24">Batch *</th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground w-28">Expiry *</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">MRP</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground w-20">Cost</th>
                </tr>
              </thead>
              <tbody>
                {receiveItems.map((item, idx) => (
                  <tr key={item.itemId} className="border-b">
                    <td className="p-2 text-xs font-medium">{item.medicineName}</td>
                    <td className="p-2 text-xs text-right">{item.orderedQty}</td>
                    <td className="p-2 text-xs text-right">{item.receivedQty}</td>
                    <td className="p-1.5">
                      <Input
                        type="number"
                        className="h-7 text-xs text-right"
                        value={item.newReceivedQty || ""}
                        onChange={(e) => {
                          const items = [...receiveItems]
                          items[idx] = { ...items[idx], newReceivedQty: parseInt(e.target.value) || 0 }
                          setReceiveItems(items)
                        }}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        className="h-7 text-xs"
                        value={item.batchNumber}
                        onChange={(e) => {
                          const items = [...receiveItems]
                          items[idx] = { ...items[idx], batchNumber: e.target.value }
                          setReceiveItems(items)
                        }}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        type="date"
                        className="h-7 text-xs"
                        value={item.expiryDate}
                        onChange={(e) => {
                          const items = [...receiveItems]
                          items[idx] = { ...items[idx], expiryDate: e.target.value }
                          setReceiveItems(items)
                        }}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-7 text-xs text-right"
                        value={item.mrp || ""}
                        onChange={(e) => {
                          const items = [...receiveItems]
                          items[idx] = { ...items[idx], mrp: parseFloat(e.target.value) || 0 }
                          setReceiveItems(items)
                        }}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-7 text-xs text-right"
                        value={item.costPrice || ""}
                        onChange={(e) => {
                          const items = [...receiveItems]
                          items[idx] = { ...items[idx], costPrice: parseFloat(e.target.value) || 0 }
                          setReceiveItems(items)
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setShowReceive(false)}>Cancel</Button>
            <Button onClick={handleReceive} disabled={loading}>
              {loading ? "Processing..." : "Receive & Update Stock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
