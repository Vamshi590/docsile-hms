import { createClient } from "./supabase/server"

export async function getNextInsClaimNumber(): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const prefix = `INS-${year}`
  const { data: last } = await supabase
    .from("InsuranceClaim")
    .select("claimNumber")
    .ilike("claimNumber", `${prefix}%`)
    .order("claimNumber", { ascending: false })
    .limit(1)
    .single()

  if (!last) return `${prefix}-0001`
  const num = parseInt(last.claimNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(num + 1).padStart(4, "0")}`
}
