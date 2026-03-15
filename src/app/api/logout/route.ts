import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { COOKIE_NAME } from "@/lib/jwt"

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  return NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  )
}
