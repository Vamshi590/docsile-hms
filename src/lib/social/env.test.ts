import { describe, it, expect, beforeEach } from "vitest"
import { requireSocialEnv } from "./env"

const REQUIRED = [
  "META_APP_ID", "META_APP_SECRET", "META_OAUTH_REDIRECT_BASE",
  "GEMINI_API_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
]

describe("requireSocialEnv", () => {
  beforeEach(() => {
    for (const k of REQUIRED) process.env[k] = "x"
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64")
  })

  it("returns env object when all vars present", () => {
    const env = requireSocialEnv()
    expect(env.META_APP_ID).toBe("x")
    expect(env.GEMINI_MODEL).toBeDefined() // has default
  })

  it("throws if META_APP_ID missing", () => {
    delete process.env.META_APP_ID
    expect(() => requireSocialEnv()).toThrow(/META_APP_ID/)
  })

  it("throws if SOCIAL_TOKEN_ENCRYPTION_KEY is not 32 bytes after base64 decode", () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64")
    expect(() => requireSocialEnv()).toThrow(/32 bytes/)
  })
})
