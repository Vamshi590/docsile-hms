"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { publishPost } from "../actions"

export function PublishButton({ postId }: { postId: string }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const click = () => start(async () => {
    setErr(null)
    const r = await publishPost({ postId })
    if (!r.success) setErr(r.quota ? `Quota exceeded: ${r.quota.used}/${r.quota.limit} today` : (r.error ?? "Failed"))
  })
  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={click} disabled={pending}>{pending ? "Publishing…" : "Publish to Instagram"}</Button>
      {err && <div className="text-sm text-red-700">{err}</div>}
    </div>
  )
}
