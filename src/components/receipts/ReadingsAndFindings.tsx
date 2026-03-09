"use client"

import { ReceiptHeader } from "./ReceiptHeader"
import { ReceiptLayout, ReceiptFooter } from "./ReceiptLayout"
import { PatientInfoSection } from "./PatientInfoSection"
import { ARTable, GlassTable } from "./ReadingsReceipt"
import { EyeExamSection } from "./ClinicalFindingsReceipt"

interface EyeData {
  sph: string
  cyl: string
  axis: string
  va: string
  vacPh?: string
}

interface EyeFindings {
  lids: string
  conjunctiva: string
  cornea: string
  ac: string
  iris: string
  pupil: string
  lens: string
  tension: string
  fundus: string
  opticDisk: string
  macula: string
  vessels: string
  peripheralRetina: string
  retinoscopy: string
  retino1: string
  retino2: string
  retino3: string
  retino4: string
}

interface ReadingsAndFindingsProps {
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
  arReading?: { rightEye: EyeData; leftEye: EyeData }
  pd?: string
  previousGlass?: {
    dist: { rightEye: EyeData; leftEye: EyeData }
    near: { rightEye: EyeData; leftEye: EyeData }
  }
  presentGlass?: {
    dist: { rightEye: EyeData; leftEye: EyeData }
    near: { rightEye: EyeData; leftEye: EyeData }
  }
  sightType?: string
  lensType?: string
  clinicalFindings?: {
    rightEye: EyeFindings
    leftEye: EyeFindings
  }
}

export function ReadingsAndFindings({
  hospital,
  patient,
  arReading,
  pd,
  previousGlass,
  presentGlass,
  sightType,
  lensType,
  clinicalFindings,
}: ReadingsAndFindingsProps) {
  const hospitalName = hospital.displayName || hospital.name

  return (
    <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
      <div className="receipt-header-section">
        <ReceiptHeader hospital={hospital} />
      </div>

      <h2 className="text-sm text-center font-bold py-1 mb-2">READINGS & CLINICAL FINDINGS</h2>

      <PatientInfoSection data={patient} />

      {/* Readings Section */}
      {arReading && <ARTable data={arReading} pd={pd} />}
      {previousGlass && <GlassTable title="PREVIOUS GLASS PRESCRIPTION" data={previousGlass} />}
      {presentGlass && (
        <>
          <GlassTable title="PRESENT GLASS PRESCRIPTION" data={presentGlass} sightType={sightType} />
          {lensType && <div className="text-center text-[10px] font-bold mb-4">{lensType}</div>}
        </>
      )}

      {/* Clinical Findings Section */}
      {clinicalFindings && (
        <>
          <h3 className="text-sm font-bold text-center mb-4 border-t border-black pt-3">CLINICAL FINDINGS</h3>
          <div className="flex justify-between mb-6">
            <EyeExamSection title="Right Eye" data={clinicalFindings.rightEye} />
            <EyeExamSection title="Left Eye" data={clinicalFindings.leftEye} />
          </div>
        </>
      )}
    </ReceiptLayout>
  )
}
