"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react"
import { createCategory, updateCategory, deleteCategory, reorderCategories } from "../actions"
import { toast } from "sonner"
import type { Database } from "@/lib/supabase/types"
type ExpenseCategory = Database["public"]["Tables"]["ExpenseCategory"]["Row"]

const PRESET_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#6B7280",
  "#14B8A6", "#84CC16", "#E11D48", "#7C3AED", "#0EA5E9",
]

export function CategoryManager({
  categories,
  onClose,
  onChanged,
}: {
  categories: ExpenseCategory[]
  onClose: () => void
  onChanged: () => void
}) {
  const [items, setItems] = useState(categories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#3B82F6")
  const [adding, setAdding] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const startEdit = (cat: ExpenseCategory) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditColor("")
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    const result = await updateCategory(editingId, { name: editName.trim(), color: editColor })
    if (result.success) {
      toast.success("Category updated")
      onChanged()
      cancelEdit()
    } else {
      toast.error(result.error)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    const result = await createCategory({ name: newName.trim(), color: newColor })
    if (result.success) {
      toast.success("Category added")
      setNewName("")
      setAdding(false)
      onChanged()
    } else {
      toast.error(result.error)
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteCategory(id)
    if (result.success) {
      toast.success("Category deleted")
      onChanged()
    } else {
      toast.error(result.error)
    }
  }

  const handleDragStart = (idx: number) => {
    setDragIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newItems = [...items]
    const [dragged] = newItems.splice(dragIdx, 1)
    newItems.splice(idx, 0, dragged)
    setItems(newItems)
    setDragIdx(idx)
  }

  const handleDragEnd = async () => {
    setDragIdx(null)
    await reorderCategories(items.map((i) => i.id))
    onChanged()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Expense Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {items.map((cat, idx) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 group"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />

              {editingId === cat.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-7 w-7 rounded border-0 cursor-pointer shrink-0"
                  />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit() }}
                  />
                  <Button variant="ghost" size="icon-sm" onClick={saveEdit}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm font-medium flex-1">{cat.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => startEdit(cat)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {adding ? (
          <div className="flex items-center gap-2 px-2 pt-2 border-t">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-7 w-7 rounded border-0 cursor-pointer shrink-0"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="h-8 text-sm flex-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false) }}
            />
            <Button size="sm" onClick={handleAdd}>Add</Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Category
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-2">
          <span className="text-xs text-muted-foreground mr-1">Quick colors:</span>
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="h-5 w-5 rounded-full border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              onClick={() => {
                if (editingId) setEditColor(color)
                else setNewColor(color)
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
