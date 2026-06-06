import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import { info, insertInBatches, newId, parseDate, parseFloatOrNull, trimOrNull } from "../utils"

export async function migrateExpenses(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== expenses → ExpenseCategory + Expense ===")

  let from = 0
  const PAGE = 1000
  const rows: any[] = []
  while (true) {
    const { data, error } = await source
      .from("expenses")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read expenses: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const createdBy = lookups.defaultUserId ?? "system"

  // Pass 1: collect distinct categories
  const newCats: any[] = []
  for (const r of rows) {
    const cat = (trimOrNull(r.category) ?? "Uncategorized").trim()
    const key = cat.toLowerCase()
    if (lookups.expenseCategoryByName.has(key)) continue
    const id = newId()
    lookups.expenseCategoryByName.set(key, id)
    newCats.push({
      id,
      name: cat,
      color: "#6B7280",
      sortOrder: 0,
      isActive: true,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  // Pass 2: build expenses
  const out: any[] = []
  for (const r of rows) {
    const cat = (trimOrNull(r.category) ?? "Uncategorized").trim()
    const categoryId = lookups.expenseCategoryByName.get(cat.toLowerCase())!
    out.push({
      id: newId(),
      title: trimOrNull(r.title) ?? "Expense",
      categoryId,
      amount: parseFloatOrNull(r.amount) ?? 0,
      date: parseDate(r.date) ?? r.created_at ?? new Date().toISOString(),
      reason: trimOrNull(r.reason),
      createdBy,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: parseDate(r.updatedAt) ?? r.created_at ?? new Date().toISOString(),
    })
  }

  info(`  transformed ${newCats.length} new categories + ${out.length} expenses`)
  if (config.dryRun) return
  if (newCats.length) await insertInBatches(target, "ExpenseCategory", newCats)
  await insertInBatches(target, "Expense", out)
  info(`  ✓ inserted`)
}
