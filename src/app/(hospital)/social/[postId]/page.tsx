import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { PostEditor } from "./components/PostEditor"
import { PublishButton } from "./components/PublishButton"
import { InstagramPostCard } from "./components/InstagramPostCard"

export default async function PostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params
  const supabase = await createClient()

  const [postResult, profileResult] = await Promise.all([
    supabase
      .from("SocialPost")
      .select("id, caption, hashtags, imageUrl, slideUrls, postType, status, errorMessage, igPostId")
      .eq("id", postId).single(),
    supabase
      .from("HospitalProfile")
      .select("name, logoUrl")
      .limit(1).single(),
  ])

  const post = postResult.data
  if (!post) notFound()

  const hashtags: string[] = JSON.parse(post.hashtags || "[]")
  const slideUrls: string[] | null = post.slideUrls ? JSON.parse(post.slideUrls) : null
  const previews = slideUrls && slideUrls.length > 0 ? slideUrls : [post.imageUrl]
  const hospitalName = profileResult.data?.name ?? "hospital"
  const hospitalLogoUrl = profileResult.data?.logoUrl ?? null
  const isDraft = post.status === "draft"

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Top bar: back + status + publish */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/social/posts"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to posts
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-600">
            <span className="text-zinc-400">{post.postType}</span>
            <span className="mx-2 text-zinc-300">·</span>
            <span className={
              post.status === "posted" ? "text-green-700 font-medium"
              : post.status === "failed" ? "text-red-700 font-medium"
              : "text-zinc-700 font-medium"
            }>
              {post.status}
            </span>
            {post.igPostId && (
              <span className="ml-2 text-zinc-400">· ig <code className="text-zinc-500">{post.igPostId}</code></span>
            )}
          </div>
          {isDraft && <PublishButton postId={post.id} />}
        </div>
      </div>

      {post.errorMessage && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">
          Last publish error: {post.errorMessage}
        </div>
      )}

      {/* Two-column on desktop: IG preview on the left, editor on the right.
          Stacks on mobile with the preview first. */}
      <div className="grid grid-cols-1 lg:grid-cols-[470px_1fr] gap-6 lg:gap-8 items-start">
        <div>
          <InstagramPostCard
            hospitalName={hospitalName}
            hospitalLogoUrl={hospitalLogoUrl}
            caption={post.caption}
            hashtags={hashtags}
            slideUrls={previews}
          />
          <div className="mt-2 text-xs text-zinc-400 text-center">
            Live preview · how this will appear on Instagram
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-zinc-900">
              {isDraft ? "Edit caption and hashtags" : "Caption (read-only)"}
            </div>
            <div className="text-xs text-zinc-500">
              {isDraft
                ? "Changes apply to the preview when you save."
                : "This post has been published; the caption cannot be edited."}
            </div>
          </div>
          <PostEditor
            postId={post.id}
            initialCaption={post.caption}
            initialHashtags={hashtags}
            readOnly={!isDraft}
          />
        </div>
      </div>
    </div>
  )
}
