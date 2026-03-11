"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
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
  const last = await db.inPatient.findFirst({
    where: { ipNumber: { startsWith: "IP-" } },
    orderBy: { createdAt: "desc" },
    select: { ipNumber: true },
  })
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
  const { search, statuses, showDischarged, dateFrom, dateTo, doctor, department } = filters

  const where: Record<string, unknown> = {}

  if (!showDischarged) {
    where.status = { not: "DISCHARGED" }
  }

  if (statuses && statuses.length > 0) {
    where.status = { in: statuses }
  }

  if (dateFrom || dateTo) {
    where.admissionDate = {
      ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    }
  }

  if (doctor) {
    where.doctorNames = { contains: doctor }
  }

  if (department) {
    where.department = department
  }

  if (search) {
    where.OR = [
      { ipNumber: { contains: search } },
      { name: { contains: search } },
      { phone: { contains: search } },
      { guardianName: { contains: search } },
      { operationName: { contains: search } },
    ]
  }

  const inpatients = await db.inPatient.findMany({
    where,
    orderBy: { admissionDate: "desc" },
  })

  // Stats
  const all = await db.inPatient.findMany({
    where: { status: { not: "DISCHARGED" } },
    select: { status: true, balanceAmount: true },
  })

  const stats = {
    totalAdmitted: all.length,
    activeInStay: all.filter(p => ["ADMITTED", "PRE_OP", "IN_SURGERY", "POST_OP"].includes(p.status)).length,
    readyToDischarge: all.filter(p => p.status === "READY_FOR_DISCHARGE").length,
    dischargedToday: await db.inPatient.count({
      where: {
        status: "DISCHARGED",
        dischargeDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    totalBalancePending: all.reduce((sum, p) => sum + p.balanceAmount, 0),
  }

  return { data: inpatients, stats }
}

export async function getInPatientById(id: string) {
  return db.inPatient.findUnique({ where: { id } })
}

export async function createInPatient(data: z.infer<typeof InPatientSchema>) {
  const user = await requireAuth()
  const validated = InPatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const ipNumber = await getNextIPNumber()
    const netAmount = pd.packageAmount - pd.discount
    const totalReceived = pd.paymentRecords?.reduce((s, r) => s + r.amount, 0) ?? 0
    const balanceAmount = netAmount - totalReceived

    // Find OP patient if patientId given
    let opPatientId: string | undefined
    if (pd.patientId) {
      const op = await db.patient.findUnique({
        where: { patientId: pd.patientId },
        select: { id: true },
      })
      opPatientId = op?.id
    }

    const parseDate = (val: string) => new Date(val.includes("T") ? val : val + "T00:00:00")

    const ip = await db.inPatient.create({
      data: {
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
      },
    })

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
        await db.insuranceClaim.create({
          data: {
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
            admissionDate: new Date(pd.admissionDate.includes("T") ? pd.admissionDate : pd.admissionDate + "T00:00:00"),
            insuranceCompanyName: insurancePayment?.notes || "TBD",
            packageAmount: pd.packageAmount,
            totalBillAmount: netAmount,
            preauthAmount: insurancePayment?.amount ?? 0,
            totalApprovedAmount: insurancePayment?.amount ?? 0,
            patientPayableAmount: Math.max(0, netAmount - (insurancePayment?.amount ?? 0)),
            patientBalance: Math.max(0, netAmount - (insurancePayment?.amount ?? 0)),
            discount: pd.discount,
            status: "PREAUTH_SUBMITTED",
            preauthSubmittedDate: new Date(),
            statusHistory: JSON.stringify(initialHistory),
            packageInclusions: pd.packageInclusions ? JSON.stringify(pd.packageInclusions) : null,
            createdById: user.id,
          },
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
  try {
    const ip = await db.inPatient.update({
      where: { id },
      data: { status, updatedBy: user.id },
    })
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
  try {
    const ip = await db.inPatient.findUnique({ where: { id: data.inpatientId } })
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

    await db.inPatient.update({
      where: { id: data.inpatientId },
      data: {
        paymentRecords: JSON.stringify(updated),
        totalReceivedAmount: totalReceived,
        balanceAmount: Math.max(0, balance),
        updatedBy: user.id,
      },
    })

    // Auto-create insurance claim if this is an insurance payment and no claim exists
    if (data.amountType.toLowerCase() === "insurance") {
      try {
        const existingClaim = await db.insuranceClaim.findFirst({
          where: { inPatientId: data.inpatientId },
        })
        if (!existingClaim) {
          const insClaimNumber = await getNextInsClaimNumber()
          const initialHistory: InsuranceStatusHistoryEntry[] = [{
            status: "PREAUTH_SUBMITTED",
            date: new Date().toISOString(),
            notes: "Auto-created from insurance payment record",
            updatedBy: user.fullName,
          }]
          await db.insuranceClaim.create({
            data: {
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
              preauthSubmittedDate: new Date(),
              statusHistory: JSON.stringify(initialHistory),
              packageInclusions: ip.packageInclusions,
              createdById: user.id,
            },
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
  try {
    const summaryJson = JSON.stringify({
      notes: data.dischargeNotes ?? "",
      diagnosis: data.dischargeDiagnosis ?? "",
      conditionAtDischarge: data.conditionAtDischarge ?? "",
      medications: data.dischargeMedications ?? "",
      followUpInstructions: data.followUpInstructions ?? "",
    })
    await db.inPatient.update({
      where: { id: data.id },
      data: {
        status: "DISCHARGED",
        dischargeDate: new Date(data.dischargeDate),
        dischargeNotes: summaryJson,
        updatedBy: user.id,
      },
    })
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
  try {
    await db.inPatient.update({
      where: { id },
      data: {
        operationName: data.operationName,
        operationDate: data.operationDate ? new Date(data.operationDate + "T00:00:00") : undefined,
        operationProcedure: data.operationProcedure,
        operationDetails: data.operationDetails,
        provisionDiagnosis: data.provisionDiagnosis,
        medicalValues: data.medicalValues ? JSON.stringify(data.medicalValues) : undefined,
        prescriptions: data.prescriptions ? JSON.stringify(data.prescriptions) : undefined,
        followUpDate: data.followUpDate ? new Date(data.followUpDate + "T00:00:00") : undefined,
        onDutyDoctor: data.onDutyDoctor,
        doctorNames: data.doctorNames ? JSON.stringify(data.doctorNames) : undefined,
        updatedBy: user.id,
      },
    })
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
  try {
    await db.$transaction(async (tx) => {
      // Delete related insurance claims first
      await tx.insuranceClaim.deleteMany({ where: { inPatientId: id } })
      // Delete the inpatient
      await tx.inPatient.delete({ where: { id } })
    })
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
  try {
    await db.inPatient.update({
      where: { id },
      data: {
        ...data,
        updatedBy: user.id,
      },
    })
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
    const netAmount = pd.packageAmount - pd.discount
    const totalReceived = pd.paymentRecords?.reduce((s, r) => s + r.amount, 0) ?? 0
    const balanceAmount = netAmount - totalReceived

    const parseDate = (val: string) => new Date(val.includes("T") ? val : val + "T00:00:00")

    await db.inPatient.update({
      where: { id },
      data: {
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
      },
    })

    revalidatePath("/inpatients")
    revalidatePath("/patients")
    return { success: true as const }
  } catch (error) {
    console.error("Error updating inpatient:", error)
    return { success: false as const, error: "Failed to update inpatient record" }
  }
}
