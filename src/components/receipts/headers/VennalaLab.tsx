"use client"

import type { HospitalHeaderProps } from "../ReceiptHeader"

export default function VennalaLabHeader({}: HospitalHeaderProps) {
  return (
    <div className="mb-3">
      {/* Top-right cell number */}
      <div className="flex justify-end">
        <p className="text-[10px] font-semibold">Cell: 9885029367</p>
      </div>

      {/* Hospital name + address (centered) */}
      <div className="text-center">
        <h1 className="text-[18px] font-bold tracking-wide">VENNELA OCULAR DIAGNOSTICS</h1>
        <p className="text-[10px] mt-1">
          Hno: 6-6-652, 1st Floor, Beside Olga Hospital, Opp: Jayasri Neuro Hospital.
          <br />
          Subhashnagar Road, KARIMNAGAR-505001.
        </p>
      </div>
    </div>
  )
}
