"use server"

import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// ─── PRODUCT MASTER CRUD ─────────────────────────────

export async function getOpticalProducts(search?: string) {
  await requireServerPermission("optical:view")
  const supabase = await createClient()

  let query = supabase
    .from("OpticalProduct")
    .select("*")
    .eq("isActive", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .limit(100)

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,brand.ilike.%${search}%,modelNumber.ilike.%${search}%`
    )
  }

  const { data: products, error } = await query
  if (error) throw error
  return products
}

export async function createOpticalProduct(data: {
  name: string
  brand?: string
  category: string
  type?: string
  material?: string
  color?: string
  size?: string
  coating?: string
  index?: string
  modelNumber?: string
  hsnCode?: string
  gstPercent?: number
}) {
  const user = await requireServerPermission("optical:manage_stock")
  const supabase = await createClient()
  try {
    const now = new Date().toISOString()
    const { data: product, error } = await supabase
      .from("OpticalProduct")
      .insert({
        ...data,
        gstPercent: data.gstPercent ?? 12,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()

    if (error) throw error
    revalidatePath("/optical")
    return { success: true as const, data: product }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create product"
    if (msg.includes("Unique constraint")) return { success: false as const, error: "Product with this name and brand already exists" }
    return { success: false as const, error: msg }
  }
}

export async function updateOpticalProduct(id: string, data: Partial<{
  name: string; brand: string; category: string; type: string; material: string
  color: string; size: string; coating: string; index: string; modelNumber: string
  hsnCode: string; gstPercent: number; isActive: boolean
}>) {
  await requireServerPermission("optical:manage_stock")
  const supabase = await createClient()
  try {
    const { data: product, error } = await supabase
      .from("OpticalProduct")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    revalidatePath("/optical")
    return { success: true as const, data: product }
  } catch {
    return { success: false as const, error: "Failed to update product" }
  }
}

export async function deleteOpticalProduct(id: string) {
  await requireServerPermission("optical:manage_stock")
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("OpticalProduct")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
    revalidatePath("/optical")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to delete product" }
  }
}

// ─── STOCK MANAGEMENT ────────────────────────────────

export async function getOpticalStock(filters?: {
  search?: string
  category?: string
  lowStock?: boolean
}) {
  await requireServerPermission("optical:view")
  const supabase = await createClient()

  let query = supabase
    .from("OpticalStock")
    .select("*, product:OpticalProduct(*)")
    .eq("isActive", true)
    .eq("product.isActive", true)

  if (filters?.category) {
    query = query.eq("product.category", filters.category)
  }

  if (filters?.lowStock) {
    query = query.lte("quantity", 5).gt("quantity", 0)
  }

  query = query.order("product(category)", { ascending: true })
    .order("product(name)", { ascending: true })
    .limit(200)

  const { data: stock, error } = await query
  if (error) throw error

  // Filter out rows where the inner join on product returned null
  const filtered = (stock ?? []).filter((item: Record<string, unknown>) => item.product != null)

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return filtered.filter(
      (item: Record<string, unknown>) => {
        const product = item.product as Record<string, string | null>
        return (
          (product.name ?? "").toLowerCase().includes(s) ||
          (product.brand ?? "").toLowerCase().includes(s) ||
          (product.modelNumber ?? "").toLowerCase().includes(s) ||
          ((item.batchNumber as string) ?? "").toLowerCase().includes(s)
        )
      }
    )
  }
  return filtered
}

export async function addOpticalStock(data: {
  productId: string
  batchNumber?: string
  quantity: number
  mrp: number
  costPrice?: number
  gstPercent?: number
  power?: string
  supplierId?: string
}) {
  const user = await requireServerPermission("optical:manage_stock")
  const supabase = await createClient()
  try {
    // Check if this product + batch + power already exists
    let existingQuery = supabase
      .from("OpticalStock")
      .select("*")
      .eq("productId", data.productId)

    if (data.batchNumber != null) {
      existingQuery = existingQuery.eq("batchNumber", data.batchNumber)
    } else {
      existingQuery = existingQuery.is("batchNumber", null)
    }

    if (data.power != null) {
      existingQuery = existingQuery.eq("power", data.power)
    } else {
      existingQuery = existingQuery.is("power", null)
    }

    const { data: existingRows, error: findError } = await existingQuery.limit(1)
    if (findError) throw findError

    const existing = existingRows?.[0] ?? null

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("OpticalStock")
        .update({ quantity: existing.quantity + data.quantity, updatedAt: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) throw updateError
      revalidatePath("/optical")
      return { success: true as const, data: updated }
    }

    const now = new Date().toISOString()
    const { data: stock, error: createError } = await supabase
      .from("OpticalStock")
      .insert({
        productId: data.productId,
        batchNumber: data.batchNumber ?? null,
        quantity: data.quantity,
        mrp: data.mrp,
        costPrice: data.costPrice ?? 0,
        gstPercent: data.gstPercent ?? 12,
        power: data.power ?? null,
        supplierId: data.supplierId ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()

    if (createError) throw createError
    revalidatePath("/optical")
    return { success: true as const, data: stock }
  } catch {
    return { success: false as const, error: "Failed to add stock" }
  }
}

export async function updateOpticalStock(id: string, data: Partial<{ quantity: number; mrp: number; costPrice: number }>) {
  await requireServerPermission("optical:manage_stock")
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("OpticalStock")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
    revalidatePath("/optical")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update stock" }
  }
}

export async function getStockSummary() {
  await requireServerPermission("optical:view")
  const supabase = await createClient()

  const [totalItemsResult, lowStockResult] = await Promise.all([
    supabase
      .from("OpticalStock")
      .select("id, product:OpticalProduct!inner(isActive)", { count: "exact", head: true })
      .eq("isActive", true)
      .gt("quantity", 0)
      .eq("product.isActive", true),
    supabase
      .from("OpticalStock")
      .select("id, product:OpticalProduct!inner(isActive)", { count: "exact", head: true })
      .eq("isActive", true)
      .lte("quantity", 5)
      .gt("quantity", 0)
      .eq("product.isActive", true),
  ])

  return {
    totalItems: totalItemsResult.count ?? 0,
    lowStock: lowStockResult.count ?? 0,
  }
}

// Search stock for billing autocomplete
export async function searchOpticalStock(search: string) {
  await requireServerPermission("optical:view")
  if (!search || search.length < 2) return []

  const supabase = await createClient()

  const { data: stock, error } = await supabase
    .from("OpticalStock")
    .select("*, product:OpticalProduct!inner(*)")
    .eq("isActive", true)
    .gt("quantity", 0)
    .eq("product.isActive", true)
    .order("product(name)", { ascending: true })
    .limit(30)

  if (error) throw error

  const s = search.toLowerCase()
  return (stock ?? [])
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => {
        const product = item.product
        return (
          (product.name ?? "").toLowerCase().includes(s) ||
          (product.brand ?? "").toLowerCase().includes(s) ||
          (product.modelNumber ?? "").toLowerCase().includes(s)
        )
      }
    )
    .slice(0, 20)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => {
      const product = item.product
      return {
        stockId: item.id,
        productId: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        type: product.type,
        modelNumber: product.modelNumber,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        mrp: item.mrp,
        gstPercent: item.gstPercent,
        power: item.power,
      }
    })
}

// ─── PATIENT LOOKUP WITH AR READINGS ─────────────────

export async function getPatientWithARReading(patientId: string) {
  await requireServerPermission("optical:view")
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from("Patient")
    .select("*, eyeReadings:EyeReading(*), prescriptions:Prescription(*)")
    .eq("patientId", patientId)
    .single()

  if (error || !patient) return null

  // Sort and pick latest eye reading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eyeReadings = ((patient.eyeReadings ?? []) as any[])
    .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime())
  const latestReading = eyeReadings[0] ?? null

  // Filter and sort prescriptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prescriptions = ((patient.prescriptions ?? []) as any[])
    .filter((p: any) => p.status === "COMPLETED" || p.status === "DRAFT")
    .sort((a: any, b: any) => new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime())
  const latestPrescription = prescriptions[0] ?? null

  return {
    patientId: patient.patientId,
    name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    doctorName: patient.doctorName,
    // AR reading data (parsed from JSON)
    autoRefractometer: latestReading?.autoRefractometer ? JSON.parse(String(latestReading.autoRefractometer)) : null,
    glassesReading: latestReading?.glassesReading ? JSON.parse(String(latestReading.glassesReading)) : null,
    presentPrescription: latestReading?.presentPrescription ? JSON.parse(String(latestReading.presentPrescription)) : null,
    readingDate: latestReading?.readingDate ?? null,
    prescriptionId: latestPrescription?.id ?? null,
  }
}

// ─── BILLING ─────────────────────────────────────────

async function getNextOpticalBillNumber(): Promise<string> {
  const supabase = await createClient()
  const today = new Date()
  const prefix = `OPT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`

  const { data: last } = await supabase
    .from("OpticalBill")
    .select("billNumber")
    .like("billNumber", `${prefix}%`)
    .order("billNumber", { ascending: false })
    .limit(1)
    .single()

  const seq = last ? parseInt(last.billNumber.split("-").pop() || "0") + 1 : 1
  return `${prefix}-${String(seq).padStart(4, "0")}`
}

export async function createOpticalBill(data: {
  patientName: string
  patientId?: string
  patientPhone?: string
  gender?: string
  referredDoctor?: string
  prescriptionId?: string
  lensPrescription?: Record<string, unknown>
  discountPercent: number
  roundOff: number
  paymentMode: string
  paidAmount: number
  paymentRef?: string
  deliveryDate?: string
  orderNotes?: string
  status?: string
  items: {
    stockId?: string
    itemName: string
    category: string
    eye?: string
    quantity: number
    mrp: number
    price: number
    total: number
    discountPercent: number
    amount: number
    gstPercent: number
  }[]
}) {
  const user = await requireServerPermission("optical:create")
  const supabase = await createClient()

  try {
    const billNumber = await getNextOpticalBillNumber()

    const subtotal = data.items.reduce((s, i) => s + i.total, 0)
    const gstAmount = data.items.reduce((s, i) => (s + (i.amount * i.gstPercent) / (100 + i.gstPercent)), 0)
    const discountAmount = subtotal * (data.discountPercent / 100)
    const netAmount = subtotal - discountAmount
    const billAmount = Math.round(netAmount + data.roundOff)
    const balanceDue = billAmount - data.paidAmount

    const now = new Date().toISOString()

    // Insert bill
    const { data: bill, error: billError } = await supabase
      .from("OpticalBill")
      .insert({
        billNumber,
        patientId: data.patientId ?? null,
        patientName: data.patientName,
        patientPhone: data.patientPhone ?? null,
        gender: data.gender ?? null,
        referredDoctor: data.referredDoctor ?? null,
        prescriptionId: data.prescriptionId ?? null,
        lensPrescription: data.lensPrescription ? JSON.stringify(data.lensPrescription) : null,
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
        paymentRef: data.paymentRef ?? null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString() : null,
        orderNotes: data.orderNotes ?? null,
        status: data.status ?? "COMPLETED",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()

    if (billError) throw billError

    // Create bill items & decrement stock
    for (const item of data.items) {
      const { error: itemError } = await supabase
        .from("OpticalBillItem")
        .insert({
          billId: bill.id,
          stockId: item.stockId ?? null,
          itemName: item.itemName,
          category: item.category,
          eye: item.eye ?? null,
          quantity: item.quantity,
          mrp: item.mrp,
          price: item.price,
          total: item.total,
          discountPercent: item.discountPercent,
          amount: item.amount,
          gstPercent: item.gstPercent,
        })

      if (itemError) throw itemError

      // Decrement stock if linked
      if (item.stockId) {
        // Fetch current quantity then update
        const { data: currentStock, error: fetchError } = await supabase
          .from("OpticalStock")
          .select("quantity")
          .eq("id", item.stockId)
          .single()

        if (fetchError) throw fetchError

        const { error: stockError } = await supabase
          .from("OpticalStock")
          .update({
            quantity: currentStock.quantity - item.quantity,
            updatedAt: now,
          })
          .eq("id", item.stockId)

        if (stockError) throw stockError
      }
    }

    revalidatePath("/optical")
    return { success: true as const, data: { billNumber: bill.billNumber, billAmount: bill.billAmount } }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create bill"
    return { success: false as const, error: msg }
  }
}

export async function getOpticalBills(filters?: {
  dateFrom?: string
  dateTo?: string
  search?: string
  status?: string
}) {
  await requireServerPermission("optical:view")
  const supabase = await createClient()

  let query = supabase
    .from("OpticalBill")
    .select("*, items:OpticalBillItem(*)")
    .order("createdAt", { ascending: false })
    .limit(100)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.dateFrom) {
    query = query.gte("createdAt", new Date(filters.dateFrom + "T00:00:00+05:30").toISOString())
  }

  if (filters?.dateTo) {
    query = query.lte("createdAt", new Date(filters.dateTo + "T23:59:59+05:30").toISOString())
  }

  const { data: bills, error } = await query
  if (error) throw error

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return (bills ?? []).filter(
      (b: Record<string, unknown>) =>
        (b.patientName as string).toLowerCase().includes(s) ||
        (b.billNumber as string).toLowerCase().includes(s) ||
        ((b.patientPhone as string) ?? "").toLowerCase().includes(s)
    )
  }
  return bills
}

export async function updateOpticalBillStatus(billId: string, status: string) {
  await requireServerPermission("optical:edit")
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from("OpticalBill")
      .update({ status, updatedAt: new Date().toISOString() })
      .eq("id", billId)

    if (error) throw error
    revalidatePath("/optical")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}

// ─── OPTICAL SETTINGS (print header) ─────────────────

export async function getOpticalSettings() {
  await requireServerPermission("optical:view")
  const supabase = await createClient()
  const { data } = await supabase.from("HospitalProfile").select("settings").limit(1).single()
  try {
    const s = JSON.parse(data?.settings ?? "{}")
    return { printHeaderKey: (s.opticalPrintHeaderKey as string) ?? "" }
  } catch {
    return { printHeaderKey: "" }
  }
}

export async function updateOpticalSettings(settings: { printHeaderKey: string }) {
  await requireServerPermission("optical:manage_stock")
  const supabase = await createClient()
  const { data: profile } = await supabase.from("HospitalProfile").select("id, settings").limit(1).single()
  if (!profile) return { success: false as const, error: "Hospital profile not found" }
  try {
    const existing = JSON.parse(profile.settings ?? "{}")
    existing.opticalPrintHeaderKey = settings.printHeaderKey || undefined
    await supabase.from("HospitalProfile").update({ settings: JSON.stringify(existing) }).eq("id", profile.id)
    revalidatePath("/optical")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to save settings" }
  }
}

export async function getOpticalHospitalProfile() {
  await requireServerPermission("optical:view")
  const supabase = await createClient()
  const { data } = await supabase.from("HospitalProfile").select("*").limit(1).single()
  return data
}
