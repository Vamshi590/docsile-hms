/**
 * Re-cases InPatient.medicalValues JSON keys to match the new software's expected schema.
 *
 * Legacy keys: BP, CBP, HIV, IOP, RBS, XST, HBsAg, Syringing, AScan, preOpVision, postOpVision
 * New keys:    bp, cbp, hiv, iop, rbs, xst, hbsAg, syringing, aScan, preOpVision, postOpVision
 */

import { makeTargetClient } from "./config"
import { info } from "./utils"

type Row = { id: string; medicalValues: string | null }

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

const KEY_MAP: Record<string, string> = {
  BP: "bp",
  bp: "bp",
  CBP: "cbp",
  cbp: "cbp",
  HIV: "hiv",
  hiv: "hiv",
  IOP: "iop",
  iop: "iop",
  RBS: "rbs",
  rbs: "rbs",
  XST: "xst",
  xst: "xst",
  HBsAg: "hbsAg",
  hbsag: "hbsAg",
  hbsAg: "hbsAg",
  Syringing: "syringing",
  syringing: "syringing",
  AScan: "aScan",
  Ascan: "aScan",
  ascan: "aScan",
  aScan: "aScan",
  preOpVision: "preOpVision",
  PreOpVision: "preOpVision",
  postOpVision: "postOpVision",
  PostOpVision: "postOpVision",
}

function transform(legacy: any): Record<string, string> | null {
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(legacy)) {
    if (v == null) continue
    const val = String(v).trim()
    if (!val) continue
    const newKey = KEY_MAP[k] ?? KEY_MAP[k.toLowerCase()] ?? k // fallback to original key
    out[newKey] = val
  }
  return Object.keys(out).length > 0 ? out : null
}

function isAlreadyNewFormat(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false
  const keys = Object.keys(obj)
  // If ALL keys are already in new (lowercase-first) format
  return keys.length > 0 && keys.every((k) => KEY_MAP[k] === k)
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)

  const target = makeTargetClient()

  info("\nReading InPatient.medicalValues...")
  const rows = await readAllOrdered<Row>(target, "InPatient", "id, medicalValues")
  info(`  total InPatient: ${rows.length}`)

  const updates: { id: string; medicalValues: string }[] = []
  let skippedNull = 0
  let skippedAlreadyNew = 0
  let skippedParseErr = 0

  for (const r of rows) {
    if (!r.medicalValues) {
      skippedNull++
      continue
    }
    let parsed: any
    try {
      parsed = JSON.parse(r.medicalValues)
    } catch {
      skippedParseErr++
      continue
    }
    if (isAlreadyNewFormat(parsed)) {
      skippedAlreadyNew++
      continue
    }
    const transformed = transform(parsed)
    if (!transformed) {
      skippedNull++
      continue
    }
    updates.push({ id: r.id, medicalValues: JSON.stringify(transformed) })
  }

  info(`\nDiff:`)
  info(`  to update: ${updates.length}`)
  info(`  skipped (null/empty): ${skippedNull}`)
  info(`  skipped (already new format): ${skippedAlreadyNew}`)
  info(`  skipped (JSON parse error): ${skippedParseErr}`)

  if (updates.length === 0) {
    info("\n✓ Nothing to do")
    return
  }

  if (dryRun) {
    info("\n[dry-run] sample updates (first 3):")
    for (const u of updates.slice(0, 3)) {
      const before = rows.find((r) => r.id === u.id)?.medicalValues
      console.log(`\n  id: ${u.id}`)
      console.log(`  before: ${before}`)
      console.log(`  after:  ${u.medicalValues}`)
    }
    return
  }

  info("\nApplying updates...")
  let done = 0
  let failed = 0
  for (const u of updates) {
    const { error } = await target.from("InPatient").update({ medicalValues: u.medicalValues }).eq("id", u.id)
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
