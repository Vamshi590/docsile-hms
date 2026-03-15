import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Browser-side Supabase client for database queries (uses anon key)
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
