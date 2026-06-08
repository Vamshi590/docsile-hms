"use client"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updatePost } from "../actions"

export function PostEditor(props: { postId: string; initialCaption: string; initialHashtags: string[]; readOnly: boolean }) {
  const [caption, setCaption] = useState(props.initialCaption)
  const [hashtagText, setHashtagText] = useState(props.initialHashtags.join(" "))
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const save = () => start(async () => {
    const tags = hashtagText.split(/\s+/).map((s) => s.replace(/^#/, "")).filter(Boolean)
    try {
      await updatePost({ postId: props.postId, caption, hashtags: tags })
      setMsg("Saved.")
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed.")
    }
  })

  return (
    <div className="space-y-3">
      <Label>Caption</Label>
      <Textarea rows={10} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={props.readOnly} />
      <div className="text-xs text-zinc-500">{caption.length}/2200</div>

      <Label>Hashtags (space-separated, no #)</Label>
      <Input value={hashtagText} onChange={(e) => setHashtagText(e.target.value)} disabled={props.readOnly} />

      {!props.readOnly && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          {msg && <span className="text-sm text-zinc-600">{msg}</span>}
        </div>
      )}
    </div>
  )
}
