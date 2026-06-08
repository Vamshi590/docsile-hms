import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyToken, COOKIE_NAME } from "./jwt"

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: string
  permissions: string[]
}

/**
 * Fast session check — reads only from the JWT cookie.
 * No DB call. The JWT is signed so we trust its contents.
 */
export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const payload = await verifyToken(token)
    if (!payload) return null

    // Invalidate the session if the role's permissions were updated after
    // this token was issued. Forces a re-login so the new JWT carries the
    // fresh permission list.
    const iat = (payload as unknown as { iat?: number }).iat
    if (iat) {
      const { createClient } = await import("./supabase/server")
      const supabase = await createClient()
      const { data: role } = await supabase
        .from("Role")
        .select("updatedAt")
        .eq("name", payload.role)
        .single()
      if (role?.updatedAt) {
        const roleUpdatedMs = new Date(role.updatedAt).getTime()
        if (roleUpdatedMs > iat * 1000) {
          return null
        }
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName ?? payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
    }
  } catch {
    return null
  }
})

/**
 * Full session with fresh DB data — use only when you need up-to-date permissions.
 */
export async function getSessionFromDB(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const payload = await verifyToken(token)
    if (!payload) return null

    const { createClient } = await import("./supabase/server")
    const supabase = await createClient()

    const [userResult, rolesResult] = await Promise.all([
      supabase
        .from("User")
        .select("id, email, fullName, role")
        .eq("id", payload.sub)
        .eq("isActive", true)
        .single(),
      supabase
        .from("Role")
        .select("name, permissions"),
    ])

    const user = userResult.data
    if (!user) return null

    let permissions: string[] = []
    try {
      const role = rolesResult.data?.find((r: any) => r.name === user.role)
      if (role) {
        permissions = JSON.parse(role.permissions)
      }
    } catch {
      if (user.role === "ADMIN") {
        const { getAllPermissionKeys } = await import("./permissions")
        permissions = getAllPermissionKeys()
      }
    }

    return { ...user, permissions }
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    // /api/logout clears the JWT cookie before redirecting to /login. This is
    // important when the session is null because a role's permissions were
    // updated after the token was issued — the cookie is still cryptographically
    // valid, so middleware would otherwise let the user back in and we'd loop.
    redirect("/api/logout")
  }
  return session
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role !== "ADMIN") {
    redirect("/dashboard")
  }
  return session
}

export async function requireServerPermission(permission: string): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role === "ADMIN") return session
  if (!session.permissions.includes(permission)) {
    redirect("/unauthorized")
  }
  return session
}

export function requirePermission(user: SessionUser, permission: string): boolean {
  if (user.role === "ADMIN") return true
  return user.permissions.includes(permission)
}
