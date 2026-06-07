import { makeLegacyClient, makeTargetClient } from "./config"
import { info, trimOrNull } from "./utils"

async function readAllPaginated<T>(client: any, table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)

  const source = makeLegacyClient()
  const target = makeTargetClient()

  // 1. Read legacy gender by patientId
  info("\nReading legacy patients...")
  const legacy = await readAllPaginated<{ patientId: string | null; gender: string | null }>(
    source,
    "patients",
    "patientId, gender",
  )
  const legacyGenderByPatientId = new Map<string, string>()
  for (const p of legacy) {
    const pid = trimOrNull(p.patientId)
    const g = trimOrNull(p.gender)
    if (pid && g) legacyGenderByPatientId.set(pid, g)
  }
  info(`  legacy patients with gender: ${legacyGenderByPatientId.size} / ${legacy.length}`)

  // 2. Read target patients
  info("\nReading target patients...")
  const targetPatients = await readAllPaginated<{ id: string; patientId: string | null; gender: string | null }>(
    target,
    "Patient",
    "id, patientId, gender",
  )
  info(`  target patients: ${targetPatients.length}`)

  // 3. Compute updates
  const updates: { id: string; gender: string }[] = []
  let alreadyCorrect = 0
  let noLegacyData = 0
  for (const tp of targetPatients) {
    if (!tp.patientId) continue
    const legacyGender = legacyGenderByPatientId.get(tp.patientId)
    if (!legacyGender) {
      noLegacyData++
      continue
    }
    if (tp.gender === legacyGender) {
      alreadyCorrect++
      continue
    }
    updates.push({ id: tp.id, gender: legacyGender })
  }

  info(`\nDiff:`)
  info(`  already correct: ${alreadyCorrect}`)
  info(`  no legacy gender available: ${noLegacyData}`)
  info(`  to update: ${updates.length}`)

  if (updates.length === 0) {
    info("\n✓ Nothing to do")
    return
  }

  if (dryRun) {
    info("\n[dry-run] sample updates:")
    console.log(JSON.stringify(updates.slice(0, 5), null, 2))
    return
  }

  // 4. Apply updates (one at a time — Supabase doesn't support batch updates with different values)
  info("\nApplying updates...")
  let done = 0
  for (const u of updates) {
    const { error } = await target.from("Patient").update({ gender: u.gender }).eq("id", u.id)
    if (error) {
      console.error(`  ✗ ${u.id}: ${error.message}`)
      continue
    }
    done++
    if (done % 100 === 0) info(`  ...${done}/${updates.length}`)
  }
  info(`\n✓ Updated ${done}/${updates.length} patients`)
}

main().catch((err) => {
  console.error("\n✗ Failed:", err)
  process.exit(1)
})
