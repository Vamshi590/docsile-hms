/**
 * Re-syncs name/gender/age/phone/address/DOB for LAB-W-XXXXX placeholder patients
 * from the original legacy `labs` row that created them.
 *
 * Uses iteration order (ORDER BY id) to map LAB-W-{N:05d} back to the Nth legacy
 * row with blank PATIENT ID and lab data.
 */

import { makeLegacyClient, makeTargetClient } from "./config"
import { info, parseDate, parseIntOrNull, trimOrNull } from "./utils"

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

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)

  const source = makeLegacyClient()
  const target = makeTargetClient()

  // 1. Replay legacy labs iteration to build LAB-W-{N} → legacy row map
  info("\nReplaying legacy labs iteration order...")
  const legacy = await readAllOrdered<any>(
    source,
    "labs",
    'id, "PATIENT ID", "PATIENT NAME", "GENDER", "AGE", "PHONE NUMBER", "ADDRESS", "DOB", "GUARDIAN NAME", "LAB TEST 1", "VLAB TEST 1"',
  )

  const walkinToLegacy = new Map<string, any>()
  let counter = 0
  for (const r of legacy) {
    const pid = trimOrNull(r["PATIENT ID"])
    const hasMain = !!trimOrNull(r["LAB TEST 1"]) // approximation — same as my placeholder trigger
    const hasVlab = !!trimOrNull(r["VLAB TEST 1"])
    if (!pid && (hasMain || hasVlab)) {
      counter += 1
      const walkinId = `LAB-W-${String(counter).padStart(5, "0")}`
      walkinToLegacy.set(walkinId, r)
    }
  }
  info(`  built ${walkinToLegacy.size} LAB-W → legacy mappings`)

  // 2. Read all LAB-W-* patients from target
  info("\nReading LAB-W-* placeholders from target...")
  const targetWalkins = await readAllOrdered<{
    id: string
    patientId: string
    firstName: string | null
    gender: string | null
    age: number | null
    phone: string | null
    address: string | null
    dateOfBirth: string | null
    guardianName: string | null
  }>(target, "Patient", "id, patientId, firstName, gender, age, phone, address, dateOfBirth, guardianName")
  const walkins = targetWalkins.filter((p) => p.patientId.startsWith("LAB-W-"))
  info(`  ${walkins.length} placeholders in target`)

  // 3. Compute updates
  type Update = { id: string; changes: Record<string, any> }
  const updates: Update[] = []
  let missingLegacy = 0
  for (const w of walkins) {
    const legacyRow = walkinToLegacy.get(w.patientId)
    if (!legacyRow) {
      missingLegacy++
      continue
    }
    const changes: Record<string, any> = {}

    const legacyName = trimOrNull(legacyRow["PATIENT NAME"])
    if (legacyName && (w.firstName === "Unknown" || !w.firstName)) {
      changes.firstName = legacyName
    }
    const legacyGender = trimOrNull(legacyRow["GENDER"])
    if (legacyGender && (w.gender === "Unknown" || !w.gender)) {
      changes.gender = legacyGender
    }
    const legacyAge = parseIntOrNull(legacyRow["AGE"])
    if (legacyAge != null && w.age == null) {
      changes.age = legacyAge
    }
    const legacyPhone = trimOrNull(legacyRow["PHONE NUMBER"])
    if (legacyPhone && (!w.phone || w.phone === "")) {
      changes.phone = legacyPhone
    }
    const legacyAddress = trimOrNull(legacyRow["ADDRESS"])
    if (legacyAddress && !w.address) {
      changes.address = legacyAddress
    }
    const legacyDob = parseDate(legacyRow["DOB"])
    if (legacyDob && !w.dateOfBirth) {
      changes.dateOfBirth = legacyDob
    }
    const legacyGuardian = trimOrNull(legacyRow["GUARDIAN NAME"])
    if (legacyGuardian && !w.guardianName) {
      changes.guardianName = legacyGuardian
    }

    if (Object.keys(changes).length > 0) {
      updates.push({ id: w.id, changes })
    }
  }

  info(`\nDiff:`)
  info(`  to update: ${updates.length}`)
  info(`  walkins with no matching legacy row: ${missingLegacy}`)

  if (updates.length === 0) {
    info("\n✓ Nothing to do")
    return
  }

  if (dryRun) {
    info("\n[dry-run] sample updates:")
    console.log(JSON.stringify(updates.slice(0, 5), null, 2))
    return
  }

  info("\nApplying updates...")
  let done = 0
  let failed = 0
  for (const u of updates) {
    const { error } = await target.from("Patient").update(u.changes).eq("id", u.id)
    if (error) {
      console.error(`  ✗ ${u.id}: ${error.message}`)
      failed++
      continue
    }
    done++
    if (done % 50 === 0) info(`  ...${done}/${updates.length}`)
  }
  info(`\n✓ Updated ${done}/${updates.length} (${failed} failed)`)
}

main().catch((err) => {
  console.error("\n✗ Failed:", err)
  process.exit(1)
})
