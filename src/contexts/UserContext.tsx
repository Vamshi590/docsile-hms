"use client"

import { createContext, useContext } from "react"
import type { SessionUser } from "@/lib/auth"

const UserContext = createContext<SessionUser | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser(): SessionUser {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used inside UserProvider")
  return ctx
}
