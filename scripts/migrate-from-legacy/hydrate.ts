import { SupabaseClient } from "@supabase/supabase-js"
import { Lookups } from "./lookups"
import { info, normalizeUsername } from "./utils"

async function readAll<T = any>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await client.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(`Read ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

/**
 * Hydrate in-memory lookups from existing rows in the target DB.
 * Called at startup so that re-runs / --only steps still resolve FKs correctly.
 */
export async function hydrateLookups(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== hydrating lookups from target ===")

  // Users
  const targetUsers = await readAll<{ id: string; email: string }>(target, "User", "id, email")
  const newIdByEmail = new Map<string, string>()
  for (const u of targetUsers) {
    newIdByEmail.set(u.email.toLowerCase(), u.id)
    const username = u.email.toLowerCase().split("@")[0]
    lookups.userByUsername.set(username, u.id)
    if (!lookups.defaultUserId) lookups.defaultUserId = u.id
  }

  const legacyStaff = await readAll<{ id: string; username: string | null }>(source, "staff", "id, username")
  for (const s of legacyStaff) {
    const username = normalizeUsername(s.username)
    if (!username) continue
    const newId = newIdByEmail.get(`${username}@sheh.com`)
    if (newId) lookups.userByLegacyId.set(s.id, newId)
  }
  info(`  users: ${lookups.userByUsername.size} by username, ${lookups.userByLegacyId.size} by legacy uuid, default=${lookups.defaultUserId ?? "none"}`)

  // Patients
  const targetPatients = await readAll<{ id: string; patientId: string | null }>(target, "Patient", "id, patientId")
  for (const p of targetPatients) {
    if (p.patientId) lookups.patientById.set(p.patientId, p.id)
  }
  info(`  patients: ${lookups.patientById.size} by patientId`)

  // Prescriptions — for labs to look up by (patientId, date)
  const targetPres = await readAll<{ id: string; patientId: string | null; prescriptionDate: string | null }>(
    target,
    "Prescription",
    "id, patientId, prescriptionDate",
  )
  for (const p of targetPres) {
    if (p.patientId && p.prescriptionDate) {
      const key = `${p.patientId}::${p.prescriptionDate.slice(0, 10)}`
      // First-write wins (if multiple prescriptions same day, lab arbitrarily attaches to first)
      if (!lookups.prescriptionByPatientDate.has(key)) {
        lookups.prescriptionByPatientDate.set(key, p.id)
      }
    }
  }
  info(`  prescriptions: ${lookups.prescriptionByPatientDate.size} (patient,date) keys`)

  // Labs
  const targetLabs = await readAll<{ id: string; name: string }>(target, "Lab", "id, name")
  for (const l of targetLabs) lookups.labByName.set(l.name, l.id)
  info(`  labs: ${lookups.labByName.size}`)

  // Expense categories
  const targetCats = await readAll<{ id: string; name: string }>(target, "ExpenseCategory", "id, name")
  for (const c of targetCats) lookups.expenseCategoryByName.set(c.name.toLowerCase(), c.id)
  info(`  expense categories: ${lookups.expenseCategoryByName.size}`)

  // PharmacyStock lookup: legacy medicine.id → target PharmacyStock.id
  // Match by (name lowercased, batchNumber)
  const targetMeds = await readAll<{ id: string; name: string }>(target, "PharmacyMedicine", "id, name")
  const medIdByName = new Map<string, string>()
  for (const m of targetMeds) medIdByName.set(m.name.toLowerCase(), m.id)

  const targetStocks = await readAll<{ id: string; medicineId: string; batchNumber: string }>(
    target,
    "PharmacyStock",
    "id, medicineId, batchNumber",
  )
  const stockByMedAndBatch = new Map<string, string>()
  for (const s of targetStocks) stockByMedAndBatch.set(`${s.medicineId}::${s.batchNumber}`, s.id)

  const legacyMeds = await readAll<{ id: string; name: string | null; batchNumber: string | null }>(
    source,
    "medicines",
    "id, name, batchNumber",
  )
  for (const lm of legacyMeds) {
    const name = (lm.name ?? "").trim().toLowerCase()
    if (!name) continue
    const medId = medIdByName.get(name)
    if (!medId) continue
    const batch = (lm.batchNumber ?? "").trim() || `UNKNOWN-${lm.id.slice(0, 8)}`
    const stockId = stockByMedAndBatch.get(`${medId}::${batch}`)
    if (stockId) lookups.pharmacyStockByLegacyMedicineId.set(lm.id, stockId)
  }
  info(`  pharmacy stock: ${lookups.pharmacyStockByLegacyMedicineId.size} by legacy medicineId`)
}
