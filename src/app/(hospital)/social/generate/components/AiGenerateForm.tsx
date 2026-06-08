"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { generateAi } from "../actions"

const POST_TYPE_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "auto",        label: "Let AI choose",         hint: "Gemini picks the most fitting type" },
  { value: "doctor",      label: "Doctor spotlight",      hint: "Highlights one of your doctors (requires a doctor profile)" },
  { value: "educational", label: "Educational carousel",  hint: 'Multi-slide "Did You Know?" tips' },
  { value: "promo",       label: "Promo / offer",         hint: "Announce a service or special offer" },
  { value: "engagement",  label: "Engagement / poll",     hint: "Asks a question to drive comments" },
  { value: "trust",       label: "Trust / testimonial",   hint: "Multi-slide testimonial-style post" },
]

export function AiGenerateForm() {
  const [postType, setPostType] = useState<string>("auto")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selected = POST_TYPE_OPTIONS.find((o) => o.value === postType)

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Gemini writes a draft using your hospital profile (name, tone, departments, doctors).
      </p>

      <div className="space-y-2">
        <Label>Post type</Label>
        <Select value={postType} onValueChange={setPostType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {POST_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && <div className="text-xs text-zinc-500">{selected.hint}</div>}
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <Button
        onClick={() => start(async () => {
          try {
            setError(null)
            await generateAi({ postType: postType === "auto" ? undefined : postType })
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed.")
          }
        })}
        disabled={pending}
      >
        {pending ? "Generating…" : "Generate AI Post"}
      </Button>
    </div>
  )
}
