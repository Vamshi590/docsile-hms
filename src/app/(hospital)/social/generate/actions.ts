// src/app/(hospital)/social/generate/actions.ts
"use server"

import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { requireServerPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { generateAiContent } from "@/lib/social/generation/ai-prompt"
import { generateVisionContent } from "@/lib/social/generation/vision-prompt"
import { renderAiContent, renderVisionContent } from "@/lib/social/templates"
import { uploadJpeg, deleteByPrefix } from "@/lib/social/storage"

async function loadHospitalAndDoctors(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: hospital, error: hErr } = await supabase
    .from("HospitalProfile")
    .select("id, name, address, tone, departments, logoUrl")
    .limit(1).single()
  if (hErr || !hospital) throw new Error("HospitalProfile not configured.")
  const departments: string[] = JSON.parse(hospital.departments || "[]")

  const { data: doctors } = await supabase
    .from("User")
    .select("id, fullName, qualifications, department, avatarUrl")
    .eq("role", "DOCTOR").eq("isActive", true)

  return {
    hospital: {
      id: hospital.id, name: hospital.name, address: hospital.address,
      tone: hospital.tone, departments, logoUrl: hospital.logoUrl,
    },
    doctors: (doctors ?? []).map((d) => ({
      id: d.id, fullName: d.fullName,
      qualifications: d.qualifications, department: d.department,
      avatarUrl: d.avatarUrl,
    })),
  }
}

export async function generateAi(): Promise<void> {
  const user = await requireServerPermission("social:generate")
  const supabase = await createClient()
  const { hospital, doctors } = await loadHospitalAndDoctors(supabase)

  const content = await generateAiContent(
    { name: hospital.name, address: hospital.address, tone: hospital.tone, departments: hospital.departments },
    doctors.map((d) => ({ id: d.id, fullName: d.fullName, qualifications: d.qualifications, department: d.department })),
  )

  let doctor = null
  if (content.post_type === "doctor") {
    const withAvatar = doctors.filter((d) => d.avatarUrl)
    const pool = withAvatar.length ? withAvatar : doctors
    if (!pool.length) throw new Error("No doctors available for doctor post")
    doctor = pool[Math.floor(Math.random() * pool.length)]
  }

  const postId = randomUUID()
  const { cover, slides } = await renderAiContent(content,
    { name: hospital.name, logoUrl: hospital.logoUrl }, doctor)

  let coverUrl: string
  let slideUrls: string[] = []
  try {
    coverUrl = await uploadJpeg(cover, `posts/${postId}/cover.jpg`)
    if (slides.length) {
      slideUrls = await Promise.all(slides.map((buf, i) =>
        uploadJpeg(buf, `posts/${postId}/slide-${i + 2}.jpg`),
      ))
    }
  } catch (e) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw e
  }

  const allSlideUrls = slideUrls.length ? [coverUrl!, ...slideUrls] : null

  const { error: insErr } = await supabase.from("SocialPost").insert({
    id: postId, caption: content.caption,
    hashtags: JSON.stringify(content.hashtags), postType: content.post_type,
    imageUrl: coverUrl!, slideUrls: allSlideUrls ? JSON.stringify(allSlideUrls) : null,
    status: "draft", source: "ai",
    doctorId: doctor?.id ?? null, createdById: user.id,
    updatedAt: new Date().toISOString(),
  })
  if (insErr) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw new Error(`DB insert failed: ${insErr.message}`)
  }

  redirect(`/social/${postId}`)
}

export async function generateFromImages(formData: FormData): Promise<void> {
  const user = await requireServerPermission("social:generate")
  const supabase = await createClient()
  const { hospital } = await loadHospitalAndDoctors(supabase)

  const files = formData.getAll("images") as File[]
  const uploadType = (formData.get("upload_type") as string | null) ?? null
  const userText = (formData.get("text") as string | null)?.trim() || undefined
  const language = (formData.get("language") as string | null)?.trim() || undefined

  if (!files.length) throw new Error("At least one image is required.")
  if (files.length > 5) throw new Error("Maximum 5 images allowed.")
  if (uploadType !== "patient" && uploadType !== "infrastructure") {
    throw new Error('upload_type must be "patient" or "infrastructure".')
  }
  const ALLOWED = ["image/jpeg", "image/png", "image/webp"]
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) throw new Error(`Unsupported image type: ${f.type}`)
    if (f.size > 10 * 1024 * 1024) throw new Error("Each image must be ≤10MB.")
  }

  const visions = await Promise.all(files.map(async (file) => {
    const buf = Buffer.from(await file.arrayBuffer())
    const content = await generateVisionContent(
      { name: hospital.name, tone: hospital.tone, departments: hospital.departments },
      uploadType, buf, file.type, userText, language,
    )
    return { content, imageBuffer: buf, mimeType: file.type }
  }))

  const sharedHashtags = visions[0].content.hashtags
  const sharedCaption = visions[0].content.caption

  const department = hospital.departments[0] ?? null
  const postId = randomUUID()
  const { cover, slides } = await renderVisionContent(visions,
    { name: hospital.name, logoUrl: hospital.logoUrl }, department)

  let coverUrl: string
  let slideUrls: string[] = []
  try {
    coverUrl = await uploadJpeg(cover, `posts/${postId}/cover.jpg`)
    if (slides.length) {
      slideUrls = await Promise.all(slides.map((buf, i) =>
        uploadJpeg(buf, `posts/${postId}/slide-${i + 2}.jpg`),
      ))
    }
  } catch (e) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw e
  }

  const allSlideUrls = slideUrls.length ? [coverUrl!, ...slideUrls] : null

  const { error: insErr } = await supabase.from("SocialPost").insert({
    id: postId, caption: sharedCaption,
    hashtags: JSON.stringify(sharedHashtags),
    postType: visions[0].content.post_type,
    imageUrl: coverUrl!,
    slideUrls: allSlideUrls ? JSON.stringify(allSlideUrls) : null,
    status: "draft", source: "image",
    doctorId: null, createdById: user.id,
    updatedAt: new Date().toISOString(),
  })
  if (insErr) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw new Error(`DB insert failed: ${insErr.message}`)
  }

  redirect(`/social/${postId}`)
}
