"use client"

import { ReceiptLayout } from "./ReceiptLayout"
import VennalaLabHeader from "./headers/VennalaLab"
import { formatDate } from "@/lib/utils"

interface Props {
  bill: {
    billNumber: string
    total: number
    amountPaid: number
    balanceDue: number
    discount: number
    subtotal: number
    items: { name: string; amount: number }[]
    createdAt: string
  }
  patient: {
    fullName: string
  }
  doctorName?: string | null
}

function splitRupees(amount: number): { rupees: string; paise: string } {
  const safe = Number.isFinite(amount) ? amount : 0
  const rupees = Math.trunc(safe)
  const paise = Math.round(Math.abs(safe - rupees) * 100)
  return {
    rupees: rupees.toLocaleString("en-IN"),
    paise: String(paise).padStart(2, "0"),
  }
}

export function VennelaLabReceipt({ bill, patient, doctorName }: Props) {
  const discountPct = bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0

  return (
    <ReceiptLayout>
      <div className="text-[11px] text-black" style={{ fontFamily: "'Arial', sans-serif" }}>
        {/* Hospital header (rendered from headers/VennalaLab.tsx) */}
        <VennalaLabHeader hospital={{ name: "Vennela Lab" } as Parameters<typeof VennalaLabHeader>[0]["hospital"]} />

        {/* LAB RECEIPT title */}
        <div className="text-center mb-3">
          <p className="text-[12px] font-bold">LAB RECEIPT</p>
        </div>

        {/* Bill No + Date row */}
        <div className="flex items-end justify-between mb-3 text-[11px]">
          <div className="flex items-end gap-2 w-1/2">
            <span>Bill No.</span>
            <span className="font-bold text-red-600 border-b border-black flex-1 px-1 pb-0.5">
              {bill.billNumber}
            </span>
          </div>
          <div className="flex items-end gap-2 w-2/5">
            <span>Date</span>
            <span className="border-b border-black flex-1 px-1 pb-0.5">
              {formatDate(bill.createdAt)}
            </span>
          </div>
        </div>

        {/* Patient Name */}
        <div className="flex items-end gap-2 mb-3 text-[11px]">
          <span>Patient Name</span>
          <span className="border-b border-black flex-1 px-1 pb-0.5">{patient.fullName}</span>
        </div>

        {/* Doctor */}
        <div className="flex items-end gap-2 mb-4 text-[11px]">
          <span>Doctor</span>
          <span className="border-b border-black flex-1 px-1 pb-0.5">
            {doctorName?.trim() ? doctorName : "Dr. Srilatha ch"}
          </span>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-black p-1.5 font-bold w-[10%] text-center align-middle">
                Sl.
                <br />
                No.
              </th>
              <th className="border border-black p-1.5 font-bold text-center align-middle">
                PARTICULARS
              </th>
              <th className="border border-black p-0 font-bold w-[22%] align-middle" colSpan={2}>
                <div className="text-center pt-1.5 font-bold">AMOUNT</div>
                <div className="grid grid-cols-2 border-t border-black mt-1">
                  <div className="text-center py-1 border-r border-black">Rs.</div>
                  <div className="text-center py-1">Ps.</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, i) => {
              const { rupees, paise } = splitRupees(item.amount)
              return (
                <tr key={i}>
                  <td className="border border-black p-1.5 text-center">{i + 1}</td>
                  <td className="border border-black p-1.5">{item.name}</td>
                  <td className="border border-black p-1.5 text-right">{rupees}</td>
                  <td className="border border-black p-1.5 text-right">{paise}</td>
                </tr>
              )
            })}
            {/* Summary rows */}
            {(() => {
              const total = splitRupees(bill.total)
              const disc = splitRupees(bill.discount)
              const paid = splitRupees(bill.amountPaid)
              const due = splitRupees(bill.balanceDue)
              return (
                <>
                  <tr>
                    <td className="border-l border-r border-black p-1.5" />
                    <td className="border border-black p-1.5 text-right font-bold">Total Amount:</td>
                    <td className="border border-black p-1.5 text-right">{total.rupees}</td>
                    <td className="border border-black p-1.5 text-right">{total.paise}</td>
                  </tr>
                  <tr>
                    <td className="border-l border-r border-black p-1.5" />
                    <td className="border border-black p-1.5 text-right font-bold">
                      Discount ({discountPct}%):
                    </td>
                    <td className="border border-black p-1.5 text-right">{disc.rupees}</td>
                    <td className="border border-black p-1.5 text-right">{disc.paise}</td>
                  </tr>
                  <tr>
                    <td className="border-l border-r border-black p-1.5" />
                    <td className="border border-black p-1.5 text-right font-bold">Amount Received:</td>
                    <td className="border border-black p-1.5 text-right">{paid.rupees}</td>
                    <td className="border border-black p-1.5 text-right">{paid.paise}</td>
                  </tr>
                  <tr>
                    <td className="border-l border-r border-b border-black p-1.5" />
                    <td className="border border-black p-1.5 text-right font-bold">Amount Due:</td>
                    <td className="border border-black p-1.5 text-right font-bold">{due.rupees}</td>
                    <td className="border border-black p-1.5 text-right font-bold">{due.paise}</td>
                  </tr>
                </>
              )
            })()}
          </tbody>
        </table>

        {/* Footer notes + signature */}
        <div className="flex justify-between items-end mt-6 text-[10px]">
          <div className="leading-snug">
            <p>Thank you for choosing our services</p>
            <p>Amount paid not refundable / transferable</p>
            <p>Subject to karimnagar jurisdiction</p>
          </div>
          <div className="italic">Authorized Signature</div>
        </div>
      </div>
    </ReceiptLayout>
  )
}
