/**
 * One-off script: remove LAB-W-* and IP-* placeholder patients from Patient table by
 * matching them to real OPD patients (by name + phone), then relinking InPatient and LabBill.
 *
 * Flags:
 *   --dry-run            : no writes, show what would happen
 *   --kind=ip|lab|all    : which placeholders to process (default: all)
 *   --keep-orphans       : if no match found, leave placeholder in place (default: report only)
 */

import { makeTargetClient } from "./config"
import { info, trimOrNull } from "./utils"

type Patient = {
  id: string
  patientId: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  patientType: string | null
}

async function readAllPaginated<T>(client: any, table: string, columns: string, filter?: { col: string; op: "like" | "not.like" | "eq"; val: string }): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    let q = client.from(table).select(columns).order("id", { ascending: true }).range(from, from + PAGE - 1)
    if (filter) {
      if (filter.op === "like") q = q.like(filter.col, filter.val)
      else if (filter.op === "not.like") q = q.not(filter.col, "like", filter.val)
      else if (filter.op === "eq") q = q.eq(filter.col, filter.val)
    }
    const { data, error } = await q
    if (error) throw new Error(`Read ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}
function normalizePhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").replace(/^0+/, "")
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const keepOrphans = process.argv.includes("--keep-orphans")
  const kindArg = process.argv.find((a) => a.startsWith("--kind="))?.split("=")[1] ?? "all"
  info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}, kind=${kindArg}, keepOrphans=${keepOrphans}`)

  const target = makeTargetClient()

  // 1. Read all OPD patients (potential match targets)
  info("\nReading OPD patients...")
  const opd = await readAllPaginated<Patient>(
    target,
    "Patient",
    "id, patientId, firstName, lastName, phone, patientType",
    { col: "patientId", op: "not.like", val: "%-%" }, // exclude IDs containing "-" (IP- and LAB-W-)
  )
  info(`  ${opd.length} OPD-like patients`)

  // Build index by (normalizedName, normalizedPhone) and by phone alone
  const byNamePhone = new Map<string, Patient>()
  const byPhone = new Map<string, Patient[]>()
  for (const p of opd) {
    const fullName = `${p.firstName ?? ""} ${p.lastName ?? ""}`
    const k = `${normalizeName(fullName)}::${normalizePhone(p.phone)}`
    byNamePhone.set(k, p)
    const ph = normalizePhone(p.phone)
    if (ph) {
      const arr = byPhone.get(ph) ?? []
      arr.push(p)
      byPhone.set(ph, arr)
    }
  }

  // 2. Read all placeholder patients
  const wantIp = kindArg === "all" || kindArg === "ip"
  const wantLab = kindArg === "all" || kindArg === "lab"
  const placeholders: Patient[] = []
  if (wantIp) {
    const ipPs = await readAllPaginated<Patient>(target, "Patient", "id, patientId, firstName, lastName, phone, patientType", { col: "patientId", op: "like", val: "IP-%" })
    info(`\n${ipPs.length} IP-* placeholders`)
    placeholders.push(...ipPs)
  }
  if (wantLab) {
    const labPs = await readAllPaginated<Patient>(target, "Patient", "id, patientId, firstName, lastName, phone, patientType", { col: "patientId", op: "like", val: "LAB-W-%" })
    info(`${labPs.length} LAB-W-* placeholders`)
    placeholders.push(...labPs)
  }

  // 3. Match each placeholder
  const matches: { placeholder: Patient; opd: Patient; via: string }[] = []
  const orphans: Patient[] = []
  for (const ph of placeholders) {
    const fullName = `${ph.firstName ?? ""} ${ph.lastName ?? ""}`
    const k = `${normalizeName(fullName)}::${normalizePhone(ph.phone)}`
    const exact = byNamePhone.get(k)
    if (exact) {
      matches.push({ placeholder: ph, opd: exact, via: "name+phone" })
      continue
    }
    // Try by phone alone if phone is reasonably long
    const phNorm = normalizePhone(ph.phone)
    if (phNorm.length >= 9) {
      const phoneMatches = byPhone.get(phNorm) ?? []
      if (phoneMatches.length === 1) {
        matches.push({ placeholder: ph, opd: phoneMatches[0], via: "phone-only" })
        continue
      }
    }
    orphans.push(ph)
  }

  info(`\nResults:`)
  info(`  matched to OPD patient: ${matches.length}`)
  info(`    via name+phone: ${matches.filter((m) => m.via === "name+phone").length}`)
  info(`    via phone-only: ${matches.filter((m) => m.via === "phone-only").length}`)
  info(`  orphans (no match): ${orphans.length}`)

  if (dryRun) {
    info("\n[dry-run] sample matches:")
    console.log(JSON.stringify(matches.slice(0, 5).map((m) => ({
      placeholder: m.placeholder.patientId,
      placeholderName: m.placeholder.firstName,
      placeholderPhone: m.placeholder.phone,
      opd: m.opd.patientId,
      opdName: m.opd.firstName,
      opdPhone: m.opd.phone,
      via: m.via,
    })), null, 2))
    info("\n[dry-run] sample orphans:")
    console.log(JSON.stringify(orphans.slice(0, 5).map((o) => ({
      patientId: o.patientId,
      name: o.firstName,
      phone: o.phone,
    })), null, 2))
    return
  }

  // 4. Apply: for each match, relink InPatient/LabBill, then delete placeholder
  info("\nApplying relinks...")
  let done = 0
  let failed = 0
  for (const m of matches) {
    try {
      const phId = m.placeholder.id
      const phPatientIdText = m.placeholder.patientId!
      const opdId = m.opd.id
      const opdPatientIdText = m.opd.patientId!

      if (m.placeholder.patientId!.startsWith("IP-")) {
        // InPatient.patientId references Patient.id (cuid)
        const { error: e1 } = await target.from("InPatient").update({ patientId: opdId }).eq("patientId", phId)
        if (e1) throw new Error(`InPatient relink: ${e1.message}`)
      }
      // LabBill.patientId references Patient.patientId (text)
      const { error: e2 } = await target.from("LabBill").update({ patientId: opdPatientIdText }).eq("patientId", phPatientIdText)
      if (e2) throw new Error(`LabBill relink: ${e2.message}`)

      // PharmacyBill / OpticalBill / Prescription / EyeReading also reference patientId — relink those too
      const { error: e3 } = await target.from("Prescription").update({ patientId: opdPatientIdText }).eq("patientId", phPatientIdText)
      if (e3) throw new Error(`Prescription relink: ${e3.message}`)
      const { error: e4 } = await target.from("EyeReading").update({ patientId: opdPatientIdText }).eq("patientId", phPatientIdText)
      if (e4) throw new Error(`EyeReading relink: ${e4.message}`)
      const { error: e5 } = await target.from("PharmacyBill").update({ patientId: opdPatientIdText }).eq("patientId", phPatientIdText)
      if (e5) throw new Error(`PharmacyBill relink: ${e5.message}`)
      const { error: e6 } = await target.from("OpticalBill").update({ patientId: opdPatientIdText }).eq("patientId", phPatientIdText)
      if (e6) throw new Error(`OpticalBill relink: ${e6.message}`)

      // Now delete the placeholder
      const { error: eDel } = await target.from("Patient").delete().eq("id", phId)
      if (eDel) throw new Error(`Delete placeholder: ${eDel.message}`)

      done++
      if (done % 50 === 0) info(`  ...${done}/${matches.length}`)
    } catch (err) {
      failed++
      console.error(`  ✗ ${m.placeholder.patientId} → ${m.opd.patientId}: ${(err as Error).message}`)
    }
  }
  info(`\n✓ Relinked ${done}/${matches.length} (${failed} failed)`)

  if (!keepOrphans && orphans.length > 0) {
    info(`\nOrphans NOT deleted (use --keep-orphans=false flag is default behavior; pass it explicitly to confirm).`)
    info(`To delete orphans manually: review them first, then run SQL like:`)
    info(`  DELETE FROM "Patient" WHERE "patientId" IN ('LAB-W-XXXXX', ...);`)
  }

  info("\nOrphan summary:")
  info(`  IP-* orphans: ${orphans.filter((o) => o.patientId?.startsWith("IP-")).length}`)
  info(`  LAB-W-* orphans: ${orphans.filter((o) => o.patientId?.startsWith("LAB-W-")).length}`)
}

main().catch((err) => {
  console.error("\n✗ Failed:", err)
  process.exit(1)
})
