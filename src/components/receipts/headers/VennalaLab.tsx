"use client"

import type { HospitalHeaderProps } from "../ReceiptHeader"

export default function VennalaLabHeader({ hospital }: HospitalHeaderProps) {
  return (
    <div className="pb-2 mb-2 border-b-2 border-black">
      <div className="flex justify-end">
        <p className="text-[10px] font-semibold">Ph: 08782955955, Cell: 9885029367</p>
      </div>

      <div className="text-center mb-2">
        <h1 className="text-lg font-bold leading-tight uppercase">VENNELA LAB</h1>
        <p className="text-[10px] leading-tight mt-0.5">
          Near Mancherial Chowrasta, Ambedkarnagar, Choppadandi Road, KARIMNAGAR-505001
        </p>
      </div>

      <div className="text-center text-[9px] leading-[1.3] mb-1">
        <p className="font-bold text-[11px]">Dr. CH. SRILATHA</p>
        <p>M.B.B.S., M.S.(Ophth)</p>
        <p>FICLEP (LVPEI), FICO (UK)</p>
        <p>Obs. Paediatric Ophthalmology &amp; Squint (AEH, Madurai)</p>
        <p>Ex. Asst. Professor in CAIMS, MIMS (Hyd)</p>
        <p>Ex. Civil Assistant Surgeon, Karimnagar | Phaco Surgeon</p>
        <p className="mt-0.5">Regd. No. 46756</p>
      </div>

      <div className="text-center text-[9px] mt-1">
        <p className="font-semibold">Daily Timings: 9:00 am to 2:30 pm &amp; 5:30 pm to 7:30 pm</p>
      </div>
    </div>
  )
}
