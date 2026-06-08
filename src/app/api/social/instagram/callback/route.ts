// src/app/api/social/instagram/callback/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { exchangeCodeForToken } from "@/lib/social/instagram"
import { encryptToken } from "@/lib/social/tokens"

function redirect(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/social/settings?${query}`, req.url))
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error")

  if (error) return redirect(req, `ig_error=${encodeURIComponent(error)}`)
  if (!code || !state) return redirect(req, `ig_error=missing-code-or-state`)

  const supabase = await createClient()
  const { data: stateRow } = await supabase
    .from("OAuthState").select("*").eq("state", state).maybeSingle()

  await supabase.from("OAuthState").delete().eq("state", state)
  if (!stateRow || new Date(stateRow.expiresAt).getTime() < Date.now()) {
    return redirect(req, `ig_error=invalid-or-expired-state`)
  }

  try {
    const { access_token, ig_user_id } = await exchangeCodeForToken(code)
    const enc = encryptToken(access_token)
    const { data: profile } = await supabase
      .from("HospitalProfile").select("id").limit(1).single()
    if (!profile) throw new Error("HospitalProfile not found")
    const { error: updErr } = await supabase
      .from("HospitalProfile")
      .update({ igAccessToken: enc, igUserId: ig_user_id, igConnectedAt: new Date().toISOString() })
      .eq("id", profile.id)
    if (updErr) throw new Error(updErr.message)
    return redirect(req, "ig_connected=1")
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown-error"
    return redirect(req, `ig_error=${encodeURIComponent(msg)}`)
  }
}
