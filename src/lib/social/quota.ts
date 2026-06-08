import { createClient } from "@/lib/supabase/server"

export type QuotaResult = { allowed: boolean; used: number; limit: number }

export function computeQuotaResult(used: number, limit: number): QuotaResult {
  return { allowed: used < limit, used, limit }
}

export async function checkDailyCap(): Promise<QuotaResult> {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { count, error } = await supabase
    .from("SocialPost")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .gte("postedAt", today.toISOString())
    .lt("postedAt", tomorrow.toISOString())
  if (error) throw new Error(`Quota query failed: ${error.message}`)

  const { data: profile, error: profErr } = await supabase
    .from("HospitalProfile").select("socialDailyCap").limit(1).single()
  if (profErr) throw new Error(`HospitalProfile query failed: ${profErr.message}`)

  return computeQuotaResult(count ?? 0, profile?.socialDailyCap ?? 5)
}
