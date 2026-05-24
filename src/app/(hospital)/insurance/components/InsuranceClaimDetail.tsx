"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Printer } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { InsuranceStatusBadge, INS_STATUS_CONFIG, INS_STATUS_TRANSITIONS } from "./InsuranceStatusBadge"
import {
  getInsuranceClaimById,
  updateInsuranceClaimStatus,
  addInsurancePatientPayment,
  updateInsuranceClaimDetails,
  getInsuranceCompanies,
} from "../actions"
import { formatDate, formatDateTime, formatCurrency, getInitials } from "@/lib/utils"
import type { InsuranceClaimStatus, InsuranceStatusHistoryEntry, PackageInclusion, InsuranceCompany } from "@/lib/types"

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"]

interface Props {
  claimId: string
  onBack: () => void
  onUpdate: () => void
  onViewBill?: (type: "final" | "enhancement" | "cash") => void
}

type Claim = NonNullable<Awaited<ReturnType<typeof getInsuranceClaimById>>>

export function InsuranceClaimDetail({ claimId, onBack, onUpdate, onViewBill }: Props) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [loading, setLoading] = useState(true)

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [targetStatus, setTargetStatus] = useState<InsuranceClaimStatus | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Status form fields
  const [statusNotes, setStatusNotes] = useState("")
  const [statusAmount, setStatusAmount] = useState("")
  const [statusRejectionReason, setStatusRejectionReason] = useState("")
  const [statusSettlementRef, setStatusSettlementRef] = useState("")
  const [statusDeductions, setStatusDeductions] = useState("")

  // Payment form fields
  const [payAmount, setPayAmount] = useState("")
  const [payMode, setPayMode] = useState("Cash")
  const [payNotes, setPayNotes] = useState("")

  // Edit details
  const [editingDetails, setEditingDetails] = useState(false)
  const [editCompanyId, setEditCompanyId] = useState("")
  const [editCompanyName, setEditCompanyName] = useState("")
  const [editTpaName, setEditTpaName] = useState("")
  const [editPolicyNumber, setEditPolicyNumber] = useState("")
  const [editCardNumber, setEditCardNumber] = useState("")

  // Auto-prompt for insurance company
  const [showCompanyPrompt, setShowCompanyPrompt] = useState(false)
  const [promptCompanyId, setPromptCompanyId] = useState("")
  const [promptPolicyNumber, setPromptPolicyNumber] = useState("")
  const [promptCardNumber, setPromptCardNumber] = useState("")

  async function fetchClaim() {
    setLoading(true)
    const [c, comps] = await Promise.all([
      getInsuranceClaimById(claimId),
      getInsuranceCompanies(),
    ])
    setClaim(c as Claim | null)
    setCompanies(comps as InsuranceCompany[])
    setLoading(false)

    // Auto-prompt if insurance company is not set
    if (c && (!c.insuranceCompanyId || c.insuranceCompanyName === "TBD" || !c.insuranceCompanyName)) {
      setPromptCompanyId("")
      setPromptPolicyNumber(c.policyNumber ?? "")
      setPromptCardNumber(c.insuranceCardNumber ?? "")
      setShowCompanyPrompt(true)
    }
  }

  useEffect(() => {
    fetchClaim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId])

  async function refresh() {
    const c = await getInsuranceClaimById(claimId)
    setClaim(c as Claim | null)
    onUpdate()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="text-center py-32 text-muted-foreground">
        <p>Claim not found</p>
        <Button variant="link" onClick={onBack} className="mt-2">Go back</Button>
      </div>
    )
  }

  const currentStatus = claim.status as InsuranceClaimStatus
  const transitions = INS_STATUS_TRANSITIONS[currentStatus] ?? []

  const history: InsuranceStatusHistoryEntry[] = (() => {
    try { return JSON.parse(claim.statusHistory ?? "[]") } catch { return [] }
  })()

  const packageInclusions: PackageInclusion[] = (() => {
    try { return JSON.parse(claim.packageInclusions ?? "[]") } catch { return [] }
  })()

  const doctors: string[] = (() => {
    try { return JSON.parse(claim.doctorNames) } catch { return [] }
  })()

  function openStatusTransition(status: InsuranceClaimStatus) {
    setTargetStatus(status)
    setStatusNotes("")
    setStatusAmount("")
    setStatusRejectionReason("")
    setStatusSettlementRef("")
    setStatusDeductions("")
    setShowStatusModal(true)
  }

  async function handleStatusSubmit() {
    if (!targetStatus) return
    setSubmitting(true)
    const result = await updateInsuranceClaimStatus(claim!.id, targetStatus, {
      notes: statusNotes || undefined,
      amount: statusAmount ? parseFloat(statusAmount) : undefined,
      rejectionReason: statusRejectionReason || undefined,
      settlementReference: statusSettlementRef || undefined,
      deductions: statusDeductions ? parseFloat(statusDeductions) : undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success(`Status updated to ${INS_STATUS_CONFIG[targetStatus].label}`)
      setShowStatusModal(false)
      setTargetStatus(null)
      refresh()
    } else {
      toast.error(result.error)
    }
  }

  function openPaymentModal() {
    setPayAmount("")
    setPayMode("Cash")
    setPayNotes("")
    setShowPaymentModal(true)
  }

  async function handleAddPayment() {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    setSubmitting(true)
    const result = await addInsurancePatientPayment({
      claimId: claim!.id,
      amount: parseFloat(payAmount),
      paymentMode: payMode,
      notes: payNotes || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Patient payment recorded")
      setShowPaymentModal(false)
      refresh()
    } else {
      toast.error(result.error)
    }
  }

  function startEditDetails() {
    setEditingDetails(true)
    setEditCompanyId(claim!.insuranceCompanyId ?? "")
    setEditCompanyName(claim!.insuranceCompanyName)
    setEditTpaName(claim!.tpaName ?? "")
    setEditPolicyNumber(claim!.policyNumber ?? "")
    setEditCardNumber(claim!.insuranceCardNumber ?? "")
  }

  async function handleCompanyPromptSave() {
    if (!promptCompanyId) {
      toast.error("Please select an insurance company")
      return
    }
    const company = companies.find(c => c.id === promptCompanyId)
    if (!company) return
    setSubmitting(true)
    const result = await updateInsuranceClaimDetails(claim!.id, {
      insuranceCompanyId: promptCompanyId,
      insuranceCompanyName: company.name,
      tpaName: company.tpaName ?? undefined,
      policyNumber: promptPolicyNumber || undefined,
      insuranceCardNumber: promptCardNumber || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Insurance company set successfully")
      setShowCompanyPrompt(false)
      refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function saveDetails() {
    setSubmitting(true)
    const result = await updateInsuranceClaimDetails(claim!.id, {
      insuranceCompanyId: editCompanyId || undefined,
      insuranceCompanyName: editCompanyName,
      tpaName: editTpaName || undefined,
      policyNumber: editPolicyNumber || undefined,
      insuranceCardNumber: editCardNumber || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Details updated")
      setEditingDetails(false)
      refresh()
    } else {
      toast.error(result.error)
    }
  }

  const needsAmount = targetStatus && [
    "PREAUTH_APPROVED", "ENHANCEMENT_CLAIMED", "ENHANCEMENT_APPROVED", "SETTLED", "PARTIALLY_SETTLED"
  ].includes(targetStatus)

  const needsRejection = targetStatus && [
    "PREAUTH_REJECTED", "ENHANCEMENT_REJECTED", "CLAIM_REJECTED"
  ].includes(targetStatus)

  const needsSettlement = targetStatus && ["SETTLED", "PARTIALLY_SETTLED"].includes(targetStatus)

  function handlePrintReceipt(type: "final" | "enhancement" | "cash") {
    if (onViewBill) {
      onViewBill(type)
    } else {
      const url = `/insurance/receipt/${claim!.id}?type=${type}`
      window.open(url, "_blank")
    }
  }

  return (
    <div className="py-6 space-y-6">
      {/* Claim header card */}
      <Card>
        <CardContent className="px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-11 w-11 border border-border">
                <AvatarFallback className="text-sm font-semibold bg-primary/5">{getInitials(claim.patientName)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-semibold leading-none">{claim.patientName}</h2>
                  <InsuranceStatusBadge status={currentStatus} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{claim.claimNumber}</span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{claim.ipNumber}</span>
                  {claim.insuranceCompanyName && claim.insuranceCompanyName !== "TBD" && (
                    <span className="font-medium text-foreground/70">{claim.insuranceCompanyName}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {transitions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">Change Status</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {transitions.map(s => (
                      <DropdownMenuItem key={s} onClick={() => openStatusTransition(s)}>
                        {INS_STATUS_CONFIG[s].label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button size="sm" variant="outline" onClick={openPaymentModal}>
                <Plus className="h-3.5 w-3.5" /> Patient Payment
              </Button>

              {/* Direct one-click bill buttons — this page exists primarily to
                  produce these bills, so we surface all three options instead
                  of hiding them behind a dropdown. */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1.5">
                  <Printer className="h-3 w-3 inline-block mr-1 -mt-0.5" />Print
                </span>
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => handlePrintReceipt("final")}>
                  Final Bill
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => handlePrintReceipt("enhancement")}>
                  Enhancement
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => handlePrintReceipt("cash")}>
                  Cash Receipt
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {[
          { label: "Total Bill", value: formatCurrency(claim.totalBillAmount), color: "text-foreground" },
          { label: "Preauth", value: formatCurrency(claim.preauthAmount), color: "text-blue-600" },
          { label: "Total Approved", value: formatCurrency(claim.totalApprovedAmount), color: "text-blue-600" },
          { label: "Settled", value: formatCurrency(claim.finalSettledAmount), color: "text-green-600" },
          { label: "Patient Balance", value: formatCurrency(claim.patientBalance), color: claim.patientBalance > 0 ? "text-orange-600" : "text-green-600" },
        ].map(card => (
          <Card key={card.label} className="p-3">
            <CardContent className="p-0">
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content: Tabs (left) + Timeline (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-4">
              {/* Patient Info */}
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Patient Information</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                    {[
                      ["Patient Name", claim.patientName],
                      ["IP Number", claim.ipNumber],
                      ["Age / Gender", `${claim.age} / ${claim.gender.charAt(0)}`],
                      ["Phone", claim.phone],
                      ["Guardian", claim.guardianName ?? "—"],
                      ["Department", claim.department ?? "—"],
                      ["Doctors", doctors.join(", ") || "—"],
                      ["Operation", claim.operationName ?? "—"],
                      ["Diagnosis", claim.provisionDiagnosis ?? "—"],
                      ["Admission", formatDateTime(claim.admissionDate)],
                      ["Discharge", formatDate(claim.dischargeDate)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Insurance Details */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Insurance Details</p>
                    {!editingDetails && (
                      <Button variant="ghost" size="sm" className="text-xs h-6" onClick={startEditDetails}>Edit</Button>
                    )}
                  </div>

                  {editingDetails ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Insurance Company</Label>
                        <Select value={editCompanyId} onValueChange={(id) => {
                          setEditCompanyId(id)
                          const c = companies.find(c => c.id === id)
                          if (c) { setEditCompanyName(c.name); setEditTpaName(c.tpaName ?? "") }
                        }}>
                          <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-w-lg">
                        <div className="space-y-1">
                          <Label className="text-xs">Policy Number</Label>
                          <Input value={editPolicyNumber} onChange={e => setEditPolicyNumber(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Card Number</Label>
                          <Input value={editCardNumber} onChange={e => setEditCardNumber(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveDetails} disabled={submitting}>
                          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDetails(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                      {[
                        ["Insurance Company", claim.insuranceCompanyName],
                        ["TPA", claim.tpaName ?? "—"],
                        ["Policy Number", claim.policyNumber ?? "—"],
                        ["Card Number", claim.insuranceCardNumber ?? "—"],
                        ["Policy Holder", claim.policyHolderName ?? "—"],
                        ["Relation", claim.relationToInsured ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {claim.notes && (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{claim.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Financials Tab */}
            <TabsContent value="financials" className="space-y-4 mt-4">
              {/* Bill Summary */}
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Bill Summary</p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Package Amount</span>
                      <span className="font-medium">{formatCurrency(claim.packageAmount)}</span>
                    </div>
                    {claim.discount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="text-muted-foreground">- {formatCurrency(claim.discount)}</span>
                      </div>
                    )}
                    <div className="border-t border-dashed pt-2.5 flex justify-between items-center">
                      <span className="font-semibold">Total Bill Amount</span>
                      <span className="font-bold text-base">{formatCurrency(claim.totalBillAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Insurance Approval */}
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Insurance Approval</p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Preauth Amount</span>
                      <span className="font-medium text-blue-600">{formatCurrency(claim.preauthAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Enhancement Approved</span>
                      <span className="font-medium text-blue-600">{formatCurrency(claim.enhancementApproved)}</span>
                    </div>
                    <div className="border-t border-dashed pt-2.5 flex justify-between items-center">
                      <span className="font-semibold">Total Approved</span>
                      <span className="font-bold text-base text-blue-600">{formatCurrency(claim.totalApprovedAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Settlement */}
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Settlement</p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Final Settled</span>
                      <span className="font-medium text-green-600">{formatCurrency(claim.finalSettledAmount)}</span>
                    </div>
                    {claim.deductions > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Deductions</span>
                        <span className="font-medium text-red-500">- {formatCurrency(claim.deductions)}</span>
                      </div>
                    )}
                    {claim.settlementReference && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Settlement Ref</span>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{claim.settlementReference}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Patient Account */}
              <Card className="border-2">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Patient Account</p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Patient Payable</span>
                      <span className="font-medium text-orange-600">{formatCurrency(claim.patientPayableAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Patient Paid</span>
                      <span className="font-medium text-green-600">{formatCurrency(claim.patientPaidAmount)}</span>
                    </div>
                    <div className="border-t border-dashed pt-2.5 flex justify-between items-center">
                      <span className="font-bold">Patient Balance</span>
                      <span className={`font-bold text-base ${claim.patientBalance > 0 ? "text-destructive" : "text-green-600"}`}>
                        {formatCurrency(claim.patientBalance)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Package Inclusions */}
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Package Inclusions
                  </p>
                  {packageInclusions.length > 0 ? (
                    <div className="space-y-1">
                      {packageInclusions.map((item, i) => (
                        <div key={i} className="rounded-lg border bg-muted/30 px-3.5 py-2.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{item.name}</span>
                            <span className="font-semibold">{formatCurrency(item.amount)}</span>
                          </div>
                          {item.subItems && item.subItems.length > 0 && (
                            <div className="mt-1.5 space-y-1 border-t border-dashed pt-1.5">
                              {item.subItems.map((sub, j) => (
                                <div key={j} className="flex justify-between text-xs text-muted-foreground">
                                  <span>{sub.itemName} <span className="text-muted-foreground/60">x{sub.quantity}</span></span>
                                  <span>{formatCurrency(sub.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No package inclusions</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Timeline (always visible) */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status Timeline</p>
              {history.length > 0 ? (
                <div className="space-y-0">
                  {history.slice().reverse().map((entry, i) => (
                    <div key={i} className="flex gap-3 pb-4">
                      <div className="flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
                        {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <InsuranceStatusBadge status={entry.status} />
                          <span className="text-xs text-muted-foreground">{formatDateTime(entry.date)}</span>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                        )}
                        {entry.updatedBy && (
                          <p className="text-xs text-muted-foreground mt-0.5">by {entry.updatedBy}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No status history</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Key Dates</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                {[
                  ["Preauth Submitted", formatDate(claim.preauthSubmittedDate)],
                  ["Preauth Approved", formatDate(claim.preauthApprovedDate)],
                  ["Enhancement Claimed", formatDate(claim.enhancementClaimedDate)],
                  ["Enhancement Approved", formatDate(claim.enhancementApprovedDate)],
                  ["Final Bill Submitted", formatDate(claim.finalBillSubmittedDate)],
                  ["Settlement Date", formatDate(claim.settlementDate)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {(claim.preauthRejectionReason || claim.enhancementRejectionReason) && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Rejection Details</p>
                {claim.preauthRejectionReason && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 mb-2">
                    <p className="text-xs text-muted-foreground">Preauth Rejection</p>
                    <p className="text-sm">{claim.preauthRejectionReason}</p>
                  </div>
                )}
                {claim.enhancementRejectionReason && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                    <p className="text-xs text-muted-foreground">Enhancement Rejection</p>
                    <p className="text-sm">{claim.enhancementRejectionReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Status Change Modal ── */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Change Status
              {targetStatus && <InsuranceStatusBadge status={targetStatus} />}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {needsAmount && (
              <div className="space-y-1.5">
                <Label>
                  {targetStatus === "ENHANCEMENT_CLAIMED" ? "Enhancement Amount (₹)" : "Approved / Settled Amount (₹)"}
                </Label>
                <Input
                  type="number"
                  value={statusAmount}
                  onChange={e => setStatusAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
            )}

            {needsRejection && (
              <div className="space-y-1.5">
                <Label>Rejection Reason</Label>
                <Textarea
                  value={statusRejectionReason}
                  onChange={e => setStatusRejectionReason(e.target.value)}
                  placeholder="Describe the reason for rejection..."
                  className="h-20"
                  autoFocus
                />
              </div>
            )}

            {needsSettlement && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Settlement Reference</Label>
                  <Input
                    value={statusSettlementRef}
                    onChange={e => setStatusSettlementRef(e.target.value)}
                    placeholder="UTR / Cheque No."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Deductions (₹)</Label>
                  <Input
                    type="number"
                    value={statusDeductions}
                    onChange={e => setStatusDeductions(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={statusNotes}
                onChange={e => setStatusNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowStatusModal(false)}>Cancel</Button>
            <Button onClick={handleStatusSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Insurance Company Prompt Modal ── */}
      <Dialog open={showCompanyPrompt} onOpenChange={setShowCompanyPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Insurance Company</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This claim does not have an insurance company assigned. Please select one to continue.
          </p>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Insurance Company</Label>
              <Select value={promptCompanyId} onValueChange={setPromptCompanyId}>
                <SelectTrigger><SelectValue placeholder="Select insurance company" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Policy Number</Label>
                <Input
                className="bg-white"
                  value={promptPolicyNumber}
                  onChange={e => setPromptPolicyNumber(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Card Number</Label>
                <Input
                  value={promptCardNumber}
                  className="bg-white"
                  onChange={e => setPromptCardNumber(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCompanyPrompt(false)}>Skip</Button>
            <Button onClick={handleCompanyPromptSave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Patient Payment Modal ── */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Patient Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
            {claim.patientBalance > 0 && (
              <p className="text-xs text-muted-foreground">
                Outstanding balance: <span className="font-semibold text-orange-600">{formatCurrency(claim.patientBalance)}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
