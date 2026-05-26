"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth, requireServerPermission } from "@/lib/auth"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DueRecord {
  id: string
  type: "OPD" | "IPD" | "LAB" | "PHARMACY"
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
  pharmacyBillNumber?: string
}

export interface FollowUpRecord {
  id: string
  type: "OPD" | "IPD"
  patientId: string
  patientName: string
  uhid: string
  phone: string
  email: string | null
  followUpDate: string
  doctorName: string
  department: string
  diagnosis: string
  additionalNotes: string
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
  pharmacyCount: number
  pharmacyTotal: number
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
  type?: "OPD" | "IPD" | "LAB" | "PHARMACY" | "ALL"
  dateFrom?: string
  dateTo?: string
  sortBy?: "amount_desc" | "amount_asc" | "date_desc" | "date_asc"
}) {
  await requireServerPermission("dues:view")
  const supabase = await createClient()

  const { search, type = "ALL", dateFrom, dateTo, sortBy = "date_desc" } = filters

  const dues: DueRecord[] = []

  // ── OPD Dues: Prescriptions with balanceDue > 0 ──
  if (type === "ALL" || type === "OPD") {
    let query = supabase
      .from("Prescription")
      .select("*, patient:Patient!patientId(patientId, firstName, lastName, phone), items:InvoiceItem(*)")
      .gt("balanceDue", 0)
      .order("prescriptionDate", { ascending: false })

    if (dateFrom) query = query.gte("prescriptionDate", dateFrom + "T00:00:00")
    if (dateTo) query = query.lte("prescriptionDate", dateTo + "T23:59:59")

    if (search) {
      query = query.or(
        `prescriptionNumber.ilike.%${search}%,patient.firstName.ilike.%${search}%,patient.lastName.ilike.%${search}%,patient.phone.ilike.%${search}%,patient.patientId.ilike.%${search}%`
      )
    }

    const { data: prescriptions } = await query

    for (const rx of prescriptions ?? []) {
      const patient = rx.patient as { patientId: string; firstName: string; lastName: string; phone: string }
      const items = (rx.items ?? []) as { description: string }[]
      dues.push({
        id: rx.id,
        type: "OPD",
        patientId: patient.patientId,
        patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
        uhid: patient.patientId,
        phone: patient.phone,
        services: items.map((i) => i.description).join(", ") || "Consultation",
        totalAmount: rx.total,
        amountPaid: rx.amountPaid,
        balanceDue: rx.balanceDue,
        date: new Date(rx.prescriptionDate).toISOString(),
        prescriptionNumber: rx.prescriptionNumber ?? undefined,
      })
    }
  }

  // ── IPD Dues: InPatients with balanceAmount > 0 ──
  if (type === "ALL" || type === "IPD") {
    let query = supabase
      .from("InPatient")
      .select("*, patient:Patient!patientId(patientId)")
      .gt("balanceAmount", 0)
      .order("admissionDate", { ascending: false })

    if (dateFrom) query = query.gte("admissionDate", dateFrom + "T00:00:00")
    if (dateTo) query = query.lte("admissionDate", dateTo + "T23:59:59")

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,ipNumber.ilike.%${search}%`
      )
    }

    const { data: inpatients } = await query

    for (const ip of inpatients ?? []) {
      const patient = ip.patient as { patientId: string }
      dues.push({
        id: ip.id,
        type: "IPD",
        patientId: patient.patientId,
        patientName: ip.name,
        uhid: patient.patientId,
        phone: ip.phone,
        services: ip.operationName || "In-Patient Package",
        totalAmount: ip.netAmount,
        amountPaid: ip.totalReceivedAmount,
        balanceDue: ip.balanceAmount,
        date: new Date(ip.admissionDate).toISOString(),
      })
    }
  }

  // ── LAB Dues: LabBills with balanceDue > 0 ──
  if (type === "ALL" || type === "LAB") {
    let query = supabase
      .from("LabBill")
      .select("*, patient:Patient!patientId(patientId, firstName, lastName, phone), lab:Lab!labId(name), items:LabBillItem(*)")
      .gt("balanceDue", 0)
      .neq("status", "CANCELLED")
      .order("createdAt", { ascending: false })

    if (dateFrom) query = query.gte("createdAt", dateFrom + "T00:00:00")
    if (dateTo) query = query.lte("createdAt", dateTo + "T23:59:59")

    if (search) {
      query = query.or(
        `billNumber.ilike.%${search}%,patient.firstName.ilike.%${search}%,patient.lastName.ilike.%${search}%,patient.phone.ilike.%${search}%,patient.patientId.ilike.%${search}%`
      )
    }

    const { data: labBills } = await query

    for (const lb of labBills ?? []) {
      const patient = lb.patient as { patientId: string; firstName: string; lastName: string; phone: string }
      const lab = lb.lab as { name: string }
      const items = (lb.items ?? []) as { name: string }[]
      dues.push({
        id: lb.id,
        type: "LAB",
        patientId: patient.patientId,
        patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
        uhid: patient.patientId,
        phone: patient.phone,
        services: `${lab.name}: ${items.map((i) => i.name).join(", ")}`,
        totalAmount: lb.total,
        amountPaid: lb.amountPaid,
        balanceDue: lb.balanceDue,
        date: new Date(lb.createdAt).toISOString(),
        labBillNumber: lb.billNumber,
      })
    }
  }

  // ── PHARMACY Dues: PharmacyBills with balanceDue > 0 ──
  if (type === "ALL" || type === "PHARMACY") {
    let query = supabase
      .from("PharmacyBill")
      .select("*, items:PharmacyBillItem(*)")
      .gt("balanceDue", 0)
      .order("createdAt", { ascending: false })

    if (dateFrom) query = query.gte("createdAt", dateFrom + "T00:00:00")
    if (dateTo) query = query.lte("createdAt", dateTo + "T23:59:59")

    if (search) {
      query = query.or(
        `billNumber.ilike.%${search}%,patientName.ilike.%${search}%,patientPhone.ilike.%${search}%,patientId.ilike.%${search}%`
      )
    }

    const { data: pharmacyBills } = await query

    for (const pb of pharmacyBills ?? []) {
      const items = (pb.items ?? []) as { medicineName: string }[]
      dues.push({
        id: pb.id,
        type: "PHARMACY",
        patientId: pb.patientId ?? "—",
        patientName: pb.patientName,
        uhid: pb.patientId ?? "—",
        phone: pb.patientPhone ?? "—",
        services: items.map((i) => i.medicineName).join(", ") || "Medicines",
        totalAmount: pb.billAmount,
        amountPaid: pb.paidAmount,
        balanceDue: pb.balanceDue,
        date: new Date(pb.createdAt).toISOString(),
        pharmacyBillNumber: pb.billNumber,
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
  const pharmacyDues = dues.filter((d) => d.type === "PHARMACY")

  const summary: DuesSummary = {
    totalOutstanding: dues.reduce((sum, d) => sum + d.balanceDue, 0),
    opdCount: opdDues.length,
    opdTotal: opdDues.reduce((sum, d) => sum + d.balanceDue, 0),
    ipdCount: ipdDues.length,
    ipdTotal: ipdDues.reduce((sum, d) => sum + d.balanceDue, 0),
    labCount: labDues.length,
    labTotal: labDues.reduce((sum, d) => sum + d.balanceDue, 0),
    pharmacyCount: pharmacyDues.length,
    pharmacyTotal: pharmacyDues.reduce((sum, d) => sum + d.balanceDue, 0),
  }

  return { dues, summary }
}

// ─── Get Follow-Ups ──────────────────────────────────────────────────────────

export async function getFollowUps(filters: {
  notesSearch?: string
  type?: "OPD" | "IPD" | "ALL"
  doctor?: string
  department?: string
  dateFrom?: string
  dateTo?: string
  includeOverdue?: boolean
}) {
  await requireServerPermission("dues:view")
  const supabase = await createClient()

  const { notesSearch, type = "ALL", doctor, department, includeOverdue = false } = filters

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
    let query = supabase
      .from("Prescription")
      .select("*, patient:Patient!patientId(patientId, firstName, lastName, phone, email)")
      .gte("followUpDate", dateFrom.toISOString())
      .lte("followUpDate", dateTo.toISOString())
      .order("followUpDate", { ascending: true })

    if (notesSearch) {
      query = query.ilike("additionalNotes", `%${notesSearch}%`)
    }
    if (doctor) query = query.ilike("doctorName", `%${doctor}%`)
    if (department) query = query.eq("department", department)

    const { data: prescriptions } = await query

    for (const rx of prescriptions ?? []) {
      const patient = rx.patient as { patientId: string; firstName: string; lastName: string; phone: string; email: string | null }
      const fuDate = new Date(rx.followUpDate!)
      followUps.push({
        id: rx.id,
        type: "OPD",
        patientId: patient.patientId,
        patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
        uhid: patient.patientId,
        phone: patient.phone,
        email: patient.email ?? null,
        followUpDate: fuDate.toISOString(),
        doctorName: rx.doctorName ?? "—",
        department: rx.department ?? "—",
        diagnosis: rx.diagnosis ?? "—",
        additionalNotes: rx.additionalNotes ?? "",
        lastVisitDate: new Date(rx.prescriptionDate).toISOString(),
        isOverdue: fuDate < today,
      })
    }
  }

  // ── IPD Follow-ups: from InPatient.followUpDate ──
  if (type === "ALL" || type === "IPD") {
    let query = supabase
      .from("InPatient")
      .select("*, patient:Patient!patientId(patientId, firstName, lastName, phone, email)")
      .gte("followUpDate", dateFrom.toISOString())
      .lte("followUpDate", dateTo.toISOString())
      .order("followUpDate", { ascending: true })

    if (notesSearch) {
      query = query.ilike("dischargeNotes", `%${notesSearch}%`)
    }
    if (doctor) query = query.ilike("doctorNames", `%${doctor}%`)
    if (department) query = query.eq("department", department)

    const { data: inpatients } = await query

    for (const ip of inpatients ?? []) {
      const patient = ip.patient as { patientId: string; firstName: string; lastName: string; phone: string; email: string | null }
      const fuDate = new Date(ip.followUpDate!)
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
        patientId: patient.patientId,
        patientName: ip.name,
        uhid: patient.patientId,
        phone: ip.phone,
        email: patient.email ?? null,
        followUpDate: fuDate.toISOString(),
        doctorName,
        department: ip.department ?? "—",
        diagnosis: ip.provisionDiagnosis ?? ip.operationName ?? "—",
        additionalNotes: ip.dischargeNotes ?? "",
        lastVisitDate: new Date(ip.dischargeDate ?? ip.admissionDate).toISOString(),
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

export async function markDueAsPaid(id: string, type: "OPD" | "IPD" | "LAB" | "PHARMACY") {
  const user = await requireServerPermission("dues:edit")
  const supabase = await createClient()

  try {
    if (type === "LAB") {
      const { data: labBill } = await supabase
        .from("LabBill")
        .select("*")
        .eq("id", id)
        .single()
      if (!labBill) return { success: false as const, error: "Lab bill not found" }

      await supabase
        .from("LabBill")
        .update({
          amountPaid: labBill.total,
          balanceDue: 0,
          status: "PAID",
          paymentMode: labBill.paymentMode || "CASH",
          paymentDate: new Date().toISOString(),
        })
        .eq("id", id)

      await supabase
        .from("LabPayment")
        .insert({
          labBillId: id,
          amount: labBill.balanceDue,
          paymentMode: labBill.paymentMode || "CASH",
          receivedBy: user.id,
        })
    } else if (type === "OPD") {
      const { data: prescription } = await supabase
        .from("Prescription")
        .select("*")
        .eq("id", id)
        .single()
      if (!prescription) return { success: false as const, error: "Prescription not found" }

      await supabase
        .from("Prescription")
        .update({
          amountPaid: prescription.total,
          balanceDue: 0,
          updatedBy: user.id,
        })
        .eq("id", id)

      await supabase
        .from("Payment")
        .insert({
          prescriptionId: id,
          amount: prescription.balanceDue,
          paymentMode: "CASH",
          receivedBy: user.id,
        })
    } else if (type === "PHARMACY") {
      const { data: pharmacyBill } = await supabase
        .from("PharmacyBill")
        .select("*")
        .eq("id", id)
        .single()
      if (!pharmacyBill) return { success: false as const, error: "Pharmacy bill not found" }

      await supabase
        .from("PharmacyBill")
        .update({
          paidAmount: pharmacyBill.billAmount,
          balanceDue: 0,
          status: "COMPLETED",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id)
    } else {
      const { data: inpatient } = await supabase
        .from("InPatient")
        .select("*")
        .eq("id", id)
        .single()
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

      await supabase
        .from("InPatient")
        .update({
          totalReceivedAmount: inpatient.netAmount,
          balanceAmount: 0,
          paymentRecords: JSON.stringify(existingRecords),
          updatedBy: user.id,
        })
        .eq("id", id)
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
  await requireServerPermission("dues:view")
  const supabase = await createClient()
  const { data: doctors } = await supabase
    .from("Prescription")
    .select("doctorName")
    .not("doctorName", "is", null)

  const uniqueNames = [...new Set((doctors ?? []).map((d) => d.doctorName!))]
  return uniqueNames.filter(Boolean).sort()
}

// ─── Get Department List (for filter dropdown) ───────────────────────────────

export async function getDepartmentList() {
  await requireServerPermission("dues:view")
  const supabase = await createClient()
  const { data: departments } = await supabase
    .from("Prescription")
    .select("department")
    .not("department", "is", null)

  const uniqueDepts = [...new Set((departments ?? []).map((d) => d.department!))]
  return uniqueDepts.filter(Boolean).sort()
}

// ─── Get Available Email Templates from Sitha AI ────────────────────────────

export async function getAvailableTemplates(): Promise<Array<{code: string; name: string}>> {
  await requireServerPermission("dues:view")

  const sithaUrl = process.env.SITHA_API_URL
  const sithaKey = process.env.SITHA_API_KEY

  if (!sithaUrl || !sithaKey) return []

  try {
    const res = await fetch(`${sithaUrl}/api/v1/templates`, {
      headers: { Authorization: `Bearer ${sithaKey}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.templates ?? []
  } catch {
    return []
  }
}

// ─── Get Hospital Display Name ────────────────────────────────────────────────

export async function getHospitalDisplayName(): Promise<string> {
  await requireAuth()
  const supabase = await createClient()
  const { data } = await supabase
    .from("HospitalProfile")
    .select("displayName, name")
    .limit(1)
    .maybeSingle()
  return (data as { displayName?: string; name?: string } | null)?.displayName
    ?? (data as { displayName?: string; name?: string } | null)?.name
    ?? "Hospital"
}

// ─── Send Patient Email via Sitha AI ─────────────────────────────────────────

export async function sendPatientEmail(input: {
  toEmail: string
  toName: string
  templateCode: string
  variables: Record<string, string>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireServerPermission("dues:edit")

  const sithaUrl = process.env.SITHA_API_URL
  const sithaKey = process.env.SITHA_API_KEY

  if (!sithaUrl || !sithaKey) {
    return { ok: false, error: "Email service not configured" }
  }

  try {
    const res = await fetch(`${sithaUrl}/api/v1/email/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sithaKey}`,
      },
      body: JSON.stringify({
        templateCode: input.templateCode,
        to: { email: input.toEmail, name: input.toName },
        variables: input.variables,
      }),
    })

    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Email failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" }
  }
}
