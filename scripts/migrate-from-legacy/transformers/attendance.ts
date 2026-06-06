import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import { info, insertInBatches, logError, newId, parseDate, trimOrNull } from "../utils"

export async function migrateAttendance(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== staff_attendance → StaffAttendance ===")

  let from = 0
  const PAGE = 1000
  const out: any[] = []
  const seen = new Set<string>() // dedupe (userId, date)

  while (true) {
    const { data, error } = await source
      .from("staff_attendance")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read staff_attendance: ${error.message}`)
    if (!data || data.length === 0) break

    for (const r of data) {
      const userId = lookups.userByLegacyId.get(r.staff_id ?? "")
      if (!userId) {
        logError("staff_attendance", r.id, `unknown staff_id ${r.staff_id}`)
        continue
      }
      // Normalize date to YYYY-MM-DD so different formats don't bypass dedupe
      const rawDate = trimOrNull(r.date)
      if (!rawDate) continue
      const parsed = parseDate(rawDate)
      const date = parsed ? parsed.slice(0, 10) : rawDate.slice(0, 10)
      const key = `${userId}::${date}`
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        id: newId(),
        userId,
        date,
        inTime: trimOrNull(r.in_time),
        outTime: trimOrNull(r.out_time),
        status: trimOrNull(r.status),
        notes: trimOrNull(r.notes),
        createdAt: r.created_at ?? new Date().toISOString(),
        updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
      })
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  info(`  transformed ${out.length}`)
  if (config.dryRun) return
  await insertInBatches(target, "StaffAttendance", out)
  info(`  ✓ inserted ${out.length}`)
}
