"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Save, Search, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getLabById, getAllInvestigations, updateLabInvestigations, createInvestigation } from "../actions"
import { toast } from "sonner"

type Investigation = { id: string; name: string; category: string | null }
type MappedInv = { investigationId: string; amount: number; isDefault: boolean; enabled: boolean }

const INVESTIGATION_CATEGORIES = ["Lab Test", "Eye Test", "Imaging", "General"]

export function LabInvestigationConfig({ labId, onBack }: { labId: string; onBack: () => void }) {
  const [labName, setLabName] = useState("")
  const [allInvestigations, setAllInvestigations] = useState<Investigation[]>([])
  const [mappings, setMappings] = useState<Map<string, MappedInv>>(new Map())
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add investigation dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newInvName, setNewInvName] = useState("")
  const [newInvCategory, setNewInvCategory] = useState("")
  const [addingInv, setAddingInv] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [lab, investigations] = await Promise.all([
      getLabById(labId),
      getAllInvestigations(),
    ])
    if (lab) {
      setLabName(lab.name)
      const map = new Map<string, MappedInv>()
      for (const li of lab.investigations) {
        map.set(li.investigationId, {
          investigationId: li.investigationId,
          amount: li.amount,
          isDefault: li.isDefault,
          enabled: true,
        })
      }
      setMappings(map)
    }
    setAllInvestigations(investigations)
    setLoading(false)
  }, [labId])

  useEffect(() => { loadData() }, [loadData])

  function toggleInvestigation(invId: string, checked: boolean) {
    setMappings((prev) => {
      const next = new Map(prev)
      const existing = next.get(invId)
      if (existing) {
        next.set(invId, { ...existing, enabled: checked })
      } else if (checked) {
        next.set(invId, { investigationId: invId, amount: 0, isDefault: false, enabled: true })
      }
      return next
    })
  }

  function updateAmount(invId: string, amount: number) {
    setMappings((prev) => {
      const next = new Map(prev)
      const existing = next.get(invId)
      if (existing) next.set(invId, { ...existing, amount })
      return next
    })
  }

  function toggleDefault(invId: string, checked: boolean) {
    setMappings((prev) => {
      const next = new Map(prev)
      const existing = next.get(invId)
      if (existing) next.set(invId, { ...existing, isDefault: checked })
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const enabled = Array.from(mappings.values()).filter((m) => m.enabled)
    const result = await updateLabInvestigations(
      labId,
      enabled.map((m) => ({
        investigationId: m.investigationId,
        amount: m.amount,
        isDefault: m.isDefault,
      }))
    )
    if (result.success) {
      toast.success("Investigation mappings saved")
      onBack()
    } else {
      toast.error(result.error)
    }
    setSaving(false)
  }

  async function handleAddInvestigation(e: React.FormEvent) {
    e.preventDefault()
    if (!newInvName.trim()) return
    setAddingInv(true)
    const result = await createInvestigation({
      name: newInvName.trim(),
      category: newInvCategory || undefined,
    })
    if (result.success) {
      toast.success("Investigation added")
      setAddDialogOpen(false)
      setNewInvName("")
      setNewInvCategory("")
      // Reload to get the new investigation
      const investigations = await getAllInvestigations()
      setAllInvestigations(investigations)
    } else {
      toast.error(result.error)
    }
    setAddingInv(false)
  }

  const filtered = allInvestigations.filter(
    (inv) => inv.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group by category
  const grouped = filtered.reduce<Record<string, Investigation[]>>((acc, inv) => {
    const cat = inv.category ?? "Other"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(inv)
    return acc
  }, {})

  const enabledCount = Array.from(mappings.values()).filter((m) => m.enabled).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading investigations...</span>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" className="h-7 w-7" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-[0.95rem] font-semibold text-foreground">
              Configure Investigations — {labName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabledCount} investigation{enabledCount !== 1 ? "s" : ""} enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Investigation
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {saving ? "Saving..." : "Save Mappings"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search investigations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Investigation Tables by Category */}
      {Object.entries(grouped).map(([category, investigations]) => (
        <div key={category}>
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 px-1">
            {category}
          </p>
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium w-10"></th>
                  <th className="text-left px-4 py-2.5 font-medium">Investigation</th>
                  <th className="text-left px-4 py-2.5 font-medium w-40">Amount (₹)</th>
                  <th className="text-center px-4 py-2.5 font-medium w-28">Default Lab</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv) => {
                  const mapping = mappings.get(inv.id)
                  const isEnabled = mapping?.enabled ?? false
                  return (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={(checked) => toggleInvestigation(inv.id, !!checked)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={isEnabled ? "font-medium" : "text-muted-foreground"}>
                          {inv.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {isEnabled ? (
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={mapping?.amount ?? 0}
                            onChange={(e) => updateAmount(inv.id, parseFloat(e.target.value) || 0)}
                            className="h-8 w-full bg-white"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isEnabled ? (
                          <Checkbox
                            checked={mapping?.isDefault ?? false}
                            onCheckedChange={(checked) => toggleDefault(inv.id, !!checked)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-white py-16 text-center">
          <p className="font-medium text-muted-foreground">No investigations found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search or add a new investigation</p>
        </div>
      )}

      {/* Add Investigation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Investigation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddInvestigation} className="space-y-4">
            <div>
              <Label htmlFor="inv-name">Investigation Name <span className="text-destructive">*</span></Label>
              <Input
                id="inv-name"
                value={newInvName}
                onChange={(e) => setNewInvName(e.target.value)}
                placeholder="e.g., Serum Creatinine"
                className="mt-1.5 bg-white"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="inv-category">Category</Label>
              <Select value={newInvCategory} onValueChange={setNewInvCategory}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {INVESTIGATION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newInvName.trim() || addingInv}>
                {addingInv && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Add Investigation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
