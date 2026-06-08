import Link from "next/link"
import { Instagram } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { PostsGallery } from "./components/PostsGallery"

export default async function PostsListPage() {
  const supabase = await createClient()

  const [postsResult, profileResult] = await Promise.all([
    supabase
      .from("SocialPost")
      .select("id, caption, postType, status, imageUrl, slideUrls, createdAt, postedAt")
      .order("createdAt", { ascending: false })
      .limit(60),
    supabase
      .from("HospitalProfile")
      .select("igUserId")
      .limit(1)
      .single(),
  ])

  const posts = postsResult.data ?? []
  const igConnected = Boolean(profileResult.data?.igUserId)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Social Posts</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/social/settings">Settings</Link></Button>
          <Button asChild><Link href="/social/generate">+ Generate</Link></Button>
        </div>
      </div>

      {!igConnected && (
        <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-white border border-pink-200 flex items-center justify-center shrink-0">
              <Instagram className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <div className="font-medium text-pink-900">Instagram not connected</div>
              <div className="text-sm text-pink-800/80 mt-0.5">
                Connect your hospital&apos;s Instagram Business account to publish posts directly from here.
                You can still generate drafts without connecting.
              </div>
            </div>
          </div>
          <Button asChild className="bg-pink-600 hover:bg-pink-700">
            <a href="/api/social/instagram/connect">Connect Instagram</a>
          </Button>
        </div>
      )}

      <PostsGallery posts={posts} />
    </div>
  )
}
