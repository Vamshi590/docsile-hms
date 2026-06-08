import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PostEditor } from "./components/PostEditor"
import { PublishButton } from "./components/PublishButton"

export default async function PostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from("SocialPost")
    .select("id, caption, hashtags, imageUrl, slideUrls, postType, status, errorMessage, igPostId")
    .eq("id", postId).single()
  if (!post) notFound()

  const hashtags: string[] = JSON.parse(post.hashtags || "[]")
  const slideUrls: string[] | null = post.slideUrls ? JSON.parse(post.slideUrls) : null
  const previews = slideUrls && slideUrls.length > 0 ? slideUrls : [post.imageUrl]

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Post · {post.postType}</h1>
          <div className="text-sm text-zinc-600 mt-1">Status: <span className="font-medium">{post.status}</span>
            {post.igPostId && <> · IG id <code>{post.igPostId}</code></>}
          </div>
        </div>
        {post.status === "draft" && <PublishButton postId={post.id} />}
      </div>

      {post.errorMessage && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">
          Last publish error: {post.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="font-medium">Preview {previews.length > 1 && `(${previews.length} slides)`}</div>
          <div className="flex gap-2 overflow-x-auto">
            {previews.map((u, i) => (
              <img key={u} src={u} alt={`slide ${i + 1}`} className="w-72 rounded-lg border" />
            ))}
          </div>
        </div>

        <PostEditor postId={post.id} initialCaption={post.caption} initialHashtags={hashtags} readOnly={post.status !== "draft"} />
      </div>
    </div>
  )
}
