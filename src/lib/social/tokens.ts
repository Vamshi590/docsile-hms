import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { requireSocialEnv } from "./env"

const ALGO = "aes-256-gcm"

export function encryptToken(plaintext: string): string {
  const { SOCIAL_TOKEN_ENCRYPTION_KEY: key } = requireSocialEnv()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`
}

export function decryptToken(encoded: string): string {
  const { SOCIAL_TOKEN_ENCRYPTION_KEY: key } = requireSocialEnv()
  const [ivB64, tagB64, ctB64] = encoded.split(":")
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed encrypted token")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const ct = Buffer.from(ctB64, "base64")
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
}
