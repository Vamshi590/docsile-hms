"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { generateAi } from "../actions"

export function AiGenerateForm() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Let Gemini pick a post type and write a draft using your hospital profile.
      </p>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <Button onClick={() => start(async () => {
        try { setError(null); await generateAi() }
        catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed.") }
      })} disabled={pending}>
        {pending ? "Generating…" : "Generate AI Post"}
      </Button>
    </div>
  )
}
