import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { COOKIE_NAME } from "@/lib/jwt"

async function clearAndRedirect(req: NextRequest | null) {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  const base = req?.nextUrl ?? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  return NextResponse.redirect(new URL("/login", base))
}

export async function POST() {
  return clearAndRedirect(null)
}

// Also support GET so server components can `redirect("/api/logout")` when
// they need to invalidate a stale-but-cryptographically-valid JWT (e.g. after
// a role's permissions are updated). Without this, the cookie stays valid and
// middleware bounces the user back into an authenticated route → redirect loop.
export async function GET(req: NextRequest) {
  return clearAndRedirect(req)
}
