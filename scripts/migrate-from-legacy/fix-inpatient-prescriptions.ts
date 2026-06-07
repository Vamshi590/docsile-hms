/**
 * Converts InPatient.prescriptions JSON from legacy format to new format.
 *
 * Legacy: [{"PRESCRIPTION1":"...","DAYS1":"...","TIMING1":"..."}, {"PRESCRIPTION2":"...","DAYS2":"...","TIMING2":"..."}, ...]
 * New:    [{"name":"...","days":"...","timing":"..."}, ...]
 *
 * Each object in the array uses numbered keys; the number is just a row identifier — each object holds ONE medicine.
 */

import { makeTargetClient } from "./config"
import { info } from "./utils"

type Patient = { id: string; prescriptions: string | null }

async function readAllOrdered<T>(client: any, table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 500
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

function transformItem(legacyItem: any): { medicine: string; days: string; timing: string } | null {
  let medicine = ""
  let days = ""
  let timing = ""
  for (const [k, v] of Object.entries(legacyItem ?? {})) {
    const val = v == null ? "" : String(v).trim()
    if (!val) continue
    if (/^PRESCRIPTION\d*$/i.test(k) || /^name$/i.test(k) || /^medicine$/i.test(k)) medicine = val
    else if (/^DAYS\d*$/i.test(k) || /^days$/i.test(k)) days = val
    else if (/^TIMING\d*$/i.test(k) || /^timing$/i.test(k)) timing = val
  }
  if (!medicine && !days && !timing) return null
  return { medicine, days, timing }
}

function isAlreadyNewFormat(arr: any[]): boolean {
  if (arr.length === 0) return true
  const first = arr[0]
  if (first && typeof first === "object") {
    const keys = Object.keys(first)
    if (keys.includes("medicine") && (keys.includes("days") || keys.includes("timing"))) return true
  }
  return false
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)

  const target = makeTargetClient()

  info("\nReading InPatient.prescriptions...")
  const rows = await readAllOrdered<Patient>(target, "InPatient", "id, prescriptions")
  info(`  total InPatient: ${rows.length}`)

  const updates: { id: string; prescriptions: string }[] = []
  let skippedAlreadyNew = 0
  let skippedNull = 0
  let skippedParseErr = 0
  let skippedNonArray = 0

  for (const r of rows) {
    if (!r.prescriptions) {
      skippedNull++
      continue
    }
    let parsed: any
    try {
      parsed = JSON.parse(r.prescriptions)
    } catch {
      skippedParseErr++
      continue
    }
    if (!Array.isArray(parsed)) {
      skippedNonArray++
      continue
    }
    if (parsed.length === 0) {
      skippedNull++
      continue
    }
    if (isAlreadyNewFormat(parsed)) {
      skippedAlreadyNew++
      continue
    }

    const transformed = parsed.map(transformItem).filter((x): x is NonNullable<typeof x> => x != null)
    if (transformed.length === 0) {
      skippedNull++
      continue
    }
    updates.push({ id: r.id, prescriptions: JSON.stringify(transformed) })
  }

  info(`\nDiff:`)
  info(`  to update: ${updates.length}`)
  info(`  skipped (null/empty): ${skippedNull}`)
  info(`  skipped (already new format): ${skippedAlreadyNew}`)
  info(`  skipped (JSON parse error): ${skippedParseErr}`)
  info(`  skipped (not an array): ${skippedNonArray}`)

  if (updates.length === 0) {
    info("\n✓ Nothing to do")
    return
  }

  if (dryRun) {
    info("\n[dry-run] sample updates (first 3):")
    for (const u of updates.slice(0, 3)) {
      const before = rows.find((r) => r.id === u.id)?.prescriptions
      console.log(`\n  id: ${u.id}`)
      console.log(`  before: ${before}`)
      console.log(`  after:  ${u.prescriptions}`)
    }
    return
  }

  info("\nApplying updates...")
  let done = 0
  let failed = 0
  for (const u of updates) {
    const { error } = await target.from("InPatient").update({ prescriptions: u.prescriptions }).eq("id", u.id)
    if (error) {
      console.error(`  ✗ ${u.id}: ${error.message}`)
      failed++
      continue
    }
    done++
    if (done % 25 === 0) info(`  ...${done}/${updates.length}`)
  }
  info(`\n✓ Updated ${done}/${updates.length} (${failed} failed)`)
}

main().catch((err) => {
  console.error("\n✗ Failed:", err)
  process.exit(1)
})
