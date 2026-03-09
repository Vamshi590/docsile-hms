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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../actions"

type Supplier = Awaited<ReturnType<typeof getSuppliers>>[number]

const emptyForm = {
  name: "", contactPerson: "", phone: "", email: "",
  address: "", gstin: "", drugLicenseNo: "", creditDays: 30,
}

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const data = await getSuppliers(search || undefined)
    setSuppliers(data)
  }, [search])

  useEffect(() => { refresh() }, [refresh])

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      gstin: supplier.gstin ?? "",
      drugLicenseNo: supplier.drugLicenseNo ?? "",
      creditDays: supplier.creditDays,
    })
    setShowForm(true)
  }

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return toast.error("Supplier name is required")
    setLoading(true)

    if (editing) {
      const res = await updateSupplier(editing.id, form)
      if (res.success) {
        toast.success("Supplier updated")
      } else {
        toast.error(res.error)
        setLoading(false)
        return
      }
    } else {
      const res = await createSupplier(form)
      if (res.success) {
        toast.success("Supplier added")
      } else {
        toast.error(res.error)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
    refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this supplier?")) return
    const res = await deleteSupplier(id)
    if (res.success) {
      toast.success("Supplier deactivated")
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Supplier
        </Button>
      </div>

      {/* Supplier Cards Grid */}
      {suppliers.length === 0 ? (
        <Card className="p-12">
          <CardContent className="p-0 text-center text-muted-foreground">
            No suppliers found. Add your first supplier to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="p-5 hover:shadow-md transition-shadow">
              <CardContent className="p-0 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{supplier.name}</h4>
                      {supplier.contactPerson && (
                        <p className="text-xs text-muted-foreground">{supplier.contactPerson}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(supplier)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {supplier.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3" /> {supplier.phone}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3" /> {supplier.email}
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{supplier.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t">
                  {supplier.gstin && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      GSTIN: {supplier.gstin}
                    </Badge>
                  )}
                  {supplier.drugLicenseNo && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      DL: {supplier.drugLicenseNo}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
                    Credit: {supplier.creditDays} days
                  </Badge>
                  <Badge variant="info" className="text-[10px] px-1.5 py-0">
                    {supplier._count.purchaseOrders} POs
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2">
              <Label className="text-xs">Supplier Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Contact Person</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">GSTIN</Label>
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="e.g. 29ABCDE1234F1ZK" />
            </div>
            <div>
              <Label className="text-xs">Drug License No.</Label>
              <Input value={form.drugLicenseNo} onChange={(e) => setForm({ ...form, drugLicenseNo: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Credit Days</Label>
              <Input type="number" value={form.creditDays} onChange={(e) => setForm({ ...form, creditDays: parseInt(e.target.value) || 30 })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : editing ? "Update" : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
