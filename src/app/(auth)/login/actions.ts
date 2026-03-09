"use server"

import { db } from "@/lib/db"
import { createSession, verifyPassword } from "@/lib/auth"

export async function loginAction(data: { email: string; password: string }) {
  try {
    const user = await db.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    })

    if (!user || !user.isActive) {
      return { success: false, error: "Invalid email or password" }
    }

    const valid = verifyPassword(data.password, user.passwordHash)
    if (!valid) {
      return { success: false, error: "Invalid email or password" }
    }

    await createSession(user.id)

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    return { success: true, data: { id: user.id, role: user.role } }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "An error occurred. Please try again." }
  }
}
