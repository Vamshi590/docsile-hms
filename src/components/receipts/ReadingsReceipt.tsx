"use client"

import { ReceiptHeader } from "./ReceiptHeader"
import { ReceiptLayout, ReceiptFooter } from "./ReceiptLayout"
import { PatientInfoSection } from "./PatientInfoSection"

interface EyeData {
  sph: string
  cyl: string
  axis: string
  va: string
  vacPh?: string
}

interface EyePrescriptionData {
  dist: { rightEye: EyeData; leftEye: EyeData }
  near: { rightEye: EyeData; leftEye: EyeData }
}

interface ReadingsReceiptProps {
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
  previousGlass?: EyePrescriptionData
  presentGlass?: EyePrescriptionData
  sightType?: string
  lensType?: string
  advise?: string
}

function ARTable({ data, pd }: { data: { rightEye: EyeData; leftEye: EyeData }; pd?: string }) {
  return (
    <div className="pb-3 mb-4 no-break">
      <h3 className="text-xs font-bold mb-3 text-center">
        AR READING {pd && `(PD: ${pd} mm)`}
      </h3>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-black p-2 text-center font-bold w-16" />
            <th className="border border-black p-2 text-center font-bold">SPH</th>
            <th className="border border-black p-2 text-center font-bold">CYL</th>
            <th className="border border-black p-2 text-center font-bold">AXIS</th>
            <th className="border border-black p-2 text-center font-bold">VA</th>
            <th className="border border-black p-2 text-center font-bold">VAC P.H.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 text-center font-bold">R/E</td>
            <td className="border border-black p-2 text-center">{data.rightEye.sph}</td>
            <td className="border border-black p-2 text-center">{data.rightEye.cyl}</td>
            <td className="border border-black p-2 text-center">{data.rightEye.axis}</td>
            <td className="border border-black p-2 text-center">{data.rightEye.va}</td>
            <td className="border border-black p-2 text-center">{data.rightEye.vacPh}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-bold">L/E</td>
            <td className="border border-black p-2 text-center">{data.leftEye.sph}</td>
            <td className="border border-black p-2 text-center">{data.leftEye.cyl}</td>
            <td className="border border-black p-2 text-center">{data.leftEye.axis}</td>
            <td className="border border-black p-2 text-center">{data.leftEye.va}</td>
            <td className="border border-black p-2 text-center">{data.leftEye.vacPh}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function GlassTable({ title, data, sightType }: { title: string; data: EyePrescriptionData; sightType?: string }) {
  return (
    <div className="pb-3 mb-4 no-break">
      <h3 className="text-xs font-bold mb-3 text-center">
        {title} {sightType ? `(${sightType})` : ""}
      </h3>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-black p-2 text-center font-bold" />
            <th className="border border-black p-2 text-center font-bold" colSpan={4}>RIGHT EYE</th>
            <th className="border border-black p-2 text-center font-bold" colSpan={4}>LEFT EYE</th>
          </tr>
          <tr>
            <th className="border border-black p-2 text-center font-bold" />
            <th className="border border-black p-2 text-center font-bold">SPH</th>
            <th className="border border-black p-2 text-center font-bold">CYL</th>
            <th className="border border-black p-2 text-center font-bold">AXIS</th>
            <th className="border border-black p-2 text-center font-bold">BCVA</th>
            <th className="border border-black p-2 text-center font-bold">SPH</th>
            <th className="border border-black p-2 text-center font-bold">CYL</th>
            <th className="border border-black p-2 text-center font-bold">AXIS</th>
            <th className="border border-black p-2 text-center font-bold">BCVA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 text-center font-bold">DIST</td>
            <td className="border border-black p-2 text-center">{data.dist.rightEye.sph}</td>
            <td className="border border-black p-2 text-center">{data.dist.rightEye.cyl}</td>
            <td className="border border-black p-2 text-center">{data.dist.rightEye.axis}</td>
            <td className="border border-black p-2 text-center">{data.dist.rightEye.va}</td>
            <td className="border border-black p-2 text-center">{data.dist.leftEye.sph}</td>
            <td className="border border-black p-2 text-center">{data.dist.leftEye.cyl}</td>
            <td className="border border-black p-2 text-center">{data.dist.leftEye.axis}</td>
            <td className="border border-black p-2 text-center">{data.dist.leftEye.va}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-bold">NEAR</td>
            <td className="border border-black p-2 text-center">{data.near.rightEye.sph}</td>
            <td className="border border-black p-2 text-center">{data.near.rightEye.cyl}</td>
            <td className="border border-black p-2 text-center">{data.near.rightEye.axis}</td>
            <td className="border border-black p-2 text-center">{data.near.rightEye.va}</td>
            <td className="border border-black p-2 text-center">{data.near.leftEye.sph}</td>
            <td className="border border-black p-2 text-center">{data.near.leftEye.cyl}</td>
            <td className="border border-black p-2 text-center">{data.near.leftEye.axis}</td>
            <td className="border border-black p-2 text-center">{data.near.leftEye.va}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function ReadingsReceipt({
  hospital,
  patient,
  arReading,
  pd,
  previousGlass,
  presentGlass,
  sightType,
  lensType,
  advise,
}: ReadingsReceiptProps) {
  const hospitalName = hospital.displayName || hospital.name

  return (
    <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
      <div className="receipt-header-section">
        <ReceiptHeader hospital={hospital} />
      </div>

      <h2 className="text-sm text-center font-bold py-1 mb-2">READINGS</h2>

      <PatientInfoSection data={patient} />

      {arReading && <ARTable data={arReading} pd={pd} />}
      {previousGlass && <GlassTable title="PREVIOUS GLASS PRESCRIPTION" data={previousGlass} />}
      {presentGlass && (
        <>
          <GlassTable title="PRESENT GLASS PRESCRIPTION" data={presentGlass} sightType={sightType} />
          {lensType && <div className="text-center text-[10px] font-bold mb-4">{lensType}</div>}
        </>
      )}

      {advise && (
        <div className="pb-3 mb-4 no-break">
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <td className="font-bold w-20 py-1">ADVISE</td>
                <td className="py-1">{advise}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </ReceiptLayout>
  )
}

// Export sub-components for combined receipt
export { ARTable, GlassTable }
