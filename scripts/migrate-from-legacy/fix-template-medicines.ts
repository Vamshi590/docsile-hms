/**
 * Converts PredefinedTemplate.medicines JSON keys to match the new software's format.
 *
 * Legacy: [{"prescription":"HHOMEGA TAB","days":"30","timing":"Once daily","notes":""}]
 * New:    [{"name":"HHOMEGA TAB","days":"30","timing":"Once daily","note":""}]
 *
 * Key changes:
 *   prescription → name
 *   notes        → note
 */

import { makeTargetClient } from "./config"
import { info } from "./utils"

type Row = { id: string; medicines: string | null }

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

function transformItem(legacyItem: any): { name: string; days: string; timing: string; note: string } | null {
  let name = ""
  let days = ""
  let timing = ""
  let note = ""
  for (const [k, v] of Object.entries(legacyItem ?? {})) {
    const val = v == null ? "" : String(v).trim()
    if (!val && k !== "notes" && k !== "note") continue
    const kl = k.toLowerCase()
    if (kl === "prescription" || kl === "name" || kl === "medicine") name = val
    else if (kl === "days") days = val
    else if (kl === "timing") timing = val
    else if (kl === "notes" || kl === "note") note = val
  }
  if (!name && !days && !timing && !note) return null
  return { name, days, timing, note }
}

function isAlreadyNewFormat(arr: any[]): boolean {
  if (arr.length === 0) return true
  const first = arr[0]
  if (first && typeof first === "object") {
    const keys = Object.keys(first)
    return keys.includes("name") && !keys.includes("prescription")
  }
  return false
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)

  const target = makeTargetClient()

  info("\nReading PredefinedTemplate.medicines...")
  const rows = await readAllOrdered<Row>(target, "PredefinedTemplate", "id, medicines")
  info(`  total templates: ${rows.length}`)

  const updates: { id: string; medicines: string }[] = []
  let skippedEmpty = 0
  let skippedAlreadyNew = 0
  let skippedParseErr = 0

  for (const r of rows) {
    if (!r.medicines || r.medicines === "[]") {
      skippedEmpty++
      continue
    }
    let parsed: any
    try {
      parsed = JSON.parse(r.medicines)
    } catch {
      skippedParseErr++
      continue
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      skippedEmpty++
      continue
    }
    if (isAlreadyNewFormat(parsed)) {
      skippedAlreadyNew++
      continue
    }
    const transformed = parsed.map(transformItem).filter((x): x is NonNullable<typeof x> => x != null)
    if (transformed.length === 0) {
      skippedEmpty++
      continue
    }
    updates.push({ id: r.id, medicines: JSON.stringify(transformed) })
  }

  info(`\nDiff:`)
  info(`  to update: ${updates.length}`)
  info(`  skipped (empty): ${skippedEmpty}`)
  info(`  skipped (already new format): ${skippedAlreadyNew}`)
  info(`  skipped (JSON parse error): ${skippedParseErr}`)

  if (updates.length === 0) {
    info("\n✓ Nothing to do")
    return
  }

  if (dryRun) {
    info("\n[dry-run] sample updates (first 3):")
    for (const u of updates.slice(0, 3)) {
      const before = rows.find((r) => r.id === u.id)?.medicines
      console.log(`\n  id: ${u.id}`)
      console.log(`  before: ${before}`)
      console.log(`  after:  ${u.medicines}`)
    }
    return
  }

  info("\nApplying updates...")
  let done = 0
  let failed = 0
  for (const u of updates) {
    const { error } = await target.from("PredefinedTemplate").update({ medicines: u.medicines }).eq("id", u.id)
    if (error) {
      console.error(`  ✗ ${u.id}: ${error.message}`)
      failed++
      continue
    }
    done++
  }
  info(`\n✓ Updated ${done}/${updates.length} (${failed} failed)`)
}

main().catch((err) => {
  console.error("\n✗ Failed:", err)
  process.exit(1)
})
