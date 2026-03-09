"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"
import { getNextInsClaimNumber } from "@/lib/id-generators"
import type { InsuranceClaimStatus, InsuranceStatusHistoryEntry } from "@/lib/types"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const InsuranceClaimSchema = z.object({
  inPatientId: z.string().min(1, "InPatient required"),
  insuranceCompanyId: z.string().optional(),
  insuranceCompanyName: z.string().min(1, "Insurance company required"),
  tpaName: z.string().optional(),
  policyNumber: z.string().optional(),
  policyHolderName: z.string().optional(),
  insuranceCardNumber: z.string().optional(),
  relationToInsured: z.string().optional(),
  preauthAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
})

const InsuranceCompanySchema = z.object({
  name: z.string().min(1, "Company name required"),
  tpaName: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
})

// ─── Insurance Company CRUD ──────────────────────────────────────────────────

export async function getInsuranceCompanies() {
  return db.insuranceCompany.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })
}

export async function getAllInsuranceCompanies() {
  return db.insuranceCompany.findMany({ orderBy: { name: "asc" } })
}

export async function createInsuranceCompany(data: z.infer<typeof InsuranceCompanySchema>) {
  const validated = InsuranceCompanySchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }
  try {
    const company = await db.insuranceCompany.create({ data: validated.data })
    revalidatePath("/insurance")
    return { success: true as const, data: company }
  } catch {
    return { success: false as const, error: "Company name may already exist" }
  }
}

export async function updateInsuranceCompany(id: string, data: z.infer<typeof InsuranceCompanySchema> & { isActive?: boolean }) {
  try {
    const company = await db.insuranceCompany.update({
      where: { id },
      data: {
        name: data.name,
        tpaName: data.tpaName ?? null,
        contactNumber: data.contactNumber ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        isActive: data.isActive,
      },
    })
    revalidatePath("/insurance")
    return { success: true as const, data: company }
  } catch {
    return { success: false as const, error: "Failed to update company" }
  }
}

export async function deleteInsuranceCompany(id: string) {
  try {
    await db.insuranceCompany.update({ where: { id }, data: { isActive: false } })
    revalidatePath("/insurance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete company" }
  }
}

// ─── Insurance Claims ────────────────────────────────────────────────────────

export async function getInsuranceClaims(filters: {
  search?: string
  statuses?: string[]
  insuranceCompany?: string
  dateFrom?: string
  dateTo?: string
  showClosed?: boolean
}) {
  const { search, statuses, insuranceCompany, dateFrom, dateTo, showClosed } = filters
  const where: Record<string, unknown> = {}

  if (!showClosed) {
    where.status = { notIn: ["CLOSED"] }
  }

  if (statuses && statuses.length > 0) {
    where.status = { in: statuses }
  }

  if (insuranceCompany) {
    where.insuranceCompanyName = insuranceCompany
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    }
  }

  if (search) {
    where.OR = [
      { claimNumber: { contains: search, mode: "insensitive" } },
      { patientName: { contains: search, mode: "insensitive" } },
      { ipNumber: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { insuranceCompanyName: { contains: search, mode: "insensitive" } },
    ]
  }

  const claims = await db.insuranceClaim.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  // Stats
  const all = await db.insuranceClaim.findMany({
    where: { status: { notIn: ["CLOSED"] } },
    select: {
      status: true,
      totalApprovedAmount: true,
      finalSettledAmount: true,
      patientBalance: true,
      createdAt: true,
    },
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const stats = {
    totalClaims: all.length,
    preauthPending: all.filter(c => ["PREAUTH_SUBMITTED", "PREAUTH_QUERY"].includes(c.status)).length,
    enhancementPending: all.filter(c => ["ENHANCEMENT_CLAIMED", "ENHANCEMENT_QUERY"].includes(c.status)).length,
    settlementPending: all.filter(c => c.status === "FINAL_BILL_SUBMITTED").length,
    totalApprovedAmount: all.reduce((s, c) => s + c.totalApprovedAmount, 0),
    totalSettledAmount: all.reduce((s, c) => s + c.finalSettledAmount, 0),
    totalPatientPending: all.reduce((s, c) => s + c.patientBalance, 0),
    claimsThisMonth: all.filter(c => c.createdAt >= monthStart).length,
  }

  return { data: claims, stats }
}

export async function getInsuranceClaimById(id: string) {
  return db.insuranceClaim.findUnique({ where: { id } })
}

export async function createInsuranceClaim(data: z.infer<typeof InsuranceClaimSchema>) {
  const user = await requireAuth()
  const validated = InsuranceClaimSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const ip = await db.inPatient.findUnique({ where: { id: pd.inPatientId } })
    if (!ip) return { success: false as const, error: "InPatient not found" }

    const claimNumber = await getNextInsClaimNumber()
    const totalBillAmount = ip.netAmount
    const patientPayable = totalBillAmount - pd.preauthAmount

    const initialHistory: InsuranceStatusHistoryEntry[] = [{
      status: "PREAUTH_SUBMITTED",
      date: new Date().toISOString(),
      notes: "Claim created",
      updatedBy: user.fullName,
    }]

    const claim = await db.insuranceClaim.create({
      data: {
        claimNumber,
        inPatientId: ip.id,
        insuranceCompanyId: pd.insuranceCompanyId ?? null,
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
        dischargeDate: ip.dischargeDate,
        insuranceCompanyName: pd.insuranceCompanyName,
        tpaName: pd.tpaName ?? null,
        policyNumber: pd.policyNumber ?? null,
        policyHolderName: pd.policyHolderName ?? null,
        insuranceCardNumber: pd.insuranceCardNumber ?? null,
        relationToInsured: pd.relationToInsured ?? null,
        packageAmount: ip.packageAmount,
        totalBillAmount,
        preauthAmount: pd.preauthAmount,
        totalApprovedAmount: pd.preauthAmount,
        patientPayableAmount: Math.max(0, patientPayable),
        patientBalance: Math.max(0, patientPayable),
        discount: ip.discount,
        status: "PREAUTH_SUBMITTED",
        preauthSubmittedDate: new Date(),
        statusHistory: JSON.stringify(initialHistory),
        notes: pd.notes ?? null,
        packageInclusions: ip.packageInclusions,
        createdById: user.id,
      },
    })

    revalidatePath("/insurance")
    revalidatePath("/inpatients")
    return { success: true as const, data: claim }
  } catch (error) {
    console.error("Error creating insurance claim:", error)
    return { success: false as const, error: "Failed to create insurance claim" }
  }
}

export async function updateInsuranceClaimStatus(
  id: string,
  newStatus: InsuranceClaimStatus,
  data: {
    notes?: string
    amount?: number
    rejectionReason?: string
    settlementReference?: string
    deductions?: number
  }
) {
  const user = await requireAuth()
  try {
    const claim = await db.insuranceClaim.findUnique({ where: { id } })
    if (!claim) return { success: false as const, error: "Claim not found" }

    const history: InsuranceStatusHistoryEntry[] = claim.statusHistory
      ? JSON.parse(claim.statusHistory)
      : []

    history.push({
      status: newStatus,
      date: new Date().toISOString(),
      notes: data.notes,
      updatedBy: user.fullName,
    })

    const updateData: Record<string, unknown> = {
      status: newStatus,
      statusHistory: JSON.stringify(history),
      updatedBy: user.id,
    }

    switch (newStatus) {
      case "PREAUTH_QUERY":
        updateData.preauthQueryNotes = data.notes ?? null
        break
      case "PREAUTH_APPROVED":
        updateData.preauthApprovedDate = new Date()
        if (data.amount !== undefined) {
          updateData.preauthAmount = data.amount
          updateData.totalApprovedAmount = data.amount + claim.enhancementApproved
          updateData.patientPayableAmount = Math.max(0, claim.totalBillAmount - data.amount - claim.enhancementApproved - claim.discount)
          updateData.patientBalance = Math.max(0, claim.totalBillAmount - data.amount - claim.enhancementApproved - claim.discount - claim.patientPaidAmount)
        }
        break
      case "PREAUTH_REJECTED":
        updateData.preauthRejectionReason = data.rejectionReason ?? data.notes ?? null
        break
      case "ENHANCEMENT_CLAIMED":
        updateData.enhancementClaimedDate = new Date()
        if (data.amount !== undefined) {
          updateData.enhancementAmount = data.amount
        }
        break
      case "ENHANCEMENT_QUERY":
        updateData.enhancementQueryNotes = data.notes ?? null
        break
      case "ENHANCEMENT_APPROVED":
        updateData.enhancementApprovedDate = new Date()
        if (data.amount !== undefined) {
          updateData.enhancementApproved = data.amount
          updateData.totalApprovedAmount = claim.preauthAmount + data.amount
          updateData.patientPayableAmount = Math.max(0, claim.totalBillAmount - claim.preauthAmount - data.amount - claim.discount)
          updateData.patientBalance = Math.max(0, claim.totalBillAmount - claim.preauthAmount - data.amount - claim.discount - claim.patientPaidAmount)
        }
        break
      case "ENHANCEMENT_REJECTED":
        updateData.enhancementRejectionReason = data.rejectionReason ?? data.notes ?? null
        break
      case "FINAL_BILL_SUBMITTED":
        updateData.finalBillSubmittedDate = new Date()
        break
      case "SETTLED":
      case "PARTIALLY_SETTLED": {
        updateData.settlementDate = new Date()
        updateData.settlementReference = data.settlementReference ?? null
        const settled = data.amount ?? claim.totalApprovedAmount
        const ded = data.deductions ?? 0
        updateData.finalSettledAmount = settled
        updateData.deductions = ded
        updateData.patientPayableAmount = Math.max(0, claim.totalBillAmount - settled - claim.discount)
        updateData.patientBalance = Math.max(0, claim.totalBillAmount - settled - claim.discount - claim.patientPaidAmount)

        // Update linked inpatient balance to reflect insurance settlement
        if (claim.inPatientId) {
          const ip = await db.inPatient.findUnique({ where: { id: claim.inPatientId } })
          if (ip) {
            const newTotalReceived = ip.totalReceivedAmount + settled
            const newBalance = Math.max(0, ip.netAmount - newTotalReceived)
            await db.inPatient.update({
              where: { id: claim.inPatientId },
              data: {
                totalReceivedAmount: newTotalReceived,
                balanceAmount: newBalance,
              },
            })
            revalidatePath("/inpatients")
          }
        }
        break
      }
      case "CLAIM_REJECTED":
        updateData.patientPayableAmount = claim.totalBillAmount - claim.discount
        updateData.patientBalance = Math.max(0, claim.totalBillAmount - claim.discount - claim.patientPaidAmount)
        break
    }

    await db.insuranceClaim.update({ where: { id }, data: updateData })
    revalidatePath("/insurance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}

export async function updateInsuranceClaimDetails(id: string, data: {
  insuranceCompanyName?: string
  insuranceCompanyId?: string
  tpaName?: string
  policyNumber?: string
  policyHolderName?: string
  insuranceCardNumber?: string
  relationToInsured?: string
  totalBillAmount?: number
  notes?: string
}) {
  const user = await requireAuth()
  try {
    await db.insuranceClaim.update({
      where: { id },
      data: {
        ...data,
        updatedBy: user.id,
      },
    })
    revalidatePath("/insurance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update claim details" }
  }
}

export async function addInsurancePatientPayment(data: {
  claimId: string
  amount: number
  paymentMode: string
  notes?: string
}) {
  const user = await requireAuth()
  try {
    const claim = await db.insuranceClaim.findUnique({ where: { id: data.claimId } })
    if (!claim) return { success: false as const, error: "Claim not found" }

    const newPaid = claim.patientPaidAmount + data.amount
    const newBalance = Math.max(0, claim.patientPayableAmount - newPaid)

    const history: InsuranceStatusHistoryEntry[] = claim.statusHistory
      ? JSON.parse(claim.statusHistory)
      : []

    history.push({
      status: claim.status as InsuranceClaimStatus,
      date: new Date().toISOString(),
      notes: `Patient payment: ₹${data.amount} via ${data.paymentMode}${data.notes ? ` - ${data.notes}` : ""}`,
      updatedBy: user.fullName,
    })

    await db.insuranceClaim.update({
      where: { id: data.claimId },
      data: {
        patientPaidAmount: newPaid,
        patientBalance: newBalance,
        statusHistory: JSON.stringify(history),
        updatedBy: user.id,
      },
    })

    // Update linked inpatient balance to reflect patient payment
    if (claim.inPatientId) {
      const ip = await db.inPatient.findUnique({ where: { id: claim.inPatientId } })
      if (ip) {
        const newTotalReceived = ip.totalReceivedAmount + data.amount
        const newIpBalance = Math.max(0, ip.netAmount - newTotalReceived)
        await db.inPatient.update({
          where: { id: claim.inPatientId },
          data: {
            totalReceivedAmount: newTotalReceived,
            balanceAmount: newIpBalance,
          },
        })
        revalidatePath("/inpatients")
      }
    }

    revalidatePath("/insurance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to record payment" }
  }
}

// Search inpatients for claim form
export async function searchInPatientsForInsurance(search: string) {
  if (!search || search.length < 2) return []
  return db.inPatient.findMany({
    where: {
      OR: [
        { ipNumber: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    },
    select: {
      id: true,
      ipNumber: true,
      name: true,
      age: true,
      gender: true,
      phone: true,
      department: true,
      packageAmount: true,
      netAmount: true,
      admissionDate: true,
      operationName: true,
    },
    take: 10,
    orderBy: { admissionDate: "desc" },
  })
}
