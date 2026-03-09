"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Trash2, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  getAllInsuranceCompanies,
  createInsuranceCompany,
  updateInsuranceCompany,
  deleteInsuranceCompany,
} from "../actions"

type Company = {
  id: string
  name: string
  tpaName: string | null
  contactNumber: string | null
  email: string | null
  address: string | null
  isActive: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function InsuranceCompanyManager({ open, onClose, onUpdate }: Props) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // Add form
  const [name, setName] = useState("")
  const [tpaName, setTpaName] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [email, setEmail] = useState("")

  async function fetchCompanies() {
    setLoading(true)
    const data = await getAllInsuranceCompanies()
    setCompanies(data as Company[])
    setLoading(false)
  }

  useEffect(() => {
    if (open) fetchCompanies()
  }, [open])

  function resetForm() {
    setName("")
    setTpaName("")
    setContactNumber("")
    setEmail("")
    setShowAdd(false)
  }

  async function handleAdd() {
    if (!name.trim()) { toast.error("Company name required"); return }
    setSubmitting(true)
    const result = await createInsuranceCompany({
      name: name.trim(),
      tpaName: tpaName || undefined,
      contactNumber: contactNumber || undefined,
      email: email || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Company added")
      resetForm()
      fetchCompanies()
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  async function handleToggle(company: Company) {
    setSubmitting(true)
    const result = company.isActive
      ? await deleteInsuranceCompany(company.id)
      : await updateInsuranceCompany(company.id, {
          name: company.name,
          tpaName: company.tpaName ?? undefined,
          contactNumber: company.contactNumber ?? undefined,
          email: company.email ?? undefined,
          isActive: true,
        })
    setSubmitting(false)
    if (result.success) {
      toast.success(company.isActive ? "Company deactivated" : "Company reactivated")
      fetchCompanies()
      onUpdate()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { resetForm(); onClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Insurance Companies</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add form toggle */}
          {!showAdd ? (
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Company
            </Button>
          ) : (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Company Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Star Health" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">TPA Name</Label>
                  <Input value={tpaName} onChange={e => setTpaName(e.target.value)} placeholder="e.g. Medi Assist" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact Number</Label>
                  <Input value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="Phone" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={submitting}>
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Add
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Companies list */}
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  <TableHead>Company Name</TableHead>
                  <TableHead>TPA</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No companies added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.tpaName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.contactNumber ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.isActive ? "success" : "muted"}>
                          {c.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggle(c)}
                          disabled={submitting}
                          title={c.isActive ? "Deactivate" : "Reactivate"}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
