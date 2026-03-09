"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Printer, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import InsuranceFinalBill from "./InsuranceFinalBill"
import InsuranceEnhancementBill from "./InsuranceEnhancementBill"
import InsuranceCashReceipt from "./InsuranceCashReceipt"
import { getInsuranceClaimById } from "../actions"
import type { PackageInclusion } from "@/lib/types"

type BillType = "final" | "enhancement" | "cash"

interface Props {
  claimId: string
  billType: BillType
  onBack: () => void
}

type Claim = NonNullable<Awaited<ReturnType<typeof getInsuranceClaimById>>>

interface BillingItem {
  particulars: string
  amount: number
}

const BILL_LABELS: Record<BillType, string> = {
  final: "Final Bill",
  enhancement: "Enhancement Bill",
  cash: "Cash Receipt",
}

export function InsuranceBillPreview({ claimId, billType, onBack }: Props) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  // Editable state
  const [billingItems, setBillingItems] = useState<BillingItem[]>([])
  const [headerHeight, setHeaderHeight] = useState(120)
  const [billDate, setBillDate] = useState("")

  // Final bill editable
  const [totalAmount, setTotalAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [netAmount, setNetAmount] = useState(0)

  // Insurance data editable
  const [preauthAmount, setPreauthAmount] = useState(0)
  const [enhancementApproved, setEnhancementApproved] = useState(0)
  const [totalApproved, setTotalApproved] = useState(0)
  const [finalSettled, setFinalSettled] = useState(0)
  const [deductions, setDeductions] = useState(0)
  const [patientPayable, setPatientPayable] = useState(0)

  // Enhancement bill editable
  const [enhancementAmount, setEnhancementAmount] = useState(0)
  const [excessAmount, setExcessAmount] = useState(0)

  // Cash receipt editable
  const [amountReceived, setAmountReceived] = useState(0)
  const [patientBalance, setPatientBalance] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const c = await getInsuranceClaimById(claimId)
      if (!c) { setLoading(false); return }
      setClaim(c as Claim)

      // Parse billing items from package inclusions
      const packageInclusions: PackageInclusion[] = (() => {
        try { return JSON.parse(c.packageInclusions ?? "[]") } catch { return [] }
      })()

      const items = packageInclusions.flatMap((item) => {
        const arr: BillingItem[] = [{ particulars: item.name, amount: item.amount }]
        if (item.subItems) {
          item.subItems.forEach((sub) => {
            arr.push({ particulars: `  - ${sub.itemName} x${sub.quantity}`, amount: sub.amount })
          })
        }
        return arr
      })

      setBillingItems(items.length > 0 ? items : [{ particulars: "", amount: 0 }])
      setBillDate(c.createdAt.toISOString ? c.createdAt.toISOString().split("T")[0] : String(c.createdAt).split("T")[0])
      setTotalAmount(c.packageAmount)
      setDiscountAmount(c.discount)
      setNetAmount(c.totalBillAmount)
      setPreauthAmount(c.preauthAmount)
      setEnhancementApproved(c.enhancementApproved)
      setTotalApproved(c.totalApprovedAmount)
      setFinalSettled(c.finalSettledAmount)
      setDeductions(c.deductions)
      setPatientPayable(c.patientPayableAmount)
      setEnhancementAmount(c.enhancementAmount)
      setExcessAmount(Math.max(0, c.totalBillAmount - c.preauthAmount))
      setAmountReceived(c.patientPaidAmount)
      setPatientBalance(c.patientBalance)

      setLoading(false)
    }
    load()
  }, [claimId])

  function handlePrint() {
    const printArea = printRef.current
    if (!printArea) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    // Collect all stylesheets from the current page (includes Tailwind)
    const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join("\n")

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${BILL_LABELS[billType]}</title>
          ${styleSheets}
          <style>
            body { background: white; margin: 0; padding: 0; }
            @media print {
              @page { size: A4 portrait; margin: 0; }
            }
          </style>
        </head>
        <body>${printArea.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }

  function addBillingItem() {
    setBillingItems(prev => [...prev, { particulars: "", amount: 0 }])
  }

  function removeBillingItem(index: number) {
    setBillingItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateBillingItem(index: number, field: keyof BillingItem, value: string | number) {
    setBillingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
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

  const doctors: string[] = (() => {
    try { return JSON.parse(claim.doctorNames) } catch { return [] }
  })()

  const patientData = {
    patientName: claim.patientName,
    patientId: claim.ipNumber,
    gender: claim.gender,
    age: String(claim.age),
    admissionDate: claim.admissionDate ? new Date(claim.admissionDate).toISOString() : "",
    dischargeDate: claim.dischargeDate ? new Date(claim.dischargeDate).toISOString() : "",
    doctorSpecialization: doctors.join(", ") || "—",
    department: claim.department ?? "—",
  }

  // Filter valid billing items for preview
  const validItems = billingItems.filter(i => i.particulars.trim() !== "")

  return (
    <div className="py-6 space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {BILL_LABELS[billType]} Preview
        </h3>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Print {BILL_LABELS[billType]}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Editable fields */}
        <div className="space-y-5">
          {/* Header height */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Settings</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Letterhead Space (px)</Label>
                <Input
                  type="number"
                  value={headerHeight}
                  onChange={e => setHeaderHeight(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bill Date</Label>
                <Input
                  type="date"
                  value={billDate}
                  onChange={e => setBillDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing items */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Billing Items</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addBillingItem}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {billingItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      value={item.particulars}
                      onChange={e => updateBillingItem(i, "particulars", e.target.value)}
                      placeholder="Particulars"
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      value={item.amount || ""}
                      onChange={e => updateBillingItem(i, "amount", Number(e.target.value) || 0)}
                      placeholder="Amount"
                      className="h-8 text-xs w-24"
                    />
                    {billingItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeBillingItem(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Amounts */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amounts</p>

              {(billType === "final" || billType === "cash") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Total Amount</Label>
                      <Input type="number" value={totalAmount || ""} onChange={e => setTotalAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Discount</Label>
                      <Input type="number" value={discountAmount || ""} onChange={e => setDiscountAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Net Amount</Label>
                    <Input type="number" value={netAmount || ""} onChange={e => setNetAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                  </div>
                  <Separator />
                </>
              )}

              {billType === "final" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Preauth</Label>
                      <Input type="number" value={preauthAmount || ""} onChange={e => setPreauthAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Enhancement</Label>
                      <Input type="number" value={enhancementApproved || ""} onChange={e => setEnhancementApproved(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Total Approved</Label>
                      <Input type="number" value={totalApproved || ""} onChange={e => setTotalApproved(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Settled</Label>
                      <Input type="number" value={finalSettled || ""} onChange={e => setFinalSettled(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Deductions</Label>
                      <Input type="number" value={deductions || ""} onChange={e => setDeductions(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Patient Payable</Label>
                      <Input type="number" value={patientPayable || ""} onChange={e => setPatientPayable(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                </>
              )}

              {billType === "enhancement" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Preauth Amount</Label>
                      <Input type="number" value={preauthAmount || ""} onChange={e => setPreauthAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Total Bill</Label>
                      <Input type="number" value={netAmount || ""} onChange={e => setNetAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Excess Amount</Label>
                      <Input type="number" value={excessAmount || ""} onChange={e => setExcessAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Enhancement Requested</Label>
                      <Input type="number" value={enhancementAmount || ""} onChange={e => setEnhancementAmount(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                </>
              )}

              {billType === "cash" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Total Approved</Label>
                      <Input type="number" value={totalApproved || ""} onChange={e => setTotalApproved(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Settled</Label>
                      <Input type="number" value={finalSettled || ""} onChange={e => setFinalSettled(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Patient Payable</Label>
                      <Input type="number" value={patientPayable || ""} onChange={e => setPatientPayable(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Amt. Received</Label>
                      <Input type="number" value={amountReceived || ""} onChange={e => setAmountReceived(Number(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Balance</Label>
                    <Input type="number" value={patientBalance || ""} onChange={e => setPatientBalance(Number(e.target.value) || 0)} className="h-8 text-xs" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Live preview */}
        <div className="col-span-2">
          <div className="border border-border rounded-xl bg-gray-50 p-4 overflow-auto">
            <div ref={printRef} className="origin-top-left" style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "138.9%" }}>
              {billType === "final" && (
                <InsuranceFinalBill
                  patientData={patientData}
                  billDate={billDate ? new Date(billDate + "T00:00:00").toISOString() : ""}
                  billingItems={validItems}
                  billingData={{
                    totalAmount,
                    discountAmount,
                    netAmount,
                  }}
                  insuranceData={{
                    companyName: claim.insuranceCompanyName,
                    preauthAmount,
                    enhancementApproved,
                    totalApproved,
                    finalSettled,
                    deductions,
                    patientPayable,
                  }}
                  headerHeight={headerHeight}
                />
              )}

              {billType === "enhancement" && (
                <InsuranceEnhancementBill
                  patientData={patientData}
                  billDate={billDate ? new Date(billDate + "T00:00:00").toISOString() : ""}
                  billingItems={validItems}
                  enhancementData={{
                    companyName: claim.insuranceCompanyName,
                    preauthAmount,
                    totalBillAmount: netAmount,
                    excessAmount,
                    enhancementRequested: enhancementAmount,
                  }}
                  headerHeight={headerHeight}
                />
              )}

              {billType === "cash" && (
                <InsuranceCashReceipt
                  patientData={{
                    billNumber: claim.claimNumber,
                    patientId: claim.ipNumber,
                    date: billDate ? format(new Date(billDate + "T00:00:00"), "dd/MM/yyyy") : "",
                    patientName: claim.patientName,
                    gender: claim.gender,
                    guardianName: claim.guardianName ?? "",
                    age: String(claim.age),
                    address: "",
                    mobile: claim.phone,
                    doctorName: doctors[0] ?? "—",
                    doctorNames: doctors.join(", "),
                    onDutyDoctor: "",
                    department: claim.department ?? "—",
                    dateOfAdmit: claim.admissionDate ? format(new Date(claim.admissionDate), "dd/MM/yyyy") : "",
                    dateOfDischarge: claim.dischargeDate ? format(new Date(claim.dischargeDate), "dd/MM/yyyy") : "",
                    referredBy: "",
                  }}
                  billingItems={validItems}
                  billingData={{
                    totalAmount,
                    advancePaid: 0,
                    discountPercent: totalAmount > 0 ? (discountAmount / totalAmount) * 100 : 0,
                    discountAmount,
                    amountReceived,
                    balance: patientBalance,
                  }}
                  insuranceSummary={{
                    companyName: claim.insuranceCompanyName,
                    totalApproved,
                    finalSettled,
                    patientPayable,
                    patientPaid: amountReceived,
                    patientBalance,
                  }}
                  headerHeight={headerHeight}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
