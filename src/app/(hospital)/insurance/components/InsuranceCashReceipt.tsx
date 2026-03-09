"use client"

import React, { useEffect, useState } from "react"

interface BillingItem {
  particulars: string
  amount: number
  days?: number
}

interface PatientData {
  billNumber: string
  patientId: string
  date: string
  patientName: string
  gender: string
  guardianName?: string
  age: string
  address: string
  mobile: string
  doctorName: string
  doctorNames: string
  onDutyDoctor: string
  department: string
  dateOfAdmit?: string
  dateOfDischarge?: string
  dateOfOperation?: string
  referredBy?: string
}

interface BillingData {
  totalAmount: number
  advancePaid: number
  discountPercent: number
  discountAmount: number
  amountReceived: number
  balance: number
}

interface InsuranceSummary {
  companyName: string
  totalApproved: number
  finalSettled: number
  patientPayable: number
  patientPaid: number
  patientBalance: number
}

interface InsuranceCashReceiptProps {
  patientData: PatientData
  billingItems?: BillingItem[]
  billingData?: BillingData
  insuranceSummary?: InsuranceSummary
  headerHeight?: number
}

export default function InsuranceCashReceipt({
  patientData,
  billingItems = [],
  billingData,
  insuranceSummary,
  headerHeight = 120,
}: InsuranceCashReceiptProps): React.ReactElement {
  const [pages, setPages] = useState<BillingItem[][]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [ITEMS_PER_PAGE] = useState(billingItems.length)

  useEffect(() => {
    if (!billingItems || billingItems.length === 0) {
      setPages([[]])
      return
    }
    const pageCount = Math.ceil(billingItems.length / ITEMS_PER_PAGE)
    const paginatedItems: BillingItem[][] = []
    for (let i = 0; i < pageCount; i++) {
      const startIndex = i * ITEMS_PER_PAGE
      const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, billingItems.length)
      paginatedItems.push(billingItems.slice(startIndex, endIndex))
    }
    setPages(paginatedItems)
  }, [billingItems, ITEMS_PER_PAGE])

  const renderReceiptPage = (
    pageItems: BillingItem[],
    pageIndex: number,
    isLastPage: boolean
  ): React.ReactElement => {
    return (
      <div
        key={`page-${pageIndex}`}
        className={`receipt-container bg-[#ffffff] mx-auto relative ${pageIndex !== currentPage ? "hidden" : ""}`}
      >
        <div className="receipt-content">
          {/* Configurable blank header space for pre-printed letterhead */}
          <div style={{ height: `${headerHeight}px` }} className="border-b-2 border-[#000000]" />

          <h2 className="text-sm text-center font-bold py-1 px-2 mb-2 mt-2">BILLING RECEIPT</h2>

          {/* Patient Information Section */}
          <div className="pb-3 mb-4 border-b border-[#000000]">
            <h3 className="text-xs font-bold mb-3">PATIENT INFORMATION</h3>
            <div className="text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
              <div>
                <div className="font-bold">PATIENT NAME</div>
                <div>{patientData.patientName}</div>
              </div>
              <div>
                <div className="font-bold">PATIENT ID</div>
                <div>{patientData.patientId}</div>
              </div>
              <div>
                <div className="font-bold">DATE</div>
                <div>{patientData.date}</div>
              </div>
              <div>
                <div className="font-bold">BILL NO</div>
                <div>{patientData.billNumber}</div>
              </div>
              <div>
                <div className="font-bold">GENDER</div>
                <div>{patientData.gender}</div>
              </div>
              <div>
                <div className="font-bold">REFERRED BY</div>
                <div>{patientData.referredBy || ""}</div>
              </div>
              <div>
                <div className="font-bold">AGE</div>
                <div>{patientData.age}</div>
              </div>
              <div>
                <div className="font-bold">ADDRESS</div>
                <div>{patientData.address}</div>
              </div>
              <div>
                <div className="font-bold">MOBILE</div>
                <div>{patientData.mobile}</div>
              </div>
              <div>
                <div className="font-bold">DOCTOR NAME</div>
                <div>{patientData.doctorName}</div>
              </div>
              <div>
                <div className="font-bold">ON DUTY DOCTOR</div>
                <div>{patientData.onDutyDoctor}</div>
              </div>
              <div>
                <div className="font-bold">DEPT.</div>
                <div>{patientData.department}</div>
              </div>
            </div>
          </div>

          {/* Billing Table Section */}
          <div className="pb-3 mb-4">
            <h3 className="text-xs font-bold mb-3">BILLING DETAILS</h3>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-[#000000] p-2 text-left">S.No</th>
                  <th className="border border-[#000000] p-2 text-left">Particulars</th>
                  <th className="border border-[#000000] p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item, index) => {
                  const isSubItem = item.particulars.startsWith("  - ")
                  let itemNumber = ""
                  if (!isSubItem) {
                    const subItemsBeforeCount = pageItems
                      .slice(0, index)
                      .filter((i) => i.particulars.startsWith("  - ")).length
                    itemNumber = String(pageIndex * ITEMS_PER_PAGE + index + 1 - subItemsBeforeCount)
                  }
                  return (
                    <tr key={`item-${index}`}>
                      <td className="border border-[#000000] p-2">{isSubItem ? "" : itemNumber}</td>
                      <td className="border border-[#000000] p-2">{item.particulars}</td>
                      <td className="border border-[#000000] p-2 text-right">{item.amount.toFixed(2)}</td>
                    </tr>
                  )
                })}

                {pageItems.length < ITEMS_PER_PAGE &&
                  Array(ITEMS_PER_PAGE - pageItems.length)
                    .fill(0)
                    .map((_, index) => (
                      <tr key={`empty-${index}`}>
                        <td className="border border-[#000000] p-2">&nbsp;</td>
                        <td className="border border-[#000000] p-2">&nbsp;</td>
                        <td className="border border-[#000000] p-2">&nbsp;</td>
                      </tr>
                    ))}

                {/* Summary rows on last page */}
                {isLastPage && billingData && (
                  <>
                    <tr>
                      <td className="border border-[#000000] p-2" colSpan={2}>
                        <div className="text-right font-bold">TOTAL AMOUNT</div>
                      </td>
                      <td className="border border-[#000000] p-2 text-right font-bold">{billingData.totalAmount.toFixed(2)}</td>
                    </tr>
                    {billingData.discountPercent > 0 && (
                      <tr>
                        <td className="border border-[#000000] p-2" colSpan={2}>
                          <div className="text-right font-bold">DISCOUNT %</div>
                        </td>
                        <td className="border border-[#000000] p-2 text-right">{billingData.discountPercent}%</td>
                      </tr>
                    )}
                    {billingData.discountAmount > 0 && (
                      <tr>
                        <td className="border border-[#000000] p-2" colSpan={2}>
                          <div className="text-right font-bold">DISCOUNT AMOUNT</div>
                        </td>
                        <td className="border border-[#000000] p-2 text-right">{billingData.discountAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="border border-[#000000] p-2" colSpan={2}>
                        <div className="text-right font-bold">NET AMOUNT</div>
                      </td>
                      <td className="border border-[#000000] p-2 text-right font-bold">
                        {(billingData.totalAmount - billingData.discountAmount).toFixed(2)}
                      </td>
                    </tr>

                    {/* Insurance summary rows */}
                    {insuranceSummary && (
                      <>
                        <tr>
                          <td className="border border-[#000000] p-2" colSpan={2}>
                            <div className="text-right font-bold">INSURANCE ({insuranceSummary.companyName})</div>
                          </td>
                          <td className="border border-[#000000] p-2 text-right font-bold">
                            {insuranceSummary.totalApproved.toFixed(2)}
                          </td>
                        </tr>
                        {insuranceSummary.finalSettled > 0 && (
                          <tr>
                            <td className="border border-[#000000] p-2" colSpan={2}>
                              <div className="text-right font-bold">INSURANCE SETTLED</div>
                            </td>
                            <td className="border border-[#000000] p-2 text-right font-bold">
                              {insuranceSummary.finalSettled.toFixed(2)}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="border border-[#000000] p-2" colSpan={2}>
                            <div className="text-right font-bold">PATIENT AMOUNT</div>
                          </td>
                          <td className="border border-[#000000] p-2 text-right font-bold">
                            {insuranceSummary.patientPayable.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}

                    <tr>
                      <td className="border border-[#000000] p-2" colSpan={2}>
                        <div className="text-right font-bold">AMT. RECEIVED</div>
                      </td>
                      <td className="border border-[#000000] p-2 text-right">{billingData.amountReceived.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="border border-[#000000] p-2" colSpan={2}>
                        <div className="text-right font-bold">BALANCE</div>
                      </td>
                      <td className="border border-[#000000] p-2 text-right font-bold">{billingData.balance.toFixed(2)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="receipt-footer">
          <div className="pt-3">
            <div className="text-center text-[10px] mb-2">
              Page {pageIndex + 1} of {pages.length}
            </div>

            {isLastPage && (
              <div className="flex justify-between items-center">
                <div className="text-left text-[11px]"></div>
                <div className="text-right text-[11px] space-y-1">
                  <p className="font-bold">AUTHORISED SIGNATORY</p>
                </div>
              </div>
            )}

            <div className="border-t border-[#000000] pt-1 text-center mt-2 text-[9px] text-[#000000]">
              <p className="mt-1 text-sm font-semibold text-center">
                Arogya Sri and Insurance facilities available
              </p>
              <div className="flex justify-between items-center">
                <span>
                  This is a computer generated receipt. Please preserve this for your records.
                </span>
                <span>
                  Generated on:{" "}
                  {new Date().toLocaleDateString("en-GB", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  {new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handlePrevPage = (): void => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = (): void => {
    setCurrentPage((prev) => Math.min(pages.length - 1, prev + 1))
  }

  return (
    <div>
      {pages.map((pageItems, index) =>
        renderReceiptPage(pageItems, index, index === pages.length - 1)
      )}

      {pages.length > 1 && (
        <div className="flex justify-center items-center mt-4 gap-4 print:hidden">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className={`px-3 py-1 rounded ${
              currentPage === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Previous Page
          </button>
          <span className="text-sm">
            Page {currentPage + 1} of {pages.length}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === pages.length - 1}
            className={`px-3 py-1 rounded ${
              currentPage === pages.length - 1 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Next Page
          </button>
        </div>
      )}

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
            box-shadow: none; page-break-after: always;
          }
          .receipt-container:last-child { page-break-after: avoid; }
          .hidden { display: block !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  )
}
