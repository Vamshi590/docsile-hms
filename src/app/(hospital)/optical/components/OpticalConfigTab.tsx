"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HEADER_OPTIONS } from "@/components/receipts/headers/registry"
import { getOpticalSettings, updateOpticalSettings } from "../actions"

export function OpticalConfigTab() {
  const [printHeaderKey, setPrintHeaderKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getOpticalSettings().then(s => {
      setPrintHeaderKey(s.printHeaderKey || "default")
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const result = await updateOpticalSettings({ printHeaderKey: printHeaderKey === "default" ? "" : printHeaderKey })
    if (result.success) {
      toast.success("Optical settings saved")
    } else {
      toast.error(result.error)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Print Settings</h3>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="opt-header">Receipt Header</Label>
              <Select value={printHeaderKey || "default"} onValueChange={setPrintHeaderKey}>
                <SelectTrigger id="opt-header" className="bg-white">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {HEADER_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose which header appears on printed optical bills
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
