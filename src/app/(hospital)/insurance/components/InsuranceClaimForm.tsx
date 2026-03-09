"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createInsuranceClaim, searchInPatientsForInsurance } from "../actions"
import type { InsuranceCompany } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  companies: InsuranceCompany[]
}

type SearchResult = {
  id: string
  ipNumber: string
  name: string
  age: number
  gender: string
  phone: string
  department: string | null
  packageAmount: number
  netAmount: number
  admissionDate: Date
  operationName: string | null
}

const RELATION_OPTIONS = ["Self", "Spouse", "Child", "Parent", "Other"]

export default function InsuranceClaimForm({ open, onClose, onSuccess, companies }: Props) {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIP, setSelectedIP] = useState<SearchResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [companyId, setCompanyId] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [tpaName, setTpaName] = useState("")
  const [policyNumber, setPolicyNumber] = useState("")
  const [policyHolderName, setPolicyHolderName] = useState("")
  const [insuranceCardNumber, setInsuranceCardNumber] = useState("")
  const [relationToInsured, setRelationToInsured] = useState("")
  const [preauthAmount, setPreauthAmount] = useState("")
  const [notes, setNotes] = useState("")

  async function handleSearch() {
    if (!searchTerm.trim()) return
    setSearching(true)
    const results = await searchInPatientsForInsurance(searchTerm.trim())
    setSearchResults(results as SearchResult[])
    setSearching(false)
  }

  function handleSelectIP(ip: SearchResult) {
    setSelectedIP(ip)
    setSearchResults([])
    setSearchTerm(ip.ipNumber)
  }

  function handleCompanySelect(id: string) {
    setCompanyId(id)
    const company = companies.find(c => c.id === id)
    if (company) {
      setCompanyName(company.name)
      setTpaName(company.tpaName ?? "")
    }
  }

  function resetForm() {
    setSearchTerm("")
    setSearchResults([])
    setSelectedIP(null)
    setCompanyId("")
    setCompanyName("")
    setTpaName("")
    setPolicyNumber("")
    setPolicyHolderName("")
    setInsuranceCardNumber("")
    setRelationToInsured("")
    setPreauthAmount("")
    setNotes("")
  }

  async function handleSubmit() {
    if (!selectedIP) { toast.error("Select an inpatient"); return }
    if (!companyName.trim()) { toast.error("Select insurance company"); return }

    setSubmitting(true)
    const result = await createInsuranceClaim({
      inPatientId: selectedIP.id,
      insuranceCompanyId: companyId || undefined,
      insuranceCompanyName: companyName,
      tpaName: tpaName || undefined,
      policyNumber: policyNumber || undefined,
      policyHolderName: policyHolderName || undefined,
      insuranceCardNumber: insuranceCardNumber || undefined,
      relationToInsured: relationToInsured || undefined,
      preauthAmount: parseFloat(preauthAmount) || 0,
      notes: notes || undefined,
    })
    setSubmitting(false)

    if (result.success) {
      toast.success(`Claim ${result.data.claimNumber} created`)
      resetForm()
      onSuccess()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { resetForm(); onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Insurance Claim</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Search InPatient */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Search InPatient</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Search by IP number, name, or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
              <Button size="sm" variant="secondary" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="rounded-lg border border-border max-h-40 overflow-y-auto">
                {searchResults.map(ip => (
                  <button
                    key={ip.id}
                    onClick={() => handleSelectIP(ip)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                  >
                    <div>
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mr-2">{ip.ipNumber}</span>
                      <span className="font-medium">{ip.name}</span>
                      <span className="text-muted-foreground ml-2">{ip.age}y / {ip.gender.charAt(0)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">₹{ip.netAmount.toLocaleString("en-IN")}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedIP && (
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{selectedIP.name}</span>
                  <span className="font-mono text-xs">{selectedIP.ipNumber}</span>
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1">
                  <span>{selectedIP.age}y / {selectedIP.gender.charAt(0)}</span>
                  <span>{selectedIP.department ?? "—"}</span>
                  <span>{selectedIP.operationName ?? "—"}</span>
                </div>
                <div className="flex justify-between mt-1 text-xs">
                  <span>Package: ₹{selectedIP.packageAmount.toLocaleString("en-IN")}</span>
                  <span className="font-medium">Net: ₹{selectedIP.netAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Insurance Company */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Insurance Company</Label>
            <Select value={companyId} onValueChange={handleCompanySelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select insurance company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.tpaName ? ` (${c.tpaName})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Policy Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Policy Number</Label>
              <Input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Policy / Member ID" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insurance Card No</Label>
              <Input value={insuranceCardNumber} onChange={e => setInsuranceCardNumber(e.target.value)} placeholder="Card number" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Policy Holder Name</Label>
              <Input value={policyHolderName} onChange={e => setPolicyHolderName(e.target.value)} placeholder="Policy holder" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relation to Insured</Label>
              <Select value={relationToInsured} onValueChange={setRelationToInsured}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preauth Amount */}
          <div className="space-y-1">
            <Label className="text-xs">Preauth Amount (₹)</Label>
            <Input
              type="number"
              value={preauthAmount}
              onChange={e => setPreauthAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="h-16" />
          </div>

          {/* Submit */}
          <Button className="w-full" onClick={handleSubmit} disabled={submitting || !selectedIP}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Insurance Claim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
