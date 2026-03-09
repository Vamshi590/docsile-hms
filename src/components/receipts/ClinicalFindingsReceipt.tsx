"use client"

import { ReceiptLayout, ReceiptFooter } from "./ReceiptLayout"

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

interface ClinicalFindingsReceiptProps {
  hospital: {
    name: string
    displayName?: string | null
    logoUrl?: string | null
  }
  rightEye: EyeFindings
  leftEye: EyeFindings
  advised?: string
  reviewDate?: string
}

function EyeExamSection({ title, data }: { title: string; data: EyeFindings }) {
  const fields = [
    { label: "LIDS", value: data.lids },
    { label: "CONJUNCTIVA", value: data.conjunctiva },
    { label: "CORNEA", value: data.cornea },
    { label: "A.C.", value: data.ac },
    { label: "IRIS", value: data.iris },
    { label: "PUPIL", value: data.pupil },
    { label: "LENS", value: data.lens },
    { label: "TENSION", value: data.tension },
    { label: "FUNDUS", value: data.fundus },
    { label: "OPTIC DISK", value: data.opticDisk },
    { label: "MACULA", value: data.macula },
    { label: "VESSELS", value: data.vessels },
    { label: "PERIPHERAL RETINA", value: data.peripheralRetina },
    { label: "RETINOSCOPY", value: data.retinoscopy },
  ]

  return (
    <div className="w-[48%]">
      <div className="text-center mb-2">
        <p className="text-sm font-bold">{title}</p>
      </div>
      <div className="p-2 mb-4 pl-8">
        <div className="grid grid-cols-2 gap-1 text-xs">
          {fields.filter(f => f.value).map(f => (
            <div key={f.label} className="contents">
              <div className="font-semibold">{f.label}</div>
              <div className="text-center">{f.value || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Retinoscopy diagrams */}
      <div className="flex gap-4 justify-center">
        {/* Circle diagram */}
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 rounded-full border-2 border-black" />
          <div className="absolute w-5 h-5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black z-10 bg-white" />
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full z-0">
            <line x1="15" y1="15" x2="85" y2="85" stroke="black" strokeWidth="2" />
            <line x1="85" y1="15" x2="15" y2="85" stroke="black" strokeWidth="2" />
          </svg>
          <div className="absolute top-0 left-8 w-[40%] h-[40%] flex items-center justify-center z-20 text-[10px]">{data.retino1}</div>
          <div className="absolute top-8 right-0 w-[40%] h-[40%] flex items-center justify-center z-20 text-[10px]">{data.retino2}</div>
          <div className="absolute bottom-0 left-8 w-[40%] h-[40%] flex items-center justify-center z-20 text-[10px]">{data.retino3}</div>
          <div className="absolute bottom-8 left-0 w-[40%] h-[40%] flex items-center justify-center z-20 text-[10px]">{data.retino4}</div>
        </div>

        {/* Quadrant diagram */}
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 flex justify-center items-center">
            <div className="absolute w-px h-full bg-black" />
            <div className="absolute h-px w-full bg-black" />
          </div>
          <div className="absolute top-2 left-2 w-1/2 h-1/2 flex items-center justify-center text-[10px]">{data.retino1}</div>
          <div className="absolute top-2 right-2 w-1/2 h-1/2 flex items-center justify-center text-[10px]">{data.retino2}</div>
          <div className="absolute bottom-2 left-2 w-1/2 h-1/2 flex items-center justify-center text-[10px]">{data.retino3}</div>
          <div className="absolute bottom-2 right-2 w-1/2 h-1/2 flex items-center justify-center text-[10px]">{data.retino4}</div>
        </div>
      </div>
    </div>
  )
}

export function ClinicalFindingsReceipt({
  hospital,
  rightEye,
  leftEye,
  advised,
  reviewDate,
}: ClinicalFindingsReceiptProps) {
  const hospitalName = hospital.displayName || hospital.name

  return (
    <ReceiptLayout footer={<ReceiptFooter hospitalName={hospitalName} />}>
      <header className="flex justify-between items-center border-b border-black mb-6 px-4">
        {hospital.logoUrl && <img className="w-16 h-16" src={hospital.logoUrl} alt="" />}
        <h2 className="text-sm text-center font-bold py-1 px-2 mb-4 flex-1">CLINICAL FINDINGS</h2>
        {hospital.logoUrl && <img className="w-16 h-16" src={hospital.logoUrl} alt="" />}
      </header>

      <div className="flex justify-between mb-6">
        <EyeExamSection title="Right Eye" data={rightEye} />
        <EyeExamSection title="Left Eye" data={leftEye} />
      </div>

      {advised && (
        <div className="text-[11px] mb-2 no-break">
          <span className="font-bold">ADVISED: </span>
          <span>{advised}</span>
        </div>
      )}
      {reviewDate && (
        <div className="text-[11px] no-break">
          <span className="font-bold">REVIEW DATE: </span>
          <span>{reviewDate}</span>
        </div>
      )}
    </ReceiptLayout>
  )
}

export { EyeExamSection }
