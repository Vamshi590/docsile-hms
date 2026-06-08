import { describe, it, expect, beforeEach } from "vitest"
import { encryptToken, decryptToken } from "./tokens"

describe("token encryption", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "x"
    process.env.META_APP_SECRET = "x"
    process.env.META_OAUTH_REDIRECT_BASE = "https://x.test"
    process.env.GEMINI_API_KEY = "x"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "x"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x"
  })

  it("round-trips a token", () => {
    const enc = encryptToken("EAAGm0PX4ZCpsBA...example")
    expect(enc).not.toContain("EAAGm0PX4ZCpsBA")
    expect(decryptToken(enc)).toBe("EAAGm0PX4ZCpsBA...example")
  })

  it("produces different ciphertext each call (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"))
  })

  it("rejects tampered ciphertext", () => {
    const enc = encryptToken("secret")
    const [iv, tag, ct] = enc.split(":")
    const tamperedCt = Buffer.from(ct, "base64")
    tamperedCt[0] ^= 0xff
    const tampered = `${iv}:${tag}:${tamperedCt.toString("base64")}`
    expect(() => decryptToken(tampered)).toThrow()
  })
})
