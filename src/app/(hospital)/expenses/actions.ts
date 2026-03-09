"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

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
  const user = await requireAuth()
  const count = await db.expenseCategory.count()
  if (count > 0) return

  await db.expenseCategory.createMany({
    data: DEFAULT_CATEGORIES.map((cat, i) => ({
      name: cat.name,
      color: cat.color,
      sortOrder: i,
      createdBy: user.id,
    })),
  })
  revalidatePath("/expenses")
}

// ─── Category CRUD ───────────────────────────────────────────────────────────

export async function getCategories() {
  return db.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function createCategory(data: { name: string; color: string }) {
  const user = await requireAuth()
  try {
    const maxSort = await db.expenseCategory.aggregate({ _max: { sortOrder: true } })
    const category = await db.expenseCategory.create({
      data: {
        name: data.name,
        color: data.color,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        createdBy: user.id,
      },
    })
    revalidatePath("/expenses")
    return { success: true as const, data: category }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "A category with this name already exists"
      : "Failed to create category"
    return { success: false as const, error: msg }
  }
}

export async function updateCategory(id: string, data: { name?: string; color?: string }) {
  await requireAuth()
  try {
    const category = await db.expenseCategory.update({ where: { id }, data })
    revalidatePath("/expenses")
    return { success: true as const, data: category }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "A category with this name already exists"
      : "Failed to update category"
    return { success: false as const, error: msg }
  }
}

export async function deleteCategory(id: string) {
  await requireAuth()
  const expenseCount = await db.expense.count({ where: { categoryId: id } })
  if (expenseCount > 0) {
    return { success: false as const, error: `Cannot delete: ${expenseCount} expense(s) linked. Reassign them first.` }
  }
  try {
    await db.expenseCategory.delete({ where: { id } })
    revalidatePath("/expenses")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete category" }
  }
}

export async function reorderCategories(orderedIds: string[]) {
  await requireAuth()
  await Promise.all(
    orderedIds.map((id, i) =>
      db.expenseCategory.update({ where: { id }, data: { sortOrder: i } })
    )
  )
  revalidatePath("/expenses")
  return { success: true as const }
}

// ─── Expense CRUD ────────────────────────────────────────────────────────────

export async function getExpensesByDateRange(startDate: string, endDate: string) {
  const expenses = await db.expense.findMany({
    where: {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59"),
      },
    },
    include: { category: true },
    orderBy: { date: "desc" },
  })
  return expenses
}

export async function createExpense(data: {
  title: string
  categoryId: string
  amount: number
  date: string
  reason?: string
}) {
  const user = await requireAuth()
  try {
    const expense = await db.expense.create({
      data: {
        title: data.title,
        categoryId: data.categoryId,
        amount: data.amount,
        date: new Date(data.date),
        reason: data.reason ?? null,
        createdBy: user.id,
      },
      include: { category: true },
    })
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
  await requireAuth()
  try {
    const updateData: Record<string, unknown> = { ...data }
    if (data.date) updateData.date = new Date(data.date)
    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      include: { category: true },
    })
    revalidatePath("/expenses")
    return { success: true as const, data: expense }
  } catch {
    return { success: false as const, error: "Failed to update expense" }
  }
}

export async function deleteExpense(id: string) {
  await requireAuth()
  try {
    await db.expense.delete({ where: { id } })
    revalidatePath("/expenses")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete expense" }
  }
}
