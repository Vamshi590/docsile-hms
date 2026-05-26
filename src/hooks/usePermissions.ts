"use client"

import { useUser } from "@/contexts/UserContext"

export function usePermissions() {
  const user = useUser()
  return {
    can: (permission: string): boolean => {
      if (user.role === "ADMIN") return true
      return user.permissions.includes(permission)
    },
    canAny: (permissions: string[]): boolean => {
      if (user.role === "ADMIN") return true
      return permissions.some((p) => user.permissions.includes(p))
    },
  }
}
