import { callGemini as defaultCallGemini } from "@/lib/ai/gemini"
import type { VisionContent } from "./types"
import { GenerationError } from "./types"

type HospitalInput = { name: string; tone: string | null; departments: string[] }
type UploadType = "patient" | "infrastructure"
type Deps = { callGemini: typeof defaultCallGemini }

export function buildVisionPrompt(
  hospital: HospitalInput,
  uploadType: UploadType,
  userText: string | undefined,
  language: string | undefined,
): string {
  const forcedType = uploadType === "patient" ? "trust" : "promo"
  const tone = hospital.tone ?? "friendly"
  const lang = language ? `Write the caption and quote in ${language}.` : ""
  const ctx = userText ? `Additional context from the user: "${userText}".` : ""

  return [
    `You are a ${tone} social media writer for the hospital "${hospital.name}".`,
    `You are looking at an uploaded ${uploadType === "patient" ? "patient photo" : "hospital/infrastructure photo"}.`,
    ctx,
    lang,
    `Respond as STRICT JSON only:`,
    `{`,
    `  "post_type": "${forcedType}",`,
    `  "caption": string (max 2200 chars),`,
    `  "hashtags": string[] (5-15, no leading #),`,
    `  "quote": string | null (a short pull-quote, used as image overlay text)`,
    `}`,
    ``,
    `If post_type is not exactly "${forcedType}", the response is invalid.`,
  ].filter(Boolean).join("\n")
}

export function parseVisionResponse(raw: string): VisionContent {
  const stripped = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
  let obj: unknown
  try { obj = JSON.parse(stripped) } catch (e) {
    throw new GenerationError(`Vision JSON parse failed: ${(e as Error).message}`, raw)
  }
  const o = obj as Partial<VisionContent>
  if (o.post_type !== "trust" && o.post_type !== "promo") {
    throw new GenerationError(`Invalid vision post_type: ${o.post_type}`, raw)
  }
  if (typeof o.caption !== "string" || !o.caption.trim()) throw new GenerationError("Missing caption", raw)
  if (!Array.isArray(o.hashtags)) throw new GenerationError("hashtags must be array", raw)
  return {
    post_type: o.post_type,
    caption: o.caption.slice(0, 2200),
    hashtags: o.hashtags.map((h: string) => h.replace(/^#/, "")),
    quote: o.quote ?? undefined,
  }
}

export async function generateVisionContent(
  hospital: HospitalInput,
  uploadType: UploadType,
  imageBuffer: Buffer,
  mimeType: string,
  userText?: string,
  language?: string,
  deps: Deps = { callGemini: defaultCallGemini },
): Promise<VisionContent> {
  const system = buildVisionPrompt(hospital, uploadType, userText, language)
  const result = await deps.callGemini({
    system,
    messages: [{ role: "user", image: { mimeType, data: imageBuffer.toString("base64") } }],
    temperature: 0.8, maxOutputTokens: 1024,
  })
  if (!result.ok) throw new GenerationError(`Gemini error: ${result.error}`)
  return parseVisionResponse(result.text)
}
