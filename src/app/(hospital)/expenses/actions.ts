"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"

// ─── Default Categories (matching old app) ───────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Stationary", color: "rgba(59, 130, 246, 0.7)" },
  { name: "Discount", color: "rgba(80, 25, 25, 0.7)" },
  { name: "House Keeping", color: "rgba(16, 185, 129, 0.7)" },
  { name: "DR's & RMP's", color: "rgba(244, 63, 94, 0.7)" },
  { name: "Lab", color: "rgba(249, 115, 22, 0.7)" },
  { name: "Salaries", color: "rgba(139, 92, 246, 0.7)" },
  { name: "Medicine", color: "rgba(236, 72, 153, 0.7)" },
  { name: "Opticals", color: "rgba(20, 184, 166, 0.7)" },
  { name: "Maintenance", color: "rgba(125, 156, 40, 0.7)" },
  { name: "Other", color: "rgba(161, 161, 170, 0.7)" },
]

export async function seedDefaultCategories() {
  const user = await requireServerPermission("expenses:view")
  const supabase = await createClient()
  const { count } = await supabase.from("ExpenseCategory").select("*", { count: "exact", head: true })
  if ((count ?? 0) > 0) return

  const now = new Date().toISOString()
  await supabase.from("ExpenseCategory").insert(
    DEFAULT_CATEGORIES.map((cat, i) => ({
      name: cat.name,
      color: cat.color,
      sortOrder: i,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    }))
  )
  // No revalidatePath here: the function is idempotent and is also called
  // from `page.tsx` during SSR, where revalidatePath is forbidden. Callers
  // that need revalidation should call it themselves after their own mutation.
}

// ─── Category CRUD ───────────────────────────────────────────────────────────

export async function getCategories() {
  await requireServerPermission("expenses:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ExpenseCategory")
    .select("*")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function createCategory(data: { name: string; color: string }) {
  const user = await requireServerPermission("expenses:create")
  const supabase = await createClient()
  try {
    // Get max sortOrder
    const { data: maxRow } = await supabase
      .from("ExpenseCategory")
      .select("sortOrder")
      .order("sortOrder", { ascending: false })
      .limit(1)
      .single()
    const maxSort = maxRow?.sortOrder ?? 0

    const now = new Date().toISOString()
    const { data: category, error } = await supabase
      .from("ExpenseCategory")
      .insert({
        name: data.name,
        color: data.color,
        sortOrder: maxSort + 1,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) {
      if (error.code === "23505") return { success: false as const, error: "A category with this name already exists" }
      throw error
    }
    revalidatePath("/expenses")
    return { success: true as const, data: category }
  } catch {
    return { success: false as const, error: "Failed to create category" }
  }
}

export async function updateCategory(id: string, data: { name?: string; color?: string }) {
  await requireServerPermission("expenses:edit")
  const supabase = await createClient()
  try {
    const { data: category, error } = await supabase
      .from("ExpenseCategory")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) {
      if (error.code === "23505") return { success: false as const, error: "A category with this name already exists" }
      throw error
    }
    revalidatePath("/expenses")
    return { success: true as const, data: category }
  } catch {
    return { success: false as const, error: "Failed to update category" }
  }
}

export async function deleteCategory(id: string) {
  await requireServerPermission("expenses:edit")
  const supabase = await createClient()
  const { count } = await supabase.from("Expense").select("*", { count: "exact", head: true }).eq("categoryId", id)
  if ((count ?? 0) > 0) {
    return { success: false as const, error: `Cannot delete: ${count} expense(s) linked. Reassign them first.` }
  }
  try {
    const { error } = await supabase.from("ExpenseCategory").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/expenses")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete category" }
  }
}

export async function reorderCategories(orderedIds: string[]) {
  await requireServerPermission("expenses:edit")
  const supabase = await createClient()
  const now = new Date().toISOString()
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("ExpenseCategory").update({ sortOrder: i, updatedAt: now }).eq("id", id)
    )
  )
  revalidatePath("/expenses")
  return { success: true as const }
}

// ─── Expense CRUD ────────────────────────────────────────────────────────────

export async function getExpensesByDateRange(startDate: string, endDate: string) {
  await requireServerPermission("expenses:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("Expense")
    .select("*, category:ExpenseCategory(*)")
    .gte("date", new Date(startDate).toISOString())
    .lte("date", new Date(endDate + "T23:59:59").toISOString())
    .order("date", { ascending: false })
  if (error) throw error
  return data
}

export async function createExpense(data: {
  title: string
  categoryId: string
  amount: number
  date: string
  reason?: string
}) {
  const user = await requireServerPermission("expenses:create")
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: expense, error } = await supabase
      .from("Expense")
      .insert({
        title: data.title,
        categoryId: data.categoryId,
        amount: data.amount,
        date: new Date(data.date).toISOString(),
        reason: data.reason ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select("*, category:ExpenseCategory(*)")
      .single()
    if (error) throw error
    revalidatePath("/expenses")
    return { success: true as const, data: expense }
  } catch {
    return { success: false as const, error: "Failed to create expense" }
  }
}

export async function updateExpense(id: string, data: {
  title?: string
  categoryId?: string
  amount?: number
  date?: string
  reason?: string
}) {
  await requireServerPermission("expenses:edit")
  const supabase = await createClient()
  try {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() }
    if (data.date) updateData.date = new Date(data.date).toISOString()
    const { data: expense, error } = await supabase
      .from("Expense")
      .update(updateData)
      .eq("id", id)
      .select("*, category:ExpenseCategory(*)")
      .single()
    if (error) throw error
    revalidatePath("/expenses")
    return { success: true as const, data: expense }
  } catch {
    return { success: false as const, error: "Failed to update expense" }
  }
}

export async function deleteExpense(id: string) {
  await requireServerPermission("expenses:delete")
  const supabase = await createClient()
  try {
    const { error } = await supabase.from("Expense").delete().eq("id", id)
    if (error) throw error
    revalidatePath("/expenses")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete expense" }
  }
}
