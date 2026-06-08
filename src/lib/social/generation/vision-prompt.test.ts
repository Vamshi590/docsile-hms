import { describe, it, expect, vi } from "vitest"
import { buildVisionPrompt, parseVisionResponse, generateVisionContent } from "./vision-prompt"
import { GenerationError } from "./types"

describe("buildVisionPrompt", () => {
  it("forces post_type=trust for patient uploads", () => {
    const sys = buildVisionPrompt({ name: "X", tone: "friendly", departments: [] }, "patient", undefined, undefined)
    expect(sys).toMatch(/post_type.*trust/i)
  })

  it("forces post_type=promo for infrastructure uploads", () => {
    const sys = buildVisionPrompt({ name: "X", tone: "friendly", departments: [] }, "infrastructure", undefined, undefined)
    expect(sys).toMatch(/post_type.*promo/i)
  })

  it("includes user-provided text and language", () => {
    const sys = buildVisionPrompt({ name: "X", tone: "friendly", departments: [] }, "patient", "loved the care", "Telugu")
    expect(sys).toMatch(/loved the care/)
    expect(sys).toMatch(/Telugu/)
  })
})

describe("parseVisionResponse", () => {
  it("parses valid trust JSON", () => {
    const r = parseVisionResponse(JSON.stringify({
      post_type: "trust", caption: "Thank you", hashtags: ["care"], quote: "Amazing service",
    }))
    expect(r.post_type).toBe("trust")
    expect(r.quote).toBe("Amazing service")
  })

  it("rejects mismatched post_type", () => {
    expect(() => parseVisionResponse(JSON.stringify({
      post_type: "engagement", caption: "x", hashtags: [],
    }))).toThrow(GenerationError)
  })
})

describe("generateVisionContent", () => {
  it("sends image data inline to Gemini", async () => {
    const callGemini = vi.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({ post_type: "trust", caption: "c", hashtags: ["h"], quote: "q" }),
    })
    const r = await generateVisionContent(
      { name: "X", tone: "friendly", departments: [] },
      "patient", Buffer.from("img"), "image/jpeg",
      undefined, undefined, { callGemini } as never,
    )
    expect(r.caption).toBe("c")
    expect(callGemini).toHaveBeenCalledTimes(1)
    const msg = callGemini.mock.calls[0][0].messages[0]
    expect("image" in msg).toBe(true)
  })
})
