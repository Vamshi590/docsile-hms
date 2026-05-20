// src/app/(hospital)/settings/components/PrintDefaultsTab.tsx
"use client"

import { useState, useEffect } from "react"
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  DEFAULT_PRINT_LABELS,
  READINGS_SUBMODE_LABELS,
  type DefaultPrintItem,
  type DefaultPrintItemType,
  type ReadingsSubMode,
} from "@/lib/default-print"
import { getDefaultPrintConfig, saveDefaultPrintConfig } from "../actions"

const ALL_TYPES: DefaultPrintItemType[] = ["cash", "prescription", "readings", "report"]

export function PrintDefaultsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<DefaultPrintItem[]>([])
  const [loaded, setLoaded] = useState<DefaultPrintItem[]>([])

  useEffect(() => {
    let cancelled = false
    getDefaultPrintConfig()
      .then(cfg => {
        if (cancelled) return
        setItems(cfg.items)
        setLoaded(cfg.items)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error("Failed to load print defaults")
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const usedTypes = new Set(items.map(i => i.type))
  const addableTypes = ALL_TYPES.filter(t => !usedTypes.has(t))
  const dirty = JSON.stringify(items) !== JSON.stringify(loaded)

  function addItem(type: DefaultPrintItemType) {
    if (usedTypes.has(type)) return
    const newItem: DefaultPrintItem = type === "readings"
      ? { type: "readings", subMode: "both" }
      : { type }
    setItems(prev => [...prev, newItem])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function moveItem(index: number, delta: -1 | 1) {
    setItems(prev => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  function updateSubMode(index: number, subMode: ReadingsSubMode) {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it
      if (it.type !== "readings") return it
      return { ...it, subMode }
    }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await saveDefaultPrintConfig({ items })
    setSaving(false)
    if (res.success) {
      setLoaded(items)
      toast.success("Print defaults saved")
    } else {
      toast.error(res.error || "Failed to save")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Quick Print — Default Receipts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which receipts are printed when the quick-print button is clicked on the
          Doctor page. The order below is the print order — each item produces one page.
        </p>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No default receipts configured. Add one below to enable the quick-print button
              on the Doctor page.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.type}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2"
            >
              <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">
                {DEFAULT_PRINT_LABELS[item.type]}
              </span>
              {item.type === "readings" && (
                <Select
                  value={item.subMode}
                  onValueChange={(v) => updateSubMode(index, v as ReadingsSubMode)}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["readings", "clinical", "both"] as const).map(sm => (
                      <SelectItem key={sm} value={sm}>{READINGS_SUBMODE_LABELS[sm]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                title="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                title="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => removeItem(index)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add receipt dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={addableTypes.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add receipt
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {addableTypes.map(t => (
            <DropdownMenuItem key={t} onClick={() => addItem(t)}>
              {DEFAULT_PRINT_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setItems(loaded)}
          disabled={!dirty || saving}
        >
          Reset
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save changes
        </Button>
      </div>
    </div>
  )
}
