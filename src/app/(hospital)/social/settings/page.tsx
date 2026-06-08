// src/app/(hospital)/social/settings/page.tsx
import { createClient } from "@/lib/supabase/server"
import { InstagramConnectionCard } from "./components/InstagramConnectionCard"
import { SocialConfigForm } from "./components/SocialConfigForm"

export default async function SocialSettingsPage({
  searchParams,
}: { searchParams: Promise<{ ig_connected?: string; ig_error?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("HospitalProfile")
    .select("tone, departments, socialDailyCap, igUserId, igConnectedAt")
    .limit(1).single()

  const tone = profile?.tone ?? "friendly"
  const departments: string[] = JSON.parse(profile?.departments || "[]")
  const dailyCap = profile?.socialDailyCap ?? 5
  const connected = Boolean(profile?.igUserId)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Social Settings</h1>

      {sp.ig_connected && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-green-800">
          Instagram connected successfully.
        </div>
      )}
      {sp.ig_error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-800">
          Instagram error: {sp.ig_error}
        </div>
      )}

      <InstagramConnectionCard
        connected={connected}
        igUserId={profile?.igUserId ?? null}
        connectedAt={profile?.igConnectedAt ?? null}
      />

      <SocialConfigForm tone={tone} departments={departments} socialDailyCap={dailyCap} />
    </div>
  )
}
