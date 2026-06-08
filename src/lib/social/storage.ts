import { createClient } from "@supabase/supabase-js"
import { requireSocialEnv } from "./env"

const BUCKET = "social-posts"

function admin() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireSocialEnv()
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export async function uploadJpeg(buffer: Buffer, key: string): Promise<string> {
  const supabase = admin()
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: "image/jpeg", upsert: true, cacheControl: "86400",
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return data.publicUrl
}

export async function deleteByPrefix(prefix: string): Promise<void> {
  const supabase = admin()
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix)
  if (error) throw new Error(`Storage list failed: ${error.message}`)
  if (!data?.length) return
  const keys = data.map((f) => `${prefix}/${f.name}`)
  const { error: delErr } = await supabase.storage.from(BUCKET).remove(keys)
  if (delErr) throw new Error(`Storage delete failed: ${delErr.message}`)
}

export function publicUrlFor(key: string): string {
  const supabase = admin()
  return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
}
