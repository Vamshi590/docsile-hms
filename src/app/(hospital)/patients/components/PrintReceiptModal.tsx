"use client"

import { useState, useRef } from "react"
import { Printer, X, FileText } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { InPatient, PaymentRecord, PackageInclusion, MedicalValues, IPPrescription } from "@/lib/types"

/* ─── OPD Receipt Types ─── */
type OPDPrescription = {
  id: string
  prescriptionNumber: string | null
  prescriptionDate: Date
  status: string
  total: number
  discount: number
  amountPaid: number
  balanceDue: number
  paymentMode: string | null
  items?: { id: string; description: string; category: string | null; quantity: number; unitPrice: number; amount: number }[]
}

type OPDPatient = {
  patientId: string
  firstName: string
  lastName: string | null
  age: number | null
  gender: string
  phone: string
  address: string | null
  guardianName: string | null
  doctorName: string | null
  department: string | null
  referredBy: string | null
  appointmentDate: Date
  prescriptions?: OPDPrescription[]
}

/* ─── Common ─── */
type ReceiptType = "cash" | "prescription" | "discharge" | "operation"

const OPD_RECEIPT_TYPES: { key: ReceiptType; label: string; icon: string }[] = [
  { key: "cash", label: "Cash Receipt", icon: "💰" },
]

const IPD_RECEIPT_TYPES: { key: ReceiptType; label: string; icon: string }[] = [
  { key: "cash", label: "Cash Receipt", icon: "💰" },
  { key: "operation", label: "Operation Receipt", icon: "🏥" },
  { key: "discharge", label: "Discharge Summary", icon: "📋" },
]

/* ─── OPD Print Modal ─── */
interface OPDPrintProps {
  open: boolean
  onClose: () => void
  patient: OPDPatient
  prescription: OPDPrescription
  hospitalName?: string
}

export function OPDPrintReceiptModal({ open, onClose, patient, prescription, hospitalName = "Hospital" }: OPDPrintProps) {
  const [selectedType, setSelectedType] = useState<ReceiptType>("cash")
  const receiptRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    if (!receiptRef.current) return
    const printWindow = window.open("", "_blank", "width=800,height=1000")
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Receipt</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 11px; }
        th { background: #f0f0f0; font-weight: bold; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        .header h1 { font-size: 18px; margin-bottom: 2px; }
        .header p { font-size: 10px; color: #555; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 12px 0; font-size: 11px; }
        .info-grid .label { color: #555; }
        .info-grid .value { font-weight: 600; }
        .section-title { font-size: 12px; font-weight: bold; margin: 14px 0 6px; text-transform: uppercase; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        .total-row { font-weight: bold; background: #f5f5f5; }
        .text-right { text-align: right; }
        .signature { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
        .signature div { text-align: center; }
        .signature .line { border-top: 1px solid #000; width: 140px; margin-top: 30px; padding-top: 4px; }
        @media print { body { padding: 10px; } }
      </style>
      </head><body>${receiptRef.current.innerHTML}</body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Print Receipt — {patient.firstName} {patient.lastName ?? ""}</DialogTitle>
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </DialogHeader>

        {/* Receipt type selector */}
        <div className="flex gap-2 pb-3 border-b">
          {OPD_RECEIPT_TYPES.map(t => (
            <Button
              key={t.key}
              size="sm"
              variant={selectedType === t.key ? "default" : "outline"}
              className="gap-1.5 text-xs"
              onClick={() => setSelectedType(t.key)}
            >
              <span>{t.icon}</span> {t.label}
            </Button>
          ))}
        </div>

        {/* Receipt preview */}
        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
          <div ref={receiptRef} className="bg-white max-w-[700px] mx-auto p-8 shadow-sm rounded border">
            {selectedType === "cash" && (
              <OPDCashReceipt patient={patient} prescription={prescription} hospitalName={hospitalName} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ─── IPD Print Modal ─── */
interface IPDPrintProps {
  open: boolean
  onClose: () => void
  inpatient: InPatient
  hospitalName?: string
}

export function IPDPrintReceiptModal({ open, onClose, inpatient, hospitalName = "Hospital" }: IPDPrintProps) {
  const [selectedType, setSelectedType] = useState<ReceiptType>("cash")
  const receiptRef = useRef<HTMLDivElement>(null)

  const doctors: string[] = (() => {
    try { return JSON.parse(inpatient.doctorNames) } catch { return [] }
  })()
  const paymentRecords: PaymentRecord[] = (() => {
    try { return JSON.parse(inpatient.paymentRecords ?? "[]") } catch { return [] }
  })()
  const packageInclusions: PackageInclusion[] = (() => {
    try { return JSON.parse(inpatient.packageInclusions ?? "[]") } catch { return [] }
  })()
  const medicalValues: MedicalValues = (() => {
    try { return JSON.parse(inpatient.medicalValues ?? "{}") } catch { return {} }
  })()
  const prescriptions: IPPrescription[] = (() => {
    try { return JSON.parse(inpatient.prescriptions ?? "[]") } catch { return [] }
  })()

  function handlePrint() {
    if (!receiptRef.current) return
    const printWindow = window.open("", "_blank", "width=800,height=1000")
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Receipt</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 11px; }
        th { background: #f0f0f0; font-weight: bold; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        .header h1 { font-size: 18px; margin-bottom: 2px; }
        .header p { font-size: 10px; color: #555; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 12px 0; font-size: 11px; }
        .info-grid .label { color: #555; }
        .info-grid .value { font-weight: 600; }
        .section-title { font-size: 12px; font-weight: bold; margin: 14px 0 6px; text-transform: uppercase; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        .total-row { font-weight: bold; background: #f5f5f5; }
        .text-right { text-align: right; }
        .signature { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
        .signature div { text-align: center; }
        .signature .line { border-top: 1px solid #000; width: 140px; margin-top: 30px; padding-top: 4px; }
        @media print { body { padding: 10px; } }
      </style>
      </head><body>${receiptRef.current.innerHTML}</body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Print Receipt — {inpatient.name}</DialogTitle>
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </DialogHeader>

        {/* Receipt type selector */}
        <div className="flex gap-2 pb-3 border-b">
          {IPD_RECEIPT_TYPES.map(t => (
            <Button
              key={t.key}
              size="sm"
              variant={selectedType === t.key ? "default" : "outline"}
              className="gap-1.5 text-xs"
              onClick={() => setSelectedType(t.key)}
            >
              <span>{t.icon}</span> {t.label}
            </Button>
          ))}
        </div>

        {/* Receipt preview */}
        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
          <div ref={receiptRef} className="bg-white max-w-[700px] mx-auto p-8 shadow-sm rounded border">
            {selectedType === "cash" && (
              <IPDCashReceipt
                inpatient={inpatient}
                doctors={doctors}
                paymentRecords={paymentRecords}
                packageInclusions={packageInclusions}
                hospitalName={hospitalName}
              />
            )}
            {selectedType === "operation" && (
              <IPDOperationReceipt
                inpatient={inpatient}
                doctors={doctors}
                medicalValues={medicalValues}
                hospitalName={hospitalName}
              />
            )}
            {selectedType === "discharge" && (
              <IPDDischargeReceipt
                inpatient={inpatient}
                doctors={doctors}
                medicalValues={medicalValues}
                prescriptions={prescriptions}
                hospitalName={hospitalName}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RECEIPT TEMPLATES (render as plain HTML for print compatibility)
   ═══════════════════════════════════════════════════════════════════════════════ */

function ReceiptHeader({ hospitalName, title }: { hospitalName: string; title: string }) {
  return (
    <div className="header" style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #000", paddingBottom: 12 }}>
      <h1 style={{ fontSize: 18, marginBottom: 2 }}>{hospitalName}</h1>
      <p style={{ fontSize: 12, fontWeight: "bold", marginTop: 8, textTransform: "uppercase", letterSpacing: 1 }}>{title}</p>
    </div>
  )
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", margin: "12px 0", fontSize: 11 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: 4 }}>
          <span style={{ color: "#555" }}>{label}:</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: "bold", margin: "14px 0 6px", textTransform: "uppercase", color: "#333", borderBottom: "1px solid #ccc", paddingBottom: 3 }}>
      {children}
    </div>
  )
}

/* ─── OPD Cash Receipt ─── */
function OPDCashReceipt({ patient, prescription, hospitalName }: { patient: OPDPatient; prescription: OPDPrescription; hospitalName: string }) {
  return (
    <div>
      <ReceiptHeader hospitalName={hospitalName} title="Cash Receipt" />
      <InfoGrid items={[
        ["Patient ID", patient.patientId],
        ["Date", formatDate(prescription.prescriptionDate)],
        ["Patient Name", `${patient.firstName} ${patient.lastName ?? ""}`],
        ["Age / Gender", `${patient.age ?? "—"} / ${patient.gender}`],
        ["Phone", patient.phone],
        ["Guardian", patient.guardianName ?? "—"],
        ["Doctor", patient.doctorName ?? "—"],
        ["Receipt No", prescription.prescriptionNumber ?? "—"],
      ]} />

      {prescription.items && prescription.items.length > 0 && (
        <>
          <SectionTitle>Services</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>#</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Description</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0", textAlign: "right" }}>Qty</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0", textAlign: "right" }}>Rate</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {prescription.items.map((item, i) => (
                <tr key={item.id}>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{i + 1}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{item.description}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
          <span>Total Amount</span><span style={{ fontWeight: 600 }}>{formatCurrency(prescription.total)}</span>
        </div>
        {prescription.discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#555" }}>
            <span>Discount</span><span>- {formatCurrency(prescription.discount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, borderTop: "1px solid #000", marginTop: 4, paddingTop: 6 }}>
          <span>Amount Received</span><span>{formatCurrency(prescription.amountPaid)}</span>
        </div>
        {prescription.balanceDue > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "red" }}>
            <span>Balance Due</span><span>{formatCurrency(prescription.balanceDue)}</span>
          </div>
        )}
        {prescription.paymentMode && (
          <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Payment Mode: {prescription.paymentMode}</div>
        )}
      </div>

      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Patient Signature</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Authorized Signatory</div>
        </div>
      </div>
    </div>
  )
}

/* ─── IPD Cash Receipt ─── */
function IPDCashReceipt({ inpatient, doctors, paymentRecords, packageInclusions, hospitalName }: {
  inpatient: InPatient; doctors: string[]; paymentRecords: PaymentRecord[]; packageInclusions: PackageInclusion[]; hospitalName: string
}) {
  return (
    <div>
      <ReceiptHeader hospitalName={hospitalName} title="In-Patient Cash Receipt" />
      <InfoGrid items={[
        ["IP Number", inpatient.ipNumber],
        ["Date", formatDate(inpatient.admissionDate)],
        ["Patient Name", inpatient.name],
        ["Age / Gender", `${inpatient.age} / ${inpatient.gender}`],
        ["Phone", inpatient.phone],
        ["Guardian", inpatient.guardianName ?? "—"],
        ["Doctor(s)", doctors.join(", ") || "—"],
        ["Operation", inpatient.operationName ?? "—"],
      ]} />

      {packageInclusions.length > 0 && (
        <>
          <SectionTitle>Package Inclusions</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Item</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {packageInclusions.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{item.name}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
          <span>Package Amount</span><span>{formatCurrency(inpatient.packageAmount)}</span>
        </div>
        {inpatient.discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#555" }}>
            <span>Discount</span><span>- {formatCurrency(inpatient.discount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, borderTop: "1px solid #ccc", marginTop: 4, paddingTop: 6 }}>
          <span>Net Amount</span><span>{formatCurrency(inpatient.netAmount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
          <span>Total Received</span><span style={{ color: "green" }}>{formatCurrency(inpatient.totalReceivedAmount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, borderTop: "1px solid #000", paddingTop: 6 }}>
          <span>Balance Due</span><span style={{ color: inpatient.balanceAmount > 0 ? "red" : "green" }}>{formatCurrency(inpatient.balanceAmount)}</span>
        </div>
      </div>

      {paymentRecords.length > 0 && (
        <>
          <SectionTitle>Payment History</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Date</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Type</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Mode</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentRecords.map((p, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{formatDate(p.date)}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{p.amountType}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{p.paymentMode}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, textAlign: "right" }}>{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Patient Signature</div></div>
        <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Authorized Signatory</div></div>
      </div>
    </div>
  )
}

/* ─── IPD Operation Receipt ─── */
function IPDOperationReceipt({ inpatient, doctors, medicalValues, hospitalName }: {
  inpatient: InPatient; doctors: string[]; medicalValues: MedicalValues; hospitalName: string
}) {
  return (
    <div>
      <ReceiptHeader hospitalName={hospitalName} title="Operation Receipt" />
      <InfoGrid items={[
        ["IP Number", inpatient.ipNumber],
        ["Patient Name", inpatient.name],
        ["Age / Gender", `${inpatient.age} / ${inpatient.gender}`],
        ["Phone", inpatient.phone],
        ["Guardian", inpatient.guardianName ?? "—"],
        ["Admission Date", formatDate(inpatient.admissionDate)],
        ["Operation Date", formatDate(inpatient.operationDate)],
        ["Doctor(s)", doctors.join(", ") || "—"],
      ]} />

      <SectionTitle>Operation Details</SectionTitle>
      <div style={{ fontSize: 11, lineHeight: 1.6 }}>
        <div><strong>Operation:</strong> {inpatient.operationName ?? "—"}</div>
        <div><strong>Diagnosis:</strong> {inpatient.provisionDiagnosis ?? "—"}</div>
        {inpatient.operationProcedure && <div style={{ marginTop: 6 }}><strong>Procedure:</strong><br />{inpatient.operationProcedure}</div>}
        {inpatient.operationDetails && <div style={{ marginTop: 6 }}><strong>Details:</strong><br />{inpatient.operationDetails}</div>}
      </div>

      {Object.values(medicalValues).some(v => v) && (
        <>
          <SectionTitle>Medical Values</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 16px", fontSize: 11 }}>
            {Object.entries(medicalValues).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><strong>{k}:</strong> {String(v)}</div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Patient Signature</div></div>
        <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Surgeon Signature</div></div>
      </div>
    </div>
  )
}

/* ─── IPD Discharge Summary ─── */
function IPDDischargeReceipt({ inpatient, doctors, medicalValues, prescriptions, hospitalName }: {
  inpatient: InPatient; doctors: string[]; medicalValues: MedicalValues; prescriptions: IPPrescription[]; hospitalName: string
}) {
  return (
    <div>
      <ReceiptHeader hospitalName={hospitalName} title="Discharge Summary" />
      <InfoGrid items={[
        ["IP Number", inpatient.ipNumber],
        ["Patient Name", inpatient.name],
        ["Age / Gender", `${inpatient.age} / ${inpatient.gender}`],
        ["Phone", inpatient.phone],
        ["Guardian", inpatient.guardianName ?? "—"],
        ["Admission Date", formatDate(inpatient.admissionDate)],
        ["Operation Date", formatDate(inpatient.operationDate)],
        ["Discharge Date", formatDate(inpatient.dischargeDate)],
        ["Doctor(s)", doctors.join(", ") || "—"],
        ["Department", inpatient.department ?? "—"],
      ]} />

      <SectionTitle>Operation Details</SectionTitle>
      <div style={{ fontSize: 11, lineHeight: 1.6 }}>
        <div><strong>Operation:</strong> {inpatient.operationName ?? "—"}</div>
        <div><strong>Diagnosis:</strong> {inpatient.provisionDiagnosis ?? "—"}</div>
        {inpatient.operationProcedure && <div style={{ marginTop: 6 }}><strong>Procedure:</strong><br />{inpatient.operationProcedure}</div>}
        {inpatient.operationDetails && <div style={{ marginTop: 6 }}><strong>Details:</strong><br />{inpatient.operationDetails}</div>}
      </div>

      {Object.values(medicalValues).some(v => v) && (
        <>
          <SectionTitle>Medical Values</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 16px", fontSize: 11 }}>
            {Object.entries(medicalValues).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><strong>{k}:</strong> {String(v)}</div>
            ))}
          </div>
        </>
      )}

      {prescriptions.length > 0 && (
        <>
          <SectionTitle>Discharge Medications</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>#</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Medicine</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Days</th>
                <th style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11, background: "#f0f0f0" }}>Timing</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((rx, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{i + 1}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{rx.medicine}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{rx.days}</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", fontSize: 11 }}>{rx.timing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {inpatient.followUpDate && (
        <div style={{ marginTop: 12, fontSize: 12, padding: "8px 12px", background: "#f5f5f5", borderRadius: 4 }}>
          <strong>Follow-up Date:</strong> {formatDate(inpatient.followUpDate)}
        </div>
      )}

      {inpatient.dischargeNotes && (
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <strong>Discharge Notes:</strong> {inpatient.dischargeNotes}
        </div>
      )}

      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Patient Signature</div></div>
        <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: 140, marginTop: 30, paddingTop: 4 }}>Doctor Signature</div></div>
      </div>
    </div>
  )
}
