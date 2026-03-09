"use client"

import React from "react"
import { format } from "date-fns"

interface PatientData {
  patientName: string
  patientId: string
  gender: string
  age: string
  admissionDate: string
  dischargeDate: string
  doctorSpecialization: string
  department: string
}

interface BillingItem {
  particulars: string
  amount: number | string
}

interface BillingData {
  totalAmount: number
  discountAmount: number
  netAmount: number
}

interface InsuranceData {
  companyName: string
  preauthAmount: number
  enhancementApproved: number
  totalApproved: number
  finalSettled: number
  deductions: number
  patientPayable: number
}

interface InsuranceFinalBillProps {
  patientData: PatientData
  billDate: string
  billingItems?: BillingItem[]
  billingSummary?: BillingItem[]
  billingData?: BillingData
  insuranceData?: InsuranceData
  headerHeight?: number // px, configurable blank space for letterhead
}

export default function InsuranceFinalBill({
  patientData,
  billDate,
  billingItems = [],
  billingSummary,
  billingData,
  insuranceData,
  headerHeight = 120,
}: InsuranceFinalBillProps): React.ReactElement {
  return (
    <div className="receipt-container bg-[#ffffff] mx-auto relative">
      {/* Main Content */}
      <div className="receipt-content">
        {/* Configurable blank header space for pre-printed letterhead */}
        <div style={{ height: `${headerHeight}px` }} />

        {/* Certificate Title */}
        <h2 className="text-sm text-center font-bold py-2 px-2 mb-4">
          HOSPITAL FINAL BILL
        </h2>

        {/* Date Section */}
        <div className="flex justify-end mb-6">
          <div className="text-[12px]">
            <span className="font-bold">Date: </span>
            <span>{billDate ? format(new Date(billDate), "dd/MM/yyyy") : ""}</span>
          </div>
        </div>

        {/* Patient Information Section */}
        <div className="pb-3 mb-4 border-b border-[#000000]">
          <h3 className="text-xs font-bold mb-3">PATIENT INFORMATION</h3>
          <div className="text-[12px] grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            <div>
              <div className="font-bold mt-1">PATIENT NAME</div>
              <div className="font-semibold pt-1">{patientData.patientName}</div>
            </div>
            <div>
              <div className="font-bold mt-1">IP NO</div>
              <div className="pt-1 font-semibold">{patientData.patientId}</div>
            </div>
            <div>
              <div className="font-bold mt-1">GENDER</div>
              <div className="pt-1 font-semibold">{patientData.gender}</div>
            </div>
            <div>
              <div className="font-bold mt-1">AGE</div>
              <div className="pt-1 font-semibold">{patientData.age}</div>
            </div>
            <div>
              <div className="font-bold mt-1">ADMISSION DATE</div>
              <div className="pt-1 font-semibold">
                {patientData.admissionDate ? format(new Date(patientData.admissionDate), "dd/MM/yyyy") : ""}
              </div>
            </div>
            <div>
              <div className="font-bold mt-1">DISCHARGE DATE</div>
              <div className="pt-1 font-semibold">
                {patientData.dischargeDate ? format(new Date(patientData.dischargeDate), "dd/MM/yyyy") : ""}
              </div>
            </div>
            <div>
              <div className="font-bold mt-1">DOCTOR/SPECIALIZATION</div>
              <div className="pt-1 font-semibold">{patientData.doctorSpecialization}</div>
            </div>
            <div>
              <div className="font-bold mt-1">DEPARTMENT</div>
              <div className="pt-1 font-semibold">{patientData.department}</div>
            </div>
          </div>
        </div>

        {/* Billing Table */}
        <div className="pb-3 mt-8">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]">PARTICULARS</th>
                <th className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff] w-32">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {billingItems.map((item, index) => (
                <tr key={index}>
                  <td className="border border-[#000000] text-center font-semibold p-2">{item.particulars}</td>
                  <td className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]">
                    {(() => {
                      const amount = typeof item.amount === "string" ? parseFloat(item.amount) : item.amount
                      return amount > 0 ? amount.toFixed(2) : "0"
                    })()}
                  </td>
                </tr>
              ))}

              {/* Financial Summary */}
              {billingData && (
                <>
                  <tr>
                    <td className="border border-[#000000] p-2 text-right font-bold bg-[#ffffff]">TOTAL AMOUNT</td>
                    <td className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]">{billingData.totalAmount.toFixed(2)}</td>
                  </tr>
                  {billingData.discountAmount > 0 && (
                    <tr>
                      <td className="border border-[#000000] p-2 text-right font-bold bg-[#ffffff]">DISCOUNT AMOUNT</td>
                      <td className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]">{billingData.discountAmount.toFixed(2)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="border border-[#000000] p-2 text-right font-bold bg-[#ffffff]">NET AMOUNT</td>
                    <td className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]">{billingData.netAmount.toFixed(2)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Insurance Summary Table */}
        {insuranceData && (
          <div className="pb-3 mt-4">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]" colSpan={2}>
                    INSURANCE SUMMARY
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#000000] p-2 font-semibold">Insurance Company</td>
                  <td className="border border-[#000000] p-2 text-center font-bold w-32">{insuranceData.companyName}</td>
                </tr>
                <tr>
                  <td className="border border-[#000000] p-2 font-semibold">Preauth Approved Amount</td>
                  <td className="border border-[#000000] p-2 text-center font-bold">{insuranceData.preauthAmount.toFixed(2)}</td>
                </tr>
                {insuranceData.enhancementApproved > 0 && (
                  <tr>
                    <td className="border border-[#000000] p-2 font-semibold">Enhancement Approved</td>
                    <td className="border border-[#000000] p-2 text-center font-bold">{insuranceData.enhancementApproved.toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td className="border border-[#000000] p-2 font-semibold">Total Insurance Approved</td>
                  <td className="border border-[#000000] p-2 text-center font-bold">{insuranceData.totalApproved.toFixed(2)}</td>
                </tr>
                {insuranceData.finalSettled > 0 && (
                  <tr>
                    <td className="border border-[#000000] p-2 font-semibold">Final Settled Amount</td>
                    <td className="border border-[#000000] p-2 text-center font-bold">{insuranceData.finalSettled.toFixed(2)}</td>
                  </tr>
                )}
                {insuranceData.deductions > 0 && (
                  <tr>
                    <td className="border border-[#000000] p-2 font-semibold">Deductions</td>
                    <td className="border border-[#000000] p-2 text-center font-bold">{insuranceData.deductions.toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td className="border border-[#000000] p-2 font-bold">AMOUNT TO BE PAID BY PATIENT</td>
                  <td className="border border-[#000000] p-2 text-center font-bold">{insuranceData.patientPayable.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Billing Summary (extra lines if provided) */}
        {billingSummary && billingSummary.some(item => item.particulars.trim() !== "") && (
          <div className="pb-3 mt-4">
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {billingSummary.filter(item => item.particulars.trim() !== "").map((item, index) => (
                  <tr key={index}>
                    <td className="border border-[#000000] text-center font-semibold p-2">{item.particulars}</td>
                    <td className="border border-[#000000] p-2 text-center font-bold bg-[#ffffff]">
                      {(() => {
                        const amount = typeof item.amount === "string" ? parseFloat(item.amount) : item.amount
                        return amount > 0 ? amount.toFixed(2) : "0"
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="receipt-footer">
        <div className="pt-3">
          <div className="flex justify-between items-center">
            <div className="text-left text-[11px]"></div>
            <div className="text-right text-[11px] space-y-1">
              <p className="font-bold">AUTHORISED SIGNATORY</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .receipt-container {
          width: 210mm;
          min-height: 297mm;
          padding: 12mm;
          font-family: 'Arial', sans-serif;
          line-height: 1.2;
          display: flex;
          flex-direction: column;
        }
        .receipt-content { flex: 1; }
        .receipt-footer { margin-top: auto; padding-top: 20px; }
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .receipt-container {
            width: 210mm; height: 297mm; margin: 0; padding: 8mm;
            box-shadow: none; page-break-after: avoid;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  )
}
