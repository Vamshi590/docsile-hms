import { callGemini as defaultCallGemini } from "@/lib/ai/gemini"
import type { GeneratedContent, PostType } from "./types"
import { GenerationError } from "./types"

type HospitalInput = {
  name: string
  address: string | null
  tone: string | null
  departments: string[]
}

type DoctorInput = {
  id: string
  fullName: string
  qualifications: string | null
  department: string | null
}

const VALID_TYPES: PostType[] = ["doctor", "educational", "promo", "engagement", "trust"]

export function buildAiPrompt(hospital: HospitalInput, doctors: DoctorInput[]): string {
  const tone = hospital.tone ?? "friendly"
  const depts = hospital.departments.length ? hospital.departments.join(", ") : "general medicine"
  const doctorLines = doctors.length
    ? doctors.map((d) => `- ${d.fullName} (${d.department ?? "—"}, ${d.qualifications ?? "—"})`).join("\n")
    : "(no doctors available — do not generate a doctor post type)"

  return [
    `You are a social media manager for a ${tone} hospital named "${hospital.name}" located in ${hospital.address ?? "India"}.`,
    `Available departments: ${depts}.`,
    `Doctors on staff:`,
    doctorLines,
    ``,
    `Generate exactly one Instagram post.`,
    `Respond as STRICT JSON only (no prose, no markdown fences).`,
    `Schema:`,
    `{`,
    `  "post_type": one of ${VALID_TYPES.map((t) => `"${t}"`).join(" | ")},`,
    `  "caption": string (max 2200 chars, the Instagram caption),`,
    `  "hashtags": string[] (5-15 items, no leading #),`,
    `  "image_idea": string (brief description of the visual concept),`,
    `  "department": string | null (matches one of the available departments),`,
    `  "slides": Slide[] (REQUIRED iff post_type is "educational" or "trust"; 3-5 items)`,
    `}`,
    `where Slide = { "heading": string | null, "body": string }.`,
    `For educational: slide 1 = "Did You Know?" title; slides 2-N = numbered points.`,
    `For trust: each slide is a testimonial quote.`,
  ].join("\n")
}

export function parseAiResponse(raw: string): GeneratedContent {
  const stripped = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
  let obj: unknown
  try { obj = JSON.parse(stripped) } catch (e) {
    throw new GenerationError(`Gemini returned malformed JSON: ${(e as Error).message}`, raw)
  }
  const o = obj as Partial<GeneratedContent>
  if (!o.post_type || !VALID_TYPES.includes(o.post_type as PostType)) {
    throw new GenerationError(`Invalid post_type: ${o.post_type}`, raw)
  }
  if (typeof o.caption !== "string" || !o.caption.trim()) {
    throw new GenerationError("Missing caption", raw)
  }
  if (!Array.isArray(o.hashtags)) {
    throw new GenerationError("hashtags must be an array", raw)
  }
  if (typeof o.image_idea !== "string") {
    throw new GenerationError("Missing image_idea", raw)
  }
  if (o.post_type === "educational" || o.post_type === "trust") {
    if (!Array.isArray(o.slides) || o.slides.length < 2) {
      throw new GenerationError(`${o.post_type} requires slides[]`, raw)
    }
  }
  return {
    post_type: o.post_type as PostType,
    caption: o.caption.slice(0, 2200),
    hashtags: o.hashtags.map((h: string) => h.replace(/^#/, "")),
    image_idea: o.image_idea,
    department: o.department ?? undefined,
    slides: o.slides ?? undefined,
  }
}

type Deps = { callGemini: typeof defaultCallGemini }

export async function generateAiContent(
  hospital: HospitalInput,
  doctors: DoctorInput[],
  deps: Deps = { callGemini: defaultCallGemini },
): Promise<GeneratedContent> {
  const system = buildAiPrompt(hospital, doctors)
  const result = await deps.callGemini({
    system,
    messages: [{ role: "user", text: "Generate the post now." }],
    temperature: 0.9,
    maxOutputTokens: 2048,
  })
  if (!result.ok) throw new GenerationError(`Gemini error: ${result.error}`)
  return parseAiResponse(result.text)
}
