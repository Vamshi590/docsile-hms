const REQUIRED = [
  "META_APP_ID", "META_APP_SECRET", "META_OAUTH_REDIRECT_BASE",
  "GEMINI_API_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
] as const

export type SocialEnv = {
  META_APP_ID: string
  META_APP_SECRET: string
  META_OAUTH_REDIRECT_BASE: string
  META_OAUTH_CALLBACK: string
  GEMINI_API_KEY: string
  GEMINI_MODEL: string
  SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer
  NEXT_PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export function requireSocialEnv(): SocialEnv {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Social module env vars missing: ${missing.join(", ")}`)
  }
  const key = Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY!, "base64")
  if (key.length !== 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -base64 32)")
  }
  const base = process.env.META_OAUTH_REDIRECT_BASE!.replace(/\/$/, "")
  return {
    META_APP_ID: process.env.META_APP_ID!,
    META_APP_SECRET: process.env.META_APP_SECRET!,
    META_OAUTH_REDIRECT_BASE: base,
    META_OAUTH_CALLBACK: `${base}/api/social/instagram/callback`,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    SOCIAL_TOKEN_ENCRYPTION_KEY: key,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }
}
