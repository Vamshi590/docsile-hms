// src/app/(hospital)/doctor/components/QuickPrintRenderer.tsx
"use client"

import { forwardRef } from "react"
import { CashReceipt } from "@/components/receipts/CashReceipt"
import { PrescriptionReceipt } from "@/components/receipts/PrescriptionReceipt"
import { ReadingsReceipt } from "@/components/receipts/ReadingsReceipt"
import { ClinicalFindingsReceipt } from "@/components/receipts/ClinicalFindingsReceipt"
import { ReadingsAndFindings } from "@/components/receipts/ReadingsAndFindings"
import type { getReceiptData } from "../actions"
import { formatDate, calculateAge } from "@/lib/utils"
import { toGlassShape } from "@/lib/glass-prescription"
import type { DefaultPrintItem } from "@/lib/default-print"

type ReceiptData = Awaited<ReturnType<typeof getReceiptData>>

interface Props {
  data: ReceiptData
  items: DefaultPrintItem[]
}

/**
 * Hidden renderer used by the quick-print button. The parent reads `.innerHTML`
 * from the forwarded ref and passes it to `printReceiptsHtml`. Visually hidden
 * (positioned off-screen) so the user never sees it.
 */
export const QuickPrintRenderer = forwardRef<HTMLDivElement, Props>(function QuickPrintRenderer(
  { data, items },
  ref,
) {
  const patient = data?.patient
  const hospital = data?.hospital
  const prescription = data?.prescription
  const eyeReading = data?.eyeReading

  if (!patient) return <div ref={ref} style={hiddenStyle} />

  const patientInfo = {
    patientName: `${patient.firstName} ${patient.lastName ?? ""}`.trim(),
    patientId: patient.patientId,
    date: formatDate(prescription?.prescriptionDate ?? patient.appointmentDate),
    mobile: patient.phone || "—",
    gender: patient.gender,
    age: String(patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"),
    address: patient.address || "—",
    referredBy: patient.referredBy || undefined,
    receiptNo: prescription?.prescriptionNumber || undefined,
    doctorName: prescription?.doctorName || patient.doctorName || "—",
    department: prescription?.department || patient.department || undefined,
  }

  const hospitalInfo = hospital ? {
    name: hospital.name,
    displayName: hospital.displayName,
    address: hospital.address,
    phone: hospital.phone,
    email: hospital.email,
    website: hospital.website,
    registrationNo: hospital.registrationNo,
    logoUrl: hospital.logoUrl,
  } : { name: "Hospital" }

  // ── Parse prescription fields ───────────────────────────────────────────────
  let medicines: { name: string; timing: string; days: string; note?: string }[] = []
  if (prescription?.medicines) {
    try { medicines = JSON.parse(prescription.medicines) } catch { /* empty */ }
  }
  let investigations: string[] = []
  if (prescription?.investigations) {
    try {
      const parsed = JSON.parse(prescription.investigations)
      investigations = parsed.map((i: { name: string }) => i.name)
    } catch { /* empty */ }
  }

  // ── Parse eye reading fields ────────────────────────────────────────────────
  let arReading: { rightEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string }; leftEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string } } | undefined
  let previousGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let presentGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let clinicalFindings: { rightEye: any; leftEye: any } | undefined

  if (eyeReading) {
    if (eyeReading.autoRefractometer) {
      try {
        const ar = JSON.parse(eyeReading.autoRefractometer)
        arReading = {
          rightEye: { sph: ar.re?.sph || "", cyl: ar.re?.cyl || "", axis: ar.re?.axis || "", va: ar.re?.va || "", vacPh: ar.re?.vacPh || "" },
          leftEye:  { sph: ar.le?.sph || "", cyl: ar.le?.cyl || "", axis: ar.le?.axis || "", va: ar.le?.va || "", vacPh: ar.le?.vacPh || "" },
        }
      } catch { /* empty */ }
    }
    if (eyeReading.previousPrescription) {
      try { previousGlass = toGlassShape(JSON.parse(eyeReading.previousPrescription)) } catch { /* empty */ }
    }
    if (eyeReading.presentPrescription) {
      try { presentGlass = toGlassShape(JSON.parse(eyeReading.presentPrescription)) } catch { /* empty */ }
    }
    if (eyeReading.clinicalFindings) {
      try {
        const cf = JSON.parse(eyeReading.clinicalFindings)
        const defaultEye = {
          lids: "Normal", conjunctiva: "Normal", cornea: "Clear", ac: "Normal",
          iris: "Normal", pupil: "Normal", lens: "Clear", tension: "—",
          fundus: "—", opticDisk: "Normal", macula: "—", vessels: "—",
          peripheralRetina: "—", retinoscopy: "—", retino1: "—", retino2: "—", retino3: "—", retino4: "—",
        }
        clinicalFindings = {
          rightEye: { ...defaultEye, ...cf.re },
          leftEye:  { ...defaultEye, ...cf.le },
        }
      } catch { /* empty */ }
    }
  }

  // ── Render each configured item in order ────────────────────────────────────
  return (
    <div ref={ref} style={hiddenStyle}>
      {items.map((item, idx) => {
        const key = `${item.type}-${idx}`
        switch (item.type) {
          case "cash":
            if (!prescription) return <EmptyPage key={key} message="No billing data available for this patient" />
            return (
              <CashReceipt
                key={key}
                hospital={hospitalInfo}
                patient={patientInfo}
                payment={{
                  mode: prescription.paymentMode || "Cash",
                  totalAmount: prescription.subtotal ?? prescription.total ?? 0,
                  discount: prescription.discount ?? 0,
                  amountReceived: prescription.amountPaid ?? 0,
                  amountDue: prescription.balanceDue ?? 0,
                  paidFor: prescription.items?.map((i: any) => i.description).join(", ") || undefined,
                }}
                items={prescription.items?.map((i: any) => ({ description: i.description, amount: i.amount })) || undefined}
              />
            )

          case "prescription":
            return (
              <PrescriptionReceipt
                key={key}
                hospital={hospitalInfo}
                patient={patientInfo}
                vitals={prescription ? {
                  temperature: prescription.temperature ? String(prescription.temperature) : undefined,
                  pulseRate: prescription.pulseRate ? String(prescription.pulseRate) : undefined,
                  spo2: prescription.spo2 ? String(prescription.spo2) : undefined,
                } : undefined}
                history={prescription ? {
                  presentComplaint: prescription.presentComplaint || undefined,
                  previousHistory: prescription.previousHistory || undefined,
                  diagnosis: prescription.diagnosis || undefined,
                } : undefined}
                medicines={medicines}
                investigations={investigations}
                advice={prescription?.additionalNotes || undefined}
                followUpDate={prescription?.followUpDate ? formatDate(prescription.followUpDate) : undefined}
                notes={prescription?.notes || undefined}
              />
            )

          case "readings": {
            if (!eyeReading) return <EmptyPage key={key} message="No eye reading data available for this patient" />
            if (item.subMode === "readings") {
              return (
                <ReadingsReceipt
                  key={key}
                  hospital={hospitalInfo}
                  patient={patientInfo}
                  arReading={arReading}
                  previousGlass={previousGlass}
                  presentGlass={presentGlass}
                />
              )
            }
            if (item.subMode === "clinical") {
              if (!clinicalFindings) return <EmptyPage key={key} message="No clinical findings available for this patient" />
              return (
                <ClinicalFindingsReceipt
                  key={key}
                  hospital={hospitalInfo}
                  rightEye={clinicalFindings.rightEye}
                  leftEye={clinicalFindings.leftEye}
                />
              )
            }
            // both
            return (
              <ReadingsAndFindings
                key={key}
                hospital={hospitalInfo}
                patient={patientInfo}
                arReading={arReading}
                previousGlass={previousGlass}
                presentGlass={presentGlass}
                clinicalFindings={clinicalFindings}
              />
            )
          }

          case "report":
            return (
              <div key={key}>
                <PrescriptionReceipt
                  hospital={hospitalInfo}
                  patient={patientInfo}
                  vitals={prescription ? {
                    temperature: prescription.temperature ? String(prescription.temperature) : undefined,
                    pulseRate: prescription.pulseRate ? String(prescription.pulseRate) : undefined,
                    spo2: prescription.spo2 ? String(prescription.spo2) : undefined,
                  } : undefined}
                  history={prescription ? {
                    presentComplaint: prescription.presentComplaint || undefined,
                    previousHistory: prescription.previousHistory || undefined,
                    diagnosis: prescription.diagnosis || undefined,
                  } : undefined}
                  medicines={medicines}
                  investigations={investigations}
                  advice={prescription?.additionalNotes || undefined}
                  followUpDate={prescription?.followUpDate ? formatDate(prescription.followUpDate) : undefined}
                  notes={prescription?.notes || undefined}
                />
                {eyeReading && (
                  <ReadingsAndFindings
                    hospital={hospitalInfo}
                    patient={patientInfo}
                    arReading={arReading}
                    previousGlass={previousGlass}
                    presentGlass={presentGlass}
                    clinicalFindings={clinicalFindings}
                  />
                )}
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
})

const hiddenStyle: React.CSSProperties = {
  position: "absolute",
  left: "-99999px",
  top: 0,
  width: 0,
  height: 0,
  overflow: "hidden",
}

function EmptyPage({ message }: { message: string }) {
  return (
    <div className="receipt-page">
      <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
        {message}
      </div>
    </div>
  )
}
