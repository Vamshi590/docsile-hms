import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "./db"

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: string
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("docsile_uid")?.value
    if (!userId) return null

    const user = await db.user.findUnique({
      where: { id: userId, isActive: true },
      select: { id: true, email: true, fullName: true, role: true },
    })
    return user ?? null
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  return session
}

export async function createSession(userId: string) {
  const cookieStore = await cookies()
  cookieStore.set("docsile_uid", userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete("docsile_uid")
}

/** Simple password hash (use bcrypt in production) */
export function hashPassword(password: string): string {
  // Dev only: base64 encode. Replace with bcrypt in production.
  return Buffer.from(password).toString("base64")
}

export function verifyPassword(password: string, hash: string): boolean {
  return Buffer.from(password).toString("base64") === hash
}
