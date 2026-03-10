"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

export async function getLicenses() {
  return db.license.findMany({
    orderBy: { expiryDate: "asc" },
  })
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
  try {
    const license = await db.license.create({
      data: {
        name: data.name,
        licenseNumber: data.licenseNumber ?? null,
        issuingBody: data.issuingBody ?? null,
        category: data.category ?? null,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        expiryDate: new Date(data.expiryDate),
        reminderDays: data.reminderDays ?? 30,
        notes: data.notes ?? null,
        createdBy: user.id,
      },
    })
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
  try {
    const updateData: Record<string, unknown> = { ...data }
    if (data.issueDate) updateData.issueDate = new Date(data.issueDate)
    if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate)
    const license = await db.license.update({
      where: { id },
      data: updateData,
    })
    revalidatePath("/license-tracker")
    return { success: true as const, data: license }
  } catch {
    return { success: false as const, error: "Failed to update license" }
  }
}

export async function deleteLicense(id: string) {
  await requireAuth()
  try {
    await db.license.delete({ where: { id } })
    revalidatePath("/license-tracker")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete license" }
  }
}
