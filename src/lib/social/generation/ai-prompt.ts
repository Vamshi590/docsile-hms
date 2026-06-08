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

export function buildAiPrompt(
  hospital: HospitalInput,
  doctors: DoctorInput[],
  forcedType?: PostType,
  userContext?: string,
): string {
  const tone = hospital.tone ?? "friendly"
  const depts = hospital.departments.length ? hospital.departments.join(", ") : "general medicine"
  const doctorLines = doctors.length
    ? doctors.map((d) => `- ${d.fullName} (${d.department ?? "—"}, ${d.qualifications ?? "—"})`).join("\n")
    : "(no doctors available — do not generate a doctor post type)"

  const postTypeLine = forcedType
    ? `  "post_type": MUST be exactly "${forcedType}",`
    : `  "post_type": one of ${VALID_TYPES.map((t) => `"${t}"`).join(" | ")},`

  const contextLine = userContext?.trim()
    ? `Additional context from the user — base the post on this:\n"${userContext.trim()}"`
    : ``

  return [
    `You are a social media manager for a ${tone} hospital named "${hospital.name}" located in ${hospital.address ?? "India"}.`,
    `Available departments: ${depts}.`,
    `Doctors on staff:`,
    doctorLines,
    ``,
    contextLine,
    contextLine ? `` : ``,
    `Generate exactly one Instagram post.`,
    forcedType
      ? `The post MUST be of type "${forcedType}". Do not choose a different type.`
      : ``,
    `Respond as STRICT JSON only (no prose, no markdown fences).`,
    `Schema:`,
    `{`,
    postTypeLine,
    `  "caption": string (max 2200 chars, the Instagram caption),`,
    `  "hashtags": string[] (5-15 items, no leading #),`,
    `  "image_idea": string (brief description of the visual concept),`,
    `  "department": string | null (matches one of the available departments),`,
    `  "slides": Slide[] (REQUIRED iff post_type is "educational" or "trust"; 3-5 items)`,
    `}`,
    `where Slide = { "heading": string | null, "body": string }.`,
    `For educational: slide 1 = "Did You Know?" title; slides 2-N = numbered points.`,
    `For trust: each slide is a testimonial quote.`,
    `For engagement: the FIRST LINE of caption MUST be an open-ended question ending in "?"`,
    `  (e.g. "When was your last eye check-up?"). Keep the question under 90 characters.`,
    `  After the question, optionally add 1-2 lines of context, then a CTA like "Tell us in the comments".`,
    `For promo: the FIRST LINE of caption is a short bold headline (≤60 chars), then a blank line,`,
    `  then 1-2 lines of supporting body copy.`,
  ].filter(Boolean).join("\n")
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

type Opts = {
  callGemini?: typeof defaultCallGemini
  forcedType?: PostType
  userContext?: string
}

export async function generateAiContent(
  hospital: HospitalInput,
  doctors: DoctorInput[],
  opts: Opts = {},
): Promise<GeneratedContent> {
  const callGemini = opts.callGemini ?? defaultCallGemini
  const system = buildAiPrompt(hospital, doctors, opts.forcedType, opts.userContext)
  const result = await callGemini({
    system,
    messages: [{ role: "user", text: "Generate the post now." }],
    temperature: 0.9,
    maxOutputTokens: 2048,
  })
  if (!result.ok) throw new GenerationError(`Gemini error: ${result.error}`)
  const parsed = parseAiResponse(result.text)
  // Defense-in-depth: if Gemini ignored the forcedType instruction, override.
  if (opts.forcedType && parsed.post_type !== opts.forcedType) {
    parsed.post_type = opts.forcedType
  }
  return parsed
}
