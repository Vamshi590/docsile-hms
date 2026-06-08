"use server"

import { revalidatePath } from "next/cache"
import { requireServerPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { deleteByPrefix } from "@/lib/social/storage"

export async function deletePost(input: { postId: string }) {
  await requireServerPermission("social:delete")
  const supabase = await createClient()

  const { data: post } = await supabase
    .from("SocialPost").select("id").eq("id", input.postId).single()
  if (!post) return

  // Best-effort storage cleanup; failure to delete files should not block row delete.
  await deleteByPrefix(`posts/${input.postId}`).catch((err) => {
    console.error("[social] storage cleanup failed:", err)
  })

  const { error: delErr } = await supabase.from("SocialPost").delete().eq("id", input.postId)
  if (delErr) throw new Error(delErr.message)

  revalidatePath("/social/posts")
}
