"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

export type UserPreferences = {
  doctorColumns?: string[]
  // Extend here as more per-user UI prefs are needed.
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const user = await requireAuth()
  const supabase = await createClient()
  const { data } = await supabase
    .from("User")
    .select("preferences")
    .eq("id", user.id)
    .single()

  if (!data?.preferences) return {}
  try {
    return JSON.parse(data.preferences) as UserPreferences
  } catch {
    return {}
  }
}

export async function updateUserPreferences(patch: Partial<UserPreferences>): Promise<{ success: boolean }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: current } = await supabase
    .from("User")
    .select("preferences")
    .eq("id", user.id)
    .single()

  let merged: UserPreferences = {}
  try { merged = current?.preferences ? JSON.parse(current.preferences) : {} } catch { /* ignore */ }
  merged = { ...merged, ...patch }

  const { error } = await supabase
    .from("User")
    .update({ preferences: JSON.stringify(merged) })
    .eq("id", user.id)

  return { success: !error }
}
