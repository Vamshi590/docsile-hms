"use client"

import type { HospitalHeaderProps } from "../ReceiptHeader"

export default function DefaultHeader({ hospital }: HospitalHeaderProps) {
  const hospitalName = hospital.displayName || hospital.name

  return (
    <div className="pb-2 mb-2 border-b-2 border-black">
      {hospital.phone && (
        <div className="flex justify-end">
          <p className="text-[10px] font-semibold">Ph: {hospital.phone}</p>
        </div>
      )}

      <div className="flex justify-center items-center mb-2">
        {hospital.logoUrl && (
          <div className="w-12 h-12 flex items-center justify-center mr-3">
            <img src={hospital.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        )}
        <div className="text-center flex-1">
          <h1 className="text-lg font-bold leading-tight uppercase">{hospitalName}</h1>
          {hospital.address && (
            <p className="text-[10px] leading-tight mt-0.5">{hospital.address}</p>
          )}
        </div>
        {hospital.logoUrl && (
          <div className="w-12 h-12 flex items-center justify-center ml-3">
            <img src={hospital.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4 text-[9px] text-center">
        {hospital.registrationNo && <span>Reg. No: {hospital.registrationNo}</span>}
        {hospital.email && <span>{hospital.email}</span>}
        {hospital.website && <span>{hospital.website}</span>}
      </div>
    </div>
  )
}
