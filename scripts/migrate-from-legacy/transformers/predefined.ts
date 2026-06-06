import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import { info, insertInBatches, newId, trimOrNull } from "../utils"

export async function migratePredefinedTemplates(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== predefined_prescriptions → PredefinedTemplate ===")

  const { data, error } = await source.from("predefined_prescriptions").select("*")
  if (error) throw new Error(`Read predefined_prescriptions: ${error.message}`)

  const createdBy = lookups.defaultUserId ?? "system"
  const out = (data ?? []).map((r) => ({
    id: newId(),
    code: trimOrNull(r.code) ?? newId(),
    name: trimOrNull(r.name) ?? "Unnamed",
    presentComplaint: trimOrNull(r.presentComplaint),
    previousHistory: trimOrNull(r.previousHistory),
    provisionalDiagnosis: trimOrNull(r.provisionalDiagnosis),
    medicines: JSON.stringify(r.medicines ?? []),
    investigations: JSON.stringify(r.investigations ?? []),
    additionalNotes: trimOrNull(r.notes),
    isActive: true,
    createdBy,
    createdAt: r.createdat ?? new Date().toISOString(),
    updatedAt: r.updatedat ?? new Date().toISOString(),
  }))

  info(`  transformed ${out.length}`)
  if (config.dryRun) return
  await insertInBatches(target, "PredefinedTemplate", out)
  info(`  ✓ inserted ${out.length}`)
}

export async function migrateMedicineMaster(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== prescriptionmedicines → MedicineMaster ===")

  const { data, error } = await source.from("prescriptionmedicines").select("*")
  if (error) throw new Error(`Read prescriptionmedicines: ${error.message}`)

  const createdBy = lookups.defaultUserId ?? "system"
  const seen = new Set<string>()
  const out: any[] = []
  for (const r of data ?? []) {
    const name = trimOrNull(r.name)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({
      id: newId(),
      name,
      defaultTiming: trimOrNull(r.timing),
      defaultDays: trimOrNull(r.days),
      note: trimOrNull(r.note),
      isActive: true,
      sortOrder: 0,
      createdBy,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: r.updatedAt ?? r.created_at ?? new Date().toISOString(),
    })
  }
  info(`  transformed ${out.length}`)
  if (config.dryRun) return
  await insertInBatches(target, "MedicineMaster", out)
  info(`  ✓ inserted ${out.length}`)
}
