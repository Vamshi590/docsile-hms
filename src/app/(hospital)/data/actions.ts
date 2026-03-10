"use server"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

type DateRange = { from?: string; to?: string }

function buildDateFilter(range: DateRange, field: string) {
  if (!range.from && !range.to) return {}
  const filter: Record<string, Date> = {}
  if (range.from) filter.gte = new Date(range.from + "T00:00:00")
  if (range.to) filter.lte = new Date(range.to + "T23:59:59")
  return { [field]: filter }
}

export async function getExportPatients(filters: {
  search?: string
  dateRange?: DateRange
  patientType?: "OPD" | "IPD" | "ALL"
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.patientType && filters.patientType !== "ALL") {
    where.patientType = filters.patientType
  }

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "appointmentDate"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { firstName: { contains: s, mode: "insensitive" } },
      { lastName: { contains: s, mode: "insensitive" } },
      { phone: { contains: s } },
      { patientId: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((p) => ({
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
    appointmentDate: p.appointmentDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }))
}

export async function getExportPrescriptions(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status
  }

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "prescriptionDate"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { prescriptionNumber: { contains: s, mode: "insensitive" } },
      { doctorName: { contains: s, mode: "insensitive" } },
      { patientId: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.prescription.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((p) => ({
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
    prescriptionDate: p.prescriptionDate.toISOString(),
    followUpDate: p.followUpDate?.toISOString() ?? "",
    createdAt: p.createdAt.toISOString(),
  }))
}

export async function getExportEyeReadings(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "readingDate"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { patientId: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.eyeReading.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((e) => ({
    id: e.id,
    patientId: e.patientId,
    autoRefractometer: e.autoRefractometer ?? "",
    glassesReading: e.glassesReading ?? "",
    previousPrescription: e.previousPrescription ?? "",
    presentPrescription: e.presentPrescription ?? "",
    clinicalFindings: e.clinicalFindings ?? "",
    status: e.status,
    readingDate: e.readingDate.toISOString(),
    createdAt: e.createdAt.toISOString(),
  }))
}

export async function getExportInPatients(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status
  }

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "admissionDate"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { ipNumber: { contains: s, mode: "insensitive" } },
      { phone: { contains: s } },
    ]
  }

  const data = await db.inPatient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((ip) => ({
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
    operationDate: ip.operationDate?.toISOString() ?? "",
    packageAmount: ip.packageAmount,
    discount: ip.discount,
    netAmount: ip.netAmount,
    totalReceivedAmount: ip.totalReceivedAmount,
    balanceAmount: ip.balanceAmount,
    status: ip.status,
    bedNumber: ip.bedNumber ?? "",
    wardName: ip.wardName ?? "",
    admissionDate: ip.admissionDate.toISOString(),
    dischargeDate: ip.dischargeDate?.toISOString() ?? "",
    createdAt: ip.createdAt.toISOString(),
  }))
}

export async function getExportInsuranceClaims(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status
  }

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "createdAt"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { claimNumber: { contains: s, mode: "insensitive" } },
      { patientName: { contains: s, mode: "insensitive" } },
      { insuranceCompanyName: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.insuranceClaim.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((c) => ({
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
    admissionDate: c.admissionDate.toISOString(),
    dischargeDate: c.dischargeDate?.toISOString() ?? "",
    createdAt: c.createdAt.toISOString(),
  }))
}

export async function getExportLabBills(filters: {
  search?: string
  dateRange?: DateRange
  status?: string
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status
  }

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "createdAt"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { billNumber: { contains: s, mode: "insensitive" } },
      { patientId: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.labBill.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { lab: { select: { name: true } } },
    take: 5000,
  })

  return data.map((b) => ({
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
    createdAt: b.createdAt.toISOString(),
  }))
}

export async function getExportPharmacyBills(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "billDate"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { billNumber: { contains: s, mode: "insensitive" } },
      { patientName: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.pharmacyBill.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((b) => ({
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
    billDate: b.billDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }))
}

export async function getExportOpticalBills(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "billDate"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { billNumber: { contains: s, mode: "insensitive" } },
      { patientName: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.opticalBill.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  return data.map((b) => ({
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
    billDate: b.billDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }))
}

export async function getExportExpenses(filters: {
  search?: string
  dateRange?: DateRange
}) {
  await requireAuth()
  const where: Record<string, unknown> = {}

  if (filters.dateRange) {
    Object.assign(where, buildDateFilter(filters.dateRange, "date"))
  }

  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { title: { contains: s, mode: "insensitive" } },
    ]
  }

  const data = await db.expense.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
    take: 5000,
  })

  return data.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category.name,
    amount: e.amount,
    date: e.date.toISOString(),
    reason: e.reason ?? "",
    paymentMode: e.paymentMode ?? "",
    createdAt: e.createdAt.toISOString(),
  }))
}
