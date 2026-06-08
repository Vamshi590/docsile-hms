"use client"
import Link from "next/link"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { PostStatusBadge } from "./PostStatusBadge"
import { deletePost } from "../actions"

export function PostCard(props: {
  id: string; caption: string; postType: string; status: string;
  imageUrl: string; slideUrls: string | null;
  createdAt: string; postedAt: string | null;
}) {
  const [pending, start] = useTransition()
  const isCarousel = props.slideUrls && JSON.parse(props.slideUrls).length > 1
  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      <Link href={`/social/${props.id}`}>
        <img src={props.imageUrl} alt="" className="w-full aspect-square object-cover" />
      </Link>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{props.postType}{isCarousel && " · carousel"}</span>
          <PostStatusBadge status={props.status} />
        </div>
        <div className="text-sm line-clamp-2">{props.caption}</div>
        <div className="flex items-center justify-between pt-2">
          <Link href={`/social/${props.id}`} className="text-sm underline">Open</Link>
          <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => start(async () => {
                    if (confirm("Delete this post?")) await deletePost({ postId: props.id })
                  })}>Delete</Button>
        </div>
      </div>
    </div>
  )
}
