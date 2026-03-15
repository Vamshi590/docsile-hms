import { SignJWT, jwtVerify } from "jose"

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "docsile-dev-secret-key-change-in-production"
)

const COOKIE_NAME = "docsile-session"
const EXPIRY = "7d"

export type JwtPayload = {
  sub: string // user id
  email: string
  role: string
  fullName: string
  permissions: string[]
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export { COOKIE_NAME }
