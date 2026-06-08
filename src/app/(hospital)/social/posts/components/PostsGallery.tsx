import { PostCard } from "./PostCard"

type Row = {
  id: string; caption: string; postType: string; status: string;
  imageUrl: string; slideUrls: string | null;
  createdAt: string; postedAt: string | null
}

export function PostsGallery({ posts }: { posts: Row[] }) {
  if (!posts.length) {
    return <div className="text-sm text-zinc-600">No posts yet. Click "Generate" to create your first one.</div>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => <PostCard key={p.id} {...p} />)}
    </div>
  )
}
