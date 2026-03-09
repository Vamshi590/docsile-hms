"use client"

import { ReceiptHeader } from "./ReceiptHeader"
import { ReceiptLayout, ReceiptFooter } from "./ReceiptLayout"
import { PatientInfoSection } from "./PatientInfoSection"

interface MedicineItem {
  name: string
  timing: string
  days: string
  note?: string
}

interface PrescriptionReceiptProps {
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
  vitals?: {
    temperature?: string
    pulseRate?: string
    spo2?: string
  }
  history?: {
    presentComplaint?: string
    previousHistory?: string
    diagnosis?: string
  }
  medicines: MedicineItem[]
  investigations?: string[]
  advice?: string
  followUpDate?: string
  notes?: string
}

export function PrescriptionReceipt({
  hospital,
  patient,
  vitals,
  history,
  medicines,
  investigations,
  advice,
  followUpDate,
  notes,
}: PrescriptionReceiptProps) {
  const hospitalName = hospital.displayName || hospital.name

  return (
    <ReceiptLayout
      footer={
        <ReceiptFooter hospitalName={hospitalName} />
      }
    >
      <div className="receipt-header-section">
        <ReceiptHeader hospital={hospital} />
      </div>

      <h2 className="text-sm text-center font-bold py-1 mb-2">PRESCRIPTION</h2>

      <PatientInfoSection data={patient} />

      {/* Vitals & History */}
      {(vitals || history) && (
        <div className="pb-3 mb-4 border-b border-black no-break">
          <h3 className="text-[12px] font-bold mb-3">VITALS & HISTORY</h3>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 text-[12px] w-[75%]">
              {history?.presentComplaint && (
                <div className="flex gap-3">
                  <div className="font-bold shrink-0">PRESENT COMPLAINT</div>
                  <div>{history.presentComplaint}</div>
                </div>
              )}
              {history?.previousHistory && (
                <div className="flex gap-3">
                  <div className="font-bold shrink-0">PREVIOUS HISTORY</div>
                  <div>{history.previousHistory}</div>
                </div>
              )}
              {history?.diagnosis && (
                <div className="flex gap-3">
                  <div className="font-bold shrink-0">DIAGNOSIS</div>
                  <div>{history.diagnosis}</div>
                </div>
              )}
            </div>
            {vitals && (
              <div className="flex flex-col gap-1 text-[11px] w-[25%]">
                {vitals.temperature && (
                  <div className="flex gap-3">
                    <div className="font-bold">TEMP.</div>
                    <div>{vitals.temperature}</div>
                  </div>
                )}
                {vitals.pulseRate && (
                  <div className="flex gap-3">
                    <div className="font-bold">P.R.</div>
                    <div>{vitals.pulseRate}</div>
                  </div>
                )}
                {vitals.spo2 && (
                  <div className="flex gap-3">
                    <div className="font-bold">SPO2</div>
                    <div>{vitals.spo2}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medicines */}
      {medicines.length > 0 && (
        <div className="pb-3 mb-4 no-break">
          <h3 className="text-xs font-bold mb-3">PRESCRIPTION</h3>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-black p-2 text-left font-bold w-[50%]">MEDICINE</th>
                <th className="border border-black p-2 text-center font-bold w-[25%]">TIMING</th>
                <th className="border border-black p-2 text-center font-bold w-[25%]">DAYS</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med, i) => (
                <tr key={i}>
                  <td className="border border-black p-2">
                    {med.name}
                    {med.note && <div className="text-[9px] text-gray-600 mt-0.5">{med.note}</div>}
                  </td>
                  <td className="border border-black p-2 text-center">{med.timing}</td>
                  <td className="border border-black p-2 text-center">{med.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Investigations / Advice / Follow-up */}
      <div className="flex justify-between text-[12px] no-break">
        {investigations && investigations.filter(Boolean).length > 0 && (
          <div className="pb-3 mb-1">
            <div className="font-bold">Investigations</div>
            <div className="mt-1">{investigations.filter(Boolean).join(" / ")}</div>
          </div>
        )}
        {(advice || notes) && (
          <div className="text-[11px] flex items-center gap-2">
            <p className="font-bold text-sm">Advice:</p>
            <p className="font-semibold">{advice || notes}</p>
          </div>
        )}
        {followUpDate && (
          <div className="text-[11px]">
            <div className="font-bold text-[12px]">REVIEW DATE</div>
            <div>{followUpDate}</div>
          </div>
        )}
      </div>
    </ReceiptLayout>
  )
}
