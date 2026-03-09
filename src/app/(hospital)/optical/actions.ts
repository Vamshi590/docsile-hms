"use server"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// ─── PRODUCT MASTER CRUD ─────────────────────────────

export async function getOpticalProducts(search?: string) {
  const products = await db.opticalProduct.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { modelNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 100,
  })
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
  const user = await requireAuth()
  try {
    const product = await db.opticalProduct.create({
      data: { ...data, gstPercent: data.gstPercent ?? 12, createdBy: user.id },
    })
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
  try {
    const product = await db.opticalProduct.update({ where: { id }, data })
    revalidatePath("/optical")
    return { success: true as const, data: product }
  } catch {
    return { success: false as const, error: "Failed to update product" }
  }
}

export async function deleteOpticalProduct(id: string) {
  try {
    await db.opticalProduct.update({ where: { id }, data: { isActive: false } })
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
  const stock = await db.opticalStock.findMany({
    where: {
      isActive: true,
      product: { isActive: true },
      ...(filters?.category ? { product: { category: filters.category, isActive: true } } : {}),
      ...(filters?.lowStock ? { quantity: { lte: 5, gt: 0 } } : {}),
    },
    include: { product: true },
    orderBy: [{ product: { category: "asc" } }, { product: { name: "asc" } }],
    take: 200,
  })

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return stock.filter(
      (item) =>
        item.product.name.toLowerCase().includes(s) ||
        item.product.brand?.toLowerCase().includes(s) ||
        item.product.modelNumber?.toLowerCase().includes(s) ||
        item.batchNumber?.toLowerCase().includes(s)
    )
  }
  return stock
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
  const user = await requireAuth()
  try {
    // Check if this product + batch + power already exists
    const existing = await db.opticalStock.findFirst({
      where: {
        productId: data.productId,
        batchNumber: data.batchNumber ?? null,
        power: data.power ?? null,
      },
    })

    if (existing) {
      const updated = await db.opticalStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + data.quantity },
      })
      revalidatePath("/optical")
      return { success: true as const, data: updated }
    }

    const stock = await db.opticalStock.create({
      data: {
        productId: data.productId,
        batchNumber: data.batchNumber ?? null,
        quantity: data.quantity,
        mrp: data.mrp,
        costPrice: data.costPrice ?? 0,
        gstPercent: data.gstPercent ?? 12,
        power: data.power ?? null,
        supplierId: data.supplierId ?? null,
        createdBy: user.id,
      },
    })
    revalidatePath("/optical")
    return { success: true as const, data: stock }
  } catch {
    return { success: false as const, error: "Failed to add stock" }
  }
}

export async function updateOpticalStock(id: string, data: Partial<{ quantity: number; mrp: number; costPrice: number }>) {
  try {
    await db.opticalStock.update({ where: { id }, data })
    revalidatePath("/optical")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update stock" }
  }
}

export async function getStockSummary() {
  const [totalItems, lowStock] = await Promise.all([
    db.opticalStock.count({ where: { isActive: true, quantity: { gt: 0 }, product: { isActive: true } } }),
    db.opticalStock.count({ where: { isActive: true, quantity: { lte: 5, gt: 0 }, product: { isActive: true } } }),
  ])
  return { totalItems, lowStock }
}

// Search stock for billing autocomplete
export async function searchOpticalStock(search: string) {
  if (!search || search.length < 2) return []

  const stock = await db.opticalStock.findMany({
    where: {
      isActive: true,
      quantity: { gt: 0 },
      product: { isActive: true },
    },
    include: { product: true },
    orderBy: { product: { name: "asc" } },
    take: 30,
  })

  const s = search.toLowerCase()
  return stock
    .filter(
      (item) =>
        item.product.name.toLowerCase().includes(s) ||
        item.product.brand?.toLowerCase().includes(s) ||
        item.product.modelNumber?.toLowerCase().includes(s)
    )
    .slice(0, 20)
    .map((item) => ({
      stockId: item.id,
      productId: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      category: item.product.category,
      type: item.product.type,
      modelNumber: item.product.modelNumber,
      batchNumber: item.batchNumber,
      quantity: item.quantity,
      mrp: item.mrp,
      gstPercent: item.gstPercent,
      power: item.power,
    }))
}

// ─── PATIENT LOOKUP WITH AR READINGS ─────────────────

export async function getPatientWithARReading(patientId: string) {
  const patient = await db.patient.findUnique({
    where: { patientId },
    include: {
      eyeReadings: {
        orderBy: { readingDate: "desc" },
        take: 1,
      },
      prescriptions: {
        where: { status: { in: ["COMPLETED", "DRAFT"] } },
        orderBy: { prescriptionDate: "desc" },
        take: 1,
      },
    },
  })

  if (!patient) return null

  const latestReading = patient.eyeReadings[0] ?? null
  const latestPrescription = patient.prescriptions[0] ?? null

  return {
    patientId: patient.patientId,
    name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    doctorName: patient.doctorName,
    // AR reading data (parsed from JSON)
    autoRefractometer: latestReading?.autoRefractometer ? JSON.parse(latestReading.autoRefractometer) : null,
    glassesReading: latestReading?.glassesReading ? JSON.parse(latestReading.glassesReading) : null,
    presentPrescription: latestReading?.presentPrescription ? JSON.parse(latestReading.presentPrescription) : null,
    readingDate: latestReading?.readingDate ?? null,
    prescriptionId: latestPrescription?.id ?? null,
  }
}

// ─── BILLING ─────────────────────────────────────────

async function getNextOpticalBillNumber(): Promise<string> {
  const today = new Date()
  const prefix = `OPT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
  const last = await db.opticalBill.findFirst({
    where: { billNumber: { startsWith: prefix } },
    orderBy: { billNumber: "desc" },
  })
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
  const user = await requireAuth()

  try {
    const billNumber = await getNextOpticalBillNumber()

    const result = await db.$transaction(async (tx) => {
      const subtotal = data.items.reduce((s, i) => s + i.total, 0)
      const gstAmount = data.items.reduce((s, i) => (s + (i.amount * i.gstPercent) / (100 + i.gstPercent)), 0)
      const discountAmount = subtotal * (data.discountPercent / 100)
      const netAmount = subtotal - discountAmount
      const billAmount = Math.round(netAmount + data.roundOff)
      const balanceDue = billAmount - data.paidAmount

      const bill = await tx.opticalBill.create({
        data: {
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
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          orderNotes: data.orderNotes ?? null,
          status: data.status ?? "COMPLETED",
          createdBy: user.id,
        },
      })

      // Create bill items & decrement stock
      for (const item of data.items) {
        await tx.opticalBillItem.create({
          data: {
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
          },
        })

        // Decrement stock if linked
        if (item.stockId) {
          await tx.opticalStock.update({
            where: { id: item.stockId },
            data: { quantity: { decrement: item.quantity } },
          })
        }
      }

      return bill
    })

    revalidatePath("/optical")
    return { success: true as const, data: { billNumber: result.billNumber, billAmount: result.billAmount } }
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
  const bills = await db.opticalBill.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            billDate: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom + "T00:00:00") } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return bills.filter(
      (b) =>
        b.patientName.toLowerCase().includes(s) ||
        b.billNumber.toLowerCase().includes(s) ||
        b.patientPhone?.toLowerCase().includes(s)
    )
  }
  return bills
}

export async function updateOpticalBillStatus(billId: string, status: string) {
  try {
    await db.opticalBill.update({ where: { id: billId }, data: { status } })
    revalidatePath("/optical")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}
