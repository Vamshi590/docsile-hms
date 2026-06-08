// src/app/api/social/instagram/connect/route.ts
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { requireServerPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { requireSocialEnv } from "@/lib/social/env"

export async function GET(_req: NextRequest) {
  const user = await requireServerPermission("social:connect")
  const { META_APP_ID, META_OAUTH_CALLBACK } = requireSocialEnv()
  const supabase = await createClient()

  const state = randomBytes(16).toString("hex")
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { error } = await supabase.from("OAuthState").insert({
    state, userId: user.id, purpose: "instagram_connect", expiresAt,
  })
  if (error) return NextResponse.redirect(new URL("/social/settings?ig_error=state-init-failed", _req.url))

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_OAUTH_CALLBACK,
    scope: [
      "public_profile", "business_management", "instagram_basic",
      "instagram_content_publish", "pages_show_list",
      "pages_read_engagement", "pages_manage_posts",
    ].join(","),
    response_type: "code",
    state,
  })
  return NextResponse.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`)
}
