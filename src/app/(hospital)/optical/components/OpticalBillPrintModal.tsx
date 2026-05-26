"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ReceiptLayout, ReceiptFooter } from "@/components/receipts/ReceiptLayout"
import { ReceiptHeader } from "@/components/receipts/ReceiptHeader"
import { PatientInfoSection } from "@/components/receipts/PatientInfoSection"
import { getOpticalHospitalProfile, getOpticalSettings } from "../actions"
import { formatDate, formatCurrency } from "@/lib/utils"

type OpticalBillItem = {
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
}

export type OpticalBillForPrint = {
  id: string
  billNumber: string
  billDate: Date | string
  patientName: string
  patientId?: string | null
  patientPhone?: string | null
  gender?: string | null
  referredDoctor?: string | null
  subtotal: number
  discountPercent: number
  discountAmount: number
  billAmount: number
  paidAmount: number
  balanceDue: number
  paymentMode: string
  deliveryDate?: Date | string | null
  orderNotes?: string | null
  items: OpticalBillItem[]
}

interface Props {
  open: boolean
  onClose: () => void
  bill: OpticalBillForPrint | null
}

export function OpticalBillPrintModal({ open, onClose, bill }: Props) {
  const [loading, setLoading] = useState(true)
  const [hospitalProfile, setHospitalProfile] = useState<Awaited<ReturnType<typeof getOpticalHospitalProfile>> | null>(null)
  const [printHeaderKey, setPrintHeaderKey] = useState("")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([getOpticalHospitalProfile(), getOpticalSettings()])
      .then(([profile, settings]) => {
        setHospitalProfile(profile)
        setPrintHeaderKey(settings.printHeaderKey)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  function handlePrint() {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const printWindow = window.open("", "_blank", "width=800,height=1000")
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Print - ${bill?.billNumber}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: A4 portrait; margin: 0; }
          .receipt-page { width: 210mm; min-height: 297mm; padding: 8mm; page-break-after: always; }
          .receipt-page:last-child { page-break-after: auto; }
          .no-break { page-break-inside: avoid; }
        }
      </style>
    </head><body>${content}</body></html>`)
    printWindow.document.close()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 1000)
  }

  if (!bill) return null

  const hospitalInfo = hospitalProfile ? {
    name: hospitalProfile.name,
    displayName: hospitalProfile.displayName,
    address: hospitalProfile.address,
    phone: hospitalProfile.phone,
    email: hospitalProfile.email,
    website: hospitalProfile.website,
    registrationNo: hospitalProfile.registrationNo,
    logoUrl: hospitalProfile.logoUrl,
  } : { name: "Hospital" }

  const hospitalName = (hospitalProfile?.displayName || hospitalProfile?.name) ?? "Hospital"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[870px] max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-row items-center justify-between">
          <DialogTitle className="text-base">Print — {bill.billNumber}</DialogTitle>
          <Button size="sm" onClick={handlePrint} disabled={loading} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : (
            <div ref={printRef}>
              <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
                <div className="receipt-header-section">
                  <ReceiptHeader hospital={hospitalInfo} headerOverrideKey={printHeaderKey || undefined} />
                </div>
                <h2 className="text-sm text-center font-bold py-1 mb-2">OPTICAL BILL</h2>
                <PatientInfoSection data={{
                  patientName: bill.patientName,
                  patientId: bill.patientId || "—",
                  date: formatDate(bill.billDate),
                  mobile: bill.patientPhone || "—",
                  gender: bill.gender || "—",
                  age: "—",
                  address: "—",
                  receiptNo: bill.billNumber,
                  doctorName: bill.referredDoctor || "—",
                }} />

                <div className="pb-3 mb-4 no-break">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr>
                        <th className="border border-black p-2 text-left font-bold w-[8%]">S.No</th>
                        <th className="border border-black p-2 text-left font-bold">ITEM</th>
                        <th className="border border-black p-2 text-center font-bold w-[8%]">EYE</th>
                        <th className="border border-black p-2 text-center font-bold w-[8%]">QTY</th>
                        <th className="border border-black p-2 text-right font-bold w-[14%]">PRICE</th>
                        <th className="border border-black p-2 text-right font-bold w-[14%]">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.map((item, i) => (
                        <tr key={item.id}>
                          <td className="border border-black p-2">{i + 1}</td>
                          <td className="border border-black p-2">
                            {item.itemName}
                            {item.category && <span className="text-[10px] text-gray-500 ml-1">({item.category})</span>}
                          </td>
                          <td className="border border-black p-2 text-center">{item.eye || "—"}</td>
                          <td className="border border-black p-2 text-center">{item.quantity}</td>
                          <td className="border border-black p-2 text-right">{item.price.toLocaleString("en-IN")}</td>
                          <td className="border border-black p-2 text-right">{item.amount.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pb-3 no-break">
                  <table className="w-full border-collapse text-[11px]">
                    <tbody>
                      <tr>
                        <td className="border border-black p-2 font-bold">SUBTOTAL</td>
                        <td className="border border-black p-2 text-right font-bold">{bill.subtotal.toLocaleString("en-IN")}</td>
                      </tr>
                      {bill.discountAmount > 0 && (
                        <tr>
                          <td className="border border-black p-2 font-bold">DISCOUNT ({bill.discountPercent}%)</td>
                          <td className="border border-black p-2 text-right font-bold">- {bill.discountAmount.toLocaleString("en-IN")}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="border border-black p-2 font-bold">TOTAL</td>
                        <td className="border border-black p-2 text-right font-bold">{bill.billAmount.toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-2 font-bold">AMOUNT PAID ({bill.paymentMode})</td>
                        <td className="border border-black p-2 text-right font-bold">{bill.paidAmount.toLocaleString("en-IN")}</td>
                      </tr>
                      {bill.balanceDue > 0 && (
                        <tr>
                          <td className="border border-black p-2 font-bold text-red-700">BALANCE DUE</td>
                          <td className="border border-black p-2 text-right font-bold text-red-700">{bill.balanceDue.toLocaleString("en-IN")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {(bill.deliveryDate || bill.orderNotes) && (
                  <div className="text-[11px] mt-3 space-y-1 no-break">
                    {bill.deliveryDate && (
                      <p><span className="font-bold">EXPECTED DELIVERY: </span>{formatDate(bill.deliveryDate)}</p>
                    )}
                    {bill.orderNotes && (
                      <p><span className="font-bold">NOTES: </span>{bill.orderNotes}</p>
                    )}
                  </div>
                )}
              </ReceiptLayout>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
