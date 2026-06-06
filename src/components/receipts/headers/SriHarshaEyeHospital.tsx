"use client";

import type { HospitalHeaderProps } from "../ReceiptHeader";

export default function SriHarshaEyeHospitalHeader({
  hospital,
}: HospitalHeaderProps) {
  return (
    <div className="pb-2 mb-2 border-b-2 border-black">
      <div className="flex justify-end">
        <p className="text-[10px] font-semibold">
          Ph: 08782955955, Cell: 9885029367
        </p>
      </div>

      {/* Hospital Name Row */}
      <div className="flex justify-between items-center mb-2">
        <div className="w-12 h-12 flex items-center justify-center">
          <img
            src="./logo.jpeg"
            alt="logo"
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="text-center flex-1 mx-2">
          <h1 className="text-lg font-bold leading-tight">
            SRI HARSHA EYE HOSPITAL
          </h1>
          <p className="text-[10px] leading-tight mt-0.5">
            Near Mancherial Chowrasta, Ambedkarnagar, Choppadandi Road,
            KARIMNAGAR-505001
          </p>
        </div>
        <div className="w-12 h-12 flex items-center justify-center">
          <img
            src="./logo.jpeg"
            alt="logo"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>

      {/* Doctor Information Row */}
      <div className="flex justify-between items-start text-[9px] leading-[1.2] mb-2">
        {/* Left Doctor */}
        <div className="w-[30%] pr-1">
          <p className="font-bold text-sm">డా. శ్రీలత</p>
          <p>M.B.B.S., M.S.(Ophth)</p>
          <p>FICLEP (LVPEI), FICO (UK),</p>
          <p>Obs. Paediatric Ophthalmology</p>
          <p>& Squint (AEH, Madurai)</p>
          <p>Ex. Asst. Professor in CAIMS, MIMS (Hyd)</p>
          <p>Ex. Civil Assistant Surgeon, Karimnagar</p>
          <p>Phaco Surgeon</p>
          <p className="mt-0.5">Regd. No. 46756</p>
        </div>

        {/* Center NABH */}
        <div className="w-[20%] flex justify-center">
          <div className="w-24 h-24 flex items-center justify-center bg-white">
            <img src="./nabh.jpeg" alt="nabh image" />
          </div>
        </div>

        {/* Right Doctor */}
        <div className="w-[30%] pl-1 text-right">
          <p className="font-bold text-sm">Dr. CH. SRILATHA</p>
          <p>M.B.B.S., M.S.(Ophth)</p>
          <p>FICLEP (LVPEI), FICO (UK),</p>
          <p>Obs. Paediatric Ophthalmology</p>
          <p>& Squint (AEH, Madurai)</p>
          <p>Ex. Asst. Professor in CAIMS, MIMS (Hyd)</p>
          <p>Ex. Civil Assistant Surgeon, Karimnagar</p>
          <p>Phaco Surgeon</p>
          <p className="mt-0.5">Regd. No. 46756</p>
        </div>
      </div>

      {/* Timing */}
      <div className="text-center text-[9px] mt-1">
        <p className="font-semibold">
          Daily Timings: 9:00 am to 2:30 pm & 5:30 pm to 7:30 pm
        </p>
      </div>
    </div>
  );
}
