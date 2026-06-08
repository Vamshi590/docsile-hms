"use server"

import { revalidatePath } from "next/cache"
import { requireServerPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

const VALID_TONES = ["friendly", "professional", "luxe"] as const

export async function updateSocialConfig(input: {
  tone: string
  departments: string[]
  socialDailyCap: number
}) {
  await requireServerPermission("social:config")
  if (!(VALID_TONES as readonly string[]).includes(input.tone)) {
    throw new Error(`tone must be one of: ${VALID_TONES.join(", ")}`)
  }
  if (input.socialDailyCap < 1 || input.socialDailyCap > 100) {
    throw new Error("socialDailyCap must be between 1 and 100.")
  }
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("HospitalProfile").select("id").limit(1).single()
  if (!profile) throw new Error("HospitalProfile not found.")

  const { error } = await supabase.from("HospitalProfile").update({
    tone: input.tone,
    departments: JSON.stringify(input.departments),
    socialDailyCap: input.socialDailyCap,
    updatedAt: new Date().toISOString(),
  }).eq("id", profile.id)
  if (error) throw new Error(error.message)

  revalidatePath("/social/settings")
}

export async function disconnectInstagram() {
  await requireServerPermission("social:connect")
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("HospitalProfile").select("id").limit(1).single()
  if (!profile) return
  const { error } = await supabase.from("HospitalProfile").update({
    igAccessToken: null, igUserId: null, igConnectedAt: null,
    updatedAt: new Date().toISOString(),
  }).eq("id", profile.id)
  if (error) throw new Error(error.message)
  revalidatePath("/social/settings")
}
