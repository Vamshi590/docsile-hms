"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { generateAi } from "../actions"

const POST_TYPE_OPTIONS: Array<{
  value: string
  label: string
  hint: string
  contextLabel: string
  contextPlaceholder: string
  contextRequired?: boolean
}> = [
  {
    value: "auto",
    label: "Let AI choose",
    hint: "Gemini picks the most fitting type",
    contextLabel: "Context (optional)",
    contextPlaceholder: "Anything specific the post should talk about? Leave blank for a free-form draft.",
  },
  {
    value: "doctor",
    label: "Doctor spotlight",
    hint: "Highlights one of your doctors (requires a doctor profile)",
    contextLabel: "Anything specific to highlight? (optional)",
    contextPlaceholder: "e.g. New consultant joining this month, or a specific achievement.",
  },
  {
    value: "educational",
    label: "Educational carousel",
    hint: 'Multi-slide "Did You Know?" tips',
    contextLabel: "Topic to cover (optional)",
    contextPlaceholder: "e.g. Diabetes and eye health, signs of glaucoma, post-cataract-surgery care.",
  },
  {
    value: "promo",
    label: "Promo / offer",
    hint: "Announce a service or special offer",
    contextLabel: "What are you promoting?",
    contextPlaceholder: "e.g. Free eye check-up camp on Sunday Jan 14 at our Eluru branch — bring an Aadhaar card.",
    contextRequired: true,
  },
  {
    value: "engagement",
    label: "Engagement / poll",
    hint: "Asks a question to drive comments",
    contextLabel: "Topic to ask about (optional)",
    contextPlaceholder: "e.g. Screen-time habits, last eye check-up, family eye-care experiences.",
  },
  {
    value: "trust",
    label: "Trust / testimonial",
    hint: "Multi-slide testimonial-style post",
    contextLabel: "Testimonial details (optional)",
    contextPlaceholder: "e.g. Patient name, condition treated, what they said about us.",
  },
]

export function AiGenerateForm() {
  const [postType, setPostType] = useState<string>("auto")
  const [context, setContext] = useState<string>("")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selected = POST_TYPE_OPTIONS.find((o) => o.value === postType) ?? POST_TYPE_OPTIONS[0]

  const submit = () => start(async () => {
    setError(null)
    if (selected.contextRequired && !context.trim()) {
      setError(`${selected.label} needs context — please describe what you're promoting.`)
      return
    }
    try {
      await generateAi({
        postType: postType === "auto" ? undefined : postType,
        context: context.trim() || undefined,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed.")
    }
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Gemini writes a draft using your hospital profile (name, tone, departments, doctors).
      </p>

      <div className="space-y-2">
        <Label>Post type</Label>
        <Select value={postType} onValueChange={(v) => { setPostType(v); /* keep context across switches */ }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {POST_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-zinc-500">{selected.hint}</div>
      </div>

      <div className="space-y-2">
        <Label>
          {selected.contextLabel}
          {selected.contextRequired && <span className="text-red-600 ml-1">*</span>}
        </Label>
        <Textarea
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={selected.contextPlaceholder}
        />
        <div className="text-xs text-zinc-500">{context.length}/600</div>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <Button onClick={submit} disabled={pending}>
        {pending ? "Generating…" : "Generate AI Post"}
      </Button>
    </div>
  )
}
