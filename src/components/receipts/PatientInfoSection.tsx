"use client"

interface PatientInfo {
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

export function PatientInfoSection({ data }: { data: PatientInfo }) {
  const fields = [
    { label: "PATIENT NAME", value: data.patientName, bold: true },
    { label: "PATIENT ID", value: data.patientId },
    { label: "DATE", value: data.date },
    { label: "MOBILE", value: data.mobile },
    { label: "GENDER", value: data.gender },
    { label: "AGE", value: data.age },
    { label: "ADDRESS", value: data.address },
    { label: "REFERRED BY", value: data.referredBy },
    ...(data.receiptNo ? [{ label: "RECEIPT NO", value: data.receiptNo }] : []),
    { label: "DOCTOR NAME", value: data.doctorName },
    ...(data.department ? [{ label: "DEPT.", value: data.department }] : []),
  ].filter(f => f.value)

  return (
    <div className="pb-3 mb-4 border-b border-black no-break">
      <h3 className="text-xs font-bold mb-3">PATIENT INFORMATION</h3>
      <div className="text-[11px] grid grid-cols-4 gap-x-4 gap-y-2">
        {fields.map(f => (
          <div key={f.label}>
            <div className="font-bold">{f.label}</div>
            <div className={f.bold ? "font-semibold text-[13px]" : ""}>{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
