// src/app/(hospital)/social/settings/components/SocialConfigForm.tsx
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateSocialConfig } from "../actions"

const DEPT_OPTIONS = ["Eye", "Dental", "Skin", "Orthopedic", "Pediatric", "General"]

export function SocialConfigForm(props: { tone: string; departments: string[]; socialDailyCap: number }) {
  const [tone, setTone] = useState(props.tone)
  const [departments, setDepartments] = useState<string[]>(props.departments)
  const [cap, setCap] = useState(props.socialDailyCap)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const toggleDept = (d: string) =>
    setDepartments((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const submit = () => start(async () => {
    try {
      await updateSocialConfig({ tone, departments, socialDailyCap: cap })
      setMsg("Saved.")
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed.")
    }
  })

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="font-medium">AI Generation Config</div>

      <div className="space-y-2">
        <Label>Brand tone</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="luxe">Luxe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Departments</Label>
        <div className="flex flex-wrap gap-2">
          {DEPT_OPTIONS.map((d) => (
            <button key={d} type="button" onClick={() => toggleDept(d)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      departments.includes(d) ? "bg-zinc-900 text-white" : "bg-white"
                    }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Daily Instagram post cap</Label>
        <Input type="number" min={1} max={100} value={cap}
               onChange={(e) => setCap(parseInt(e.target.value || "5", 10))} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {msg && <span className="text-sm text-zinc-600">{msg}</span>}
      </div>
    </div>
  )
}
