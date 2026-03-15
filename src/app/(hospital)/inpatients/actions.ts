"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"
import { getNextInsClaimNumber } from "@/lib/id-generators"
import type { InPatientStatus, PaymentRecord, PackageInclusion, MedicalValues, InsuranceStatusHistoryEntry } from "@/lib/types"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const InPatientSchema = z.object({
  name: z.string().min(1, "Name required"),
  age: z.number().int().min(0),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(10),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().optional(),
  admissionDate: z.string(),
  admissionNotes: z.string().optional(),
  referredBy: z.string().optional(),
  department: z.string().optional(),
  doctorNames: z.array(z.string()),
  onDutyDoctor: z.string().optional(),
  operationName: z.string().optional(),
  operationDate: z.string().optional(),
  dischargeDate: z.string().optional(),
  operationProcedure: z.string().optional(),
  operationDetails: z.string().optional(),
  provisionDiagnosis: z.string().optional(),
  packageAmount: z.number().min(0),
  discount: z.number().min(0).default(0),
  packageInclusions: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    subItems: z.array(z.object({
      itemName: z.string(),
      quantity: z.number(),
      rate: z.number(),
      amount: z.number(),
    })).optional(),
  })).optional(),
  paymentRecords: z.array(z.object({
    date: z.string(),
    amountType: z.string(),
    paymentMode: z.string(),
    amount: z.number(),
    notes: z.string().optional(),
  })).optional(),
  patientId: z.string().optional(), // Link to OP patient
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getNextIPNumber(): Promise<string> {
  const supabase = await createClient()
  const { data: last } = await supabase
    .from("InPatient")
    .select("ipNumber")
    .like("ipNumber", "IP-%")
    .order("createdAt", { ascending: false })
    .limit(1)
    .single()

  if (!last) return "IP-0001"
  const num = parseInt(last.ipNumber.replace(/\D/g, ""), 10) || 0
  return `IP-${String(num + 1).padStart(4, "0")}`
}

export async function getNextInPatientId(): Promise<string> {
  return getNextIPNumber()
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function getInPatients(filters: {
  search?: string
  statuses?: string[]
  showDischarged?: boolean
  dateFrom?: string
  dateTo?: string
  doctor?: string
  department?: string
}) {
  const supabase = await createClient()
  const { search, statuses, showDischarged, dateFrom, dateTo, doctor, department } = filters

  let query = supabase.from("InPatient").select("*").order("admissionDate", { ascending: false })

  if (!showDischarged) {
    query = query.neq("status", "DISCHARGED")
  }

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses)
  }

  if (dateFrom) {
    query = query.gte("admissionDate", dateFrom + "T00:00:00")
  }
  if (dateTo) {
    query = query.lte("admissionDate", dateTo + "T23:59:59")
  }

  if (doctor) {
    query = query.ilike("doctorNames", `%${doctor}%`)
  }

  if (department) {
    query = query.eq("department", department)
  }

  if (search) {
    query = query.or(
      `ipNumber.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%,guardianName.ilike.%${search}%,operationName.ilike.%${search}%`
    )
  }

  const { data: inpatients } = await query

  // Stats
  const { data: all } = await supabase
    .from("InPatient")
    .select("status, balanceAmount")
    .neq("status", "DISCHARGED")

  const allRecords = all ?? []

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const { count: dischargedTodayCount } = await supabase
    .from("InPatient")
    .select("*", { count: "exact", head: true })
    .eq("status", "DISCHARGED")
    .gte("dischargeDate", todayStart)

  const stats = {
    totalAdmitted: allRecords.length,
    activeInStay: allRecords.filter(p => ["ADMITTED", "PRE_OP", "IN_SURGERY", "POST_OP"].includes(p.status)).length,
    readyToDischarge: allRecords.filter(p => p.status === "READY_FOR_DISCHARGE").length,
    dischargedToday: dischargedTodayCount ?? 0,
    totalBalancePending: allRecords.reduce((sum, p) => sum + p.balanceAmount, 0),
  }

  return { data: inpatients ?? [], stats }
}

export async function getInPatientById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("InPatient")
    .select("*")
    .eq("id", id)
    .single()
  return data
}

export async function createInPatient(data: z.infer<typeof InPatientSchema>) {
  const user = await requireAuth()
  const validated = InPatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const supabase = await createClient()
    const ipNumber = await getNextIPNumber()
    const netAmount = pd.packageAmount - pd.discount
    const totalReceived = pd.paymentRecords?.reduce((s, r) => s + r.amount, 0) ?? 0
    const balanceAmount = netAmount - totalReceived

    // Find OP patient if patientId given
    let opPatientId: string | undefined
    if (pd.patientId) {
      const { data: op } = await supabase
        .from("Patient")
        .select("id")
        .eq("patientId", pd.patientId)
        .single()
      opPatientId = op?.id
    }

    const parseDate = (val: string) => new Date(val.includes("T") ? val : val + "T00:00:00").toISOString()

    const now = new Date().toISOString()
    const { data: ip, error: ipError } = await supabase
      .from("InPatient")
      .insert({
        patientId: opPatientId ?? "",
        ipNumber,
        name: pd.name,
        age: pd.age,
        gender: pd.gender,
        phone: pd.phone,
        address: pd.address ?? null,
        dateOfBirth: pd.dateOfBirth ? parseDate(pd.dateOfBirth) : null,
        guardianName: pd.guardianName ?? null,
        admissionDate: parseDate(pd.admissionDate),
        admissionNotes: pd.admissionNotes ?? null,
        referredBy: pd.referredBy ?? null,
        department: pd.department ?? null,
        doctorNames: JSON.stringify(pd.doctorNames),
        onDutyDoctor: pd.onDutyDoctor ?? null,
        operationName: pd.operationName ?? null,
        operationDate: pd.operationDate ? parseDate(pd.operationDate) : null,
        operationProcedure: pd.operationProcedure ?? null,
        operationDetails: pd.operationDetails ?? null,
        provisionDiagnosis: pd.provisionDiagnosis ?? null,
        packageAmount: pd.packageAmount,
        packageInclusions: pd.packageInclusions ? JSON.stringify(pd.packageInclusions) : null,
        discount: pd.discount,
        netAmount,
        totalReceivedAmount: totalReceived,
        balanceAmount,
        paymentRecords: pd.paymentRecords && pd.paymentRecords.length > 0 ? JSON.stringify(pd.paymentRecords) : null,
        dischargeDate: pd.dischargeDate ? parseDate(pd.dischargeDate) : null,
        status: "ADMITTED",
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()

    if (ipError || !ip) throw ipError

    // Auto-create insurance claim if any payment has amountType "Insurance"
    const hasInsurancePayment = pd.paymentRecords?.some(
      r => r.amountType.toLowerCase() === "insurance"
    )
    if (hasInsurancePayment) {
      try {
        const insurancePayment = pd.paymentRecords?.find(
          r => r.amountType.toLowerCase() === "insurance"
        )
        const insClaimNumber = await getNextInsClaimNumber()
        const initialHistory: InsuranceStatusHistoryEntry[] = [{
          status: "PREAUTH_SUBMITTED",
          date: new Date().toISOString(),
          notes: "Auto-created from inpatient admission (Insurance payment detected)",
          updatedBy: user.fullName,
        }]
        const claimNow = new Date().toISOString()
        await supabase.from("InsuranceClaim").insert({
          claimNumber: insClaimNumber,
          inPatientId: ip.id,
          patientName: pd.name,
          ipNumber: ip.ipNumber,
          age: pd.age,
          gender: pd.gender,
          phone: pd.phone,
          guardianName: pd.guardianName ?? null,
          department: pd.department ?? null,
          doctorNames: JSON.stringify(pd.doctorNames),
          operationName: pd.operationName ?? null,
          provisionDiagnosis: pd.provisionDiagnosis ?? null,
          admissionDate: new Date(pd.admissionDate.includes("T") ? pd.admissionDate : pd.admissionDate + "T00:00:00").toISOString(),
          insuranceCompanyName: insurancePayment?.notes || "TBD",
          packageAmount: pd.packageAmount,
          totalBillAmount: netAmount,
          preauthAmount: insurancePayment?.amount ?? 0,
          totalApprovedAmount: insurancePayment?.amount ?? 0,
          patientPayableAmount: Math.max(0, netAmount - (insurancePayment?.amount ?? 0)),
          patientBalance: Math.max(0, netAmount - (insurancePayment?.amount ?? 0)),
          discount: pd.discount,
          status: "PREAUTH_SUBMITTED",
          preauthSubmittedDate: claimNow,
          statusHistory: JSON.stringify(initialHistory),
          packageInclusions: pd.packageInclusions ? JSON.stringify(pd.packageInclusions) : null,
          createdById: user.id,
          createdAt: claimNow,
          updatedAt: claimNow,
        })
        revalidatePath("/insurance")
      } catch (insError) {
        console.error("Error auto-creating insurance claim:", insError)
        // Don't fail the inpatient creation if insurance claim fails
      }
    }

    revalidatePath("/inpatients")
    return { success: true, data: ip }
  } catch (error) {
    console.error("Error creating inpatient:", error)
    return { success: false, error: "Failed to create inpatient record" }
  }
}

export async function updateInPatientStatus(id: string, status: InPatientStatus) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: ip, error } = await supabase
      .from("InPatient")
      .update({ status, updatedBy: user.id, updatedAt: now })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/inpatients")
    return { success: true, data: ip }
  } catch {
    return { success: false, error: "Failed to update status" }
  }
}

export async function addInPatientPayment(data: {
  inpatientId: string
  amount: number
  paymentMode: string
  amountType: string
  notes?: string
  date?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const { data: ip } = await supabase
      .from("InPatient")
      .select("*")
      .eq("id", data.inpatientId)
      .single()
    if (!ip) return { success: false, error: "InPatient not found" }

    const existing: PaymentRecord[] = ip.paymentRecords ? JSON.parse(ip.paymentRecords) : []
    const newRecord: PaymentRecord = {
      date: data.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
      amountType: data.amountType,
      paymentMode: data.paymentMode,
      amount: data.amount,
      notes: data.notes,
    }
    const updated = [...existing, newRecord]
    const totalReceived = updated.reduce((s, r) => s + r.amount, 0)
    const balance = ip.netAmount - totalReceived

    const now = new Date().toISOString()
    await supabase
      .from("InPatient")
      .update({
        paymentRecords: JSON.stringify(updated),
        totalReceivedAmount: totalReceived,
        balanceAmount: Math.max(0, balance),
        updatedBy: user.id,
        updatedAt: now,
      })
      .eq("id", data.inpatientId)

    // Auto-create insurance claim if this is an insurance payment and no claim exists
    if (data.amountType.toLowerCase() === "insurance") {
      try {
        const { data: existingClaim } = await supabase
          .from("InsuranceClaim")
          .select("id")
          .eq("inPatientId", data.inpatientId)
          .limit(1)
          .single()

        if (!existingClaim) {
          const insClaimNumber = await getNextInsClaimNumber()
          const initialHistory: InsuranceStatusHistoryEntry[] = [{
            status: "PREAUTH_SUBMITTED",
            date: new Date().toISOString(),
            notes: "Auto-created from insurance payment record",
            updatedBy: user.fullName,
          }]
          const claimNow = new Date().toISOString()
          await supabase.from("InsuranceClaim").insert({
            claimNumber: insClaimNumber,
            inPatientId: ip.id,
            patientName: ip.name,
            ipNumber: ip.ipNumber,
            age: ip.age,
            gender: ip.gender,
            phone: ip.phone,
            guardianName: ip.guardianName,
            department: ip.department,
            doctorNames: ip.doctorNames,
            operationName: ip.operationName,
            provisionDiagnosis: ip.provisionDiagnosis,
            admissionDate: ip.admissionDate,
            insuranceCompanyName: data.notes || "TBD",
            packageAmount: ip.packageAmount,
            totalBillAmount: ip.netAmount,
            preauthAmount: data.amount,
            totalApprovedAmount: data.amount,
            patientPayableAmount: Math.max(0, ip.netAmount - data.amount),
            patientBalance: Math.max(0, ip.netAmount - data.amount),
            discount: ip.discount,
            status: "PREAUTH_SUBMITTED",
            preauthSubmittedDate: claimNow,
            statusHistory: JSON.stringify(initialHistory),
            packageInclusions: ip.packageInclusions,
            createdById: user.id,
            createdAt: claimNow,
            updatedAt: claimNow,
          })
          revalidatePath("/insurance")
        }
      } catch (insError) {
        console.error("Error auto-creating insurance claim from payment:", insError)
      }
    }

    revalidatePath("/inpatients")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to add payment" }
  }
}

export async function dischargeInPatient(data: {
  id: string
  dischargeDate: string
  dischargeNotes?: string
  dischargeDiagnosis?: string
  conditionAtDischarge?: string
  dischargeMedications?: string
  followUpInstructions?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const summaryJson = JSON.stringify({
      notes: data.dischargeNotes ?? "",
      diagnosis: data.dischargeDiagnosis ?? "",
      conditionAtDischarge: data.conditionAtDischarge ?? "",
      medications: data.dischargeMedications ?? "",
      followUpInstructions: data.followUpInstructions ?? "",
    })
    const now = new Date().toISOString()
    const { error } = await supabase
      .from("InPatient")
      .update({
        status: "DISCHARGED",
        dischargeDate: new Date(data.dischargeDate).toISOString(),
        dischargeNotes: summaryJson,
        updatedBy: user.id,
        updatedAt: now,
      })
      .eq("id", data.id)
    if (error) throw error
    revalidatePath("/inpatients")
    revalidatePath("/patients")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to discharge patient" }
  }
}

export async function updateInPatientDetails(id: string, data: {
  operationName?: string
  operationDate?: string
  operationProcedure?: string
  operationDetails?: string
  provisionDiagnosis?: string
  medicalValues?: MedicalValues
  prescriptions?: Array<{ medicine: string; days: string; timing: string; note?: string }>
  followUpDate?: string
  onDutyDoctor?: string
  doctorNames?: string[]
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = {
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    }

    if (data.operationName !== undefined) updateData.operationName = data.operationName
    if (data.operationDate !== undefined) updateData.operationDate = new Date(data.operationDate + "T00:00:00").toISOString()
    if (data.operationProcedure !== undefined) updateData.operationProcedure = data.operationProcedure
    if (data.operationDetails !== undefined) updateData.operationDetails = data.operationDetails
    if (data.provisionDiagnosis !== undefined) updateData.provisionDiagnosis = data.provisionDiagnosis
    if (data.medicalValues !== undefined) updateData.medicalValues = JSON.stringify(data.medicalValues)
    if (data.prescriptions !== undefined) updateData.prescriptions = JSON.stringify(data.prescriptions)
    if (data.followUpDate !== undefined) updateData.followUpDate = new Date(data.followUpDate + "T00:00:00").toISOString()
    if (data.onDutyDoctor !== undefined) updateData.onDutyDoctor = data.onDutyDoctor
    if (data.doctorNames !== undefined) updateData.doctorNames = JSON.stringify(data.doctorNames)

    const { error } = await supabase
      .from("InPatient")
      .update(updateData)
      .eq("id", id)
    if (error) throw error
    revalidatePath("/inpatients")
    revalidatePath("/patients")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update details" }
  }
}

// ─── Delete InPatient (Admin only) ───────────────────────────────────────────

export async function deleteInPatient(id: string) {
  const user = await requireAuth()
  if (user.role !== "ADMIN") return { success: false as const, error: "Admin only" }
  const supabase = await createClient()
  try {
    // Delete related insurance claims first
    await supabase.from("InsuranceClaim").delete().eq("inPatientId", id)
    // Delete the inpatient
    const { error } = await supabase.from("InPatient").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/inpatients")
    revalidatePath("/patients")
    revalidatePath("/insurance")
    return { success: true as const }
  } catch (error) {
    console.error("Error deleting inpatient:", error)
    return { success: false as const, error: "Failed to delete inpatient" }
  }
}

// ─── Update InPatient Basic Info ─────────────────────────────────────────────

export async function updateInPatientBasicInfo(id: string, data: {
  name?: string
  age?: number
  gender?: string
  phone?: string
  address?: string
  guardianName?: string
  department?: string
  referredBy?: string
  admissionNotes?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from("InPatient")
      .update({
        ...data,
        updatedBy: user.id,
        updatedAt: now,
      })
      .eq("id", id)
    if (error) throw error
    revalidatePath("/inpatients")
    revalidatePath("/patients")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update inpatient info" }
  }
}

// ─── Update InPatient (full) ────────────────────────────────────────────────

export async function updateInPatient(id: string, data: z.infer<typeof InPatientSchema>) {
  const user = await requireAuth()
  const validated = InPatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const supabase = await createClient()
    const netAmount = pd.packageAmount - pd.discount
    const totalReceived = pd.paymentRecords?.reduce((s, r) => s + r.amount, 0) ?? 0
    const balanceAmount = netAmount - totalReceived

    const parseDate = (val: string) => new Date(val.includes("T") ? val : val + "T00:00:00").toISOString()

    const now = new Date().toISOString()
    const { error } = await supabase
      .from("InPatient")
      .update({
        name: pd.name,
        age: pd.age,
        gender: pd.gender,
        phone: pd.phone,
        address: pd.address ?? null,
        dateOfBirth: pd.dateOfBirth ? parseDate(pd.dateOfBirth) : null,
        guardianName: pd.guardianName ?? null,
        admissionDate: parseDate(pd.admissionDate),
        admissionNotes: pd.admissionNotes ?? null,
        referredBy: pd.referredBy ?? null,
        department: pd.department ?? null,
        doctorNames: JSON.stringify(pd.doctorNames),
        onDutyDoctor: pd.onDutyDoctor ?? null,
        operationName: pd.operationName ?? null,
        operationDate: pd.operationDate ? parseDate(pd.operationDate) : null,
        operationProcedure: pd.operationProcedure ?? null,
        operationDetails: pd.operationDetails ?? null,
        provisionDiagnosis: pd.provisionDiagnosis ?? null,
        packageAmount: pd.packageAmount,
        packageInclusions: pd.packageInclusions ? JSON.stringify(pd.packageInclusions) : null,
        discount: pd.discount,
        netAmount,
        totalReceivedAmount: totalReceived,
        balanceAmount,
        paymentRecords: pd.paymentRecords && pd.paymentRecords.length > 0 ? JSON.stringify(pd.paymentRecords) : null,
        dischargeDate: pd.dischargeDate ? parseDate(pd.dischargeDate) : null,
        updatedBy: user.id,
        updatedAt: now,
      })
      .eq("id", id)
    if (error) throw error

    revalidatePath("/inpatients")
    revalidatePath("/patients")
    return { success: true as const }
  } catch (error) {
    console.error("Error updating inpatient:", error)
    return { success: false as const, error: "Failed to update inpatient record" }
  }
}
