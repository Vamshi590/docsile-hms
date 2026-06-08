"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { generateFromImages } from "../actions"

const LANGUAGE_OPTIONS = [
  "English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam",
  "Marathi", "Gujarati", "Bengali", "Punjabi", "Odia", "Urdu",
] as const

const LANGUAGE_DEFAULT = "English"

export function ImageUploadForm() {
  const [uploadType, setUploadType] = useState("patient")
  const [files, setFiles] = useState<FileList | null>(null)
  const [text, setText] = useState("")
  const [language, setLanguage] = useState<string>(LANGUAGE_DEFAULT)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => start(async () => {
    setError(null)
    if (!files || files.length === 0) { setError("Pick at least one image."); return }
    const fd = new FormData()
    fd.set("upload_type", uploadType)
    if (text) fd.set("text", text)
    if (language) fd.set("language", language)
    for (const f of Array.from(files).slice(0, 5)) fd.append("images", f)
    try { await generateFromImages(fd) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed.") }
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload type</Label>
        <Select value={uploadType} onValueChange={setUploadType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="patient">Patient photo (testimonial)</SelectItem>
            <SelectItem value="infrastructure">Hospital / equipment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Images (1-5)</Label>
        <Input type="file" multiple accept="image/jpeg,image/png,image/webp"
               onChange={(e) => setFiles(e.target.files)} />
      </div>
      <div className="space-y-2">
        <Label>Optional context</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                  placeholder='e.g. "Patient said: the team made me feel at home."' />
      </div>
      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <Button onClick={submit} disabled={pending}>
        {pending ? "Generating…" : "Generate from photos"}
      </Button>
    </div>
  )
}
