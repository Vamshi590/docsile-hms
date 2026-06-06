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

export async function migrateMedicines(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== medicines → PharmacyMedicine + PharmacyStock ===")

  const { data, error } = await source.from("medicines").select("*")
  if (error) throw new Error(`Read medicines: ${error.message}`)

  const createdBy = lookups.defaultUserId ?? "system"
  const meds: any[] = []
  const stocks: any[] = []
  const medByName = new Map<string, string>()
  const stockByKey = new Map<string, string>()

  for (const r of data ?? []) {
    const name = trimOrNull(r.name)
    if (!name || !r.id) continue

    let medId = medByName.get(name.toLowerCase())
    if (!medId) {
      medId = newId()
      medByName.set(name.toLowerCase(), medId)
      meds.push({
        id: medId,
        name,
        category: trimOrNull(r.medicineType),
        unitOfMeasure: "Nos",
        gstPercent: 12,
        isActive: true,
        createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    const price = parseFloatOrNull(r.price) ?? 0
    const batchNumber = trimOrNull(r.batchNumber) ?? `UNKNOWN-${r.id.slice(0, 8)}`
    const stockKey = `${medId}::${batchNumber}`

    // Dedupe (medicineId, batchNumber) — keep first, link subsequent legacy ids to same stock
    const existingStockId = stockByKey.get(stockKey)
    if (existingStockId) {
      lookups.pharmacyStockByLegacyMedicineId.set(r.id, existingStockId)
      continue
    }

    const stockId = newId()
    stockByKey.set(stockKey, stockId)
    stocks.push({
      id: stockId,
      medicineId: medId,
      batchNumber,
      quantity: parseIntOrNull(r.quantity) ?? 0,
      mrp: price,
      costPrice: price,
      gstPercent: 12,
      unitsPerPack: 1,
      expiryDate: parseDate(r.expiryDate) ?? new Date("2099-12-31").toISOString(),
      isActive: trimOrNull(r.status) !== "out_of_stock",
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    lookups.pharmacyStockByLegacyMedicineId.set(r.id, stockId)
  }

  info(`  transformed ${meds.length} medicines + ${stocks.length} stock entries`)
  if (config.dryRun) return
  await insertInBatches(target, "PharmacyMedicine", meds)
  await insertInBatches(target, "PharmacyStock", stocks)
  info(`  ✓ inserted`)
}

export async function migrateMedicineDispense(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== medicine_dispense_records → PharmacyBill + PharmacyBillItem ===")

  const { data, error } = await source.from("medicine_dispense_records").select("*")
  if (error) throw new Error(`Read medicine_dispense_records: ${error.message}`)

  const bills: any[] = []
  const items: any[] = []
  let billCounter = 0

  for (const r of data ?? []) {
    const stockId = lookups.pharmacyStockByLegacyMedicineId.get(r.medicineId ?? "")
    if (!stockId) {
      // medicine not migrated; skip
      continue
    }
    const createdBy =
      lookups.userByUsername.get(normalizeUsername(r.dispensedBy)) ?? lookups.defaultUserId ?? "system"
    const billId = newId()
    const qty = parseIntOrNull(r.quantity) ?? 1
    const price = parseFloatOrNull(r.price) ?? 0
    const total = parseFloatOrNull(r.totalAmount) ?? qty * price
    billCounter += 1

    bills.push({
      id: billId,
      billNumber: `PB-MIG-${String(billCounter).padStart(6, "0")}`,
      patientId: trimOrNull(r.patientId),
      patientName: trimOrNull(r.patientName) ?? "Unknown",
      billDate: parseDate(r.dispensedDate) ?? new Date().toISOString(),
      subtotal: total,
      discountPercent: 0,
      discountAmount: 0,
      gstAmount: 0,
      netAmount: total,
      roundOff: 0,
      billAmount: total,
      paidAmount: total,
      balanceDue: 0,
      paymentMode: "CASH",
      status: "COMPLETED",
      createdBy,
      createdAt: parseDate(r.dispensedDate) ?? new Date().toISOString(),
      updatedAt: parseDate(r.dispensedDate) ?? new Date().toISOString(),
    })
    items.push({
      id: newId(),
      billId,
      stockId,
      medicineName: trimOrNull(r.medicineName) ?? "Unknown",
      batchNumber: trimOrNull(r.batchNumber) ?? "UNKNOWN",
      quantity: qty,
      mrp: price,
      price,
      total,
      discountPercent: 0,
      amount: total,
      gstPercent: 0,
    })
  }

  info(`  transformed ${bills.length} bills + ${items.length} items`)
  if (config.dryRun) return
  await insertInBatches(target, "PharmacyBill", bills)
  await insertInBatches(target, "PharmacyBillItem", items)
  info(`  ✓ inserted`)
}
