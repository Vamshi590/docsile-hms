import { NextResponse, type NextRequest } from "next/server"
import { verifyToken, COOKIE_NAME } from "./lib/jwt"

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const isAuth = token ? !!(await verifyToken(token)) : false

  const { pathname } = request.nextUrl

  // Skip auth redirect for requests without any cookies (PWA manifest probe, bots, etc.)
  // These are not real user navigations — no point redirecting them to /login
  if (!request.cookies.size && !pathname.startsWith("/login")) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to login
  if (
    !isAuth &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login
  if (isAuth && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Forward the current pathname to server components via a request header.
  // Next does not expose the pathname directly in server layouts, so we set it
  // here for the module-gate check downstream.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|manifest|sw\\.js)$).*)",
  ],
}
