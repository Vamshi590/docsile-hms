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

export async function migrateOpticals(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== opticals → OpticalProduct + OpticalStock ===")

  const { data, error } = await source.from("opticals").select("*")
  if (error) throw new Error(`Read opticals: ${error.message}`)

  const createdBy = lookups.defaultUserId ?? "system"
  const products: any[] = []
  const stocks: any[] = []
  const prodByKey = new Map<string, string>()

  for (const r of data ?? []) {
    const brand = trimOrNull(r.brand) ?? "Generic"
    const model = trimOrNull(r.model) ?? ""
    const type = trimOrNull(r.type) ?? "Frame"
    const name = [model, type].filter(Boolean).join(" ") || "Unnamed"
    const key = `${name.toLowerCase()}::${brand.toLowerCase()}`

    let productId = prodByKey.get(key)
    if (!productId) {
      productId = newId()
      prodByKey.set(key, productId)
      products.push({
        id: productId,
        name,
        brand,
        category: type,
        modelNumber: model || null,
        size: trimOrNull(r.size),
        gstPercent: 12,
        isActive: true,
        createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    const price = parseFloatOrNull(r.price) ?? 0
    const cost = parseFloatOrNull(r.cost) ?? price
    const stockId = newId()
    stocks.push({
      id: stockId,
      productId,
      quantity: parseIntOrNull(r.quantity) ?? 0,
      mrp: price,
      costPrice: cost,
      gstPercent: 12,
      power: trimOrNull(r.power),
      isActive: trimOrNull(r.status) !== "out_of_stock",
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    if (r.id) lookups.opticalStockByLegacyId.set(r.id, stockId)
  }

  info(`  transformed ${products.length} products + ${stocks.length} stock`)
  if (config.dryRun) return
  await insertInBatches(target, "OpticalProduct", products)
  await insertInBatches(target, "OpticalStock", stocks)
  info(`  ✓ inserted`)
}

export async function migrateOpticalDispense(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== optical_dispense_records → OpticalBill + OpticalBillItem ===")

  const { data, error } = await source.from("optical_dispense_records").select("*")
  if (error) throw new Error(`Read optical_dispense_records: ${error.message}`)

  const bills: any[] = []
  const items: any[] = []
  let billCounter = 0

  for (const r of data ?? []) {
    const stockId = lookups.opticalStockByLegacyId.get(r.opticalId ?? "") ?? null
    const createdBy =
      lookups.userByUsername.get(normalizeUsername(r.dispensedBy)) ?? lookups.defaultUserId ?? "system"
    const billId = newId()
    const qty = parseIntOrNull(r.quantity) ?? 1
    const price = parseFloatOrNull(r.price) ?? 0
    const total = qty * price
    billCounter += 1

    bills.push({
      id: billId,
      billNumber: `OB-MIG-${String(billCounter).padStart(6, "0")}`,
      patientId: trimOrNull(r.patientId),
      patientName: trimOrNull(r.patientName) ?? "Unknown",
      billDate: parseDate(r.dispensedAt) ?? new Date().toISOString(),
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
      status: "DELIVERED",
      createdBy,
      createdAt: parseDate(r.dispensedAt) ?? new Date().toISOString(),
      updatedAt: parseDate(r.dispensedAt) ?? new Date().toISOString(),
    })
    items.push({
      id: newId(),
      billId,
      stockId,
      itemName: [trimOrNull(r.brand), trimOrNull(r.model), trimOrNull(r.opticalType)].filter(Boolean).join(" ") || "Optical",
      category: trimOrNull(r.opticalType) ?? "Frame",
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
  await insertInBatches(target, "OpticalBill", bills)
  await insertInBatches(target, "OpticalBillItem", items)
  info(`  ✓ inserted`)
}
