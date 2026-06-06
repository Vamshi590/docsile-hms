import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import {
  info,
  insertInBatches,
  newId,
  normalizeUsername,
  parseDate,
  parseFloatOrNull,
  parseIntOrNull,
  trimOrNull,
} from "../utils"

const MAIN_LAB = "Main Lab"
const VENNELA_LAB = "Vennela Lab"

async function ensureLab(target: SupabaseClient, lookups: Lookups, name: string): Promise<string> {
  let id = lookups.labByName.get(name)
  if (id) return id
  id = newId()
  if (!config.dryRun) {
    const { error } = await target.from("Lab").insert([
      { id, name, isActive: true, sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ])
    if (error) throw new Error(`Insert Lab ${name}: ${error.message}`)
  }
  lookups.labByName.set(name, id)
  return id
}

function collectItems(
  row: any,
  testPrefix: string,
  amountPrefix: string,
): { name: string; amount: number }[] {
  const items: { name: string; amount: number }[] = []
  for (let i = 1; i <= 10; i++) {
    const name = trimOrNull(row[`${testPrefix} ${i}`])
    const amt = parseFloatOrNull(row[`${amountPrefix} ${i}`])
    if (name) items.push({ name, amount: amt ?? 0 })
  }
  return items
}

export async function migrateLabs(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== labs → Lab + LabBill + LabBillItem ===")

  const mainLabId = await ensureLab(target, lookups, MAIN_LAB)
  const vennelaLabId = await ensureLab(target, lookups, VENNELA_LAB)

  let from = 0
  const PAGE = 500
  const bills: any[] = []
  const items: any[] = []
  const placeholderPatients: any[] = []
  let billCounter = 0
  let walkinCounter = 0

  while (true) {
    const { data, error } = await source
      .from("labs")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read labs: ${error.message}`)
    if (!data || data.length === 0) break

    for (const r of data) {
      const createdBy = lookups.userByUsername.get(normalizeUsername(r.createdBy)) ?? lookups.defaultUserId ?? null
      let patientId = trimOrNull(r["PATIENT ID"])
      const date = parseDate(r.DATE) ?? parseDate(r.createdAt) ?? new Date().toISOString()

      const mainItems = collectItems(r, "LAB TEST", "AMOUNT")
      const vItems = collectItems(r, "VLAB TEST", "VAMOUNT")
      const hasLabData = mainItems.length > 0 || vItems.length > 0

      // Anonymous walk-in: row has lab data but blank PATIENT ID → synthesize one
      if (!patientId && hasLabData) {
        walkinCounter += 1
        patientId = `LAB-W-${String(walkinCounter).padStart(5, "0")}`
      }

      // If patient not in lookup, create a placeholder from the lab row's denormalized fields
      if (patientId && !lookups.patientById.has(patientId)) {
        const placeholderId = newId()
        placeholderPatients.push({
          id: placeholderId,
          patientId,
          firstName: trimOrNull(r["PATIENT NAME"]) ?? "Unknown",
          lastName: null,
          age: parseIntOrNull(r.AGE),
          gender: trimOrNull(r.GENDER) ?? "Unknown",
          phone: trimOrNull(r["PHONE NUMBER"]) ?? "",
          address: trimOrNull(r.ADDRESS),
          dateOfBirth: parseDate(r.DOB),
          guardianName: trimOrNull(r["GUARDIAN NAME"]),
          patientType: "OPD",
          status: "REGISTERED",
          appointmentDate: date,
          createdAt: date,
          updatedAt: date,
        })
        lookups.patientById.set(patientId, placeholderId)
      }
      if (mainItems.length > 0 && patientId && lookups.patientById.has(patientId)) {
        billCounter += 1
        const billId = newId()
        const subtotal = mainItems.reduce((s, it) => s + it.amount, 0)
        const received = parseFloatOrNull(r["AMOUNT RECEIVED"]) ?? subtotal
        const due = parseFloatOrNull(r["AMOUNT DUE"]) ?? Math.max(0, subtotal - received)
        bills.push({
          id: billId,
          billNumber: `LB-MIG-${String(billCounter).padStart(6, "0")}`,
          labId: mainLabId,
          patientId,
          prescriptionId: null,
          subtotal,
          discount: parseFloatOrNull(r["DISCOUNT PERCENTAGE"]) ?? 0,
          total: subtotal,
          amountPaid: received,
          balanceDue: due,
          paymentMode: trimOrNull(r.MODE) ?? "CASH",
          paymentDate: date,
          status: due > 0 ? "PARTIAL" : "PAID",
          createdBy,
          createdAt: date,
          updatedAt: date,
        })
        mainItems.forEach((it, idx) => {
          items.push({
            id: newId(),
            labBillId: billId,
            name: it.name,
            amount: it.amount,
            sortOrder: idx,
          })
        })
      }

      // Vennela lab bill
      if (vItems.length > 0 && patientId && lookups.patientById.has(patientId)) {
        billCounter += 1
        const billId = newId()
        const subtotal = vItems.reduce((s, it) => s + it.amount, 0)
        const received = parseFloatOrNull(r["VAMOUNT RECEIVED"]) ?? subtotal
        const due = parseFloatOrNull(r["VAMOUNT DUE"]) ?? Math.max(0, subtotal - received)
        bills.push({
          id: billId,
          billNumber: `VB-MIG-${String(billCounter).padStart(6, "0")}`,
          labId: vennelaLabId,
          patientId,
          prescriptionId: null,
          subtotal,
          discount: parseFloatOrNull(r["VDISCOUNT PERCENTAGE"]) ?? 0,
          total: subtotal,
          amountPaid: received,
          balanceDue: due,
          paymentMode: trimOrNull(r.VMODE) ?? "CASH",
          paymentDate: date,
          status: due > 0 ? "PARTIAL" : "PAID",
          createdBy,
          createdAt: date,
          updatedAt: date,
        })
        vItems.forEach((it, idx) => {
          items.push({
            id: newId(),
            labBillId: billId,
            name: it.name,
            amount: it.amount,
            sortOrder: idx,
          })
        })
      }
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  info(`  transformed ${placeholderPatients.length} placeholder patients + ${bills.length} LabBills + ${items.length} items`)
  if (config.dryRun) return
  if (placeholderPatients.length) await insertInBatches(target, "Patient", placeholderPatients)
  await insertInBatches(target, "LabBill", bills)
  await insertInBatches(target, "LabBillItem", items)
  info(`  ✓ inserted`)
}
