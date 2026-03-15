"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createExpense, updateExpense } from "../actions"
import { toast } from "sonner"
import { todayISO } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"
type ExpenseCategory = Database["public"]["Tables"]["ExpenseCategory"]["Row"]

type ExpenseData = {
  id: string
  title: string
  categoryId: string
  amount: number
  date: Date | string
  reason: string | null
}

export function ExpenseForm({
  categories,
  expense,
  onClose,
  onSuccess,
}: {
  categories: ExpenseCategory[]
  expense?: ExpenseData | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!expense

  const [title, setTitle] = useState(expense?.title ?? "")
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? "")
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? (categories[0]?.id ?? ""))
  const [date, setDate] = useState(
    expense?.date
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(expense.date))
      : todayISO()
  )
  const [reason, setReason] = useState(expense?.reason ?? "")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = "Expense title is required"
    if (!amount || parseFloat(amount) <= 0) errs.amount = "Please enter a valid amount"
    if (!categoryId) errs.category = "Category is required"
    if (!date) errs.date = "Date is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const data = {
        title: title.trim(),
        categoryId,
        amount: parseFloat(amount),
        date,
        reason: reason.trim() || undefined,
      }

      const result = isEdit
        ? await updateExpense(expense!.id, data)
        : await createExpense(data)

      if (result.success) {
        toast.success(isEdit ? "Expense updated successfully" : "Expense added successfully")
        onSuccess()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add New Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Expense Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Expense Title <span className="text-red-500">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })) }}
              placeholder="Enter expense title"
              className={`h-10 bg-white  ${errors.title ? "border-red-500" : ""}`}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Amount (₹) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: "" })) }}
              placeholder="Enter amount"
              className={`h-10 bg-white ${errors.amount ? "border-red-500" : ""}`}
            />
            {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setErrors((p) => ({ ...p, category: "" })) }}>
              <SelectTrigger className={`h-10 ${errors.category ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Date of Expense <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: "" })) }}
              max={todayISO()}
              className={`h-10 bg-white ${errors.date ? "border-red-500" : ""}`}
            />
            {errors.date && <p className="text-sm text-red-500">{errors.date}</p>}
          </div>

          {/* Reason (Optional) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Reason (Optional)</Label>
            <Textarea
              value={reason}
              className="bg-white"
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for expense"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update Expense" : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
