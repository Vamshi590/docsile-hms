"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getNextBillNumber(): Promise<string> {
  const supabase = await createClient()
  const today = new Date()
  const prefix = `PH-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
  const { data: last } = await supabase
    .from("PharmacyBill")
    .select("billNumber")
    .like("billNumber", `${prefix}%`)
    .order("billNumber", { ascending: false })
    .limit(1)
    .single()
  if (!last) return `${prefix}-0001`
  const lastNum = parseInt(last.billNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

async function getNextPONumber(): Promise<string> {
  const supabase = await createClient()
  const today = new Date()
  const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`
  const { data: last } = await supabase
    .from("PurchaseOrder")
    .select("orderNumber")
    .like("orderNumber", `${prefix}%`)
    .order("orderNumber", { ascending: false })
    .limit(1)
    .single()
  if (!last) return `${prefix}-0001`
  const lastNum = parseInt(last.orderNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

// ─── Medicine Master CRUD ─────────────────────────────────────────────────────

export async function getMedicines(search?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("PharmacyMedicine")
    .select("*")
    .eq("isActive", true)
    .order("name", { ascending: true })
    .limit(100)

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,genericName.ilike.%${search}%,manufacturer.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createMedicine(data: {
  name: string
  genericName?: string
  manufacturer?: string
  composition?: string
  category?: string
  dosageForm?: string
  strength?: string
  unitOfMeasure?: string
  hsnCode?: string
  gstPercent?: number
  scheduleType?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: med, error } = await supabase
      .from("PharmacyMedicine")
      .insert({
        name: data.name,
        genericName: data.genericName || null,
        manufacturer: data.manufacturer || null,
        composition: data.composition || null,
        category: data.category || null,
        dosageForm: data.dosageForm || null,
        strength: data.strength || null,
        unitOfMeasure: data.unitOfMeasure || "Nos",
        hsnCode: data.hsnCode || null,
        gstPercent: data.gstPercent ?? 12,
        scheduleType: data.scheduleType || null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const, data: med }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "A medicine with this name and manufacturer already exists"
      : "Failed to create medicine"
    return { success: false as const, error: msg }
  }
}

export async function updateMedicine(id: string, data: {
  name?: string
  genericName?: string
  manufacturer?: string
  composition?: string
  category?: string
  dosageForm?: string
  strength?: string
  unitOfMeasure?: string
  hsnCode?: string
  gstPercent?: number
  scheduleType?: string
  isActive?: boolean
}) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { data: med, error } = await supabase
      .from("PharmacyMedicine")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const, data: med }
  } catch {
    return { success: false as const, error: "Failed to update medicine" }
  }
}

export async function deleteMedicine(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("PharmacyMedicine")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete medicine" }
  }
}

// ─── Stock / Inventory ────────────────────────────────────────────────────────

export async function getStock(filters?: {
  search?: string
  lowStock?: boolean
  nearExpiry?: boolean
  medicineId?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("PharmacyStock")
    .select("*, medicine:PharmacyMedicine(name, genericName, manufacturer, category, gstPercent, unitOfMeasure), supplier:PharmacySupplier(name)")
    .eq("isActive", true)
    .gt("quantity", 0)
    .order("expiryDate", { ascending: true })
    .limit(200)

  if (filters?.medicineId) {
    query = query.eq("medicineId", filters.medicineId)
  }

  if (filters?.nearExpiry) {
    const threeMonths = new Date()
    threeMonths.setMonth(threeMonths.getMonth() + 3)
    query = query.lte("expiryDate", threeMonths.toISOString())
  }

  if (filters?.lowStock) {
    query = query.lte("quantity", 10)
  }

  const { data: stock, error } = await query
  if (error) throw error

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return stock.filter(
      (item: any) =>
        item.medicine.name.toLowerCase().includes(s) ||
        item.medicine.genericName?.toLowerCase().includes(s) ||
        item.medicine.manufacturer?.toLowerCase().includes(s) ||
        item.batchNumber.toLowerCase().includes(s)
    )
  }

  return stock
}

export async function addStock(data: {
  medicineId: string
  batchNumber: string
  quantity: number
  mrp: number
  costPrice: number
  gstPercent: number
  unitsPerPack: number
  expiryDate: string
  manufacturingDate?: string
  supplierId?: string
  purchaseOrderId?: string
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    // Check if batch already exists for this medicine
    const { data: existing } = await supabase
      .from("PharmacyStock")
      .select("*")
      .eq("medicineId", data.medicineId)
      .eq("batchNumber", data.batchNumber)
      .single()

    if (existing) {
      // Update existing batch quantity
      const { data: updated, error } = await supabase
        .from("PharmacyStock")
        .update({
          quantity: existing.quantity + data.quantity,
          mrp: data.mrp,
          costPrice: data.costPrice,
          gstPercent: data.gstPercent,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()
      if (error) throw error
      revalidatePath("/pharmacy")
      return { success: true as const, data: updated }
    }

    const now = new Date().toISOString()
    const { data: stock, error } = await supabase
      .from("PharmacyStock")
      .insert({
        medicineId: data.medicineId,
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        mrp: data.mrp,
        costPrice: data.costPrice,
        gstPercent: data.gstPercent,
        unitsPerPack: data.unitsPerPack,
        expiryDate: new Date(data.expiryDate).toISOString(),
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate).toISOString() : null,
        supplierId: data.supplierId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const, data: stock }
  } catch (error: unknown) {
    console.error("Error adding stock:", error)
    return { success: false as const, error: "Failed to add stock" }
  }
}

export async function updateStock(id: string, data: {
  quantity?: number
  mrp?: number
  costPrice?: number
  batchNumber?: string
  gstPercent?: number
  expiryDate?: string
}) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { expiryDate, ...rest } = data
    const { error } = await supabase
      .from("PharmacyStock")
      .update({
        ...rest,
        ...(expiryDate ? { expiryDate: new Date(expiryDate).toISOString() } : {}),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update stock" }
  }
}

export async function getStockSummary() {
  const supabase = await createClient()
  const now = new Date()
  const threeMonths = new Date()
  threeMonths.setMonth(threeMonths.getMonth() + 3)

  const [totalItemsRes, lowStockRes, nearExpiryRes, expiredRes, totalValueRes] = await Promise.all([
    supabase
      .from("PharmacyStock")
      .select("*", { count: "exact", head: true })
      .eq("isActive", true)
      .gt("quantity", 0),
    supabase
      .from("PharmacyStock")
      .select("*", { count: "exact", head: true })
      .eq("isActive", true)
      .gt("quantity", 0)
      .lte("quantity", 10),
    supabase
      .from("PharmacyStock")
      .select("*", { count: "exact", head: true })
      .eq("isActive", true)
      .gt("quantity", 0)
      .gt("expiryDate", now.toISOString())
      .lte("expiryDate", threeMonths.toISOString()),
    supabase
      .from("PharmacyStock")
      .select("*", { count: "exact", head: true })
      .eq("isActive", true)
      .gt("quantity", 0)
      .lte("expiryDate", now.toISOString()),
    supabase
      .from("PharmacyStock")
      .select("quantity, mrp")
      .eq("isActive", true)
      .gt("quantity", 0),
  ])

  const totalItems = totalItemsRes.count ?? 0
  const lowStock = lowStockRes.count ?? 0
  const nearExpiry = nearExpiryRes.count ?? 0
  const expired = expiredRes.count ?? 0
  const stockValue = (totalValueRes.data ?? []).reduce((sum: number, s: any) => sum + s.quantity * s.mrp, 0)

  return { totalItems, lowStock, nearExpiry, expired, stockValue }
}

// ─── Stock search for billing (find available batches for a medicine) ──────

export async function searchMedicineStock(search: string) {
  if (!search || search.length < 2) return []

  const supabase = await createClient()

  // First find matching medicine IDs
  const { data: medicines } = await supabase
    .from("PharmacyMedicine")
    .select("id")
    .or(`name.ilike.%${search}%,genericName.ilike.%${search}%`)

  if (!medicines || medicines.length === 0) return []

  const medicineIds = medicines.map((m: any) => m.id)

  const { data: stock, error } = await supabase
    .from("PharmacyStock")
    .select("*, medicine:PharmacyMedicine(name, genericName, gstPercent)")
    .eq("isActive", true)
    .gt("quantity", 0)
    .gt("expiryDate", new Date().toISOString())
    .in("medicineId", medicineIds)
    .order("expiryDate", { ascending: true })
    .limit(20)

  if (error) throw error

  return (stock ?? []).map((s: any) => ({
    stockId: s.id,
    medicineId: s.medicineId,
    name: s.medicine.name,
    genericName: s.medicine.genericName,
    batchNumber: s.batchNumber,
    quantity: s.quantity,
    mrp: s.mrp,
    gstPercent: s.medicine.gstPercent,
    expiryDate: s.expiryDate,
  }))
}

// ─── Prescription Lookup for Billing ──────────────────────────────────────────

export async function getPatientPrescription(patientId: string) {
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from("Patient")
    .select("id, patientId, firstName, lastName, age, gender, phone, email, doctorName")
    .eq("patientId", patientId)
    .single()

  if (error || !patient) return { success: false as const, error: "Patient not found" }

  const { data: prescriptions } = await supabase
    .from("Prescription")
    .select("id, prescriptionNumber, medicines, doctorName, prescriptionDate")
    .eq("patientId", patient.id)
    .in("status", ["COMPLETED", "DRAFT"])
    .neq("medicines", "[]")
    .order("prescriptionDate", { ascending: false })
    .limit(1)

  const prescription = prescriptions?.[0] ?? null
  let medicines: { name: string; days?: string; timing?: string; note?: string }[] = []
  if (prescription) {
    try {
      medicines = JSON.parse(prescription.medicines)
    } catch {
      medicines = []
    }
  }

  return {
    success: true as const,
    data: {
      patient: {
        patientId: patient.patientId,
        name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        doctorName: patient.doctorName,
      },
      prescription: prescription
        ? {
            id: prescription.id,
            prescriptionNumber: prescription.prescriptionNumber,
            doctorName: prescription.doctorName,
            prescriptionDate: prescription.prescriptionDate,
            medicines,
          }
        : null,
    },
  }
}

// ─── Pharmacy Billing ─────────────────────────────────────────────────────────

export async function createPharmacyBill(data: {
  patientName: string
  patientId?: string
  patientPhone?: string
  gender?: string
  email?: string
  referredDoctor?: string
  prescriptionId?: string
  discountPercent: number
  roundOff: number
  paymentMode: string
  paidAmount: number
  paymentRef?: string
  items: {
    stockId: string
    medicineName: string
    batchNumber: string
    quantity: number
    mrp: number
    price: number
    total: number
    discountPercent: number
    amount: number
    gstPercent: number
  }[]
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const billNumber = await getNextBillNumber()
    const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
    const discountAmount = subtotal * (data.discountPercent / 100)
    const afterDiscount = subtotal - discountAmount
    const gstAmount = data.items.reduce((sum, item) => {
      const itemShare = subtotal > 0 ? (item.amount / subtotal) * afterDiscount : 0
      return sum + (itemShare * item.gstPercent) / (100 + item.gstPercent)
    }, 0)
    const netAmount = afterDiscount
    const billAmount = Math.round(netAmount + data.roundOff)
    const balanceDue = billAmount - data.paidAmount

    const now = new Date().toISOString()

    // Create bill
    const { data: newBill, error: billError } = await supabase
      .from("PharmacyBill")
      .insert({
        billNumber,
        patientId: data.patientId || null,
        patientName: data.patientName,
        patientPhone: data.patientPhone || null,
        gender: data.gender || null,
        email: data.email || null,
        referredDoctor: data.referredDoctor || null,
        prescriptionId: data.prescriptionId || null,
        subtotal,
        discountPercent: data.discountPercent,
        discountAmount,
        gstAmount,
        netAmount,
        roundOff: data.roundOff,
        billAmount,
        paidAmount: data.paidAmount,
        balanceDue,
        paymentMode: data.paymentMode,
        paymentRef: data.paymentRef || null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (billError) throw billError

    // Create bill items
    const billItems = data.items.map((item) => ({
      billId: newBill.id,
      stockId: item.stockId,
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      quantity: item.quantity,
      mrp: item.mrp,
      price: item.price,
      total: item.total,
      discountPercent: item.discountPercent,
      amount: item.amount,
      gstPercent: item.gstPercent,
    }))
    const { error: itemsError } = await supabase
      .from("PharmacyBillItem")
      .insert(billItems)
    if (itemsError) throw itemsError

    // Deduct stock quantities
    for (const item of data.items) {
      // Fetch current stock to compute new quantity
      const { data: currentStock, error: fetchError } = await supabase
        .from("PharmacyStock")
        .select("quantity")
        .eq("id", item.stockId)
        .single()
      if (fetchError) throw fetchError

      const { error: stockError } = await supabase
        .from("PharmacyStock")
        .update({
          quantity: currentStock.quantity - item.quantity,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", item.stockId)
      if (stockError) throw stockError
    }

    revalidatePath("/pharmacy")
    return { success: true as const, data: { id: newBill.id, billNumber: newBill.billNumber, billAmount: newBill.billAmount } }
  } catch (error) {
    console.error("Error creating pharmacy bill:", error)
    return { success: false as const, error: "Failed to create bill" }
  }
}

export async function getPharmacyBills(filters?: {
  dateFrom?: string
  dateTo?: string
  search?: string
  status?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("PharmacyBill")
    .select("*, items:PharmacyBillItem(*)")
    .order("createdAt", { ascending: false })
    .limit(100)

  if (filters?.dateFrom) {
    query = query.gte("billDate", new Date(filters.dateFrom + "T00:00:00").toISOString())
  }
  if (filters?.dateTo) {
    query = query.lte("billDate", new Date(filters.dateTo + "T23:59:59").toISOString())
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data: bills, error } = await query
  if (error) throw error

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return (bills ?? []).filter(
      (b: any) =>
        b.patientName.toLowerCase().includes(s) ||
        b.billNumber.toLowerCase().includes(s) ||
        b.patientPhone?.toLowerCase().includes(s)
    )
  }

  return bills
}

// ─── Suppliers CRUD ───────────────────────────────────────────────────────────

export async function getSuppliers(search?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("PharmacySupplier")
    .select("*")
    .eq("isActive", true)
    .order("name", { ascending: true })

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,contactPerson.ilike.%${search}%,phone.ilike.%${search}%`
    )
  }

  const { data: suppliers, error } = await query
  if (error) throw error

  // Get counts for each supplier (replaces _count include)
  const supplierIds = (suppliers ?? []).map((s: any) => s.id)

  if (supplierIds.length === 0) return []

  const [poCountRes, stockCountRes] = await Promise.all([
    supabase
      .from("PurchaseOrder")
      .select("supplierId")
      .in("supplierId", supplierIds),
    supabase
      .from("PharmacyStock")
      .select("supplierId")
      .in("supplierId", supplierIds),
  ])

  const poCounts: Record<string, number> = {}
  for (const row of poCountRes.data ?? []) {
    poCounts[row.supplierId] = (poCounts[row.supplierId] || 0) + 1
  }
  const stockCounts: Record<string, number> = {}
  for (const row of stockCountRes.data ?? []) {
    stockCounts[row.supplierId] = (stockCounts[row.supplierId] || 0) + 1
  }

  return (suppliers ?? []).map((s: any) => ({
    ...s,
    _count: {
      purchaseOrders: poCounts[s.id] || 0,
      stockEntries: stockCounts[s.id] || 0,
    },
  }))
}

export async function createSupplier(data: {
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  drugLicenseNo?: string
  creditDays?: number
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: supplier, error } = await supabase
      .from("PharmacySupplier")
      .insert({
        ...data,
        creditDays: data.creditDays ?? 30,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const, data: supplier }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "A supplier with this name already exists"
      : "Failed to create supplier"
    return { success: false as const, error: msg }
  }
}

export async function updateSupplier(id: string, data: {
  name?: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  drugLicenseNo?: string
  creditDays?: number
  isActive?: boolean
}) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { data: supplier, error } = await supabase
      .from("PharmacySupplier")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const, data: supplier }
  } catch {
    return { success: false as const, error: "Failed to update supplier" }
  }
}

export async function deleteSupplier(id: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("PharmacySupplier")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete supplier" }
  }
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export async function getPurchaseOrders(filters?: {
  status?: string
  supplierId?: string
  dateFrom?: string
  dateTo?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("PurchaseOrder")
    .select("*, supplier:PharmacySupplier(name, phone), items:PurchaseOrderItem(*, medicine:PharmacyMedicine(name))")
    .order("createdAt", { ascending: false })
    .limit(100)

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.supplierId) query = query.eq("supplierId", filters.supplierId)
  if (filters?.dateFrom) query = query.gte("orderDate", new Date(filters.dateFrom + "T00:00:00").toISOString())
  if (filters?.dateTo) query = query.lte("orderDate", new Date(filters.dateTo + "T23:59:59").toISOString())

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPurchaseOrder(data: {
  supplierId: string
  expectedDate?: string
  invoiceNumber?: string
  invoiceDate?: string
  notes?: string
  discount: number
  paymentMode?: string
  amountPaid: number
  items: {
    medicineId: string
    batchNumber?: string
    quantity: number
    costPrice: number
    mrp: number
    gstPercent: number
    expiryDate?: string
  }[]
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    const orderNumber = await getNextPONumber()

    const itemsWithAmount = data.items.map((item) => ({
      ...item,
      amount: item.quantity * item.costPrice * (1 + item.gstPercent / 100),
    }))

    const subtotal = itemsWithAmount.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)
    const gstAmount = itemsWithAmount.reduce((sum, item) => sum + (item.quantity * item.costPrice * item.gstPercent) / 100, 0)
    const totalAmount = subtotal + gstAmount - data.discount
    const balanceDue = totalAmount - data.amountPaid

    const now = new Date().toISOString()

    // Create purchase order
    const { data: po, error: poError } = await supabase
      .from("PurchaseOrder")
      .insert({
        orderNumber,
        supplierId: data.supplierId,
        expectedDate: data.expectedDate ? new Date(data.expectedDate).toISOString() : null,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString() : null,
        subtotal,
        gstAmount,
        discount: data.discount,
        totalAmount,
        amountPaid: data.amountPaid,
        balanceDue,
        paymentMode: data.paymentMode || null,
        notes: data.notes || null,
        status: "ORDERED",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (poError) throw poError

    // Create purchase order items
    const poItems = itemsWithAmount.map((item) => ({
      purchaseOrderId: po.id,
      medicineId: item.medicineId,
      batchNumber: item.batchNumber || null,
      quantity: item.quantity,
      costPrice: item.costPrice,
      mrp: item.mrp,
      gstPercent: item.gstPercent,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null,
      amount: item.amount,
    }))
    const { error: itemsError } = await supabase
      .from("PurchaseOrderItem")
      .insert(poItems)
    if (itemsError) throw itemsError

    revalidatePath("/pharmacy")
    return { success: true as const, data: { id: po.id, orderNumber: po.orderNumber } }
  } catch (error) {
    console.error("Error creating PO:", error)
    return { success: false as const, error: "Failed to create purchase order" }
  }
}

export async function receivePurchaseOrder(
  poId: string,
  items: { itemId: string; receivedQty: number; batchNumber: string; expiryDate: string; mrp: number; costPrice: number }[]
) {
  const user = await requireAuth()
  const supabase = await createClient()
  try {
    // Fetch the PO with its items and medicine data
    const { data: po, error: poError } = await supabase
      .from("PurchaseOrder")
      .select("*, items:PurchaseOrderItem(*, medicine:PharmacyMedicine(*))")
      .eq("id", poId)
      .single()
    if (poError || !po) throw new Error("Purchase order not found")

    for (const receivedItem of items) {
      const poItem = po.items.find((i: any) => i.id === receivedItem.itemId)
      if (!poItem) continue

      // Update received quantity on PO item
      const newReceivedQty = poItem.receivedQty + receivedItem.receivedQty
      const { error: updateItemError } = await supabase
        .from("PurchaseOrderItem")
        .update({
          receivedQty: newReceivedQty,
          batchNumber: receivedItem.batchNumber,
          expiryDate: new Date(receivedItem.expiryDate).toISOString(),
          mrp: receivedItem.mrp,
          costPrice: receivedItem.costPrice,
        })
        .eq("id", receivedItem.itemId)
      if (updateItemError) throw updateItemError

      // Add to pharmacy stock - check if batch exists
      const { data: existingStock } = await supabase
        .from("PharmacyStock")
        .select("*")
        .eq("medicineId", poItem.medicineId)
        .eq("batchNumber", receivedItem.batchNumber)
        .single()

      if (existingStock) {
        const { error: stockUpdateError } = await supabase
          .from("PharmacyStock")
          .update({
            quantity: existingStock.quantity + receivedItem.receivedQty,
            mrp: receivedItem.mrp,
            costPrice: receivedItem.costPrice,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", existingStock.id)
        if (stockUpdateError) throw stockUpdateError
      } else {
        const now = new Date().toISOString()
        const { error: stockCreateError } = await supabase
          .from("PharmacyStock")
          .insert({
            medicineId: poItem.medicineId,
            batchNumber: receivedItem.batchNumber,
            quantity: receivedItem.receivedQty,
            mrp: receivedItem.mrp,
            costPrice: receivedItem.costPrice,
            gstPercent: poItem.gstPercent,
            unitsPerPack: 1,
            expiryDate: new Date(receivedItem.expiryDate).toISOString(),
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
          })
        if (stockCreateError) throw stockCreateError
      }
    }

    // Check ALL PO items to determine final status
    const { data: updatedItems, error: fetchItemsError } = await supabase
      .from("PurchaseOrderItem")
      .select("*")
      .eq("purchaseOrderId", poId)
    if (fetchItemsError) throw fetchItemsError

    const allReceived = (updatedItems ?? []).every((i: any) => i.receivedQty >= i.quantity)

    const { error: statusError } = await supabase
      .from("PurchaseOrder")
      .update({
        status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", poId)
    if (statusError) throw statusError

    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch (error) {
    console.error("Error receiving PO:", error)
    return { success: false as const, error: "Failed to receive purchase order" }
  }
}

export async function updatePOStatus(poId: string, status: string) {
  await requireAuth()
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("PurchaseOrder")
      .update({ status, updatedAt: new Date().toISOString() })
      .eq("id", poId)
    if (error) throw error
    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}
