"use client"

import { ReceiptHeader } from "./ReceiptHeader"
import { ReceiptLayout, ReceiptFooter } from "./ReceiptLayout"
import { PatientInfoSection } from "./PatientInfoSection"

interface CashReceiptProps {
  hospital: {
    name: string
    displayName?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    registrationNo?: string | null
    logoUrl?: string | null
  }
  patient: {
    patientName: string
    patientId: string
    date: string
    mobile: string
    gender: string
    age: string
    address: string
    referredBy?: string
    receiptNo?: string
    doctorName: string
    department?: string
  }
  payment: {
    paidFor?: string
    mode: string
    totalAmount: number
    discount: number
    amountReceived: number
    amountDue: number
  }
  items?: { description: string; amount: number }[]
}

export function CashReceipt({ hospital, patient, payment, items }: CashReceiptProps) {
  const hospitalName = hospital.displayName || hospital.name

  return (
    <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
      <div className="receipt-header-section">
        <ReceiptHeader hospital={hospital} />
      </div>

      <h2 className="text-sm text-center font-bold py-1 mb-2">CASH RECEIPT</h2>

      <PatientInfoSection data={patient} />

      {/* Service Items */}
      {items && items.length > 0 && (
        <div className="pb-3 mb-4 no-break">
          <h3 className="text-xs font-bold mb-2">SERVICES</h3>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-black p-2 text-left font-bold w-[10%]">#</th>
                <th className="border border-black p-2 text-left font-bold">DESCRIPTION</th>
                <th className="border border-black p-2 text-right font-bold w-[25%]">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="border border-black p-2">{i + 1}</td>
                  <td className="border border-black p-2">{item.description}</td>
                  <td className="border border-black p-2 text-right">{item.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Summary */}
      <div className="pb-3 mb-4 no-break">
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {payment.paidFor && (
              <tr>
                <td className="border border-black p-2 font-bold">PAID FOR</td>
                <td className="border border-black p-2 text-right font-bold">{payment.paidFor}</td>
              </tr>
            )}
            <tr>
              <td className="border border-black p-2 font-bold">MODE</td>
              <td className="border border-black p-2 text-right font-bold">{payment.mode}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">TOTAL AMOUNT</td>
              <td className="border border-black p-2 text-right font-bold">{payment.totalAmount.toLocaleString("en-IN")}</td>
            </tr>
            {payment.discount > 0 && (
              <tr>
                <td className="border border-black p-2 font-bold">DISCOUNT</td>
                <td className="border border-black p-2 text-right font-bold">{payment.discount.toLocaleString("en-IN")}</td>
              </tr>
            )}
            <tr>
              <td className="border border-black p-2 font-bold">AMOUNT RECEIVED</td>
              <td className="border border-black p-2 text-right font-bold">{payment.amountReceived.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">AMOUNT DUE</td>
              <td className="border border-black p-2 text-right font-bold">{payment.amountDue.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReceiptLayout>
  )
}
