"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

export async function getLicenses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("License")
    .select("*")
    .order("expiryDate", { ascending: true })
  if (error) throw error
  return data
}

export async function createLicense(data: {
  name: string
  licenseNumber?: string
  issuingBody?: string
  category?: string
  issueDate?: string
  expiryDate: string
  reminderDays?: number
  notes?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: license, error } = await supabase
      .from("License")
      .insert({
        name: data.name,
        licenseNumber: data.licenseNumber ?? null,
        issuingBody: data.issuingBody ?? null,
        category: data.category ?? null,
        issueDate: data.issueDate ? new Date(data.issueDate).toISOString() : null,
        expiryDate: new Date(data.expiryDate).toISOString(),
        reminderDays: data.reminderDays ?? 30,
        notes: data.notes ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/license-tracker")
    return { success: true as const, data: license }
  } catch {
    return { success: false as const, error: "Failed to create license" }
  }
}

export async function updateLicense(id: string, data: {
  name?: string
  licenseNumber?: string
  issuingBody?: string
  category?: string
  issueDate?: string
  expiryDate?: string
  reminderDays?: number
  status?: string
  notes?: string
}) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() }
    if (data.issueDate) updateData.issueDate = new Date(data.issueDate).toISOString()
    if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate).toISOString()
    const { data: license, error } = await supabase
      .from("License")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/license-tracker")
    return { success: true as const, data: license }
  } catch {
    return { success: false as const, error: "Failed to update license" }
  }
}

export async function deleteLicense(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("License").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/license-tracker")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete license" }
  }
}

export async function saveLicenseDocumentUrl(licenseId: string, url: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("License")
      .update({ documentUrl: url, updatedAt: new Date().toISOString() })
      .eq("id", licenseId)
    if (error) throw error
    revalidatePath("/license-tracker")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to save document URL" }
  }
}

export async function removeLicenseDocument(licenseId: string, filePath: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error: storageError } = await supabase.storage
      .from("license-documents")
      .remove([filePath])
    if (storageError) throw storageError
    const { error: dbError } = await supabase
      .from("License")
      .update({ documentUrl: null, updatedAt: new Date().toISOString() })
      .eq("id", licenseId)
    if (dbError) throw dbError
    revalidatePath("/license-tracker")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to remove document" }
  }
}
