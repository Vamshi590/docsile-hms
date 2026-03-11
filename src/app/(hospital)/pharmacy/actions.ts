"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getNextBillNumber(): Promise<string> {
  const today = new Date()
  const prefix = `PH-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
  const last = await db.pharmacyBill.findFirst({
    where: { billNumber: { startsWith: prefix } },
    orderBy: { billNumber: "desc" },
    select: { billNumber: true },
  })
  if (!last) return `${prefix}-0001`
  const lastNum = parseInt(last.billNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

async function getNextPONumber(): Promise<string> {
  const today = new Date()
  const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`
  const last = await db.purchaseOrder.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  })
  if (!last) return `${prefix}-0001`
  const lastNum = parseInt(last.orderNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

// ─── Medicine Master CRUD ─────────────────────────────────────────────────────

export async function getMedicines(search?: string) {
  const where: Record<string, unknown> = { isActive: true }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { genericName: { contains: search, mode: "insensitive" } },
      { manufacturer: { contains: search, mode: "insensitive" } },
    ]
  }
  return db.pharmacyMedicine.findMany({
    where,
    orderBy: { name: "asc" },
    take: 100,
  })
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
  try {
    const med = await db.pharmacyMedicine.create({
      data: {
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
      },
    })
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
  try {
    const med = await db.pharmacyMedicine.update({ where: { id }, data })
    revalidatePath("/pharmacy")
    return { success: true as const, data: med }
  } catch {
    return { success: false as const, error: "Failed to update medicine" }
  }
}

export async function deleteMedicine(id: string) {
  await requireAuth()
  try {
    await db.pharmacyMedicine.update({ where: { id }, data: { isActive: false } })
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
  const where: Record<string, unknown> = { isActive: true, quantity: { gt: 0 } }

  if (filters?.medicineId) {
    where.medicineId = filters.medicineId
  }

  if (filters?.nearExpiry) {
    const threeMonths = new Date()
    threeMonths.setMonth(threeMonths.getMonth() + 3)
    where.expiryDate = { lte: threeMonths }
  }

  if (filters?.lowStock) {
    where.quantity = { lte: 10, gt: 0 }
  }

  const stock = await db.pharmacyStock.findMany({
    where,
    include: {
      medicine: { select: { name: true, genericName: true, manufacturer: true, category: true, gstPercent: true, unitOfMeasure: true } },
      supplier: { select: { name: true } },
    },
    orderBy: [{ expiryDate: "asc" }, { medicine: { name: "asc" } }],
    take: 200,
  })

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    return stock.filter(
      (item) =>
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
  try {
    // Check if batch already exists for this medicine
    const existing = await db.pharmacyStock.findUnique({
      where: { medicineId_batchNumber: { medicineId: data.medicineId, batchNumber: data.batchNumber } },
    })

    if (existing) {
      // Update existing batch quantity
      const updated = await db.pharmacyStock.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + data.quantity,
          mrp: data.mrp,
          costPrice: data.costPrice,
          gstPercent: data.gstPercent,
        },
      })
      revalidatePath("/pharmacy")
      return { success: true as const, data: updated }
    }

    const stock = await db.pharmacyStock.create({
      data: {
        medicineId: data.medicineId,
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        mrp: data.mrp,
        costPrice: data.costPrice,
        gstPercent: data.gstPercent,
        unitsPerPack: data.unitsPerPack,
        expiryDate: new Date(data.expiryDate),
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
        supplierId: data.supplierId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        createdBy: user.id,
      },
    })
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
  try {
    const { expiryDate, ...rest } = data
    await db.pharmacyStock.update({
      where: { id },
      data: {
        ...rest,
        ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
      },
    })
    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update stock" }
  }
}

export async function getStockSummary() {
  const now = new Date()
  const threeMonths = new Date()
  threeMonths.setMonth(threeMonths.getMonth() + 3)

  const [totalItems, lowStock, nearExpiry, expired, totalValue] = await Promise.all([
    db.pharmacyStock.count({ where: { isActive: true, quantity: { gt: 0 } } }),
    db.pharmacyStock.count({ where: { isActive: true, quantity: { gt: 0, lte: 10 } } }),
    db.pharmacyStock.count({ where: { isActive: true, quantity: { gt: 0 }, expiryDate: { gt: now, lte: threeMonths } } }),
    db.pharmacyStock.count({ where: { isActive: true, quantity: { gt: 0 }, expiryDate: { lte: now } } }),
    db.pharmacyStock.findMany({
      where: { isActive: true, quantity: { gt: 0 } },
      select: { quantity: true, mrp: true },
    }),
  ])

  const stockValue = totalValue.reduce((sum, s) => sum + s.quantity * s.mrp, 0)

  return { totalItems, lowStock, nearExpiry, expired, stockValue }
}

// ─── Stock search for billing (find available batches for a medicine) ──────

export async function searchMedicineStock(search: string) {
  if (!search || search.length < 2) return []

  const stock = await db.pharmacyStock.findMany({
    where: {
      isActive: true,
      quantity: { gt: 0 },
      expiryDate: { gt: new Date() },
      medicine: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { genericName: { contains: search, mode: "insensitive" } },
        ],
      },
    },
    include: {
      medicine: { select: { name: true, genericName: true, gstPercent: true } },
    },
    orderBy: { expiryDate: "asc" }, // FEFO
    take: 20,
  })

  return stock.map((s) => ({
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
  const patient = await db.patient.findUnique({
    where: { patientId },
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      age: true,
      gender: true,
      phone: true,
      email: true,
      doctorName: true,
      prescriptions: {
        where: {
          status: { in: ["COMPLETED", "DRAFT"] },
          medicines: { not: "[]" },
        },
        orderBy: { prescriptionDate: "desc" },
        take: 1,
        select: {
          id: true,
          prescriptionNumber: true,
          medicines: true,
          doctorName: true,
          prescriptionDate: true,
        },
      },
    },
  })

  if (!patient) return { success: false as const, error: "Patient not found" }

  const prescription = patient.prescriptions[0]
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

    const bill = await db.$transaction(async (tx) => {
      // Create bill
      const newBill = await tx.pharmacyBill.create({
        data: {
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
          items: {
            create: data.items.map((item) => ({
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
            })),
          },
        },
      })

      // Deduct stock quantities
      for (const item of data.items) {
        await tx.pharmacyStock.update({
          where: { id: item.stockId },
          data: { quantity: { decrement: item.quantity } },
        })
      }

      return newBill
    })

    revalidatePath("/pharmacy")
    return { success: true as const, data: { id: bill.id, billNumber: bill.billNumber, billAmount: bill.billAmount } }
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
  const where: Record<string, unknown> = {}

  if (filters?.dateFrom || filters?.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom + "T00:00:00")
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo + "T23:59:59")
    where.billDate = dateFilter
  }
  if (filters?.status) where.status = filters.status

  const bills = await db.pharmacyBill.findMany({
    where,
    include: {
      items: true,
    },
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

// ─── Suppliers CRUD ───────────────────────────────────────────────────────────

export async function getSuppliers(search?: string) {
  const where: Record<string, unknown> = { isActive: true }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactPerson: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  }
  return db.pharmacySupplier.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseOrders: true, stockEntries: true } },
    },
  })
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
  try {
    const supplier = await db.pharmacySupplier.create({
      data: {
        ...data,
        creditDays: data.creditDays ?? 30,
        createdBy: user.id,
      },
    })
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
  try {
    const supplier = await db.pharmacySupplier.update({ where: { id }, data })
    revalidatePath("/pharmacy")
    return { success: true as const, data: supplier }
  } catch {
    return { success: false as const, error: "Failed to update supplier" }
  }
}

export async function deleteSupplier(id: string) {
  await requireAuth()
  try {
    await db.pharmacySupplier.update({ where: { id }, data: { isActive: false } })
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
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.supplierId) where.supplierId = filters.supplierId
  if (filters?.dateFrom || filters?.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom + "T00:00:00")
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo + "T23:59:59")
    where.orderDate = dateFilter
  }

  return db.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true, phone: true } },
      items: {
        include: { medicine: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
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

    const po = await db.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
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
        items: {
          create: itemsWithAmount.map((item) => ({
            medicineId: item.medicineId,
            batchNumber: item.batchNumber || null,
            quantity: item.quantity,
            costPrice: item.costPrice,
            mrp: item.mrp,
            gstPercent: item.gstPercent,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            amount: item.amount,
          })),
        },
      },
    })

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
  try {
    await db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { items: { include: { medicine: true } } },
      })
      if (!po) throw new Error("Purchase order not found")

      for (const receivedItem of items) {
        const poItem = po.items.find((i) => i.id === receivedItem.itemId)
        if (!poItem) continue

        // Update received quantity on PO item
        const newReceivedQty = poItem.receivedQty + receivedItem.receivedQty
        await tx.purchaseOrderItem.update({
          where: { id: receivedItem.itemId },
          data: {
            receivedQty: newReceivedQty,
            batchNumber: receivedItem.batchNumber,
            expiryDate: new Date(receivedItem.expiryDate),
            mrp: receivedItem.mrp,
            costPrice: receivedItem.costPrice,
          },
        })

        // Add to pharmacy stock
        const existingStock = await tx.pharmacyStock.findUnique({
          where: { medicineId_batchNumber: { medicineId: poItem.medicineId, batchNumber: receivedItem.batchNumber } },
        })

        if (existingStock) {
          await tx.pharmacyStock.update({
            where: { id: existingStock.id },
            data: { quantity: existingStock.quantity + receivedItem.receivedQty, mrp: receivedItem.mrp, costPrice: receivedItem.costPrice },
          })
        } else {
          await tx.pharmacyStock.create({
            data: {
              medicineId: poItem.medicineId,
              batchNumber: receivedItem.batchNumber,
              quantity: receivedItem.receivedQty,
              mrp: receivedItem.mrp,
              costPrice: receivedItem.costPrice,
              gstPercent: poItem.gstPercent,
              unitsPerPack: 1,
              expiryDate: new Date(receivedItem.expiryDate),
              supplierId: po.supplierId,
              purchaseOrderId: po.id,
              createdBy: user.id,
            },
          })
        }
      }

      // Check ALL PO items (not just those in this batch) to determine final status
      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId } })
      const allReceived = updatedItems.every((i) => i.receivedQty >= i.quantity)

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
      })
    })

    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch (error) {
    console.error("Error receiving PO:", error)
    return { success: false as const, error: "Failed to receive purchase order" }
  }
}

export async function updatePOStatus(poId: string, status: string) {
  await requireAuth()
  try {
    await db.purchaseOrder.update({ where: { id: poId }, data: { status } })
    revalidatePath("/pharmacy")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}
