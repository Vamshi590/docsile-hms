"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { z } from "zod"
import { DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys } from "@/lib/permissions"

// ─── Staff (Users) ────────────────────────────────────────────────────────────

const StaffSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Min 6 characters").optional(),
  fullName: z.string().min(1, "Name required"),
  phone: z.string().optional(),
  role: z.string().min(1, "Role required"),
  department: z.string().optional(),
  designation: z.string().optional(),
  employeeId: z.string().optional(),
  qualifications: z.string().optional(),
  joiningDate: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  bloodGroup: z.string().optional(),
})

export async function getStaffMembers() {
  await requireAdmin()
  return db.user.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      department: true,
      designation: true,
      employeeId: true,
      qualifications: true,
      joiningDate: true,
      address: true,
      emergencyContact: true,
      bloodGroup: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
    },
  })
}

export async function getStaffMember(id: string) {
  await requireAdmin()
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      department: true,
      designation: true,
      employeeId: true,
      qualifications: true,
      joiningDate: true,
      address: true,
      emergencyContact: true,
      bloodGroup: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
    },
  })
}

export async function createStaffMember(data: z.infer<typeof StaffSchema>) {
  await requireAdmin()
  const validated = StaffSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }
  if (!validated.data.password) {
    return { success: false, error: "Password is required for new staff" }
  }

  const { hashPassword } = await import("@/lib/auth")
  try {
    const existing = await db.user.findUnique({ where: { email: validated.data.email } })
    if (existing) return { success: false, error: "Email already registered" }

    if (validated.data.employeeId) {
      const existingEmp = await db.user.findUnique({ where: { employeeId: validated.data.employeeId } })
      if (existingEmp) return { success: false, error: "Employee ID already exists" }
    }

    await db.user.create({
      data: {
        email: validated.data.email,
        passwordHash: hashPassword(validated.data.password),
        fullName: validated.data.fullName,
        phone: validated.data.phone || null,
        role: validated.data.role,
        department: validated.data.department || null,
        designation: validated.data.designation || null,
        employeeId: validated.data.employeeId || null,
        qualifications: validated.data.qualifications || null,
        joiningDate: validated.data.joiningDate ? new Date(validated.data.joiningDate) : null,
        address: validated.data.address || null,
        emergencyContact: validated.data.emergencyContact || null,
        bloodGroup: validated.data.bloodGroup || null,
        isActive: true,
      },
    })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to create staff member" }
  }
}

export async function updateStaffMember(
  id: string,
  data: Partial<z.infer<typeof StaffSchema>>
) {
  await requireAdmin()
  try {
    const updateData: Record<string, unknown> = {}
    if (data.fullName !== undefined) updateData.fullName = data.fullName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.role !== undefined) updateData.role = data.role
    if (data.department !== undefined) updateData.department = data.department || null
    if (data.designation !== undefined) updateData.designation = data.designation || null
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications || null
    if (data.joiningDate !== undefined) updateData.joiningDate = data.joiningDate ? new Date(data.joiningDate) : null
    if (data.address !== undefined) updateData.address = data.address || null
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact || null
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null

    if (data.password) {
      const { hashPassword } = await import("@/lib/auth")
      updateData.passwordHash = hashPassword(data.password)
    }

    await db.user.update({ where: { id }, data: updateData })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update staff member" }
  }
}

export async function toggleStaffActive(id: string) {
  const admin = await requireAdmin()
  if (admin.id === id) {
    return { success: false, error: "You cannot deactivate yourself" }
  }
  try {
    const user = await db.user.findUnique({ where: { id }, select: { isActive: true } })
    if (!user) return { success: false, error: "Staff member not found" }
    await db.user.update({ where: { id }, data: { isActive: !user.isActive } })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to toggle staff status" }
  }
}

export async function resetStaffPassword(id: string, newPassword: string) {
  await requireAdmin()
  if (newPassword.length < 6) return { success: false, error: "Password must be at least 6 characters" }
  const { hashPassword } = await import("@/lib/auth")
  try {
    await db.user.update({
      where: { id },
      data: { passwordHash: hashPassword(newPassword) },
    })
    return { success: true }
  } catch {
    return { success: false, error: "Failed to reset password" }
  }
}

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export async function getRoles() {
  await requireAdmin()
  return db.role.findMany({
    orderBy: { name: "asc" },
  })
}

export async function createRole(data: {
  name: string
  displayName: string
  description?: string
  permissions: string[]
}) {
  await requireAdmin()
  if (!data.name.trim()) return { success: false, error: "Role name required" }
  if (!data.displayName.trim()) return { success: false, error: "Display name required" }

  try {
    const existing = await db.role.findUnique({ where: { name: data.name.trim().toUpperCase() } })
    if (existing) return { success: false, error: "Role name already exists" }

    await db.role.create({
      data: {
        name: data.name.trim().toUpperCase(),
        displayName: data.displayName.trim(),
        description: data.description?.trim() || null,
        permissions: JSON.stringify(data.permissions),
        isSystem: false,
        isActive: true,
      },
    })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to create role" }
  }
}

export async function updateRolePermissions(id: string, permissions: string[]) {
  await requireAdmin()
  try {
    await db.role.update({
      where: { id },
      data: { permissions: JSON.stringify(permissions) },
    })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update role permissions" }
  }
}

export async function updateRole(
  id: string,
  data: { displayName?: string; description?: string; isActive?: boolean }
) {
  await requireAdmin()
  try {
    const role = await db.role.findUnique({ where: { id } })
    if (!role) return { success: false, error: "Role not found" }

    await db.role.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update role" }
  }
}

export async function deleteRole(id: string) {
  await requireAdmin()
  try {
    const role = await db.role.findUnique({ where: { id } })
    if (!role) return { success: false, error: "Role not found" }
    if (role.isSystem) return { success: false, error: "System roles cannot be deleted" }

    // Check if any users are using this role
    const usersWithRole = await db.user.count({ where: { role: role.name } })
    if (usersWithRole > 0) {
      return { success: false, error: `Cannot delete: ${usersWithRole} staff member(s) use this role` }
    }

    await db.role.delete({ where: { id } })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete role" }
  }
}

// ─── Seed System Roles ────────────────────────────────────────────────────────

export async function seedSystemRoles() {
  await requireAdmin()
  try {
    const systemRoles = [
      { name: "ADMIN", displayName: "Administrator", description: "Full system access", permissions: getAllPermissionKeys() },
      { name: "DOCTOR", displayName: "Doctor", description: "Clinical access for consultations and prescriptions", permissions: DEFAULT_ROLE_PERMISSIONS.DOCTOR },
      { name: "RECEPTIONIST", displayName: "Receptionist", description: "Front desk operations and patient registration", permissions: DEFAULT_ROLE_PERMISSIONS.RECEPTIONIST },
      { name: "OPTOMETRIST", displayName: "Optometrist", description: "Eye workup and optical operations", permissions: DEFAULT_ROLE_PERMISSIONS.OPTOMETRIST },
      { name: "NURSE", displayName: "Nurse", description: "Patient care and clinical support", permissions: DEFAULT_ROLE_PERMISSIONS.NURSE },
    ]

    for (const role of systemRoles) {
      await db.role.upsert({
        where: { name: role.name },
        update: {
          displayName: role.displayName,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
        },
        create: {
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
          isActive: true,
        },
      })
    }

    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to seed system roles" }
  }
}
