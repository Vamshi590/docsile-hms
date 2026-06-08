import { describe, it, expect, vi, beforeEach } from "vitest"
import { exchangeCodeForToken, publishPost, publishCarousel } from "./instagram"

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  process.env.META_APP_ID = "app-id"
  process.env.META_APP_SECRET = "app-secret"
  process.env.META_OAUTH_REDIRECT_BASE = "https://x.test"
  process.env.GEMINI_API_KEY = "x"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "x"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x"
})

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

describe("exchangeCodeForToken", () => {
  it("walks the 5-step OAuth flow and returns long-lived page token", async () => {
    fetchMock
      .mockReturnValueOnce(json({ access_token: "short-user" }))
      .mockReturnValueOnce(json({ data: [{
        id: "page-1", name: "Clinic", access_token: "short-page",
        instagram_business_account: { id: "ig-123" },
      }] }))
      .mockReturnValueOnce(json({ access_token: "long-user" }))
      .mockReturnValueOnce(json({ access_token: "never-expires-page" }))
    const r = await exchangeCodeForToken("code-xyz")
    expect(r).toEqual({ access_token: "never-expires-page", ig_user_id: "ig-123" })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("throws if no Facebook pages found", async () => {
    fetchMock
      .mockReturnValueOnce(json({ access_token: "short-user" }))
      .mockReturnValueOnce(json({ data: [] }))
    await expect(exchangeCodeForToken("code")).rejects.toThrow(/No Facebook Pages/)
  })

  it("throws if no page has an IG business account", async () => {
    fetchMock
      .mockReturnValueOnce(json({ access_token: "short-user" }))
      .mockReturnValueOnce(json({ data: [{ id: "p", name: "n", access_token: "t" }] }))
    await expect(exchangeCodeForToken("code")).rejects.toThrow(/Instagram Business/)
  })
})

describe("publishPost", () => {
  it("creates container then publishes", async () => {
    fetchMock
      .mockReturnValueOnce(json({ id: "container-1" }))
      .mockReturnValueOnce(json({ id: "ig-post-1" }))
    const id = await publishPost("ig-user", "tok", "https://img/u.jpg", "caption")
    expect(id).toBe("ig-post-1")
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({
      image_url: "https://img/u.jpg", media_type: "IMAGE", caption: "caption",
    })
  })

  it("maps Meta error code 190 to TOKEN_EXPIRED", async () => {
    fetchMock.mockReturnValueOnce(json({ error: { code: 190, message: "expired" } }, 400))
    await expect(publishPost("u", "t", "i", "c")).rejects.toThrow(/TOKEN_EXPIRED/)
  })
})

describe("publishCarousel", () => {
  it("creates a container per slide, then a carousel, then publishes", async () => {
    fetchMock
      .mockReturnValueOnce(json({ id: "c1" }))
      .mockReturnValueOnce(json({ id: "c2" }))
      .mockReturnValueOnce(json({ id: "carousel-1" }))
      .mockReturnValueOnce(json({ id: "ig-post-1" }))
    const id = await publishCarousel("u", "t", ["https://a", "https://b"], "cap")
    expect(id).toBe("ig-post-1")
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
