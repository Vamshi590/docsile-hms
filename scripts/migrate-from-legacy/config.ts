import { createClient, SupabaseClient } from "@supabase/supabase-js"

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export const config = {
  dryRun: process.argv.includes("--dry-run"),
  only: (() => {
    const i = process.argv.indexOf("--only")
    return i >= 0 ? process.argv[i + 1]?.split(",") ?? [] : null
  })(),
}

export function makeLegacyClient(): SupabaseClient {
  return createClient(
    required("MIGRATION_LEGACY_SUPABASE_URL"),
    required("MIGRATION_LEGACY_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  )
}

export function makeTargetClient(): SupabaseClient {
  return createClient(
    required("MIGRATION_TARGET_SUPABASE_URL"),
    required("MIGRATION_TARGET_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  )
}
