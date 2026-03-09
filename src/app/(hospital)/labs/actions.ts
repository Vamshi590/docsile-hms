"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getNextLabBillNumber(): Promise<string> {
  const today = new Date()
  const prefix = `LB-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
  const last = await db.labBill.findFirst({
    where: { billNumber: { startsWith: prefix } },
    orderBy: { billNumber: "desc" },
    select: { billNumber: true },
  })
  if (!last) return `${prefix}-0001`
  const lastNum = parseInt(last.billNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

// ─── Lab CRUD ────────────────────────────────────────────────────────────────

export async function getLabs() {
  const labs = await db.lab.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { investigations: { where: { isActive: true } } } },
    },
  })
  return labs
}

export async function getLabById(id: string) {
  return db.lab.findUnique({
    where: { id },
    include: {
      investigations: {
        where: { isActive: true },
        include: { investigation: true },
        orderBy: { investigation: { name: "asc" } },
      },
    },
  })
}

export async function createLab(data: { name: string; description?: string; location?: string }) {
  await requireAuth()
  try {
    const lab = await db.lab.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        location: data.location ?? null,
      },
    })
    revalidatePath("/labs")
    return { success: true as const, data: lab }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "A lab with this name already exists"
      : "Failed to create lab"
    return { success: false as const, error: msg }
  }
}

export async function updateLab(id: string, data: { name?: string; description?: string; location?: string; isActive?: boolean }) {
  await requireAuth()
  try {
    const lab = await db.lab.update({ where: { id }, data })
    revalidatePath("/labs")
    return { success: true as const, data: lab }
  } catch {
    return { success: false as const, error: "Failed to update lab" }
  }
}

export async function deleteLab(id: string) {
  await requireAuth()
  try {
    await db.lab.delete({ where: { id } })
    revalidatePath("/labs")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Cannot delete lab with existing bills. Deactivate it instead." }
  }
}

// ─── Lab Investigation Mapping ───────────────────────────────────────────────

export async function getLabInvestigations(labId: string) {
  return db.labInvestigation.findMany({
    where: { labId, isActive: true },
    include: { investigation: true },
    orderBy: { investigation: { name: "asc" } },
  })
}

export async function getAllInvestigations() {
  return db.investigationMaster.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function createInvestigation(data: { name: string; category?: string; description?: string }) {
  const user = await requireAuth()
  try {
    const inv = await db.investigationMaster.create({
      data: {
        name: data.name,
        category: data.category ?? null,
        description: data.description ?? null,
        isActive: true,
        createdBy: user.id,
      },
    })
    revalidatePath("/labs")
    return { success: true as const, data: inv }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "An investigation with this name already exists"
      : "Failed to create investigation"
    return { success: false as const, error: msg }
  }
}

export async function updateLabInvestigations(
  labId: string,
  investigations: { investigationId: string; amount: number; isDefault: boolean }[]
) {
  await requireAuth()
  try {
    await db.$transaction(async (tx) => {
      // Remove existing mappings for this lab
      await tx.labInvestigation.deleteMany({ where: { labId } })

      // Create new mappings
      if (investigations.length > 0) {
        await tx.labInvestigation.createMany({
          data: investigations.map((inv) => ({
            labId,
            investigationId: inv.investigationId,
            amount: inv.amount,
            isDefault: inv.isDefault,
            isActive: true,
          })),
        })
      }
    })
    revalidatePath("/labs")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update lab investigations" }
  }
}

// ─── Lab Billing - Patient Investigation Lookup ──────────────────────────────

export async function getPatientInvestigations(patientId: string) {
  // Find patient
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
      doctorName: true,
      prescriptions: {
        where: {
          status: { in: ["COMPLETED", "DRAFT"] },
          investigations: { not: "[]" },
        },
        orderBy: { prescriptionDate: "desc" },
        take: 1,
        select: {
          id: true,
          prescriptionNumber: true,
          investigations: true,
          doctorName: true,
          prescriptionDate: true,
        },
      },
    },
  })

  if (!patient) return { success: false as const, error: "Patient not found" }

  const prescription = patient.prescriptions[0]
  if (!prescription) {
    return {
      success: true as const,
      data: {
        patient: {
          patientId: patient.patientId,
          name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
          age: patient.age,
          gender: patient.gender,
          phone: patient.phone,
          doctorName: patient.doctorName,
        },
        prescription: null,
        labGroups: [],
        unassigned: [],
      },
    }
  }

  // Parse investigations from prescription JSON
  let investigationNames: string[] = []
  try {
    const parsed = JSON.parse(prescription.investigations)
    investigationNames = parsed.map((inv: { name: string } | string) =>
      typeof inv === "string" ? inv : inv.name
    )
  } catch {
    investigationNames = []
  }

  if (investigationNames.length === 0) {
    return {
      success: true as const,
      data: {
        patient: {
          patientId: patient.patientId,
          name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
          age: patient.age,
          gender: patient.gender,
          phone: patient.phone,
          doctorName: patient.doctorName,
        },
        prescription: {
          id: prescription.id,
          prescriptionNumber: prescription.prescriptionNumber,
          doctorName: prescription.doctorName,
          prescriptionDate: prescription.prescriptionDate,
        },
        labGroups: [],
        unassigned: [],
      },
    }
  }

  // Find investigation master records by name
  const investigationMasters = await db.investigationMaster.findMany({
    where: { name: { in: investigationNames }, isActive: true },
    select: { id: true, name: true },
  })

  const masterMap = new Map(investigationMasters.map((m) => [m.name, m.id]))

  // Get all lab-investigation mappings for these investigations
  const masterIds = investigationMasters.map((m) => m.id)
  const labMappings = await db.labInvestigation.findMany({
    where: { investigationId: { in: masterIds }, isActive: true, lab: { isActive: true } },
    include: { lab: true, investigation: true },
  })

  // Check for existing lab bills for this prescription
  const existingBills = await db.labBill.findMany({
    where: { prescriptionId: prescription.id, status: { not: "CANCELLED" } },
    include: { items: true, lab: true },
  })

  const billedInvestigationNames = new Set(
    existingBills.flatMap((b) => b.items.map((item) => item.name))
  )

  // Build mapping: investigationId -> labMappings
  const invToLabs = new Map<string, typeof labMappings>()
  for (const mapping of labMappings) {
    const existing = invToLabs.get(mapping.investigationId) ?? []
    existing.push(mapping)
    invToLabs.set(mapping.investigationId, existing)
  }

  // Segregate investigations by lab
  const labGroupMap = new Map<string, {
    lab: { id: string; name: string; location: string | null }
    items: { investigationId: string; name: string; amount: number }[]
  }>()
  const unassigned: { name: string; alreadyBilled: boolean }[] = []

  for (const invName of investigationNames) {
    const alreadyBilled = billedInvestigationNames.has(invName)
    const masterId = masterMap.get(invName)

    if (!masterId) {
      unassigned.push({ name: invName, alreadyBilled })
      continue
    }

    const mappings = invToLabs.get(masterId)
    if (!mappings || mappings.length === 0) {
      unassigned.push({ name: invName, alreadyBilled })
      continue
    }

    // Pick the default mapping, or the first one
    const chosen = mappings.find((m) => m.isDefault) ?? mappings[0]

    const group = labGroupMap.get(chosen.labId) ?? {
      lab: { id: chosen.lab.id, name: chosen.lab.name, location: chosen.lab.location },
      items: [],
    }
    group.items.push({
      investigationId: masterId,
      name: invName,
      amount: chosen.amount,
    })
    labGroupMap.set(chosen.labId, group)
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
        doctorName: patient.doctorName,
      },
      prescription: {
        id: prescription.id,
        prescriptionNumber: prescription.prescriptionNumber,
        doctorName: prescription.doctorName,
        prescriptionDate: prescription.prescriptionDate,
      },
      labGroups: Array.from(labGroupMap.values()),
      unassigned,
      existingBills: existingBills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        labName: b.lab.name,
        total: b.total,
        status: b.status,
        items: b.items.map((i) => i.name),
      })),
    },
  }
}

// ─── Create Lab Bills ────────────────────────────────────────────────────────

export async function createLabBills(data: {
  patientId: string
  prescriptionId: string
  bills: {
    labId: string
    items: { investigationId: string; name: string; amount: number }[]
    discount: number
    discountReason?: string
    paymentMode: string
    amountPaid: number
  }[]
}) {
  const user = await requireAuth()
  try {
    const createdBills: { id: string; billNumber: string; labName: string; total: number }[] = []

    for (const bill of data.bills) {
      const billNumber = await getNextLabBillNumber()
      const subtotal = bill.items.reduce((sum, item) => sum + item.amount, 0)
      const total = subtotal - bill.discount
      const balanceDue = total - bill.amountPaid

      const labBill = await db.labBill.create({
        data: {
          billNumber,
          labId: bill.labId,
          patientId: data.patientId,
          prescriptionId: data.prescriptionId,
          subtotal,
          discount: bill.discount,
          discountReason: bill.discountReason ?? null,
          total,
          amountPaid: bill.amountPaid,
          balanceDue,
          paymentMode: bill.paymentMode,
          paymentDate: bill.amountPaid > 0 ? new Date() : null,
          status: balanceDue <= 0 ? "PAID" : bill.amountPaid > 0 ? "PARTIAL" : "PENDING",
          createdBy: user.id,
          items: {
            create: bill.items.map((item, i) => ({
              investigationId: item.investigationId,
              name: item.name,
              amount: item.amount,
              sortOrder: i,
            })),
          },
        },
        include: { lab: true },
      })

      if (bill.amountPaid > 0) {
        await db.labPayment.create({
          data: {
            labBillId: labBill.id,
            amount: bill.amountPaid,
            paymentMode: bill.paymentMode,
            receivedBy: user.id,
          },
        })
      }

      createdBills.push({
        id: labBill.id,
        billNumber: labBill.billNumber,
        labName: labBill.lab.name,
        total: labBill.total,
      })
    }

    revalidatePath("/labs")
    return { success: true as const, data: createdBills }
  } catch (error) {
    console.error("Error creating lab bills:", error)
    return { success: false as const, error: "Failed to create lab bills" }
  }
}

// ─── Lab Bills History ───────────────────────────────────────────────────────

export async function getLabBills(filters: {
  dateFrom?: string
  dateTo?: string
  labId?: string
  patientId?: string
  status?: string
}) {
  const where: Record<string, unknown> = {}

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom + "T00:00:00")
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo + "T23:59:59")
    where.createdAt = dateFilter
  }

  if (filters.labId) where.labId = filters.labId
  if (filters.patientId) where.patientId = filters.patientId
  if (filters.status) where.status = filters.status

  const bills = await db.labBill.findMany({
    where,
    include: {
      lab: { select: { name: true } },
      patient: { select: { patientId: true, firstName: true, lastName: true, phone: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return bills
}

export async function getLabBillById(id: string) {
  return db.labBill.findUnique({
    where: { id },
    include: {
      lab: true,
      patient: true,
      prescription: { select: { prescriptionNumber: true, doctorName: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  })
}
