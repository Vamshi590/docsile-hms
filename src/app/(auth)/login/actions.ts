"use server"

import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { signToken, COOKIE_NAME } from "@/lib/jwt"

export async function loginAction(data: { email: string; password: string }) {
  try {
    const supabase = await createClient()
    const email = data.email.toLowerCase().trim()

    const { data: user, error } = await supabase
      .from("User")
      .select("id, email, passwordHash, fullName, role, isActive")
      .eq("email", email)
      .single()

    if (error || !user || !user.isActive) {
      return { success: false, error: "Invalid email or password" }
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash)
    if (!valid) {
      return { success: false, error: "Invalid email or password" }
    }

    // Fetch permissions for the role
    let permissions: string[] = []
    const { data: roles } = await supabase
      .from("Role")
      .select("name, permissions")
      .eq("name", user.role)
      .single()

    if (roles?.permissions) {
      try { permissions = JSON.parse(roles.permissions) } catch { /* ignore */ }
    }
    if (user.role === "ADMIN" && permissions.length === 0) {
      const { getAllPermissionKeys } = await import("@/lib/permissions")
      permissions = getAllPermissionKeys()
    }

    // Create JWT and set cookie
    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      permissions,
    })

    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    // Update last login
    await supabase
      .from("User")
      .update({ lastLogin: new Date().toISOString() })
      .eq("id", user.id)

    return { success: true, data: { id: user.id, role: user.role } }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "An error occurred. Please try again." }
  }
}
