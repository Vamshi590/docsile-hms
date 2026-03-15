"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

type DateRange = { from?: string; to?: string }

function buildDateFilter(range: DateRange, field: string) {
  if (!range.from && !range.to) return {}
  const filter: Record<string, Date> = {}
  if (range.from) filter.gte = new Date(range.from + "T00:00:00")
  if (range.to) filter.lte = new Date(range.to + "T23:59:59")
  return { [field]: filter }
}

function applyDateRange(
  query: any,
  range: DateRange | undefined,
  field: string
) {
  if (!range) return query
  let q = query
  if (range.from) q = q.gte(field, new Date(range.from + "T00:00:00").toISOString())
  if (range.to) q = q.lte(field, new Date(range.to + "T23:59:59").toISOString())
  return q
}

export async function getExportPatients(filters: {
  search?: string
  dateRange?: DateRange
  patientType?: "OPD" | "IPD" | "ALL"
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("Patient")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  if (filters.patientType && filters.patientType !== "ALL") {
    query = query.eq("patientType", filters.patientType)
  }

  query = applyDateRange(query, filters.dateRange, "appointmentDate")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `firstName.ilike.%${s}%,lastName.ilike.%${s}%,phone.ilike.%${s}%,patientId.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((p: any) => ({
    id: p.id,
    patientId: p.patientId,
    firstName: p.firstName,
    lastName: p.lastName ?? "",
    age: p.age,
    gender: p.gender,
    phone: p.phone,
    email: p.email ?? "",
    address: p.address ?? "",
    guardianName: p.guardianName ?? "",
    referredBy: p.referredBy ?? "",
    doctorName: p.doctorName ?? "",
    department: p.department ?? "",
    patientType: p.patientType,
    status: p.status,
    appointmentDate: new Date(p.appointmentDate).toISOString(),
    createdAt: new Date(p.createdAt).toISOString(),
  }))
}

export async function getExportPrescriptions(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("Prescription")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status)
  }

  query = applyDateRange(query, filters.dateRange, "prescriptionDate")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `prescriptionNumber.ilike.%${s}%,doctorName.ilike.%${s}%,patientId.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((p: any) => ({
    id: p.id,
    prescriptionNumber: p.prescriptionNumber ?? "",
    patientId: p.patientId,
    patientType: p.patientType,
    doctorName: p.doctorName ?? "",
    department: p.department ?? "",
    diagnosis: p.diagnosis ?? "",
    presentComplaint: p.presentComplaint ?? "",
    medicines: p.medicines,
    investigations: p.investigations,
    subtotal: p.subtotal,
    discount: p.discount,
    total: p.total,
    amountPaid: p.amountPaid,
    balanceDue: p.balanceDue,
    paymentMode: p.paymentMode ?? "",
    status: p.status,
    prescriptionDate: new Date(p.prescriptionDate).toISOString(),
    followUpDate: p.followUpDate ? new Date(p.followUpDate).toISOString() : "",
    createdAt: new Date(p.createdAt).toISOString(),
  }))
}

export async function getExportEyeReadings(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("EyeReading")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  query = applyDateRange(query, filters.dateRange, "readingDate")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.ilike("patientId", `%${s}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((e: any) => ({
    id: e.id,
    patientId: e.patientId,
    autoRefractometer: e.autoRefractometer ?? "",
    glassesReading: e.glassesReading ?? "",
    previousPrescription: e.previousPrescription ?? "",
    presentPrescription: e.presentPrescription ?? "",
    clinicalFindings: e.clinicalFindings ?? "",
    status: e.status,
    readingDate: new Date(e.readingDate).toISOString(),
    createdAt: new Date(e.createdAt).toISOString(),
  }))
}

export async function getExportInPatients(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("InPatient")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status)
  }

  query = applyDateRange(query, filters.dateRange, "admissionDate")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `name.ilike.%${s}%,ipNumber.ilike.%${s}%,phone.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((ip: any) => ({
    id: ip.id,
    ipNumber: ip.ipNumber,
    patientId: ip.patientId,
    name: ip.name,
    age: ip.age,
    gender: ip.gender,
    phone: ip.phone,
    address: ip.address ?? "",
    department: ip.department ?? "",
    doctorNames: ip.doctorNames,
    operationName: ip.operationName ?? "",
    operationDate: ip.operationDate ? new Date(ip.operationDate).toISOString() : "",
    packageAmount: ip.packageAmount,
    discount: ip.discount,
    netAmount: ip.netAmount,
    totalReceivedAmount: ip.totalReceivedAmount,
    balanceAmount: ip.balanceAmount,
    status: ip.status,
    bedNumber: ip.bedNumber ?? "",
    wardName: ip.wardName ?? "",
    admissionDate: new Date(ip.admissionDate).toISOString(),
    dischargeDate: ip.dischargeDate ? new Date(ip.dischargeDate).toISOString() : "",
    createdAt: new Date(ip.createdAt).toISOString(),
  }))
}

export async function getExportInsuranceClaims(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("InsuranceClaim")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status)
  }

  query = applyDateRange(query, filters.dateRange, "createdAt")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `claimNumber.ilike.%${s}%,patientName.ilike.%${s}%,insuranceCompanyName.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((c: any) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    patientName: c.patientName,
    ipNumber: c.ipNumber,
    age: c.age,
    gender: c.gender,
    phone: c.phone,
    insuranceCompanyName: c.insuranceCompanyName,
    tpaName: c.tpaName ?? "",
    policyNumber: c.policyNumber ?? "",
    packageAmount: c.packageAmount,
    totalBillAmount: c.totalBillAmount,
    preauthAmount: c.preauthAmount,
    totalApprovedAmount: c.totalApprovedAmount,
    finalSettledAmount: c.finalSettledAmount,
    patientPayableAmount: c.patientPayableAmount,
    patientPaidAmount: c.patientPaidAmount,
    patientBalance: c.patientBalance,
    status: c.status,
    admissionDate: new Date(c.admissionDate).toISOString(),
    dischargeDate: c.dischargeDate ? new Date(c.dischargeDate).toISOString() : "",
    createdAt: new Date(c.createdAt).toISOString(),
  }))
}

export async function getExportLabBills(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("LabBill")
    .select("*, lab:Lab(name)")
    .order("createdAt", { ascending: false })
    .limit(5000)

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status)
  }

  query = applyDateRange(query, filters.dateRange, "createdAt")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `billNumber.ilike.%${s}%,patientId.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((b: any) => ({
    id: b.id,
    billNumber: b.billNumber,
    labName: b.lab.name,
    patientId: b.patientId,
    subtotal: b.subtotal,
    discount: b.discount,
    total: b.total,
    amountPaid: b.amountPaid,
    balanceDue: b.balanceDue,
    paymentMode: b.paymentMode ?? "",
    status: b.status,
    createdAt: new Date(b.createdAt).toISOString(),
  }))
}

export async function getExportPharmacyBills(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("PharmacyBill")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  query = applyDateRange(query, filters.dateRange, "billDate")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `billNumber.ilike.%${s}%,patientName.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((b: any) => ({
    id: b.id,
    billNumber: b.billNumber,
    patientName: b.patientName,
    patientPhone: b.patientPhone ?? "",
    referredDoctor: b.referredDoctor ?? "",
    subtotal: b.subtotal,
    discountAmount: b.discountAmount,
    gstAmount: b.gstAmount,
    billAmount: b.billAmount,
    paidAmount: b.paidAmount,
    balanceDue: b.balanceDue,
    paymentMode: b.paymentMode,
    status: b.status,
    billDate: new Date(b.billDate).toISOString(),
    createdAt: new Date(b.createdAt).toISOString(),
  }))
}

export async function getExportOpticalBills(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("OpticalBill")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(5000)

  query = applyDateRange(query, filters.dateRange, "billDate")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `billNumber.ilike.%${s}%,patientName.ilike.%${s}%`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((b: any) => ({
    id: b.id,
    billNumber: b.billNumber,
    patientName: b.patientName,
    patientPhone: b.patientPhone ?? "",
    referredDoctor: b.referredDoctor ?? "",
    subtotal: b.subtotal,
    discountAmount: b.discountAmount,
    gstAmount: b.gstAmount,
    billAmount: b.billAmount,
    paidAmount: b.paidAmount,
    balanceDue: b.balanceDue,
    paymentMode: b.paymentMode,
    status: b.status,
    billDate: new Date(b.billDate).toISOString(),
    createdAt: new Date(b.createdAt).toISOString(),
  }))
}

export async function getExportExpenses(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("Expense")
    .select("*, category:ExpenseCategory(name)")
    .order("createdAt", { ascending: false })
    .limit(5000)

  query = applyDateRange(query, filters.dateRange, "date")

  if (filters.search) {
    const s = filters.search.trim()
    query = query.ilike("title", `%${s}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    category: e.category.name,
    amount: e.amount,
    date: new Date(e.date).toISOString(),
    reason: e.reason ?? "",
    paymentMode: e.paymentMode ?? "",
    createdAt: new Date(e.createdAt).toISOString(),
  }))
}
