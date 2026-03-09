"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DueRecord {
  id: string
  type: "OPD" | "IPD" | "LAB"
  patientId: string
  patientName: string
  uhid: string
  phone: string
  services: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  date: string
  prescriptionNumber?: string
  labBillNumber?: string
}

export interface FollowUpRecord {
  id: string
  type: "OPD" | "IPD"
  patientId: string
  patientName: string
  uhid: string
  phone: string
  followUpDate: string
  doctorName: string
  department: string
  diagnosis: string
  lastVisitDate: string
  isOverdue: boolean
}

export interface DuesSummary {
  totalOutstanding: number
  opdCount: number
  opdTotal: number
  ipdCount: number
  ipdTotal: number
  labCount: number
  labTotal: number
}

export interface FollowUpsSummary {
  todayCount: number
  tomorrowCount: number
  totalCount: number
  overdueCount: number
}

// ─── Get Dues ────────────────────────────────────────────────────────────────

export async function getDues(filters: {
  search?: string
  type?: "OPD" | "IPD" | "LAB" | "ALL"
  dateFrom?: string
  dateTo?: string
  sortBy?: "amount_desc" | "amount_asc" | "date_desc" | "date_asc"
}) {
  await requireAuth()

  const { search, type = "ALL", dateFrom, dateTo, sortBy = "date_desc" } = filters

  const dues: DueRecord[] = []

  // ── OPD Dues: Prescriptions with balanceDue > 0 ──
  if (type === "ALL" || type === "OPD") {
    const opdWhere: Record<string, unknown> = { balanceDue: { gt: 0 } }

    if (dateFrom || dateTo) {
      opdWhere.prescriptionDate = {
        ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
      }
    }

    if (search) {
      opdWhere.OR = [
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } },
        { patient: { phone: { contains: search } } },
        { patient: { patientId: { contains: search, mode: "insensitive" } } },
        { prescriptionNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const prescriptions = await db.prescription.findMany({
      where: opdWhere,
      include: {
        patient: { select: { patientId: true, firstName: true, lastName: true, phone: true } },
        items: { select: { description: true } },
      },
      orderBy: { prescriptionDate: "desc" },
    })

    for (const rx of prescriptions) {
      dues.push({
        id: rx.id,
        type: "OPD",
        patientId: rx.patient.patientId,
        patientName: [rx.patient.firstName, rx.patient.lastName].filter(Boolean).join(" "),
        uhid: rx.patient.patientId,
        phone: rx.patient.phone,
        services: rx.items.map((i) => i.description).join(", ") || "Consultation",
        totalAmount: rx.total,
        amountPaid: rx.amountPaid,
        balanceDue: rx.balanceDue,
        date: rx.prescriptionDate.toISOString(),
        prescriptionNumber: rx.prescriptionNumber ?? undefined,
      })
    }
  }

  // ── IPD Dues: InPatients with balanceAmount > 0 ──
  if (type === "ALL" || type === "IPD") {
    const ipdWhere: Record<string, unknown> = { balanceAmount: { gt: 0 } }

    if (dateFrom || dateTo) {
      ipdWhere.admissionDate = {
        ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
      }
    }

    if (search) {
      ipdWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { ipNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const inpatients = await db.inPatient.findMany({
      where: ipdWhere,
      include: {
        patient: { select: { patientId: true } },
      },
      orderBy: { admissionDate: "desc" },
    })

    for (const ip of inpatients) {
      dues.push({
        id: ip.id,
        type: "IPD",
        patientId: ip.patient.patientId,
        patientName: ip.name,
        uhid: ip.patient.patientId,
        phone: ip.phone,
        services: ip.operationName || "In-Patient Package",
        totalAmount: ip.netAmount,
        amountPaid: ip.totalReceivedAmount,
        balanceDue: ip.balanceAmount,
        date: ip.admissionDate.toISOString(),
      })
    }
  }

  // ── LAB Dues: LabBills with balanceDue > 0 ──
  if (type === "ALL" || type === "LAB") {
    const labWhere: Record<string, unknown> = { balanceDue: { gt: 0 }, status: { not: "CANCELLED" } }

    if (dateFrom || dateTo) {
      labWhere.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
      }
    }

    if (search) {
      labWhere.OR = [
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } },
        { patient: { phone: { contains: search } } },
        { patient: { patientId: { contains: search, mode: "insensitive" } } },
        { billNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const labBills = await db.labBill.findMany({
      where: labWhere,
      include: {
        patient: { select: { patientId: true, firstName: true, lastName: true, phone: true } },
        lab: { select: { name: true } },
        items: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    for (const lb of labBills) {
      dues.push({
        id: lb.id,
        type: "LAB",
        patientId: lb.patient.patientId,
        patientName: [lb.patient.firstName, lb.patient.lastName].filter(Boolean).join(" "),
        uhid: lb.patient.patientId,
        phone: lb.patient.phone,
        services: `${lb.lab.name}: ${lb.items.map((i) => i.name).join(", ")}`,
        totalAmount: lb.total,
        amountPaid: lb.amountPaid,
        balanceDue: lb.balanceDue,
        date: lb.createdAt.toISOString(),
        labBillNumber: lb.billNumber,
      })
    }
  }

  // ── Sort ──
  dues.sort((a, b) => {
    switch (sortBy) {
      case "amount_desc": return b.balanceDue - a.balanceDue
      case "amount_asc": return a.balanceDue - b.balanceDue
      case "date_asc": return new Date(a.date).getTime() - new Date(b.date).getTime()
      case "date_desc":
      default: return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
  })

  // ── Summary ──
  const opdDues = dues.filter((d) => d.type === "OPD")
  const ipdDues = dues.filter((d) => d.type === "IPD")
  const labDues = dues.filter((d) => d.type === "LAB")

  const summary: DuesSummary = {
    totalOutstanding: dues.reduce((sum, d) => sum + d.balanceDue, 0),
    opdCount: opdDues.length,
    opdTotal: opdDues.reduce((sum, d) => sum + d.balanceDue, 0),
    ipdCount: ipdDues.length,
    ipdTotal: ipdDues.reduce((sum, d) => sum + d.balanceDue, 0),
    labCount: labDues.length,
    labTotal: labDues.reduce((sum, d) => sum + d.balanceDue, 0),
  }

  return { dues, summary }
}

// ─── Get Follow-Ups ──────────────────────────────────────────────────────────

export async function getFollowUps(filters: {
  search?: string
  type?: "OPD" | "IPD" | "ALL"
  doctor?: string
  department?: string
  dateFrom?: string
  dateTo?: string
  includeOverdue?: boolean
}) {
  await requireAuth()

  const { search, type = "ALL", doctor, department, includeOverdue = false } = filters

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Default: next 5 days from today
  const dateFrom = filters.dateFrom
    ? new Date(filters.dateFrom + "T00:00:00")
    : (includeOverdue ? new Date("2000-01-01") : today)
  const dateTo = filters.dateTo
    ? new Date(filters.dateTo + "T23:59:59")
    : new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000)

  const followUps: FollowUpRecord[] = []

  // ── OPD Follow-ups: from Prescription.followUpDate ──
  if (type === "ALL" || type === "OPD") {
    const where: Record<string, unknown> = {
      followUpDate: { gte: dateFrom, lte: dateTo },
    }

    if (search) {
      where.OR = [
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } },
        { patient: { phone: { contains: search } } },
        { patient: { patientId: { contains: search, mode: "insensitive" } } },
      ]
    }
    if (doctor) where.doctorName = { contains: doctor, mode: "insensitive" }
    if (department) where.department = department

    const prescriptions = await db.prescription.findMany({
      where,
      include: {
        patient: { select: { patientId: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { followUpDate: "asc" },
    })

    for (const rx of prescriptions) {
      const fuDate = rx.followUpDate!
      followUps.push({
        id: rx.id,
        type: "OPD",
        patientId: rx.patient.patientId,
        patientName: [rx.patient.firstName, rx.patient.lastName].filter(Boolean).join(" "),
        uhid: rx.patient.patientId,
        phone: rx.patient.phone,
        followUpDate: fuDate.toISOString(),
        doctorName: rx.doctorName ?? "—",
        department: rx.department ?? "—",
        diagnosis: rx.diagnosis ?? "—",
        lastVisitDate: rx.prescriptionDate.toISOString(),
        isOverdue: fuDate < today,
      })
    }
  }

  // ── IPD Follow-ups: from InPatient.followUpDate ──
  if (type === "ALL" || type === "IPD") {
    const ipdWhere: Record<string, unknown> = {
      followUpDate: { gte: dateFrom, lte: dateTo },
    }

    if (search) {
      ipdWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { ipNumber: { contains: search, mode: "insensitive" } },
      ]
    }
    if (doctor) ipdWhere.doctorNames = { contains: doctor }
    if (department) ipdWhere.department = department

    const inpatients = await db.inPatient.findMany({
      where: ipdWhere,
      include: {
        patient: { select: { patientId: true } },
      },
      orderBy: { followUpDate: "asc" },
    })

    for (const ip of inpatients) {
      const fuDate = ip.followUpDate!
      let doctorName = "—"
      try {
        const names = JSON.parse(ip.doctorNames) as string[]
        doctorName = names.join(", ")
      } catch {
        doctorName = ip.doctorNames || "—"
      }

      followUps.push({
        id: ip.id,
        type: "IPD",
        patientId: ip.patient.patientId,
        patientName: ip.name,
        uhid: ip.patient.patientId,
        phone: ip.phone,
        followUpDate: fuDate.toISOString(),
        doctorName,
        department: ip.department ?? "—",
        diagnosis: ip.provisionDiagnosis ?? ip.operationName ?? "—",
        lastVisitDate: (ip.dischargeDate ?? ip.admissionDate).toISOString(),
        isOverdue: fuDate < today,
      })
    }
  }

  // ── Sort by follow-up date ──
  followUps.sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime())

  // ── Summary ──
  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

  const summary: FollowUpsSummary = {
    todayCount: followUps.filter((f) => {
      const d = new Date(f.followUpDate)
      return d >= today && d < tomorrow
    }).length,
    tomorrowCount: followUps.filter((f) => {
      const d = new Date(f.followUpDate)
      return d >= tomorrow && d < tomorrowEnd
    }).length,
    totalCount: followUps.length,
    overdueCount: followUps.filter((f) => f.isOverdue).length,
  }

  return { followUps, summary }
}

// ─── Mark Due as Paid ────────────────────────────────────────────────────────

export async function markDueAsPaid(id: string, type: "OPD" | "IPD" | "LAB") {
  const user = await requireAuth()

  try {
    if (type === "LAB") {
      const labBill = await db.labBill.findUnique({ where: { id } })
      if (!labBill) return { success: false as const, error: "Lab bill not found" }

      await db.labBill.update({
        where: { id },
        data: {
          amountPaid: labBill.total,
          balanceDue: 0,
          status: "PAID",
          paymentMode: labBill.paymentMode || "CASH",
          paymentDate: new Date(),
        },
      })

      await db.labPayment.create({
        data: {
          labBillId: id,
          amount: labBill.balanceDue,
          paymentMode: labBill.paymentMode || "CASH",
          receivedBy: user.id,
        },
      })
    } else if (type === "OPD") {
      const prescription = await db.prescription.findUnique({ where: { id } })
      if (!prescription) return { success: false as const, error: "Prescription not found" }

      await db.prescription.update({
        where: { id },
        data: {
          amountPaid: prescription.total,
          balanceDue: 0,
          updatedBy: user.id,
        },
      })

      await db.payment.create({
        data: {
          prescriptionId: id,
          amount: prescription.balanceDue,
          paymentMode: "CASH",
          receivedBy: user.id,
        },
      })
    } else {
      const inpatient = await db.inPatient.findUnique({ where: { id } })
      if (!inpatient) return { success: false as const, error: "InPatient not found" }

      const existingRecords: { date: string; amountType: string; paymentMode: string; amount: number; notes?: string }[] = (() => {
        try { return JSON.parse(inpatient.paymentRecords ?? "[]") }
        catch { return [] }
      })()

      existingRecords.push({
        date: new Date().toISOString(),
        amountType: "Final",
        paymentMode: "Cash",
        amount: inpatient.balanceAmount,
        notes: "Marked as paid from Dues module",
      })

      await db.inPatient.update({
        where: { id },
        data: {
          totalReceivedAmount: inpatient.netAmount,
          balanceAmount: 0,
          paymentRecords: JSON.stringify(existingRecords),
          updatedBy: user.id,
        },
      })
    }

    revalidatePath("/dues-followups")
    return { success: true as const }
  } catch (error) {
    console.error("Error marking due as paid:", error)
    return { success: false as const, error: "Failed to mark as paid" }
  }
}

// ─── Get Doctor List (for filter dropdown) ───────────────────────────────────

export async function getDoctorList() {
  const doctors = await db.prescription.findMany({
    where: { doctorName: { not: null } },
    select: { doctorName: true },
    distinct: ["doctorName"],
  })
  return doctors.map((d) => d.doctorName!).filter(Boolean).sort()
}

// ─── Get Department List (for filter dropdown) ───────────────────────────────

export async function getDepartmentList() {
  const departments = await db.prescription.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ["department"],
  })
  return departments.map((d) => d.department!).filter(Boolean).sort()
}
