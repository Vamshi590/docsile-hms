import { createClient } from "@supabase/supabase-js"
import { ALL_PERMISSIONS } from "../src/lib/permissions"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const socialKeys = ALL_PERMISSIONS.social.permissions.map((p) => p.key)

  const { data: roles, error } = await supabase
    .from("Role")
    .select("id, name, permissions")
    .eq("name", "ADMIN")

  if (error) throw error
  if (!roles?.length) {
    console.log("No ADMIN role rows found — nothing to backfill.")
    return
  }

  for (const role of roles) {
    const existing: string[] = JSON.parse(role.permissions || "[]")
    const missing = socialKeys.filter((k) => !existing.includes(k))
    if (missing.length === 0) {
      console.log(`Role ${role.id}: already has all social:* perms.`)
      continue
    }
    const updated = JSON.stringify([...existing, ...missing])
    const { error: upErr } = await supabase
      .from("Role").update({ permissions: updated }).eq("id", role.id)
    if (upErr) throw upErr
    console.log(`Role ${role.id}: added ${missing.join(", ")}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
