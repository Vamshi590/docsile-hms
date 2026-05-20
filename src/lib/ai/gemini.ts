// Minimal server-side wrapper around the Gemini REST API.
//
// Why REST and not the @google/genai SDK:
//  - Zero extra dependencies, smaller server bundle
//  - The shape we need is tiny; the SDK adds breaking-change risk
//  - Easy to swap model id via env var without code changes
//
// Cost note: defaults to gemini-2.5-flash-lite, the cheapest tier. Override
// with GEMINI_MODEL if you need bigger reasoning.

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

export type GeminiMessage = {
  role: "user" | "model"
  text: string
}

export type GeminiCallOpts = {
  system: string
  messages: GeminiMessage[]
  maxOutputTokens?: number
  temperature?: number
}

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

export async function callGemini(opts: GeminiCallOpts): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { ok: false, error: "Gemini API key is not configured." }
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: opts.messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
    },
    // Loose safety — clinicians discuss conditions/medications; over-blocking
    // makes the assistant useless. Still blocks egregious content.
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("Gemini API error:", res.status, detail)
      return { ok: false, error: `Gemini request failed (${res.status}).` }
    }
    const json = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
      promptFeedback?: { blockReason?: string }
    }
    if (json.promptFeedback?.blockReason) {
      return { ok: false, error: `Request was blocked: ${json.promptFeedback.blockReason}` }
    }
    const parts = json.candidates?.[0]?.content?.parts ?? []
    const text = parts.map(p => p.text ?? "").join("").trim()
    if (!text) {
      return { ok: false, error: "No response from model." }
    }
    return { ok: true, text }
  } catch (err) {
    console.error("Gemini fetch error:", err)
    return { ok: false, error: "Could not reach Gemini." }
  }
}
