"use client"

import { type ReactNode } from "react"

interface ReceiptLayoutProps {
  children: ReactNode
  footer?: ReactNode
}

export function ReceiptLayout({ children, footer }: ReceiptLayoutProps) {
  return (
    <div className="receipt-page bg-white mx-auto relative" style={{ fontFamily: "'Arial', sans-serif" }}>
      <div className="receipt-page-content">
        {children}
      </div>
      {footer && (
        <div className="receipt-page-footer">
          {footer}
        </div>
      )}

      <style>{`
        .receipt-page {
          width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          line-height: 1.3;
          display: flex;
          flex-direction: column;
          color: #000;
        }
        .receipt-page-content {
          flex: 1;
        }
        .receipt-page-footer {
          margin-top: auto;
          padding-top: 16px;
        }

        @media print {
          body { margin: 0; padding: 0; background: white; }

          .receipt-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 8mm;
            box-shadow: none;
          }

          .receipt-page-content {
            page-break-inside: auto;
          }

          /* Prevent breaking inside sections */
          .no-break { page-break-inside: avoid; }

          /* New pages after first won't have header */
          .receipt-header-section {
            page-break-after: auto;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}

export function ReceiptFooter({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="pt-3">
      <div className="flex justify-between items-center">
        <div />
        <div className="text-right text-[11px] space-y-1">
          <p className="font-bold">AUTHORISED SIGNATORY</p>
          <p className="font-bold">For {hospitalName}</p>
        </div>
      </div>
      <div className="border-t border-black pt-1 mt-2 text-center text-[9px]">
        <div className="flex justify-between items-center">
          <span>This is a computer generated receipt. Please preserve this for your records.</span>
          <span>
            Generated on:{" "}
            {new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
            {new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" })}
          </span>
        </div>
      </div>
    </div>
  )
}
