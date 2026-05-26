"use server"

import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { requireAdmin, requireServerPermission } from "@/lib/auth"
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
  salary: z.number().min(0).optional(),
  salaryType: z.string().optional(),
})

export async function getStaffMembers() {
  await requireAdmin()
  await requireServerPermission("staff:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("User")
    .select("id, email, fullName, phone, role, department, designation, employeeId, qualifications, joiningDate, address, emergencyContact, bloodGroup, salary, salaryType, isActive, lastLogin, createdAt")
    .order("fullName", { ascending: true })
  if (error) throw error
  return data
}

export async function getStaffMember(id: string) {
  await requireAdmin()
  await requireServerPermission("staff:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("User")
    .select("id, email, fullName, phone, role, department, designation, employeeId, qualifications, joiningDate, address, emergencyContact, bloodGroup, salary, salaryType, isActive, lastLogin, createdAt")
    .eq("id", id)
    .single()
  if (error) return null
  return data
}

export async function createStaffMember(data: z.infer<typeof StaffSchema>) {
  await requireAdmin()
  await requireServerPermission("staff:create")
  const validated = StaffSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }
  if (!validated.data.password) {
    return { success: false, error: "Password is required for new staff" }
  }

  const supabase = await createClient()
  try {
    // Check email uniqueness
    const { data: existing } = await supabase.from("User").select("id").eq("email", validated.data.email).single()
    if (existing) return { success: false, error: "Email already registered" }

    if (validated.data.employeeId) {
      const { data: existingEmp } = await supabase.from("User").select("id").eq("employeeId", validated.data.employeeId).single()
      if (existingEmp) return { success: false, error: "Employee ID already exists" }
    }

    // Create Supabase Auth user
    const adminSupabase = await createServiceClient()
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: validated.data.email,
      password: validated.data.password,
      email_confirm: true,
    })
    if (authError) throw authError

    const hashedPassword = await bcrypt.hash(validated.data.password, 10)
    const now = new Date().toISOString()
    await supabase.from("User").insert({
      id: authData.user.id,
      email: validated.data.email,
      passwordHash: hashedPassword,
      fullName: validated.data.fullName,
      phone: validated.data.phone || null,
      role: validated.data.role,
      department: validated.data.department || null,
      designation: validated.data.designation || null,
      employeeId: validated.data.employeeId || null,
      qualifications: validated.data.qualifications || null,
      joiningDate: validated.data.joiningDate ? new Date(validated.data.joiningDate).toISOString() : null,
      address: validated.data.address || null,
      emergencyContact: validated.data.emergencyContact || null,
      bloodGroup: validated.data.bloodGroup || null,
      salary: validated.data.salary ?? null,
      salaryType: validated.data.salaryType || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
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
  await requireServerPermission("staff:edit")
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.fullName !== undefined) updateData.fullName = data.fullName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.role !== undefined) updateData.role = data.role
    if (data.department !== undefined) updateData.department = data.department || null
    if (data.designation !== undefined) updateData.designation = data.designation || null
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications || null
    if (data.joiningDate !== undefined) updateData.joiningDate = data.joiningDate ? new Date(data.joiningDate).toISOString() : null
    if (data.address !== undefined) updateData.address = data.address || null
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact || null
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null
    if (data.salary !== undefined) updateData.salary = data.salary ?? null
    if (data.salaryType !== undefined) updateData.salaryType = data.salaryType || null

    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 10)
      updateData.passwordHash = hashedPassword
      try {
        const adminSupabase = await createServiceClient()
        await adminSupabase.auth.admin.updateUserById(id, { password: data.password })
      } catch {
        // Supabase Auth sync is best-effort; passwordHash is the source of truth
      }
    }

    await supabase.from("User").update(updateData).eq("id", id)
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update staff member" }
  }
}

export async function toggleStaffActive(id: string) {
  const admin = await requireAdmin()
  await requireServerPermission("staff:deactivate")
  if (admin.id === id) {
    return { success: false, error: "You cannot deactivate yourself" }
  }
  const supabase = await createClient()
  try {
    const { data: user } = await supabase.from("User").select("isActive").eq("id", id).single()
    if (!user) return { success: false, error: "Staff member not found" }
    await supabase.from("User").update({ isActive: !user.isActive, updatedAt: new Date().toISOString() }).eq("id", id)
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to toggle staff status" }
  }
}

export async function resetStaffPassword(id: string, newPassword: string) {
  await requireAdmin()
  await requireServerPermission("staff:edit")
  if (newPassword.length < 6) return { success: false, error: "Password must be at least 6 characters" }
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const supabase = await createClient()
    const { error } = await supabase
      .from("User")
      .update({ passwordHash: hashedPassword, updatedAt: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error

    // Best-effort sync with Supabase Auth
    try {
      const adminSupabase = await createServiceClient()
      await adminSupabase.auth.admin.updateUserById(id, { password: newPassword })
    } catch {
      // Supabase Auth sync is best-effort; passwordHash is the source of truth
    }

    return { success: true }
  } catch {
    return { success: false, error: "Failed to reset password" }
  }
}

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export async function getRoles() {
  await requireAdmin()
  await requireServerPermission("staff:view")
  const supabase = await createClient()
  const { data, error } = await supabase.from("Role").select("*").order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function createRole(data: {
  name: string
  displayName: string
  description?: string
  permissions: string[]
}) {
  await requireAdmin()
  await requireServerPermission("staff:manage_roles")
  const supabase = await createClient()
  if (!data.name.trim()) return { success: false, error: "Role name required" }
  if (!data.displayName.trim()) return { success: false, error: "Display name required" }

  try {
    const name = data.name.trim().toUpperCase()
    const { data: existing } = await supabase.from("Role").select("id").eq("name", name).single()
    if (existing) return { success: false, error: "Role name already exists" }

    const now = new Date().toISOString()
    await supabase.from("Role").insert({
      name,
      displayName: data.displayName.trim(),
      description: data.description?.trim() || null,
      permissions: JSON.stringify(data.permissions),
      isSystem: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to create role" }
  }
}

export async function updateRolePermissions(id: string, permissions: string[]) {
  await requireAdmin()
  await requireServerPermission("staff:manage_roles")
  const supabase = await createClient()
  try {
    await supabase
      .from("Role")
      .update({ permissions: JSON.stringify(permissions), updatedAt: new Date().toISOString() })
      .eq("id", id)
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
  await requireServerPermission("staff:manage_roles")
  const supabase = await createClient()
  try {
    const { data: role } = await supabase.from("Role").select("id").eq("id", id).single()
    if (!role) return { success: false, error: "Role not found" }

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.displayName !== undefined) updateData.displayName = data.displayName.trim()
    if (data.description !== undefined) updateData.description = data.description.trim() || null
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    await supabase.from("Role").update(updateData).eq("id", id)
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update role" }
  }
}

export async function deleteRole(id: string) {
  await requireAdmin()
  await requireServerPermission("staff:manage_roles")
  const supabase = await createClient()
  try {
    const { data: role } = await supabase.from("Role").select("id, name, isSystem").eq("id", id).single()
    if (!role) return { success: false, error: "Role not found" }
    if (role.isSystem) return { success: false, error: "System roles cannot be deleted" }

    const { count } = await supabase.from("User").select("*", { count: "exact", head: true }).eq("role", role.name)
    if ((count ?? 0) > 0) {
      return { success: false, error: `Cannot delete: ${count} staff member(s) use this role` }
    }

    await supabase.from("Role").delete().eq("id", id)
    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete role" }
  }
}

// ─── Seed System Roles ────────────────────────────────────────────────────────

export async function seedSystemRoles() {
  await requireAdmin()
  await requireServerPermission("staff:manage_roles")
  const supabase = await createClient()
  try {
    const systemRoles = [
      { name: "ADMIN", displayName: "Administrator", description: "Full system access", permissions: getAllPermissionKeys() },
      { name: "DOCTOR", displayName: "Doctor", description: "Clinical access for consultations and prescriptions", permissions: DEFAULT_ROLE_PERMISSIONS.DOCTOR },
      { name: "RECEPTIONIST", displayName: "Receptionist", description: "Front desk operations and patient registration", permissions: DEFAULT_ROLE_PERMISSIONS.RECEPTIONIST },
      { name: "OPTOMETRIST", displayName: "Optometrist", description: "Eye workup and optical operations", permissions: DEFAULT_ROLE_PERMISSIONS.OPTOMETRIST },
      { name: "NURSE", displayName: "Nurse", description: "Patient care and clinical support", permissions: DEFAULT_ROLE_PERMISSIONS.NURSE },
    ]

    const now = new Date().toISOString()
    for (const role of systemRoles) {
      const { data: existing } = await supabase.from("Role").select("id").eq("name", role.name).single()
      if (existing) {
        await supabase.from("Role").update({
          displayName: role.displayName,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
          updatedAt: now,
        }).eq("id", existing.id)
      } else {
        await supabase.from("Role").insert({
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    revalidatePath("/staff")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to seed system roles" }
  }
}
