"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"
import { z } from "zod"
import { getNextInsClaimNumber } from "@/lib/id-generators"
import type { InsuranceClaimStatus, InsuranceStatusHistoryEntry, PaymentRecord } from "@/lib/types"

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
  await requireServerPermission("insurance:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("InsuranceCompany")
    .select("*")
    .eq("isActive", true)
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function getAllInsuranceCompanies() {
  await requireServerPermission("insurance:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("InsuranceCompany")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function createInsuranceCompany(data: z.infer<typeof InsuranceCompanySchema>) {
  await requireServerPermission("insurance:create")
  const validated = InsuranceCompanySchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: company, error } = await supabase
      .from("InsuranceCompany")
      .insert({ ...validated.data, createdAt: now, updatedAt: now })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/insurance")
    return { success: true as const, data: company }
  } catch {
    return { success: false as const, error: "Company name may already exist" }
  }
}

export async function updateInsuranceCompany(id: string, data: z.infer<typeof InsuranceCompanySchema> & { isActive?: boolean }) {
  await requireServerPermission("insurance:edit")
  try {
    const supabase = await createClient()
    const { data: company, error } = await supabase
      .from("InsuranceCompany")
      .update({
        name: data.name,
        tpaName: data.tpaName ?? null,
        contactNumber: data.contactNumber ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        isActive: data.isActive,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/insurance")
    return { success: true as const, data: company }
  } catch {
    return { success: false as const, error: "Failed to update company" }
  }
}

export async function deleteInsuranceCompany(id: string) {
  await requireServerPermission("insurance:edit")
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("InsuranceCompany")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
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
  await requireServerPermission("insurance:view")
  const { search, statuses, insuranceCompany, dateFrom, dateTo, showClosed } = filters
  const supabase = await createClient()

  // Narrow select to the columns the list view actually displays. The detail
  // view (InsuranceClaimDetail) re-fetches by id via getInsuranceClaimById,
  // so it always gets the full row including the heavy JSON/text columns
  // (statusHistory, notes, packageInclusions, rejection/query notes, etc.).
  // Note: single string literal — Supabase's TS infers row type from it.
  let query = supabase
    .from("InsuranceClaim")
    .select("id, claimNumber, patientName, ipNumber, insuranceCompanyName, tpaName, totalBillAmount, preauthAmount, enhancementApproved, totalApprovedAmount, finalSettledAmount, patientBalance, status, createdAt")

  if (!showClosed) {
    query = query.neq("status", "CLOSED")
  }

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses)
  }

  if (insuranceCompany) {
    query = query.eq("insuranceCompanyName", insuranceCompany)
  }

  if (dateFrom) {
    query = query.gte("createdAt", dateFrom + "T00:00:00")
  }
  if (dateTo) {
    query = query.lte("createdAt", dateTo + "T23:59:59")
  }

  if (search) {
    query = query.or(
      `claimNumber.ilike.%${search}%,patientName.ilike.%${search}%,ipNumber.ilike.%${search}%,phone.like.%${search}%,insuranceCompanyName.ilike.%${search}%`
    )
  }

  query = query.order("createdAt", { ascending: false })

  const { data: claims, error: claimsError } = await query
  if (claimsError) throw claimsError

  // Stats
  const { data: all, error: statsError } = await supabase
    .from("InsuranceClaim")
    .select("status, totalApprovedAmount, finalSettledAmount, patientBalance, createdAt")
    .neq("status", "CLOSED")
  if (statsError) throw statsError

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
    claimsThisMonth: all.filter(c => new Date(c.createdAt) >= monthStart).length,
  }

  return { data: claims, stats }
}

export async function getInsuranceClaimById(id: string) {
  await requireServerPermission("insurance:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("InsuranceClaim")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  return data
}

export async function createInsuranceClaim(data: z.infer<typeof InsuranceClaimSchema>) {
  const user = await requireServerPermission("insurance:create")
  const validated = InsuranceClaimSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const supabase = await createClient()
    const { data: ip, error: ipError } = await supabase
      .from("InPatient")
      .select("*")
      .eq("id", pd.inPatientId)
      .single()
    if (ipError || !ip) return { success: false as const, error: "InPatient not found" }

    const claimNumber = await getNextInsClaimNumber()
    const totalBillAmount = ip.netAmount
    const alreadyPaid = ip.totalReceivedAmount ?? 0
    const patientPayable = totalBillAmount - pd.preauthAmount

    const initialHistory: InsuranceStatusHistoryEntry[] = [{
      status: "PREAUTH_SUBMITTED",
      date: new Date().toISOString(),
      notes: "Claim created",
      updatedBy: user.fullName,
    }]

    const now = new Date().toISOString()
    const { data: claim, error: createError } = await supabase
      .from("InsuranceClaim")
      .insert({
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
        patientPaidAmount: alreadyPaid,
        patientBalance: Math.max(0, patientPayable - alreadyPaid),
        discount: ip.discount,
        status: "PREAUTH_SUBMITTED",
        preauthSubmittedDate: now,
        statusHistory: JSON.stringify(initialHistory),
        notes: pd.notes ?? null,
        packageInclusions: ip.packageInclusions,
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (createError) throw createError

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
  const user = await requireServerPermission("insurance:edit")
  try {
    const supabase = await createClient()
    const { data: claim, error: fetchError } = await supabase
      .from("InsuranceClaim")
      .select("*")
      .eq("id", id)
      .single()
    if (fetchError || !claim) return { success: false as const, error: "Claim not found" }

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
      updatedAt: new Date().toISOString(),
    }

    switch (newStatus) {
      case "PREAUTH_QUERY":
        updateData.preauthQueryNotes = data.notes ?? null
        break
      case "PREAUTH_APPROVED":
        updateData.preauthApprovedDate = new Date().toISOString()
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
        updateData.enhancementClaimedDate = new Date().toISOString()
        if (data.amount !== undefined) {
          updateData.enhancementAmount = data.amount
        }
        break
      case "ENHANCEMENT_QUERY":
        updateData.enhancementQueryNotes = data.notes ?? null
        break
      case "ENHANCEMENT_APPROVED":
        updateData.enhancementApprovedDate = new Date().toISOString()
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
        updateData.finalBillSubmittedDate = new Date().toISOString()
        break
      case "SETTLED":
      case "PARTIALLY_SETTLED": {
        updateData.settlementDate = new Date().toISOString()
        updateData.settlementReference = data.settlementReference ?? null
        const settled = data.amount ?? claim.totalApprovedAmount
        const ded = data.deductions ?? 0
        updateData.finalSettledAmount = settled
        updateData.deductions = ded
        updateData.patientPayableAmount = Math.max(0, claim.totalBillAmount - settled - claim.discount)
        updateData.patientBalance = Math.max(0, claim.totalBillAmount - settled - claim.discount - claim.patientPaidAmount)

        // Update linked inpatient: add settlement as a payment record so future
        // recomputes (e.g. addInPatientPayment) don't erase the insurance amount.
        if (claim.inPatientId) {
          const { data: ip } = await supabase
            .from("InPatient")
            .select("*")
            .eq("id", claim.inPatientId)
            .single()
          if (ip) {
            const existing: PaymentRecord[] = ip.paymentRecords ? JSON.parse(ip.paymentRecords) : []
            // Replace any prior Insurance settlement record to avoid double-counting on re-settlement
            const withoutPrior = existing.filter(r => r.amountType !== "Insurance")
            const settlementRecord: PaymentRecord = {
              date: new Date().toISOString().slice(0, 10),
              amountType: "Insurance",
              paymentMode: "Insurance",
              amount: settled,
              notes: `Insurance settlement${data.settlementReference ? ` (Ref: ${data.settlementReference})` : ""}`,
            }
            const updatedRecords = [...withoutPrior, settlementRecord]
            const newTotalReceived = updatedRecords.reduce((s, r) => s + r.amount, 0)
            const newBalance = Math.max(0, ip.netAmount - newTotalReceived)
            await supabase
              .from("InPatient")
              .update({
                paymentRecords: JSON.stringify(updatedRecords),
                totalReceivedAmount: newTotalReceived,
                balanceAmount: newBalance,
                updatedAt: new Date().toISOString(),
              })
              .eq("id", claim.inPatientId)
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

    const { error: updateError } = await supabase
      .from("InsuranceClaim")
      .update(updateData)
      .eq("id", id)
    if (updateError) throw updateError
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
  const user = await requireServerPermission("insurance:edit")
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("InsuranceClaim")
      .update({
        ...data,
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
    if (error) throw error
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
  const user = await requireServerPermission("insurance:edit")
  try {
    const supabase = await createClient()
    const { data: claim, error: fetchError } = await supabase
      .from("InsuranceClaim")
      .select("*")
      .eq("id", data.claimId)
      .single()
    if (fetchError || !claim) return { success: false as const, error: "Claim not found" }

    const now = new Date().toISOString()
    const history: InsuranceStatusHistoryEntry[] = claim.statusHistory
      ? JSON.parse(claim.statusHistory)
      : []

    history.push({
      status: claim.status as InsuranceClaimStatus,
      date: now,
      notes: `Patient payment: ₹${data.amount} via ${data.paymentMode}${data.notes ? ` - ${data.notes}` : ""}`,
      updatedBy: user.fullName,
    })

    // Write to InPatient first so we can compute the authoritative total.
    // paymentRecords is the single source of truth — both balance fields
    // are derived from it so they never drift apart.
    let patientCashPaid = claim.patientPaidAmount + data.amount // safe fallback
    if (claim.inPatientId) {
      const { data: ip } = await supabase
        .from("InPatient")
        .select("*")
        .eq("id", claim.inPatientId)
        .single()
      if (ip) {
        const existing = ip.paymentRecords ? JSON.parse(ip.paymentRecords) : []
        const newRecord = {
          date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
          amountType: "Cash",
          paymentMode: data.paymentMode,
          amount: data.amount,
          notes: data.notes ?? null,
        }
        const updatedRecords = [...existing, newRecord]
        const newTotalReceived = updatedRecords.reduce((s: number, r: { amount: number }) => s + r.amount, 0)
        const newIpBalance = Math.max(0, ip.netAmount - newTotalReceived)
        await supabase
          .from("InPatient")
          .update({
            paymentRecords: JSON.stringify(updatedRecords),
            totalReceivedAmount: newTotalReceived,
            balanceAmount: newIpBalance,
            updatedAt: now,
          })
          .eq("id", claim.inPatientId)
        revalidatePath("/inpatients")
        revalidatePath("/patients")
        // Recompute from updated records so claim gets the authoritative value
        patientCashPaid = updatedRecords
          .filter((r: { amountType: string }) => r.amountType.toLowerCase() !== "insurance")
          .reduce((s: number, r: { amount: number }) => s + r.amount, 0)
      }
    }

    const newBalance = Math.max(0, claim.patientPayableAmount - patientCashPaid)
    const { error: updateError } = await supabase
      .from("InsuranceClaim")
      .update({
        patientPaidAmount: patientCashPaid,
        patientBalance: newBalance,
        statusHistory: JSON.stringify(history),
        updatedBy: user.id,
        updatedAt: now,
      })
      .eq("id", data.claimId)
    if (updateError) throw updateError

    revalidatePath("/insurance")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to record payment" }
  }
}

// Search inpatients for claim form
export async function searchInPatientsForInsurance(search: string) {
  await requireServerPermission("insurance:view")
  if (!search || search.length < 2) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("InPatient")
    .select("id, ipNumber, name, age, gender, phone, department, packageAmount, netAmount, admissionDate, operationName")
    .or(`ipNumber.ilike.%${search}%,name.ilike.%${search}%,phone.like.%${search}%`)
    .order("admissionDate", { ascending: false })
    .limit(10)
  if (error) throw error
  return data
}
