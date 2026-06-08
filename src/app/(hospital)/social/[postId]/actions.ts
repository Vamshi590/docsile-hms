"use server"

import { revalidatePath } from "next/cache"
import { requireServerPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { decryptToken } from "@/lib/social/tokens"
import { publishPost as igPublishPost, publishCarousel as igPublishCarousel } from "@/lib/social/instagram"
import { checkDailyCap } from "@/lib/social/quota"

export async function updatePost(input: { postId: string; caption: string; hashtags: string[] }) {
  await requireServerPermission("social:edit")
  const supabase = await createClient()
  const { data: post, error } = await supabase
    .from("SocialPost").select("id,status").eq("id", input.postId).single()
  if (error || !post) throw new Error("Post not found.")
  if (post.status !== "draft") throw new Error("Only drafts can be edited.")

  const cleanedHashtags = input.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean)
  const { error: upErr } = await supabase.from("SocialPost").update({
    caption: input.caption.slice(0, 2200),
    hashtags: JSON.stringify(cleanedHashtags),
    updatedAt: new Date().toISOString(),
  }).eq("id", input.postId)
  if (upErr) throw new Error(upErr.message)

  revalidatePath(`/social/${input.postId}`)
}

export async function publishPost(input: { postId: string }): Promise<{ success: boolean; igPostId?: string; error?: string; quota?: { used: number; limit: number } }> {
  await requireServerPermission("social:publish")
  const supabase = await createClient()

  const { data: post, error } = await supabase
    .from("SocialPost")
    .select("id, status, caption, hashtags, imageUrl, slideUrls")
    .eq("id", input.postId).single()
  if (error || !post) throw new Error("Post not found.")
  if (post.status !== "draft") throw new Error("Only drafts can be published.")

  const { data: profile } = await supabase
    .from("HospitalProfile").select("id, igAccessToken, igUserId").limit(1).single()
  if (!profile?.igAccessToken || !profile?.igUserId) {
    return { success: false, error: "Instagram not connected. Connect it in Settings." }
  }

  const quota = await checkDailyCap()
  if (!quota.allowed) {
    return { success: false, error: "quota_exceeded", quota: { used: quota.used, limit: quota.limit } }
  }

  const token = decryptToken(profile.igAccessToken)
  const hashtags: string[] = JSON.parse(post.hashtags || "[]")
  const fullCaption = hashtags.length
    ? `${post.caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
    : post.caption

  const slideUrls: string[] | null = post.slideUrls ? JSON.parse(post.slideUrls) : null
  const isCarousel = slideUrls && slideUrls.length > 1

  try {
    const igPostId = isCarousel
      ? await igPublishCarousel(profile.igUserId, token, slideUrls, fullCaption)
      : await igPublishPost(profile.igUserId, token, post.imageUrl, fullCaption)
    await supabase.from("SocialPost").update({
      status: "posted", igPostId, postedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).eq("id", input.postId)
    revalidatePath("/social/posts")
    revalidatePath(`/social/${input.postId}`)
    return { success: true, igPostId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Publish failed"
    if (msg === "TOKEN_EXPIRED") {
      await supabase.from("HospitalProfile").update({
        igAccessToken: null, igUserId: null,
        updatedAt: new Date().toISOString(),
      }).eq("id", profile.id)
    }
    await supabase.from("SocialPost").update({
      status: "failed", errorMessage: msg,
      updatedAt: new Date().toISOString(),
    }).eq("id", input.postId)
    return { success: false, error: msg }
  }
}
