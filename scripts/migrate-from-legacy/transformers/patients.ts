import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import {
  info,
  insertInBatches,
  logError,
  newId,
  normalizeUsername,
  parseDate,
  parseIntOrNull,
  trimOrNull,
} from "../utils"

export async function migratePatients(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== patients → Patient ===")

  let from = 0
  const PAGE = 1000
  const out: any[] = []
  const seenPatientIds = new Set<string>(lookups.patientById.keys())

  while (true) {
    const { data, error } = await source
      .from("patients")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read patients: ${error.message}`)
    if (!data || data.length === 0) break

    for (const r of data) {
      const patientId = trimOrNull(r.patientId)
      if (!patientId) {
        logError("patients", r.id, "blank patientId")
        continue
      }
      if (seenPatientIds.has(patientId)) {
        // Already migrated previously — skip
        continue
      }

      const id = newId()
      const createdById = lookups.userByUsername.get(normalizeUsername(r.createdBy)) ?? null
      const appointmentDate = parseDate(r.date) ?? new Date().toISOString()
      const firstName = trimOrNull(r.name) ?? "Unknown"

      out.push({
        id,
        patientId,
        firstName,
        lastName: null,
        age: parseIntOrNull(r.age),
        gender: trimOrNull(r.gender) ?? "Unknown",
        phone: trimOrNull(r.phone) ?? "",
        address: trimOrNull(r.address),
        dateOfBirth: parseDate(r.dob),
        guardianName: trimOrNull(r.guardian),
        referredBy: trimOrNull(r.referredBy),
        doctorName: trimOrNull(r.doctorName),
        department: trimOrNull(r.department),
        patientType: "OPD",
        status: trimOrNull(r.status) ?? "REGISTERED",
        appointmentDate,
        createdById,
        createdAt: parseDate(r.created_at) ?? new Date().toISOString(),
        updatedAt: parseDate(r.updated_at) ?? new Date().toISOString(),
      })

      seenPatientIds.add(patientId)
      lookups.patientById.set(patientId, id)
      if (r.id) lookups.patientByLegacyUuid.set(r.id, id)
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  info(`  transformed ${out.length} → Patient rows`)
  if (config.dryRun) {
    console.log(JSON.stringify(out.slice(0, 2), null, 2))
    return
  }
  await insertInBatches(target, "Patient", out)
  info(`  ✓ inserted ${out.length} Patient rows`)
}
