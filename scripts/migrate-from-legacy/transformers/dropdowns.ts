import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import { info, insertInBatches, newId, trimOrNull } from "../utils"

export async function migrateDropdowns(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== dropdown_options → DropdownOption ===")

  let from = 0
  const PAGE = 1000
  const out: any[] = []
  const createdBy = lookups.defaultUserId ?? "system"

  while (true) {
    const { data, error } = await source
      .from("dropdown_options")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read dropdown_options: ${error.message}`)
    if (!data || data.length === 0) break

    for (const r of data) {
      const fieldName = trimOrNull(r.field_name)
      const value = trimOrNull(r.option_value)
      if (!fieldName || !value) continue
      out.push({ id: newId(), fieldName, value, createdBy, createdAt: r.created_at ?? new Date().toISOString() })
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  // Deduplicate on (fieldName, value) — schema has @@unique
  const seen = new Set<string>()
  const deduped = out.filter((r) => {
    const k = `${r.fieldName}::${r.value}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  info(`  transformed ${deduped.length} (deduped from ${out.length})`)
  if (config.dryRun) return
  await insertInBatches(target, "DropdownOption", deduped)
  info(`  ✓ inserted ${deduped.length}`)
}
