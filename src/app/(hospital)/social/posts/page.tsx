import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { PostsGallery } from "./components/PostsGallery"

export default async function PostsListPage() {
  const supabase = await createClient()
  const { data: posts } = await supabase
    .from("SocialPost")
    .select("id, caption, postType, status, imageUrl, slideUrls, createdAt, postedAt")
    .order("createdAt", { ascending: false })
    .limit(60)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Social Posts</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/social/settings">Settings</Link></Button>
          <Button asChild><Link href="/social/generate">+ Generate</Link></Button>
        </div>
      </div>
      <PostsGallery posts={posts ?? []} />
    </div>
  )
}
