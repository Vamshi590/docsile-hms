"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/layout/header"
import {
  getServiceTemplates,
  createServiceTemplate,
  updateServiceTemplate,
  deleteServiceTemplate,
  getHospitalProfile,
  updateHospitalProfile,
  getUsers,
  createUser,
  toggleUserActive,
  getPrescriptionTemplates,
  createPrescriptionTemplate,
  updatePrescriptionTemplate,
  deletePrescriptionTemplate,
  getPredefinedPackages,
  createPredefinedPackage,
  updatePredefinedPackage,
  deletePredefinedPackage,
} from "../actions"
import type { ServiceTemplate, PackageInclusion } from "@/lib/types"
import { EditableCombobox } from "@/components/ui/combobox"

const SERVICE_CATEGORIES = ["Consultation", "Diagnostic", "Procedure", "Optical", "Other"]
const USER_ROLES = ["ADMIN", "DOCTOR", "RECEPTIONIST", "OPTOMETRIST", "NURSE"]

const MEDICINE_OPTIONS = [
  // Eye drops – Antibiotics
  "Moxifloxacin 0.5% Eye Drops", "Tobramycin Eye Drops", "Ciprofloxacin Eye Drops",
  "Ofloxacin Eye Drops", "Chloramphenicol Eye Drops", "Gentamicin Eye Drops",
  "Levofloxacin Eye Drops", "Gatifloxacin Eye Drops",
  // Eye drops – Steroids
  "Prednisolone Acetate 1% Eye Drops", "Dexamethasone Eye Drops", "Fluorometholone Eye Drops",
  "Loteprednol Eye Drops", "Betamethasone Eye Drops",
  // Eye drops – Combination
  "Tobramycin + Dexamethasone Eye Drops", "Moxifloxacin + Prednisolone Eye Drops",
  "Neomycin + Polymyxin + Dexamethasone Eye Drops", "Ciprofloxacin + Dexamethasone Eye Drops",
  // Eye drops – Anti-glaucoma
  "Timolol 0.5% Eye Drops", "Timolol 0.25% Eye Drops", "Latanoprost Eye Drops",
  "Bimatoprost Eye Drops", "Travoprost Eye Drops", "Brimonidine Eye Drops",
  "Dorzolamide Eye Drops", "Brinzolamide Eye Drops", "Betaxolol Eye Drops",
  "Tafluprost Eye Drops", "Carteolol Eye Drops",
  // Eye drops – Lubricants
  "Carboxymethylcellulose Eye Drops", "Sodium Hyaluronate Eye Drops",
  "Hydroxypropyl Guar Eye Drops", "Polyethylene Glycol Eye Drops",
  "Carbomer Eye Gel", "Trehalose Eye Drops", "Lubricating Eye Drops",
  // Eye drops – Dilating agents
  "Atropine 1% Eye Drops", "Atropine 0.5% Eye Drops", "Cyclopentolate Eye Drops",
  "Tropicamide Eye Drops", "Phenylephrine Eye Drops", "Homatropine Eye Drops",
  // Eye drops – NSAID / Anti-allergy
  "Ketorolac Eye Drops", "Bromfenac Eye Drops", "Diclofenac Eye Drops",
  "Olopatadine Eye Drops", "Ketotifen Eye Drops", "Epinastine Eye Drops",
  // Eye drops – Anti-viral / Anti-fungal
  "Acyclovir Eye Drops", "Natamycin Eye Drops", "Voriconazole Eye Drops",
  // Ointments
  "Erythromycin Eye Ointment", "Chloramphenicol Eye Ointment",
  "Acyclovir 3% Eye Ointment", "Tobramycin Eye Ointment",
  "Tetracycline Eye Ointment", "Simple Eye Ointment",
  // Oral medications
  "Amoxicillin 500mg", "Amoxicillin + Clavulanate 625mg", "Ciprofloxacin 500mg",
  "Doxycycline 100mg", "Azithromycin 500mg", "Metronidazole 400mg",
  "Prednisolone 10mg", "Prednisolone 5mg", "Methylprednisolone 4mg",
  "Ibuprofen 400mg", "Paracetamol 500mg", "Acetazolamide 250mg",
  "Vitamin C 500mg", "Vitamin E 400 IU", "Omega-3 Fatty Acids",
  "Lutein + Zeaxanthin", "Multivitamin Eye Care",
]

const TIMING_OPTIONS = [
  "Once daily (OD)", "Twice daily (BD)", "Three times daily (TDS)", "Four times daily (QID)",
  "Every 4 hours", "Every 6 hours", "Every 8 hours", "Every 2 hours",
  "At bedtime (HS)", "In the morning", "Before meals", "After meals",
  "1-0-0", "0-1-0", "0-0-1", "1-1-0", "1-0-1", "0-1-1", "1-1-1", "1-1-1-1",
  "1 drop once daily", "1 drop twice daily", "1 drop three times daily",
  "1 drop four times daily", "1 drop every 6 hours",
  "2 drops once daily", "2 drops twice daily", "2 drops three times daily",
  "SOS (As needed)", "Stat (Immediately)",
]

const ADVICE_OPTIONS = [
  // Investigations
  "B-Scan Ultrasonography", "Fundus Photography", "OCT (Optical Coherence Tomography)",
  "Corneal Topography", "Pachymetry", "Perimetry (Visual Field Test)",
  "Gonioscopy", "Fluorescein Angiography", "Specular Microscopy",
  "HbA1c", "Blood Pressure Monitoring", "Blood Sugar (Fasting)",
  "Blood Sugar (Post-prandial)", "Complete Blood Count", "ESR", "CRP",
  "X-Ray Chest", "MRI Brain", "CT Scan Orbit",
  // Advice
  "Avoid eye rubbing", "Wear protective glasses", "Dark glasses outdoors",
  "Maintain ocular hygiene", "Apply warm compresses", "Apply cold compresses",
  "Avoid swimming for 4 weeks", "Avoid contact lenses",
  "Do not bend or lift heavy objects", "Head elevated position",
  "Avoid bright lights and screens", "Patch the eye as instructed",
  "Wash hands before applying drops", "Shake well before use",
  "Review after 1 week", "Review after 2 weeks", "Review after 1 month",
  "Review after 3 months", "Review after 6 months",
  "Emergency if pain / redness / sudden vision loss",
  "Continue all medications", "Discontinue previous medications",
]

type PrescriptionTemplateMed = {
  prescription: string
  days: string
  timing: string
  notes: string
}

type PrescriptionTemplateRow = {
  id: string
  code: string
  name: string
  presentComplaint: string | null
  previousHistory: string | null
  provisionalDiagnosis: string | null
  medicines: string
  investigations: string
  followUpDays: number | null
  additionalNotes: string | null
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type HospitalProfile = {
  id: string
  name: string
  displayName: string | null
  phone: string | null
  email: string | null
  website: string | null
  registrationNo: string | null
  gstin: string | null
}

type User = {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: string
  department: string | null
  designation: string | null
  isActive: boolean
  lastLogin: Date | null
  createdAt: Date
}

const ROLE_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "secondary" | "muted"> = {
  ADMIN: "default",
  DOCTOR: "info",
  RECEPTIONIST: "success",
  OPTOMETRIST: "warning",
  NURSE: "secondary",
}

export default function SettingsPage({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Settings"
        description={hospitalName}
      />

      <div className="pt-5">
        <Tabs defaultValue="services">
          <div className="border-b border-border mb-6">
            <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 -mb-px">
              {(
                [
                  { value: "services",      label: "Service Templates" },
                  { value: "prescriptions", label: "Prescription Templates" },
                  { value: "packages",      label: "IPD Packages" },
                  { value: "hospital",      label: "Hospital Profile" },
                  { value: "users",         label: "Users" },
                ] as const
              ).map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-none px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="prescriptions"><PrescriptionsTab /></TabsContent>
          <TabsContent value="packages"><PackagesTab /></TabsContent>
          <TabsContent value="hospital"><HospitalTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab() {
  const [services, setServices] = useState<ServiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [editItem, setEditItem] = useState<ServiceTemplate | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getServiceTemplates(showInactive)
    // Map data to ensure discount field exists (for backward compatibility)
    setServices(data.map(d => ({ ...d, discount: (d as any).discount ?? 0 })) as ServiceTemplate[])
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetch() }, [fetch])

  const filtered = services.filter(s => {
    if (categoryFilter !== "All" && s.category !== categoryFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleToggleActive(svc: ServiceTemplate) {
    await updateServiceTemplate(svc.id, { isActive: !svc.isActive })
    await fetch()
    toast.success(`Service ${svc.isActive ? "deactivated" : "activated"}`)
  }

  async function handleDelete() {
    if (!deleteId) return
    const result = await deleteServiceTemplate(deleteId)
    if (result.success) {
      toast.success("Service deleted")
      setDeleteId(null)
      await fetch()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            placeholder="Search services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-56"
          />
          {["All", ...SERVICE_CATEGORIES].map(cat => (
            <Button
              key={cat}
              size="sm"
              variant={categoryFilter === cat ? "default" : "ghost"}
              className="rounded-full text-xs h-8 px-3"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Button>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={checked => setShowInactive(checked as boolean)}
            />
            <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer font-normal">
              Show inactive
            </Label>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Service</Button>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>Service Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount (₹)</TableHead>
              <TableHead className="text-right">Discount (₹)</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No services found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(svc => (
                <TableRow key={svc.id}>
                  <TableCell>
                    <div className="font-medium">{svc.name}</div>
                    {svc.description && (
                      <div className="text-xs text-muted-foreground">{svc.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{svc.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {svc.amount === 0 ? (
                      <span className="text-muted-foreground">Free</span>
                    ) : (
                      `₹${svc.amount.toLocaleString("en-IN")}`
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {svc.discount > 0 ? (
                      <span className="text-green-600 font-medium">₹{svc.discount.toLocaleString("en-IN")}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={svc.isActive ? "default" : "muted"}>
                      {svc.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditItem(svc)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => handleToggleActive(svc)}
                      >
                        {svc.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(svc.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">{filtered.length} services</span>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <ServiceFormDialog
        open={addOpen || !!editItem}
        onClose={() => { setAddOpen(false); setEditItem(null) }}
        existing={editItem ?? undefined}
        onSuccess={async () => {
          setAddOpen(false)
          setEditItem(null)
          await fetch()
        }}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this service? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Service Form Dialog ──────────────────────────────────────────────────────

function ServiceFormDialog({
  open,
  onClose,
  existing,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  existing?: ServiceTemplate
  onSuccess: () => void
}) {
  const [name, setName] = useState(existing?.name ?? "")
  const [category, setCategory] = useState(existing?.category ?? "Consultation")
  const [description, setDescription] = useState(existing?.description ?? "")
  const [amount, setAmount] = useState(String(existing?.amount ?? ""))
  const [discount, setDiscount] = useState(String(existing?.discount ?? "0"))
  const [sortOrder, setSortOrder] = useState(String(existing?.sortOrder ?? "0"))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setCategory(existing.category)
      setDescription(existing.description ?? "")
      setAmount(String(existing.amount))
      setDiscount(String(existing.discount ?? 0))
      setSortOrder(String(existing.sortOrder))
    } else {
      setName(""); setCategory("Consultation"); setDescription(""); setAmount(""); setDiscount("0"); setSortOrder("0")
    }
  }, [existing, open])

  async function handleSave() {
    if (!name.trim()) { toast.error("Name required"); return }
    setLoading(true)
    const data = {
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      amount: parseFloat(amount) || 0,
      discount: parseFloat(discount) || 0,
      sortOrder: parseInt(sortOrder) || 0,
    }
    const result = existing
      ? await updateServiceTemplate(existing.id, data)
      : await createServiceTemplate(data)
    setLoading(false)
    if (result.success) {
      toast.success(existing ? "Service updated" : "Service created")
      onSuccess()
    } else {
      toast.error(result.error ?? "Failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="e.g. General Consultation" />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1" min={0} placeholder="0" />
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="mt-1" min={0} placeholder="0" />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="mt-1" min={0} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : existing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Hospital Tab ─────────────────────────────────────────────────────────────

function HospitalTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [registrationNo, setRegistrationNo] = useState("")
  const [gstin, setGstin] = useState("")

  useEffect(() => {
    getHospitalProfile().then(p => {
      if (p) {
        setName(p.name)
        setDisplayName((p as HospitalProfile).displayName ?? "")
        setPhone(p.phone ?? "")
        setEmail(p.email ?? "")
        setWebsite((p as HospitalProfile).website ?? "")
        setRegistrationNo((p as HospitalProfile).registrationNo ?? "")
        setGstin((p as HospitalProfile).gstin ?? "")
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const result = await updateHospitalProfile({
      name: name.trim(),
      displayName: displayName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      registrationNo: registrationNo.trim() || undefined,
      gstin: gstin.trim() || undefined,
    })
    setSaving(false)
    if (result.success) toast.success("Hospital profile updated")
    else toast.error(result.error ?? "Failed to update")
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>

  return (
    <div className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Hospital Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="Full hospital name" />
        </div>
        <div className="col-span-2">
          <Label>Display Name</Label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1" placeholder="Shorter name shown in app" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" placeholder="Contact number" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="contact@hospital.com" />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={website} onChange={e => setWebsite(e.target.value)} className="mt-1" placeholder="www.hospital.com" />
        </div>
        <div>
          <Label>Registration No.</Label>
          <Input value={registrationNo} onChange={e => setRegistrationNo(e.target.value)} className="mt-1" placeholder="MCI registration number" />
        </div>
        <div>
          <Label>GSTIN</Label>
          <Input value={gstin} onChange={e => setGstin(e.target.value)} className="mt-1" placeholder="GST identification number" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getUsers()
    setUsers(data as User[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function handleToggle(id: string) {
    await toggleUserActive(id)
    await fetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>+ Add User</Button>
      </div>
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No users found</TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.fullName}</div>
                    {user.designation && <div className="text-xs text-muted-foreground">{user.designation}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[user.role] ?? "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{user.department ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={user.isActive ? "default" : "muted"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => handleToggle(user.id)}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add User Dialog */}
      <AddUserDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={async () => { setAddOpen(false); await fetch() }}
      />
    </div>
  )
}

// ─── Prescriptions Tab ────────────────────────────────────────────────────────

function PrescriptionsTab() {
  const [templates, setTemplates] = useState<PrescriptionTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [editItem, setEditItem] = useState<PrescriptionTemplateRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const data = await getPrescriptionTemplates(showInactive)
    setTemplates(data as PrescriptionTemplateRow[])
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const filtered = templates.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.provisionalDiagnosis?.toLowerCase().includes(q) ?? false)
    )
  })

  async function handleToggleActive(tmpl: PrescriptionTemplateRow) {
    await updatePrescriptionTemplate(tmpl.id, { isActive: !tmpl.isActive })
    await fetchTemplates()
    toast.success(`Template ${tmpl.isActive ? "deactivated" : "activated"}`)
  }

  async function handleDelete() {
    if (!deleteId) return
    const result = await deletePrescriptionTemplate(deleteId)
    if (result.success) {
      toast.success("Template deleted")
      setDeleteId(null)
      await fetchTemplates()
    } else {
      toast.error(result.error)
    }
  }

  function getMedicines(tmpl: PrescriptionTemplateRow): PrescriptionTemplateMed[] {
    try { return JSON.parse(tmpl.medicines) } catch { return [] }
  }

  function getInvestigations(tmpl: PrescriptionTemplateRow): string[] {
    try { return JSON.parse(tmpl.investigations) } catch { return [] }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            placeholder="Search by code, name or diagnosis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-72"
          />
          <div className="flex items-center gap-1.5 ml-1">
            <Checkbox
              id="show-inactive-rx"
              checked={showInactive}
              onCheckedChange={checked => setShowInactive(checked as boolean)}
            />
            <Label htmlFor="show-inactive-rx" className="text-sm text-muted-foreground cursor-pointer font-normal">
              Show inactive
            </Label>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Template</Button>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead className="w-28">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead>Medicines</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No prescription templates found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(tmpl => {
                const meds = getMedicines(tmpl)
                const invs = getInvestigations(tmpl)
                return (
                  <TableRow key={tmpl.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {tmpl.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{tmpl.name}</div>
                      {tmpl.presentComplaint && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {tmpl.presentComplaint}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[180px]">
                        {tmpl.provisionalDiagnosis || <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {meds.length} medicine{meds.length !== 1 ? "s" : ""}
                        {invs.filter(Boolean).length > 0 && (
                          <span className="ml-1 text-xs">· {invs.filter(Boolean).length} advice</span>
                        )}
                      </div>
                      {meds.slice(0, 2).map((m, i) => (
                        <div key={i} className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {m.prescription}
                        </div>
                      ))}
                      {meds.length > 2 && (
                        <div className="text-xs text-muted-foreground">+{meds.length - 2} more</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={tmpl.isActive ? "default" : "muted"}>
                        {tmpl.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditItem(tmpl)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => handleToggleActive(tmpl)}
                        >
                          {tmpl.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(tmpl.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <PrescriptionFormDialog
        open={addOpen || !!editItem}
        onClose={() => { setAddOpen(false); setEditItem(null) }}
        existing={editItem ?? undefined}
        onSuccess={async () => {
          setAddOpen(false)
          setEditItem(null)
          await fetchTemplates()
        }}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this prescription template? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Prescription Form Dialog ─────────────────────────────────────────────────

function PrescriptionFormDialog({
  open,
  onClose,
  existing,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  existing?: PrescriptionTemplateRow
  onSuccess: () => void
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [presentComplaint, setPresentComplaint] = useState("")
  const [previousHistory, setPreviousHistory] = useState("")
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState("")
  const [medicines, setMedicines] = useState<PrescriptionTemplateMed[]>([
    { prescription: "", days: "", timing: "", notes: "" },
  ])
  const [investigations, setInvestigations] = useState<string[]>([""])
  const [followUpDays, setFollowUpDays] = useState("")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (existing) {
      setCode(existing.code)
      setName(existing.name)
      setPresentComplaint(existing.presentComplaint ?? "")
      setPreviousHistory(existing.previousHistory ?? "")
      setProvisionalDiagnosis(existing.provisionalDiagnosis ?? "")
      try {
        const meds: PrescriptionTemplateMed[] = JSON.parse(existing.medicines)
        setMedicines(meds.length > 0 ? meds : [{ prescription: "", days: "", timing: "", notes: "" }])
      } catch {
        setMedicines([{ prescription: "", days: "", timing: "", notes: "" }])
      }
      try {
        const invs: string[] = JSON.parse(existing.investigations)
        setInvestigations(invs.length > 0 ? invs : [""])
      } catch {
        setInvestigations([""])
      }
      setFollowUpDays(existing.followUpDays?.toString() ?? "")
      setAdditionalNotes(existing.additionalNotes ?? "")
    } else {
      setCode(""); setName(""); setPresentComplaint(""); setPreviousHistory("")
      setProvisionalDiagnosis("")
      setMedicines([{ prescription: "", days: "", timing: "", notes: "" }])
      setInvestigations([""])
      setFollowUpDays("")
      setAdditionalNotes("")
    }
    setErrors({})
  }, [existing, open])

  function updateMedicine(index: number, field: keyof PrescriptionTemplateMed, value: string) {
    setMedicines(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addMedicine() {
    setMedicines(prev => [...prev, { prescription: "", days: "", timing: "", notes: "" }])
  }

  function removeMedicine(index: number) {
    if (medicines.length > 1) setMedicines(prev => prev.filter((_, i) => i !== index))
  }

  function updateInvestigation(index: number, value: string) {
    setInvestigations(prev => { const next = [...prev]; next[index] = value; return next })
  }

  function addInvestigation() {
    setInvestigations(prev => [...prev, ""])
  }

  function removeInvestigation(index: number) {
    if (investigations.length > 1) setInvestigations(prev => prev.filter((_, i) => i !== index))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!code.trim()) e.code = "Template code is required"
    if (!name.trim()) e.name = "Template name is required"
    const hasValidMed = medicines.some(m => m.prescription.trim())
    if (!hasValidMed) e.medicines = "At least one medicine is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setLoading(true)
    const cleanMeds = medicines.filter(m => m.prescription.trim())
    const cleanInvs = investigations.filter(i => i.trim())
    const payload = {
      code: code.trim(),
      name: name.trim(),
      presentComplaint: presentComplaint.trim() || undefined,
      previousHistory: previousHistory.trim() || undefined,
      provisionalDiagnosis: provisionalDiagnosis.trim() || undefined,
      medicines: JSON.stringify(cleanMeds),
      investigations: JSON.stringify(cleanInvs),
      followUpDays: followUpDays.trim() ? parseInt(followUpDays.trim()) : undefined,
      additionalNotes: additionalNotes.trim() || undefined,
    }
    const result = existing
      ? await updatePrescriptionTemplate(existing.id, payload)
      : await createPrescriptionTemplate(payload)
    setLoading(false)
    if (result.success) {
      toast.success(existing ? "Template updated" : "Template created")
      onSuccess()
    } else {
      toast.error(result.error ?? "Failed to save template")
    }
  }

  const textareaClass =
    "flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl flex flex-col bg-white  gap-0 p-0 max-h-[92vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>{existing ? "Edit Prescription Template" : "Add Prescription Template"}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Section 1 — Template Identity */}
          <div className="rounded-lg border border-border bg-gray-50">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-foreground">Template Identity</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <Label>Template Code *</Label>
                <Input
                  value={code}
                  onChange={e => { setCode(e.target.value); if (errors.code) setErrors(p => ({ ...p, code: "" })) }}
                  className={`mt-1 bg-white font-mono uppercase ${errors.code ? "border-destructive" : ""}`}
                  placeholder="e.g. CONJ-001"
                />
                {errors.code && <p className="mt-1 text-xs text-destructive">{errors.code}</p>}
              </div>
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={name}
                  onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: "" })) }}
                  className={`mt-1 bg-white ${errors.name ? "border-destructive" : ""}`}
                  placeholder="e.g. Conjunctivitis Treatment"
                />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
              </div>
            </div>
          </div>

          {/* Section 2 — Clinical Notes */}
          <div className="rounded-lg border border-border bg-gray-50">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-foreground">Clinical Notes</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Present Complaint</Label>
                  <textarea
                    value={presentComplaint}
                    onChange={e => setPresentComplaint(e.target.value)}
                    rows={2}
                    className={`mt-1 ${textareaClass}`}
                    placeholder="e.g. Redness, itching, watering"
                  />
                </div>
                <div>
                  <Label>Previous History</Label>
                  <textarea
                    value={previousHistory}
                    onChange={e => setPreviousHistory(e.target.value)}
                    rows={2}
                    className={`mt-1 ${textareaClass}`}
                    placeholder="e.g. Operated eye, Diabetic"
                  />
                </div>
              </div>
              <div>
                <Label>Provisional Diagnosis</Label>
                <EditableCombobox
                  options={[
                    "Acute Conjunctivitis", "Allergic Conjunctivitis", "Bacterial Conjunctivitis",
                    "Viral Conjunctivitis", "Dry Eye Syndrome", "Blepharitis", "Chalazion",
                    "Stye (Hordeolum)", "Corneal Ulcer", "Keratitis", "Uveitis",
                    "Glaucoma (Primary Open Angle)", "Angle Closure Glaucoma",
                    "Cataract", "Diabetic Retinopathy", "Age-Related Macular Degeneration",
                    "Retinal Detachment", "Optic Neuritis", "Pterygium", "Pinguecula",
                    "Amblyopia", "Strabismus", "Refractive Error",
                  ]}
                  value={provisionalDiagnosis}
                  onValueChange={setProvisionalDiagnosis}
                  placeholder="Type or select diagnosis..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Medicines */}
          <div className="rounded-lg border border-border bg-gray-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-sm font-medium">Medicines *</p>
                {errors.medicines && (
                  <p className="text-xs text-destructive mt-0.5">{errors.medicines}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMedicine}
                className="h-7 text-xs px-3"
              >
                + Add Medicine
              </Button>
            </div>

            <div className="p-3 space-y-2">
              {/* Header labels */}
              <div className="grid gap-2 px-1" style={{ gridTemplateColumns: "2fr 1fr 1fr 32px" }}>
                <p className="text-xs text-muted-foreground font-medium">Medicine</p>
                <p className="text-xs text-muted-foreground font-medium">Days</p>
                <p className="text-xs text-muted-foreground font-medium">Timing</p>
                <span />
              </div>

              {medicines.map((med, index) => (
                <div key={index} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground px-0.5">
                    Medicine {index + 1}
                  </p>
                  <div
                    className="grid gap-2 items-center"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr 32px" }}
                  >
                    <EditableCombobox
                      options={MEDICINE_OPTIONS}
                      value={med.prescription}
                      onValueChange={v => updateMedicine(index, "prescription", v)}
                      placeholder="Medicine name"
                    />
                    <Input
                      value={med.days}
                      onChange={e => updateMedicine(index, "days", e.target.value)}
                      placeholder="5"
                      className="text-sm bg-white"
                    />
                    <EditableCombobox
                      options={TIMING_OPTIONS}
                      value={med.timing}
                      onValueChange={v => updateMedicine(index, "timing", v)}
                      placeholder="Timing"
                    />
                    <button
                      type="button"
                      onClick={() => removeMedicine(index)}
                      disabled={medicines.length === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <Input
                    value={med.notes}
                    onChange={e => updateMedicine(index, "notes", e.target.value)}
                    placeholder="Notes: After food, shake well..."
                    className="text-sm bg-white text-muted-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Investigations / Advice */}
          <div className="rounded-lg border border-border bg-gray-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-medium">Investigations / Advice</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInvestigation}
                className="h-7 text-xs px-3"
              >
                + Add
              </Button>
            </div>

            <div className="p-3 space-y-2">
              {investigations.map((inv, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <EditableCombobox
                    options={ADVICE_OPTIONS}
                    value={inv}
                    onValueChange={v => updateInvestigation(index, v)}
                    placeholder="Investigation or advice..."
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeInvestigation(index)}
                    disabled={investigations.length === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-up & Additional Notes */}
          <div className="rounded-lg border border-border bg-gray-50">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-foreground">Follow-up &amp; Notes</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <Label>Follow-up (days)</Label>
                <Input
                  type="number"
                  value={followUpDays}
                  onChange={e => setFollowUpDays(e.target.value)}
                  className="mt-1 bg-white"
                  placeholder="e.g. 7"
                  min={1}
                />
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Input
                  value={additionalNotes}
                  onChange={e => setAdditionalNotes(e.target.value)}
                  className="mt-1 bg-white"
                  placeholder="Any additional instructions..."
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : existing ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add User Dialog ──────────────────────────────────────────────────────────

function AddUserDialog({ open, onClose, onSuccess }: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("RECEPTIONIST")
  const [phone, setPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [designation, setDesignation] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!email || !password || !fullName) { toast.error("Name, email and password are required"); return }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return }
    setLoading(true)
    const result = await createUser({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
      phone: phone.trim() || undefined,
      department: department.trim() || undefined,
      designation: designation.trim() || undefined,
    })
    setLoading(false)
    if (result.success) {
      toast.success("User created")
      onSuccess()
    } else {
      toast.error(result.error ?? "Failed to create user")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" placeholder="Dr. Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="user@hospital.com" />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1" placeholder="Min 6 chars" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" placeholder="Mobile number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Input value={department} onChange={e => setDepartment(e.target.value)} className="mt-1" placeholder="e.g. Ophthalmology" />
            </div>
            <div>
              <Label>Designation</Label>
              <Input value={designation} onChange={e => setDesignation(e.target.value)} className="mt-1" placeholder="e.g. Senior Doctor" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Packages Tab ────────────────────────────────────────────────────────────

const INCLUSION_OPTIONS = [
  "Room Charges", "Medicine", "Consumables", "Surgery Charges",
  "Doctor Fee", "Nursing Care", "Food", "Lab Tests",
]

type PkgRow = {
  id: string
  name: string
  inclusions: string
  totalAmount: number
  discount: number
  isActive: boolean
}

function PackagesTab() {
  const [packages, setPackages] = useState<PkgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPkg, setEditPkg] = useState<PkgRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getPredefinedPackages(true)
    setPackages(data as PkgRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this package?")) return
    const res = await deletePredefinedPackage(id)
    if (res.success) { toast.success("Package deleted"); load() }
    else toast.error(res.error)
  }

  const handleToggle = async (pkg: PkgRow) => {
    const res = await updatePredefinedPackage(pkg.id, { isActive: !pkg.isActive })
    if (res.success) load()
    else toast.error(res.error)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">IPD Packages</h2>
        <Button size="sm" onClick={() => { setEditPkg(null); setDialogOpen(true) }}>
          + Add Package
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : packages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No packages created yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Inclusions</TableHead>
              <TableHead className="text-right">Total (₹)</TableHead>
              <TableHead className="text-right">Discount (₹)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map(pkg => {
              let inclusions: PackageInclusion[] = []
              try { inclusions = JSON.parse(pkg.inclusions) } catch {}
              return (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {inclusions.map((inc, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">
                          {inc.name}: ₹{inc.amount.toLocaleString("en-IN")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">₹{pkg.totalAmount.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{pkg.discount.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.isActive ? "default" : "secondary"} className="cursor-pointer" onClick={() => handleToggle(pkg)}>
                      {pkg.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditPkg(pkg); setDialogOpen(true) }}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(pkg.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <PackageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editPkg={editPkg}
        onSaved={load}
      />
    </div>
  )
}

function PackageDialog({ open, onClose, editPkg, onSaved }: {
  open: boolean
  onClose: () => void
  editPkg: PkgRow | null
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [discount, setDiscount] = useState(0)
  const [inclusions, setInclusions] = useState<PackageInclusion[]>([
    { name: "Surgery Charges", amount: 0, subItems: [] },
  ])

  useEffect(() => {
    if (!open) return
    if (editPkg) {
      setName(editPkg.name)
      setDiscount(editPkg.discount)
      try {
        const parsed = JSON.parse(editPkg.inclusions) as PackageInclusion[]
        setInclusions(parsed.length > 0 ? parsed : [{ name: "Surgery Charges", amount: 0, subItems: [] }])
      } catch {
        setInclusions([{ name: "Surgery Charges", amount: 0, subItems: [] }])
      }
    } else {
      setName("")
      setDiscount(0)
      setInclusions([{ name: "Surgery Charges", amount: 0, subItems: [] }])
    }
  }, [open, editPkg])

  const totalAmount = inclusions.reduce((s, i) => s + i.amount, 0)

  const updateInclusion = (idx: number, field: string, val: string) => {
    setInclusions(prev => prev.map((inc, j) =>
      j === idx ? { ...inc, [field]: field === "amount" ? (parseFloat(val) || 0) : val } : inc
    ))
  }

  const addInclusion = () => setInclusions(prev => [...prev, { name: "", amount: 0, subItems: [] }])

  const removeInclusion = (idx: number) => {
    if (inclusions.length > 1) setInclusions(prev => prev.filter((_, j) => j !== idx))
  }

  const addSubItem = (idx: number) => {
    setInclusions(prev => prev.map((inc, j) =>
      j === idx ? { ...inc, subItems: [...(inc.subItems || []), { itemName: "", quantity: 1, rate: 0, amount: 0 }] } : inc
    ))
  }

  const updateSubItem = (incIdx: number, subIdx: number, field: string, val: string) => {
    setInclusions(prev => prev.map((inc, j) => {
      if (j !== incIdx) return inc
      const subs = [...(inc.subItems || [])]
      const sub = { ...subs[subIdx] }
      if (field === "itemName") sub.itemName = val
      else if (field === "quantity") { sub.quantity = parseInt(val) || 0; sub.amount = sub.quantity * sub.rate }
      else if (field === "rate") { sub.rate = parseFloat(val) || 0; sub.amount = sub.quantity * sub.rate }
      subs[subIdx] = sub
      return { ...inc, subItems: subs }
    }))
  }

  const removeSubItem = (incIdx: number, subIdx: number) => {
    setInclusions(prev => prev.map((inc, j) =>
      j === incIdx ? { ...inc, subItems: (inc.subItems || []).filter((_, k) => k !== subIdx) } : inc
    ))
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Package name is required"); return }
    if (inclusions.every(i => !i.name)) { toast.error("Add at least one inclusion"); return }
    setLoading(true)
    const payload = {
      name: name.trim(),
      inclusions: JSON.stringify(inclusions),
      totalAmount,
      discount,
    }
    const res = editPkg
      ? await updatePredefinedPackage(editPkg.id, payload)
      : await createPredefinedPackage(payload)
    setLoading(false)
    if (res.success) {
      toast.success(editPkg ? "Package updated" : "Package created")
      onSaved()
      onClose()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPkg ? "Edit Package" : "Create Package"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Package Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cataract Surgery Package" className="mt-1" />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <Label>Total Amount (₹)</Label>
              <span className="ml-2 text-sm font-semibold bg-gray-100 border border-gray-300 rounded px-3 py-1">
                ₹{totalAmount.toLocaleString("en-IN")}
              </span>
              <span className="ml-2 text-xs text-gray-500">(auto-calculated)</span>
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input
                type="number"
                value={discount}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="mt-1 w-28"
                min={0}
                onWheel={e => e.currentTarget.blur()}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Package Inclusions</Label>
            {inclusions.map((incl, i) => (
              <div key={i} className="mb-3 border border-gray-200 rounded-md p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <Select value={incl.name} onValueChange={v => updateInclusion(i, "name", v)}>
                    <SelectTrigger className="flex-1 bg-white text-sm">
                      <SelectValue placeholder="Select inclusion..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INCLUSION_OPTIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={incl.amount}
                    onChange={e => updateInclusion(i, "amount", e.target.value)}
                    placeholder="Amount"
                    className="w-28 bg-white"
                    min={0}
                    onWheel={e => e.currentTarget.blur()}
                  />
                  <Button type="button" onClick={() => addSubItem(i)} size="icon" variant="outline" className="shrink-0 w-8 h-8 text-green-600" title="Add sub-item">+</Button>
                  {i === inclusions.length - 1 && (
                    <Button type="button" onClick={addInclusion} size="icon" variant="outline" className="shrink-0 w-8 h-8 text-blue-600" title="Add inclusion row">+</Button>
                  )}
                  {inclusions.length > 1 && (
                    <Button type="button" onClick={() => removeInclusion(i)} size="icon" variant="outline" className="shrink-0 w-8 h-8 text-red-500">−</Button>
                  )}
                </div>

                {incl.subItems && incl.subItems.length > 0 && (
                  <div className="ml-4 mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Sub Items</p>
                    {incl.subItems.map((sub, si) => (
                      <div key={si} className="flex items-center gap-2 mb-1">
                        <Input value={sub.itemName} onChange={e => updateSubItem(i, si, "itemName", e.target.value)} placeholder="Item name" className="flex-1 h-8 text-xs bg-white" />
                        <Input type="number" value={sub.quantity} onChange={e => updateSubItem(i, si, "quantity", e.target.value)} placeholder="Qty" className="w-16 h-8 text-xs bg-white" min={0} onWheel={e => e.currentTarget.blur()} />
                        <Input type="number" value={sub.rate} onChange={e => updateSubItem(i, si, "rate", e.target.value)} placeholder="Rate" className="w-20 h-8 text-xs bg-white" min={0} onWheel={e => e.currentTarget.blur()} />
                        <span className="text-xs w-16 text-right">₹{sub.amount.toLocaleString("en-IN")}</span>
                        <Button type="button" onClick={() => removeSubItem(i, si)} size="icon" variant="ghost" className="shrink-0 w-6 h-6 text-red-500 text-xs">×</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : editPkg ? "Save Changes" : "Create Package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
