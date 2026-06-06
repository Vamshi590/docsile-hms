import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import { info, logError, newId, normalizeUsername, usernameToEmail } from "../utils"

type LegacyStaff = {
  id: string
  username: string | null
  fullName: string | null
  position: string | null
  salary: string | null
  phone: string | null
  email: string | null
  passwordHash: string | null
  isAdmin: boolean | null
  createdAt: string | null
  updatedAt: string | null
}

type TargetUser = {
  id: string
  email: string
  passwordHash: string
  fullName: string
  phone: string | null
  role: string
  designation: string | null
  salary: number | null
  isActive: boolean
  preferences: string
  createdAt: string
  updatedAt: string
}

export async function migrateStaff(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== staff → User ===")

  const { data: rows, error } = await source
    .from("staff")
    .select("id, username, fullName, position, salary, phone, email, passwordHash, isAdmin, createdAt, updatedAt")
  if (error) throw new Error(`Failed to read legacy staff: ${error.message}`)
  if (!rows) {
    info("  no rows")
    return
  }
  info(`  read ${rows.length} legacy staff rows`)

  const out: TargetUser[] = []
  const usernameToNewId = new Map<string, string>()

  for (const r of rows as LegacyStaff[]) {
    const username = normalizeUsername(r.username)
    if (!username) {
      logError("staff", r.id, "blank username — skipping")
      continue
    }
    if (!r.passwordHash) {
      logError("staff", r.id, "blank passwordHash — skipping")
      continue
    }
    if (usernameToNewId.has(username)) {
      logError("staff", r.id, `duplicate username "${username}" — skipping`)
      continue
    }
    if (lookups.userByUsername.has(username)) {
      // Already in target (hydrated) — skip insert, lookup is already populated
      continue
    }

    const id = newId()
    const email = usernameToEmail(username)
    const salary = r.salary ? parseFloat(r.salary) : null

    out.push({
      id,
      email,
      passwordHash: r.passwordHash,
      fullName: r.fullName?.trim() || username,
      phone: r.phone?.trim() || null,
      role: "ADMIN",
      designation: r.position?.trim() || null,
      salary: salary != null && !Number.isNaN(salary) ? salary : null,
      isActive: true,
      preferences: "{}",
      createdAt: r.createdAt ?? new Date().toISOString(),
      updatedAt: r.updatedAt ?? new Date().toISOString(),
    })

    lookups.userByLegacyId.set(r.id, id)
    lookups.userByUsername.set(username, id)
    usernameToNewId.set(username, id)
  }

  info(`  transformed ${out.length} → User rows`)

  if (config.dryRun) {
    info("  [dry-run] would insert; sample:")
    console.log(JSON.stringify(out.slice(0, 2), null, 2))
    return
  }

  const { error: insertErr } = await target.from("User").insert(out)
  if (insertErr) throw new Error(`Insert User failed: ${insertErr.message}`)
  info(`  ✓ inserted ${out.length} User rows`)
}
