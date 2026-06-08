import { describe, it, expect, vi } from "vitest"
import { buildAiPrompt, parseAiResponse, generateAiContent } from "./ai-prompt"
import { GenerationError } from "./types"

describe("buildAiPrompt", () => {
  it("includes hospital tone, name, address, departments", () => {
    const sys = buildAiPrompt({
      name: "Vennela", address: "Eluru", tone: "friendly",
      departments: ["Eye", "General"],
    }, [])
    expect(sys).toMatch(/Vennela/)
    expect(sys).toMatch(/Eluru/)
    expect(sys).toMatch(/friendly/)
    expect(sys).toMatch(/Eye, General/)
  })

  it("includes doctor names when present", () => {
    const sys = buildAiPrompt(
      { name: "X", address: "Y", tone: "professional", departments: [] },
      [{ id: "1", fullName: "Dr. A", qualifications: "MBBS", department: "Eye" }],
    )
    expect(sys).toMatch(/Dr\. A/)
  })

  it("notes when no doctors are available (forbids doctor post type)", () => {
    const sys = buildAiPrompt({ name: "X", address: "Y", tone: "professional", departments: [] }, [])
    expect(sys).toMatch(/no doctors|do not generate.*doctor/i)
  })
})

describe("parseAiResponse", () => {
  it("parses valid JSON", () => {
    const json = JSON.stringify({
      post_type: "promo", caption: "Hello", hashtags: ["eye", "care"], image_idea: "x",
    })
    const r = parseAiResponse(json)
    expect(r.post_type).toBe("promo")
  })

  it("strips ```json fences", () => {
    const json = "```json\n" + JSON.stringify({
      post_type: "promo", caption: "Hi", hashtags: ["h"], image_idea: "x",
    }) + "\n```"
    expect(parseAiResponse(json).caption).toBe("Hi")
  })

  it("requires slides for educational", () => {
    const json = JSON.stringify({ post_type: "educational", caption: "c", hashtags: [], image_idea: "x" })
    expect(() => parseAiResponse(json)).toThrow(GenerationError)
  })

  it("rejects unknown post_type", () => {
    const json = JSON.stringify({ post_type: "weird", caption: "c", hashtags: [], image_idea: "x" })
    expect(() => parseAiResponse(json)).toThrow(GenerationError)
  })

  it("rejects malformed JSON", () => {
    expect(() => parseAiResponse("not json")).toThrow(GenerationError)
  })

  it("strips leading # from hashtags", () => {
    const json = JSON.stringify({
      post_type: "promo", caption: "c", hashtags: ["#eye", "care"], image_idea: "x",
    })
    expect(parseAiResponse(json).hashtags).toEqual(["eye", "care"])
  })
})

describe("generateAiContent", () => {
  it("calls Gemini and returns parsed content", async () => {
    const callGemini = vi.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        post_type: "promo", caption: "Hello", hashtags: ["x"], image_idea: "i",
      }),
    })
    const r = await generateAiContent(
      { name: "X", address: "Y", tone: "friendly", departments: [] },
      [], { callGemini } as never,
    )
    expect(r.caption).toBe("Hello")
    expect(callGemini).toHaveBeenCalledTimes(1)
  })

  it("throws GenerationError when Gemini returns ok:false", async () => {
    const callGemini = vi.fn().mockResolvedValue({ ok: false, error: "rate limit" })
    await expect(generateAiContent(
      { name: "X", address: "Y", tone: "friendly", departments: [] }, [],
      { callGemini } as never,
    )).rejects.toThrow(GenerationError)
  })
})
