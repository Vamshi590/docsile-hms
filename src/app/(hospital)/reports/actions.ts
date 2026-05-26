"use server"

import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"

// ─── Patient Search ──────────────────────────────────────────────────────────

export async function searchPatients(query: string) {
  await requireServerPermission("reports:view")
  if (!query || query.length < 2) return []

  const supabase = await createClient()

  const { data: patients, error } = await supabase
    .from("Patient")
    .select(
      "id, patientId, firstName, lastName, phone, age, gender, dateOfBirth, patientType, appointmentDate, createdAt, prescriptions:Prescription(prescriptionDate)"
    )
    .or(
      `patientId.ilike.%${query}%,phone.ilike.%${query}%,firstName.ilike.%${query}%,lastName.ilike.%${query}%`
    )
    .order("updatedAt", { ascending: false })
    .limit(8)

  if (error) throw error

  // Sort prescriptions client-side (descending by prescriptionDate) and take first
  return (patients ?? []).map((p: any) => {
    const sortedRx = (p.prescriptions ?? []).sort(
      (a: any, b: any) =>
        new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime()
    )
    return {
      id: p.id,
      patientId: p.patientId,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: [p.firstName, p.lastName].filter(Boolean).join(" "),
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      patientType: p.patientType,
      registeredOn: p.createdAt,
      lastVisitDate: sortedRx[0]?.prescriptionDate ?? p.appointmentDate,
    }
  })
}

// ─── Patient Summary ─────────────────────────────────────────────────────────

export async function getPatientSummary(patientId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from("Patient")
    .select(
      `*, prescriptions:Prescription(id, total, amountPaid, balanceDue, prescriptionDate, status), labBills:LabBill(total, amountPaid, balanceDue), inpatient:InPatient(netAmount, totalReceivedAmount, balanceAmount, status)`
    )
    .eq("patientId", patientId)
    .single()

  if (error || !patient) return null

  const prescriptions = patient.prescriptions ?? []
  // Sort prescriptions descending by prescriptionDate
  prescriptions.sort(
    (a: any, b: any) =>
      new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime()
  )

  const opdVisits = prescriptions.filter((p: any) => p.status !== "DRAFT").length
  const lastVisit = prescriptions[0]?.prescriptionDate ?? patient.appointmentDate

  const opdBilled = prescriptions.reduce((s: number, p: any) => s + p.total, 0)
  const opdPaid = prescriptions.reduce((s: number, p: any) => s + p.amountPaid, 0)
  const labBills = patient.labBills ?? []
  const labBilled = labBills.reduce((s: number, b: any) => s + b.total, 0)
  const labPaid = labBills.reduce((s: number, b: any) => s + b.amountPaid, 0)
  // inpatient is a one-to-one relation; Supabase returns array for joined tables
  const inpatientRecord = Array.isArray(patient.inpatient)
    ? patient.inpatient[0] ?? null
    : patient.inpatient
  const ipdBilled = inpatientRecord?.netAmount ?? 0
  const ipdPaid = inpatientRecord?.totalReceivedAmount ?? 0

  const totalBilled = opdBilled + labBilled + ipdBilled
  const totalPaid = opdPaid + labPaid + ipdPaid
  const totalDues = totalBilled - totalPaid

  return {
    id: patient.id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    fullName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    phone: patient.phone,
    email: patient.email,
    age: patient.age,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    address: patient.address,
    registeredOn: patient.createdAt,
    lastVisit,
    opdVisits,
    hasInpatient: !!inpatientRecord,
    inpatientStatus: inpatientRecord?.status ?? null,
    totalBilled,
    totalPaid,
    totalDues,
  }
}

// ─── Visit History (Prescriptions as visits) ─────────────────────────────────

export async function getVisitHistory(patientId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const { data: prescriptions, error } = await supabase
    .from("Prescription")
    .select(
      "id, prescriptionNumber, prescriptionDate, doctorName, department, presentComplaint, diagnosis, status, patientType, total, amountPaid, balanceDue, followUpDate"
    )
    .eq("patientId", patientId)
    .order("prescriptionDate", { ascending: false })

  if (error) throw error

  return prescriptions ?? []
}

// ─── Prescriptions with medicines ────────────────────────────────────────────

export async function getPrescriptions(patientId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const { data: prescriptions, error } = await supabase
    .from("Prescription")
    .select(
      "id, prescriptionNumber, prescriptionDate, doctorName, department, presentComplaint, previousHistory, diagnosis, medicines, investigations, additionalNotes, followUpDate, status, patientType, items:InvoiceItem(id, description, category, quantity, unitPrice, amount)"
    )
    .eq("patientId", patientId)
    .order("prescriptionDate", { ascending: false })

  if (error) throw error

  // Sort items by sortOrder client-side
  return (prescriptions ?? []).map((p: any) => ({
    ...p,
    items: (p.items ?? []).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }))
}

// ─── Inpatient Records ───────────────────────────────────────────────────────

export async function getInpatientRecords(patientInternalId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const { data: inpatient, error } = await supabase
    .from("InPatient")
    .select(
      "*, insuranceClaims:InsuranceClaim(id, claimNumber, insuranceCompanyName, status, totalApprovedAmount, finalSettledAmount)"
    )
    .eq("patientId", patientInternalId)
    .single()

  if (error && error.code === "PGRST116") return null
  if (error) throw error

  return inpatient
}

// ─── Receipt data for printing ───────────────────────────────────────────────

export async function getReportReceiptData(patientId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const [patientResult, hospitalResult] = await Promise.all([
    supabase
      .from("Patient")
      .select(
        "*, eyeReadings:EyeReading(*), prescriptions:Prescription(*, items:InvoiceItem(*), payments:Payment(*))"
      )
      .eq("patientId", patientId)
      .single(),
    supabase
      .from("HospitalProfile")
      .select("*")
      .limit(1)
      .single(),
  ])

  const patient = patientResult.data
  const hospital = hospitalResult.data

  if (patient) {
    // Sort prescriptions descending by date
    patient.prescriptions = (patient.prescriptions ?? []).sort(
      (a: any, b: any) =>
        new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime()
    )
    // Sort eye readings descending
    patient.eyeReadings = (patient.eyeReadings ?? []).sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  return { patient, hospital }
}

// ─── Lab Records ─────────────────────────────────────────────────────────────

export async function getLabRecords(patientId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const { data: labBills, error } = await supabase
    .from("LabBill")
    .select(
      "*, lab:Lab(name, printHeaderKey), items:LabBillItem(id, name, amount), payments:LabPayment(id, amount, paymentMode, paymentDate)"
    )
    .eq("patientId", patientId)
    .order("createdAt", { ascending: false })

  if (error) throw error

  // Sort nested items/payments client-side
  return (labBills ?? []).map((b: any) => ({
    ...b,
    items: (b.items ?? []).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    payments: (b.payments ?? []).sort(
      (a: any, b: any) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    ),
  }))
}

// ─── Billing & Payments ──────────────────────────────────────────────────────

export async function getBillingOverview(patientId: string, patientInternalId: string) {
  await requireServerPermission("reports:view")
  const supabase = await createClient()

  const [prescriptionsRes, labBillsRes, inpatientRes] = await Promise.all([
    supabase
      .from("Prescription")
      .select(
        "id, prescriptionNumber, prescriptionDate, total, amountPaid, balanceDue, status, paymentMode, payments:Payment(id, amount, paymentMode, paymentDate, notes)"
      )
      .eq("patientId", patientId)
      .order("prescriptionDate", { ascending: false }),
    supabase
      .from("LabBill")
      .select(
        "id, billNumber, total, amountPaid, balanceDue, status, createdAt, lab:Lab(name), payments:LabPayment(id, amount, paymentMode, paymentDate)"
      )
      .eq("patientId", patientId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("InPatient")
      .select(
        "ipNumber, packageAmount, discount, netAmount, totalReceivedAmount, balanceAmount, paymentRecords, status, admissionDate, dischargeDate"
      )
      .eq("patientId", patientInternalId)
      .single(),
  ])

  if (prescriptionsRes.error) throw prescriptionsRes.error
  if (labBillsRes.error) throw labBillsRes.error

  const prescriptions = (prescriptionsRes.data ?? []).map((p: any) => ({
    ...p,
    payments: (p.payments ?? []).sort(
      (a: any, b: any) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    ),
  }))

  const labBills = (labBillsRes.data ?? []).map((b: any) => ({
    ...b,
    payments: (b.payments ?? []).sort(
      (a: any, b: any) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    ),
  }))

  const inpatient =
    inpatientRes.error && inpatientRes.error.code === "PGRST116"
      ? null
      : inpatientRes.error
        ? (() => { throw inpatientRes.error })()
        : inpatientRes.data

  // Aggregate
  const opdTotal = prescriptions.reduce((s: number, p: any) => s + p.total, 0)
  const opdPaid = prescriptions.reduce((s: number, p: any) => s + p.amountPaid, 0)
  const labTotal = labBills.reduce((s: number, b: any) => s + b.total, 0)
  const labPaid = labBills.reduce((s: number, b: any) => s + b.amountPaid, 0)
  const ipdTotal = inpatient?.netAmount ?? 0
  const ipdPaid = inpatient?.totalReceivedAmount ?? 0

  return {
    summary: {
      opdTotal,
      opdPaid,
      opdDue: opdTotal - opdPaid,
      labTotal,
      labPaid,
      labDue: labTotal - labPaid,
      ipdTotal,
      ipdPaid,
      ipdDue: ipdTotal - ipdPaid,
      grandTotal: opdTotal + labTotal + ipdTotal,
      grandPaid: opdPaid + labPaid + ipdPaid,
      grandDue: (opdTotal - opdPaid) + (labTotal - labPaid) + (ipdTotal - ipdPaid),
    },
    prescriptions,
    labBills,
    inpatient,
  }
}
