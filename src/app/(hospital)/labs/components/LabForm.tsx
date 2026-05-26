"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { createLab, updateLab } from "../actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { HEADER_OPTIONS } from "@/components/receipts/headers/registry"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

type Lab = {
  id: string
  name: string
  description: string | null
  location: string | null
  printHeaderKey: string | null
  isActive: boolean
}

interface LabFormProps {
  open: boolean
  lab: Lab | null
  onClose: () => void
  onSuccess: () => void
}

export function LabForm({ open, lab, onClose, onSuccess }: LabFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [printHeaderKey, setPrintHeaderKey] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(lab?.name ?? "")
      setDescription(lab?.description ?? "")
      setLocation(lab?.location ?? "")
      setPrintHeaderKey(lab?.printHeaderKey ?? "")
      setIsActive(lab?.isActive ?? true)
    }
  }, [open, lab])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      printHeaderKey: printHeaderKey || undefined,
    }

    const result = lab
      ? await updateLab(lab.id, { ...data, isActive, printHeaderKey: printHeaderKey || null })
      : await createLab(data)

    if (result.success) {
      toast.success(lab ? "Lab updated" : "Lab created")
      onSuccess()
    } else {
      toast.error(result.error)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lab ? "Edit Lab" : "Add New Lab"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="lab-name">Lab Name <span className="text-destructive">*</span></Label>
            <Input
              id="lab-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pathology Lab"
              className="mt-1.5 bg-white"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="lab-desc">Description</Label>
            <Input
              id="lab-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Blood tests and lab investigations"
              className="mt-1.5 bg-white"
            />
          </div>
          <div>
            <Label htmlFor="lab-loc">Location</Label>
            <Input
              id="lab-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Ground Floor, Room 5"
              className="mt-1.5 bg-white"
            />
          </div>
          <div>
            <Label htmlFor="lab-header">Receipt Header</Label>
            <Select value={printHeaderKey || "default"} onValueChange={(v) => setPrintHeaderKey(v === "default" ? "" : v)}>
              <SelectTrigger id="lab-header" className="mt-1.5 bg-white">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                {HEADER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Choose which header appears on this lab&apos;s printed receipt</p>
          </div>
          {lab && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="lab-active" className="cursor-pointer">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive labs won&apos;t appear in billing</p>
              </div>
              <Switch id="lab-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {lab ? "Save Changes" : "Create Lab"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
