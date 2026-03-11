"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"

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
  return db.serviceTemplate.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function createServiceTemplate(data: z.infer<typeof ServiceSchema>) {
  const user = await requireAuth()
  const validated = ServiceSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }
  try {
    const svc = await db.serviceTemplate.create({
      data: {
        name: validated.data.name,
        category: validated.data.category,
        description: validated.data.description ?? null,
        amount: validated.data.amount,
        discount: validated.data.discount ?? 0,
        sortOrder: validated.data.sortOrder ?? 0,
        isActive: true,
        createdBy: user.id,
      } as any,
    })
    revalidatePath("/settings")
    return { success: true, data: svc }
  } catch {
    return { success: false, error: "Failed to create service template" }
  }
}

export async function updateServiceTemplate(id: string, data: Partial<z.infer<typeof ServiceSchema>> & { isActive?: boolean }) {
  await requireAuth()
  try {
    const svc = await db.serviceTemplate.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        amount: data.amount,
        discount: data.discount,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      } as any,
    })
    revalidatePath("/settings")
    return { success: true, data: svc }
  } catch {
    return { success: false, error: "Failed to update service template" }
  }
}

export async function deleteServiceTemplate(id: string) {
  await requireAuth()
  try {
    await db.serviceTemplate.delete({ where: { id } })
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete service" }
  }
}

// ─── Hospital Profile ─────────────────────────────────────────────────────────

export async function getHospitalProfile() {
  return db.hospitalProfile.findFirst()
}

export async function updateHospitalProfile(data: {
  name?: string
  displayName?: string
  phone?: string
  email?: string
  website?: string
  registrationNo?: string
  gstin?: string
}) {
  await requireAuth()
  try {
    const existing = await db.hospitalProfile.findFirst()
    if (!existing) {
      await db.hospitalProfile.create({
        data: {
          name: data.name ?? "My Hospital",
          displayName: data.displayName ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          website: data.website ?? null,
          registrationNo: data.registrationNo ?? null,
          gstin: data.gstin ?? null,
        },
      })
    } else {
      await db.hospitalProfile.update({
        where: { id: existing.id },
        data: {
          name: data.name ?? existing.name,
          displayName: data.displayName ?? existing.displayName,
          phone: data.phone ?? existing.phone,
          email: data.email ?? existing.email,
          website: data.website ?? existing.website,
          registrationNo: data.registrationNo ?? existing.registrationNo,
          gstin: data.gstin ?? existing.gstin,
        },
      })
    }
    revalidatePath("/settings")
    revalidatePath("/")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update hospital profile" }
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers() {
  return db.user.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true, email: true, fullName: true, phone: true,
      role: true, department: true, designation: true, isActive: true, lastLogin: true, createdAt: true,
    },
  })
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
  // Import hashPassword
  const { hashPassword } = await import("@/lib/auth")
  try {
    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) return { success: false, error: "Email already registered" }
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash: hashPassword(data.password),
        fullName: data.fullName,
        role: data.role,
        phone: data.phone ?? null,
        department: data.department ?? null,
        designation: data.designation ?? null,
        isActive: true,
      },
    })
    revalidatePath("/settings")
    return { success: true, data: { id: user.id, email: user.email, fullName: user.fullName } }
  } catch {
    return { success: false, error: "Failed to create user" }
  }
}

export async function toggleUserActive(id: string) {
  await requireAuth()
  try {
    const user = await db.user.findUnique({ where: { id }, select: { isActive: true } })
    if (!user) return { success: false, error: "User not found" }
    await db.user.update({ where: { id }, data: { isActive: !user.isActive } })
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to toggle user status" }
  }
}

// ─── Prescription Templates ───────────────────────────────────────────────────

export async function getPrescriptionTemplates(includeInactive = false) {
  return db.predefinedTemplate.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ code: "asc" }],
  })
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
  try {
    const existing = await db.predefinedTemplate.findUnique({ where: { code: data.code.trim().toUpperCase() } })
    if (existing) return { success: false, error: "Template code already exists" }
    const tmpl = await db.predefinedTemplate.create({
      data: {
        code: data.code.trim().toUpperCase(),
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
      },
    })
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
  try {
    const tmpl = await db.predefinedTemplate.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code.trim().toUpperCase() }),
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.presentComplaint !== undefined && { presentComplaint: data.presentComplaint.trim() || null }),
        ...(data.previousHistory !== undefined && { previousHistory: data.previousHistory.trim() || null }),
        ...(data.provisionalDiagnosis !== undefined && { provisionalDiagnosis: data.provisionalDiagnosis.trim() || null }),
        ...(data.medicines !== undefined && { medicines: data.medicines }),
        ...(data.investigations !== undefined && { investigations: data.investigations }),
        ...(data.followUpDays !== undefined && { followUpDays: data.followUpDays }),
        ...(data.additionalNotes !== undefined && { additionalNotes: data.additionalNotes.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    revalidatePath("/settings")
    return { success: true, data: tmpl }
  } catch {
    return { success: false, error: "Failed to update prescription template" }
  }
}

export async function deletePrescriptionTemplate(id: string) {
  await requireAuth()
  try {
    await db.predefinedTemplate.delete({ where: { id } })
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete prescription template" }
  }
}

// ─── Predefined Packages ─────────────────────────────────────────────────────

export async function getPredefinedPackages(includeInactive = false) {
  return db.predefinedPackage.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  })
}

export async function createPredefinedPackage(data: {
  name: string
  inclusions: string
  totalAmount: number
  discount: number
}) {
  const user = await requireAuth()
  try {
    const existing = await db.predefinedPackage.findUnique({ where: { name: data.name.trim() } })
    if (existing) return { success: false, error: "Package name already exists" }
    const pkg = await db.predefinedPackage.create({
      data: {
        name: data.name.trim(),
        inclusions: data.inclusions,
        totalAmount: data.totalAmount,
        discount: data.discount,
        isActive: true,
        createdBy: user.id,
      },
    })
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
  try {
    const pkg = await db.predefinedPackage.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.inclusions !== undefined && { inclusions: data.inclusions }),
        ...(data.totalAmount !== undefined && { totalAmount: data.totalAmount }),
        ...(data.discount !== undefined && { discount: data.discount }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    revalidatePath("/settings")
    return { success: true, data: pkg }
  } catch {
    return { success: false, error: "Failed to update package" }
  }
}

export async function deletePredefinedPackage(id: string) {
  await requireAuth()
  try {
    await db.predefinedPackage.delete({ where: { id } })
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete package" }
  }
}

// ─── Medicine Master ──────────────────────────────────────────────────────────

export async function getMedicineMasterList(includeInactive = false) {
  return db.medicineMaster.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
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
  try {
    const existing = await db.medicineMaster.findUnique({ where: { name: data.name.trim() } })
    if (existing) return { success: false, error: "Medicine name already exists" }
    const med = await db.medicineMaster.create({
      data: {
        name: data.name.trim(),
        category: data.category?.trim() || null,
        defaultTiming: data.defaultTiming?.trim() || null,
        defaultDays: data.defaultDays?.trim() || null,
        note: data.note?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
        createdBy: user.id,
      },
    })
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
  try {
    const med = await db.medicineMaster.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.category !== undefined && { category: data.category.trim() || null }),
        ...(data.defaultTiming !== undefined && { defaultTiming: data.defaultTiming.trim() || null }),
        ...(data.defaultDays !== undefined && { defaultDays: data.defaultDays.trim() || null }),
        ...(data.note !== undefined && { note: data.note.trim() || null }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    revalidatePath("/settings")
    return { success: true, data: med }
  } catch {
    return { success: false, error: "Failed to update medicine" }
  }
}

export async function deleteMedicineMaster(id: string) {
  await requireAuth()
  try {
    await db.medicineMaster.delete({ where: { id } })
    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete medicine" }
  }
}
