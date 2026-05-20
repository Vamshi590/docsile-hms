"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"
import {
  parseDefaultPrintConfig,
  validateDefaultPrintConfig,
  mergeDefaultPrintIntoSettings,
  type DefaultPrintConfig,
  EMPTY_DEFAULT_PRINT_CONFIG,
} from "@/lib/default-print"

// ─── Service Templates ────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().min(1, "Name required"),
  category: z.string().min(1, "Category required"),
  description: z.string().optional(),
  amount: z.number().min(0),
  discount: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
})

export async function getServiceTemplates(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase
    .from("ServiceTemplate")
    .select("*")
    .order("category", { ascending: true })
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  if (!includeInactive) query = query.eq("isActive", true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createServiceTemplate(data: z.infer<typeof ServiceSchema>) {
  const user = await requireAuth()
  const supabase = await createClient()
  const validated = ServiceSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }
  try {
    const now = new Date().toISOString()
    const { data: svc, error } = await supabase
      .from("ServiceTemplate")
      .insert({
        name: validated.data.name,
        category: validated.data.category,
        description: validated.data.description ?? null,
        amount: validated.data.amount,
        discount: validated.data.discount ?? 0,
        sortOrder: validated.data.sortOrder ?? 0,
        isActive: true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: svc }
  } catch {
    return { success: false, error: "Failed to create service template" }
  }
}

export async function updateServiceTemplate(id: string, data: Partial<z.infer<typeof ServiceSchema>> & { isActive?: boolean }) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined) updateData.name = data.name
    if (data.category !== undefined) updateData.category = data.category
    if (data.description !== undefined) updateData.description = data.description
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.discount !== undefined) updateData.discount = data.discount
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const { data: svc, error } = await supabase
      .from("ServiceTemplate")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: svc }
  } catch {
    return { success: false, error: "Failed to update service template" }
  }
}

export async function deleteServiceTemplate(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("ServiceTemplate").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete service" }
  }
}

// ─── Hospital Profile ─────────────────────────────────────────────────────────

export async function getHospitalProfile() {
  const supabase = await createClient()
  const { data } = await supabase.from("HospitalProfile").select("*").limit(1).single()
  return data
}

export async function updateHospitalProfile(data: {
  name?: string
  displayName?: string
  phone?: string
  email?: string
  website?: string
  registrationNo?: string
  gstin?: string
  registrationFeeEnabled?: boolean
  registrationFeeAmount?: number
  registrationFeeDefaultChecked?: boolean
}) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: existing } = await supabase.from("HospitalProfile").select("id").limit(1).single()
    if (!existing) {
      await supabase.from("HospitalProfile").insert({
        name: data.name ?? "My Hospital",
        displayName: data.displayName ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        registrationNo: data.registrationNo ?? null,
        gstin: data.gstin ?? null,
        registrationFeeEnabled: data.registrationFeeEnabled ?? false,
        registrationFeeAmount: data.registrationFeeAmount ?? 0,
        registrationFeeDefaultChecked: data.registrationFeeDefaultChecked ?? true,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      const updateData: Record<string, unknown> = { updatedAt: now }
      if (data.name !== undefined) updateData.name = data.name
      if (data.displayName !== undefined) updateData.displayName = data.displayName
      if (data.phone !== undefined) updateData.phone = data.phone
      if (data.email !== undefined) updateData.email = data.email
      if (data.website !== undefined) updateData.website = data.website
      if (data.registrationNo !== undefined) updateData.registrationNo = data.registrationNo
      if (data.gstin !== undefined) updateData.gstin = data.gstin
      if (data.registrationFeeEnabled !== undefined) updateData.registrationFeeEnabled = data.registrationFeeEnabled
      if (data.registrationFeeAmount !== undefined) updateData.registrationFeeAmount = data.registrationFeeAmount
      if (data.registrationFeeDefaultChecked !== undefined) updateData.registrationFeeDefaultChecked = data.registrationFeeDefaultChecked
      await supabase.from("HospitalProfile").update(updateData).eq("id", existing.id)
    }
    const { invalidateHospitalCache } = await import("@/lib/db")
    invalidateHospitalCache()
    revalidatePath("/settings")
    revalidatePath("/")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update hospital profile" }
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("User")
    .select("id, email, fullName, phone, role, department, designation, isActive, lastLogin, createdAt")
    .order("fullName", { ascending: true })
  if (error) throw error
  return data
}

export async function createUser(data: {
  email: string
  password: string
  fullName: string
  role: string
  phone?: string
  department?: string
  designation?: string
}) {
  await requireAuth()
  const supabase = await createClient()
  try {
    // Check if email exists
    const { data: existing } = await supabase.from("User").select("id").eq("email", data.email).single()
    if (existing) return { success: false, error: "Email already registered" }

    // Create auth user via Supabase Auth (admin API)
    const { createServiceClient } = await import("@/lib/supabase/server")
    const adminSupabase = await createServiceClient()
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    })
    if (authError) throw authError

    const now = new Date().toISOString()
    await supabase.from("User").insert({
      id: authData.user.id,
      email: data.email,
      passwordHash: "supabase-auth",
      fullName: data.fullName,
      role: data.role,
      phone: data.phone ?? null,
      department: data.department ?? null,
      designation: data.designation ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    revalidatePath("/settings")
    return { success: true, data: { id: authData.user.id, email: data.email, fullName: data.fullName } }
  } catch {
    return { success: false, error: "Failed to create user" }
  }
}

export async function toggleUserActive(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { data: user } = await supabase.from("User").select("isActive").eq("id", id).single()
    if (!user) return { success: false, error: "User not found" }
    await supabase.from("User").update({ isActive: !user.isActive, updatedAt: new Date().toISOString() }).eq("id", id)
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to toggle user status" }
  }
}

// ─── Prescription Templates ───────────────────────────────────────────────────

export async function getPrescriptionTemplates(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase.from("PredefinedTemplate").select("*").order("code", { ascending: true })
  if (!includeInactive) query = query.eq("isActive", true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPrescriptionTemplate(data: {
  code: string
  name: string
  presentComplaint?: string
  previousHistory?: string
  provisionalDiagnosis?: string
  medicines: string
  investigations: string
  followUpDays?: number
  additionalNotes?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const code = data.code.trim().toUpperCase()
    const { data: existing } = await supabase.from("PredefinedTemplate").select("id").eq("code", code).single()
    if (existing) return { success: false, error: "Template code already exists" }

    const now = new Date().toISOString()
    const { data: tmpl, error } = await supabase
      .from("PredefinedTemplate")
      .insert({
        code,
        name: data.name.trim(),
        presentComplaint: data.presentComplaint?.trim() || null,
        previousHistory: data.previousHistory?.trim() || null,
        provisionalDiagnosis: data.provisionalDiagnosis?.trim() || null,
        medicines: data.medicines,
        investigations: data.investigations,
        followUpDays: data.followUpDays ?? null,
        additionalNotes: data.additionalNotes?.trim() || null,
        isActive: true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: tmpl }
  } catch {
    return { success: false, error: "Failed to create prescription template" }
  }
}

export async function updatePrescriptionTemplate(
  id: string,
  data: {
    code?: string
    name?: string
    presentComplaint?: string
    previousHistory?: string
    provisionalDiagnosis?: string
    medicines?: string
    investigations?: string
    followUpDays?: number | null
    additionalNotes?: string
    isActive?: boolean
  }
) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase()
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.presentComplaint !== undefined) updateData.presentComplaint = data.presentComplaint.trim() || null
    if (data.previousHistory !== undefined) updateData.previousHistory = data.previousHistory.trim() || null
    if (data.provisionalDiagnosis !== undefined) updateData.provisionalDiagnosis = data.provisionalDiagnosis.trim() || null
    if (data.medicines !== undefined) updateData.medicines = data.medicines
    if (data.investigations !== undefined) updateData.investigations = data.investigations
    if (data.followUpDays !== undefined) updateData.followUpDays = data.followUpDays
    if (data.additionalNotes !== undefined) updateData.additionalNotes = data.additionalNotes.trim() || null
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const { data: tmpl, error } = await supabase
      .from("PredefinedTemplate")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: tmpl }
  } catch {
    return { success: false, error: "Failed to update prescription template" }
  }
}

export async function deletePrescriptionTemplate(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("PredefinedTemplate").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete prescription template" }
  }
}

// ─── Inpatient Templates ──────────────────────────────────────────────────────

export async function getInpatientTemplates(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase.from("InpatientTemplate").select("*").order("code", { ascending: true })
  if (!includeInactive) query = query.eq("isActive", true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createInpatientTemplate(data: {
  code: string
  name: string
  operationName?: string
  provisionDiagnosis?: string
  medicines: string
  followUpDays?: number
  additionalNotes?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const code = data.code.trim().toUpperCase()
    const { data: existing } = await supabase.from("InpatientTemplate").select("id").eq("code", code).single()
    if (existing) return { success: false, error: "Template code already exists" }

    const now = new Date().toISOString()
    const { data: tmpl, error } = await supabase
      .from("InpatientTemplate")
      .insert({
        code,
        name: data.name.trim(),
        operationName: data.operationName?.trim() || null,
        provisionDiagnosis: data.provisionDiagnosis?.trim() || null,
        medicines: data.medicines,
        followUpDays: data.followUpDays ?? null,
        additionalNotes: data.additionalNotes?.trim() || null,
        isActive: true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: tmpl }
  } catch {
    return { success: false, error: "Failed to create inpatient template" }
  }
}

export async function updateInpatientTemplate(
  id: string,
  data: {
    code?: string
    name?: string
    operationName?: string
    provisionDiagnosis?: string
    medicines?: string
    followUpDays?: number | null
    additionalNotes?: string
    isActive?: boolean
  }
) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase()
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.operationName !== undefined) updateData.operationName = data.operationName.trim() || null
    if (data.provisionDiagnosis !== undefined) updateData.provisionDiagnosis = data.provisionDiagnosis.trim() || null
    if (data.medicines !== undefined) updateData.medicines = data.medicines
    if (data.followUpDays !== undefined) updateData.followUpDays = data.followUpDays
    if (data.additionalNotes !== undefined) updateData.additionalNotes = data.additionalNotes.trim() || null
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const { data: tmpl, error } = await supabase
      .from("InpatientTemplate")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: tmpl }
  } catch {
    return { success: false, error: "Failed to update inpatient template" }
  }
}

export async function deleteInpatientTemplate(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("InpatientTemplate").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete inpatient template" }
  }
}

// ─── Predefined Packages ─────────────────────────────────────────────────────

export async function getPredefinedPackages(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase.from("PredefinedPackage").select("*").order("name", { ascending: true })
  if (!includeInactive) query = query.eq("isActive", true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPredefinedPackage(data: {
  name: string
  inclusions: string
  totalAmount: number
  discount: number
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const { data: existing } = await supabase.from("PredefinedPackage").select("id").eq("name", data.name.trim()).single()
    if (existing) return { success: false, error: "Package name already exists" }

    const now = new Date().toISOString()
    const { data: pkg, error } = await supabase
      .from("PredefinedPackage")
      .insert({
        name: data.name.trim(),
        inclusions: data.inclusions,
        totalAmount: data.totalAmount,
        discount: data.discount,
        isActive: true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: pkg }
  } catch {
    return { success: false, error: "Failed to create package" }
  }
}

export async function updatePredefinedPackage(
  id: string,
  data: {
    name?: string
    inclusions?: string
    totalAmount?: number
    discount?: number
    isActive?: boolean
  }
) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.inclusions !== undefined) updateData.inclusions = data.inclusions
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount
    if (data.discount !== undefined) updateData.discount = data.discount
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const { data: pkg, error } = await supabase
      .from("PredefinedPackage")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: pkg }
  } catch {
    return { success: false, error: "Failed to update package" }
  }
}

export async function deletePredefinedPackage(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("PredefinedPackage").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete package" }
  }
}

// ─── Predefined Surgeries ────────────────────────────────────────────────────

export async function getPredefinedSurgeries(includeInactive: boolean = false) {
  const supabase = await createClient()
  let q = supabase
    .from("PredefinedSurgery")
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  if (!includeInactive) q = q.eq("isActive", true)
  const { data, error } = await q
  if (error) {
    console.error("getPredefinedSurgeries error:", error)
    return []
  }
  return data ?? []
}

export async function createPredefinedSurgery(data: {
  name: string
  department?: string | null
  doctorNames?: string[]
  onDutyDoctors?: string[]
  provisionDiagnosis?: string | null
  operationProcedure?: string | null
  operationDetails?: string | null
  sortOrder?: number
}) {
  const user = await requireAuth()
  if (!data.name?.trim()) {
    return { success: false as const, error: "Surgery name is required" }
  }
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: row, error } = await supabase
      .from("PredefinedSurgery")
      .insert({
        name: data.name.trim(),
        department: data.department ?? null,
        doctorNames: JSON.stringify(data.doctorNames ?? []),
        onDutyDoctors: JSON.stringify(data.onDutyDoctors ?? []),
        provisionDiagnosis: data.provisionDiagnosis ?? null,
        operationProcedure: data.operationProcedure ?? null,
        operationDetails: data.operationDetails ?? null,
        isActive: true,
        sortOrder: data.sortOrder ?? 0,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true as const, data: row }
  } catch (e) {
    console.error("createPredefinedSurgery error:", e)
    return { success: false as const, error: "Failed to create surgery template" }
  }
}

export async function updatePredefinedSurgery(id: string, data: {
  name?: string
  department?: string | null
  doctorNames?: string[]
  onDutyDoctors?: string[]
  provisionDiagnosis?: string | null
  operationProcedure?: string | null
  operationDetails?: string | null
  isActive?: boolean
  sortOrder?: number
}) {
  await requireAuth()
  try {
    const supabase = await createClient()
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined)               update.name = data.name.trim()
    if (data.department !== undefined)         update.department = data.department
    if (data.doctorNames !== undefined)        update.doctorNames = JSON.stringify(data.doctorNames)
    if (data.onDutyDoctors !== undefined)      update.onDutyDoctors = JSON.stringify(data.onDutyDoctors)
    if (data.provisionDiagnosis !== undefined) update.provisionDiagnosis = data.provisionDiagnosis
    if (data.operationProcedure !== undefined) update.operationProcedure = data.operationProcedure
    if (data.operationDetails !== undefined)   update.operationDetails = data.operationDetails
    if (data.isActive !== undefined)           update.isActive = data.isActive
    if (data.sortOrder !== undefined)          update.sortOrder = data.sortOrder
    const { error } = await supabase.from("PredefinedSurgery").update(update).eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true as const }
  } catch (e) {
    console.error("updatePredefinedSurgery error:", e)
    return { success: false as const, error: "Failed to update surgery template" }
  }
}

export async function deletePredefinedSurgery(id: string) {
  await requireAuth()
  // Soft-delete: same pattern as deletePredefinedPackage
  const supabase = await createClient()
  const { error } = await supabase
    .from("PredefinedSurgery")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id)
  if (error) {
    console.error("deletePredefinedSurgery error:", error)
    return { success: false as const, error: "Failed to delete surgery template" }
  }
  revalidatePath("/settings")
  return { success: true as const }
}

// ─── Medicine Master ──────────────────────────────────────────────────────────

export async function getMedicineMasterList(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase
    .from("MedicineMaster")
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  if (!includeInactive) query = query.eq("isActive", true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createMedicineMaster(data: {
  name: string
  category?: string
  defaultTiming?: string
  defaultDays?: string
  note?: string
  sortOrder?: number
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const { data: existing } = await supabase.from("MedicineMaster").select("id").eq("name", data.name.trim()).single()
    if (existing) return { success: false, error: "Medicine name already exists" }

    const now = new Date().toISOString()
    const { data: med, error } = await supabase
      .from("MedicineMaster")
      .insert({
        name: data.name.trim(),
        category: data.category?.trim() || null,
        defaultTiming: data.defaultTiming?.trim() || null,
        defaultDays: data.defaultDays?.trim() || null,
        note: data.note?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: med }
  } catch {
    return { success: false, error: "Failed to create medicine" }
  }
}

export async function updateMedicineMaster(
  id: string,
  data: {
    name?: string
    category?: string
    defaultTiming?: string
    defaultDays?: string
    note?: string
    sortOrder?: number
    isActive?: boolean
  }
) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.category !== undefined) updateData.category = data.category.trim() || null
    if (data.defaultTiming !== undefined) updateData.defaultTiming = data.defaultTiming.trim() || null
    if (data.defaultDays !== undefined) updateData.defaultDays = data.defaultDays.trim() || null
    if (data.note !== undefined) updateData.note = data.note.trim() || null
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const { data: med, error } = await supabase
      .from("MedicineMaster")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/settings")
    return { success: true, data: med }
  } catch {
    return { success: false, error: "Failed to update medicine" }
  }
}

export async function deleteMedicineMaster(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("MedicineMaster").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete medicine" }
  }
}

// ─── Default Print Config ─────────────────────────────────────────────────────

export async function getDefaultPrintConfig(): Promise<DefaultPrintConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("HospitalProfile")
    .select("settings")
    .limit(1)
    .single()
  return parseDefaultPrintConfig(data?.settings)
}

export async function saveDefaultPrintConfig(input: DefaultPrintConfig) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const config = validateDefaultPrintConfig(input)
    const { data: existing } = await supabase
      .from("HospitalProfile")
      .select("id, settings")
      .limit(1)
      .single()
    const nextSettings = mergeDefaultPrintIntoSettings(existing?.settings, config)
    const now = new Date().toISOString()
    if (!existing) {
      await supabase.from("HospitalProfile").insert({
        name: "My Hospital",
        settings: nextSettings,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await supabase
        .from("HospitalProfile")
        .update({ settings: nextSettings, updatedAt: now })
        .eq("id", existing.id)
    }
    const { invalidateHospitalCache } = await import("@/lib/db")
    invalidateHospitalCache()
    revalidatePath("/settings")
    revalidatePath("/doctor")
    return { success: true as const }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save default print config"
    return { success: false as const, error: msg }
  }
}

// Re-export the empty constant so client components don't have to import from two places.
export { EMPTY_DEFAULT_PRINT_CONFIG } from "@/lib/default-print"
