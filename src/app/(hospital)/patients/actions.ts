"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { getISTDayBounds, computePatientStatus } from "@/lib/utils"
import { z } from "zod"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const PatientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(10, "Valid phone required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  referredBy: z.string().optional(),
  doctorName: z.string().optional(),
  department: z.string().optional(),
  patientType: z.enum(["OPD", "IPD"]).default("OPD"),
  appointmentDate: z.string(),
  notes: z.string().optional(),
})

const ServiceItemSchema = z.object({
  serviceId: z.string().optional(),
  description: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  amount: z.number().min(0),
})

const BillingSchema = z.object({
  paymentMode: z.string().min(1, "Payment mode required"),
  amountPaid: z.number().min(0),
  discount: z.number().min(0).default(0),
  discountReason: z.string().optional(),
  notes: z.string().optional(),
  services: z.array(ServiceItemSchema).min(1, "At least one service required"),
})

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function getNextPatientNumber(): Promise<string> {
  const lastPatient = await db.patient.findFirst({
    orderBy: { createdAt: "desc" },
    select: { patientId: true },
  })

  if (!lastPatient) return "0001"

  const lastNum = parseInt(lastPatient.patientId.replace(/\D/g, ""), 10) || 0
  return String(lastNum + 1).padStart(4, "0")
}

async function getNextPrescriptionNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PRX-${year}`
  const last = await db.prescription.findFirst({
    where: { prescriptionNumber: { startsWith: prefix } },
    orderBy: { prescriptionNumber: "desc" },
    select: { prescriptionNumber: true },
  })
  if (!last || !last.prescriptionNumber) return `${prefix}-0001`
  const lastNum = parseInt(last.prescriptionNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function getNextPatientId(_type: "OPD" | "IPD" = "OPD") {
  return getNextPatientNumber()
}

export async function getPatients(filters: {
  date?: string
  search?: string
  status?: string
  type?: "OPD" | "IPD"
}) {
  const { date, search, status, type = "OPD" } = filters

  const where: Record<string, unknown> = { patientType: type }
  const andConditions: Record<string, unknown>[] = []

  let dateBounds: { start: Date; end: Date } | null = null

  if (date) {
    dateBounds = getISTDayBounds(date)
    andConditions.push({
      OR: [
        { prescriptions: { some: { prescriptionDate: { gte: dateBounds.start, lte: dateBounds.end } } } },
        { appointmentDate: { gte: dateBounds.start, lte: dateBounds.end } },
      ],
    })
  }

  if (status) {
    where.status = status
  }

  if (search) {
    andConditions.push({
      OR: [
        { patientId: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
      ],
    })
  }

  if (andConditions.length > 0) {
    where.AND = andConditions
  }

  const prescriptionInclude: Record<string, unknown> = {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { items: true, payments: true },
  }
  if (dateBounds) {
    prescriptionInclude.where = { prescriptionDate: { gte: dateBounds.start, lte: dateBounds.end } }
  }

  const eyeReadingInclude = dateBounds ? {
    where: { readingDate: { gte: dateBounds.start, lte: dateBounds.end } },
    take: 1,
  } : undefined

  const patients = await db.patient.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      prescriptions: prescriptionInclude as never,
      ...(eyeReadingInclude ? { eyeReadings: eyeReadingInclude } : { eyeReadings: { take: 1 } }),
    },
  })

  // Compute status from actual data instead of using the stored DB value
  return patients.map(p => {
    const eyeReadings = (p as unknown as { eyeReadings?: { id: string }[] }).eyeReadings ?? []
    const prescriptions = (p as unknown as { prescriptions?: { status: string; doctorName: string | null }[] }).prescriptions ?? []
    const hasWorkup = eyeReadings.length > 0
    const hasDoctorPrescription = prescriptions.some(
      rx => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
    )
    return {
      ...p,
      status: computePatientStatus(hasWorkup, hasDoctorPrescription, p.status),
    }
  })
}

export async function getPatientById(patientId: string) {
  const patient = await db.patient.findUnique({
    where: { patientId },
    include: {
      prescriptions: {
        include: { items: true, payments: true, eyeReading: true },
        orderBy: { createdAt: "desc" },
      },
      eyeReadings: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
  if (!patient) return null

  const hasWorkup = patient.eyeReadings.length > 0
  const hasDoctorPrescription = patient.prescriptions.some(
    rx => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
  )
  return {
    ...patient,
    status: computePatientStatus(hasWorkup, hasDoctorPrescription, patient.status),
  }
}

// ─── Step 1: Create Patient ───────────────────────────────────────────────────

export async function createPatient(data: z.infer<typeof PatientSchema>) {
  const user = await requireAuth()
  const validated = PatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid patient data" }
  }

  const pd = validated.data

  try {
    const patientId = await getNextPatientNumber()

    const patient = await db.patient.create({
      data: {
        patientId,
        firstName: pd.firstName,
        lastName: pd.lastName ?? null,
        dateOfBirth: pd.dateOfBirth ? new Date(pd.dateOfBirth + "T00:00:00+05:30") : null,
        age: pd.age ?? null,
        gender: pd.gender,
        phone: pd.phone,
        email: pd.email || null,
        address: pd.address ?? null,
        guardianName: pd.guardianName ?? null,
        guardianRelation: pd.guardianRelation ?? null,
        referredBy: pd.referredBy ?? null,
        doctorName: pd.doctorName ?? null,
        department: pd.department ?? null,
        patientType: pd.patientType,
        status: "REGISTERED",
        appointmentDate: new Date(pd.appointmentDate + "T00:00:00+05:30"),
        notes: pd.notes ?? null,
        createdById: user.id,
      },
    })

    revalidatePath("/patients")
    return { success: true as const, data: { patientId: patient.patientId, id: patient.id } }
  } catch (error) {
    console.error("Error creating patient:", error)
    return { success: false as const, error: "Failed to create patient. Please try again." }
  }
}

// ─── Update Patient (if user edits Step 1 after creation) ─────────────────────

export async function updatePatientInfo(patientId: string, data: z.infer<typeof PatientSchema>) {
  const user = await requireAuth()
  const validated = PatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid patient data" }
  }

  const pd = validated.data
  try {
    await db.patient.update({
      where: { patientId },
      data: {
        firstName: pd.firstName,
        lastName: pd.lastName ?? null,
        dateOfBirth: pd.dateOfBirth ? new Date(pd.dateOfBirth + "T00:00:00+05:30") : null,
        age: pd.age ?? null,
        gender: pd.gender,
        phone: pd.phone,
        email: pd.email || null,
        address: pd.address ?? null,
        guardianName: pd.guardianName ?? null,
        guardianRelation: pd.guardianRelation ?? null,
        referredBy: pd.referredBy ?? null,
        doctorName: pd.doctorName ?? null,
        department: pd.department ?? null,
        appointmentDate: new Date(pd.appointmentDate + "T00:00:00+05:30"),
        notes: pd.notes ?? null,
        updatedBy: user.id,
      },
    })
    revalidatePath("/patients")
    return { success: true as const }
  } catch (error) {
    console.error("Error updating patient:", error)
    return { success: false as const, error: "Failed to update patient." }
  }
}

// ─── Step 3: Create Prescription with Billing ────────────────────────────────

export async function createPrescriptionWithBilling(data: {
  patientId: string
  billing: z.infer<typeof BillingSchema>
}) {
  const user = await requireAuth()
  const billingValidated = BillingSchema.safeParse(data.billing)

  if (!billingValidated.success) {
    return { success: false as const, error: billingValidated.error.issues[0]?.message ?? "Invalid billing data" }
  }

  const iv = billingValidated.data

  try {
    const patient = await db.patient.findUnique({
      where: { patientId: data.patientId },
      select: { id: true, patientId: true, patientType: true },
    })
    if (!patient) return { success: false as const, error: "Patient not found" }

    const newSubtotal = iv.services.reduce((sum, s) => sum + s.amount, 0)

    // Check if there's already a prescription for today — add to it
    const { start: todayStart, end: todayEnd } = getISTDayBounds()

    const existingPrescription = await db.prescription.findFirst({
      where: {
        patientId: patient.patientId,
        prescriptionDate: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    })

    let prescription
    let prescriptionNumber: string | null = null

    if (existingPrescription) {
      // Add items to existing today's prescription
      const updatedSubtotal = existingPrescription.subtotal + newSubtotal
      const updatedDiscount = existingPrescription.discount + iv.discount
      const updatedTotal = updatedSubtotal - updatedDiscount
      const updatedAmountPaid = existingPrescription.amountPaid + iv.amountPaid
      const updatedBalanceDue = updatedTotal - updatedAmountPaid

      prescription = await db.prescription.update({
        where: { id: existingPrescription.id },
        data: {
          subtotal: updatedSubtotal,
          discount: updatedDiscount,
          discountReason: iv.discountReason ?? existingPrescription.discountReason,
          total: updatedTotal,
          amountPaid: updatedAmountPaid,
          balanceDue: updatedBalanceDue,
          notes: iv.notes
            ? [existingPrescription.notes, iv.notes].filter(Boolean).join("; ")
            : existingPrescription.notes,
          items: {
            create: iv.services.map((s, i) => ({
              description: s.description,
              category: s.category ?? null,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              amount: s.amount,
              sortOrder: existingPrescription.items.length + i,
            })),
          },
        },
      })
      prescriptionNumber = existingPrescription.prescriptionNumber

      if (iv.amountPaid > 0) {
        await db.payment.create({
          data: {
            prescriptionId: existingPrescription.id,
            amount: iv.amountPaid,
            paymentMode: iv.paymentMode,
            receivedBy: user.id,
          },
        })
      }
    } else {
      // No prescription today — create a new one
      prescriptionNumber = await getNextPrescriptionNumber()
      const total = newSubtotal - iv.discount
      const balanceDue = total - iv.amountPaid

      prescription = await db.prescription.create({
        data: {
          prescriptionNumber,
          patientId: patient.patientId,
          patientType: patient.patientType,
          doctorName: null,
          medicines: "[]",
          investigations: "[]",
          subtotal: newSubtotal,
          discount: iv.discount,
          discountReason: iv.discountReason ?? null,
          total,
          amountPaid: iv.amountPaid,
          balanceDue,
          paymentMode: iv.paymentMode,
          paymentDate: new Date(),
          status: "BILLING_ONLY",
          prescriptionDate: new Date(),
          notes: iv.notes ?? null,
          createdBy: user.id,
          items: {
            create: iv.services.map((s, i) => ({
              description: s.description,
              category: s.category ?? null,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              amount: s.amount,
              sortOrder: i,
            })),
          },
        },
      })

      if (iv.amountPaid > 0) {
        await db.payment.create({
          data: {
            prescriptionId: prescription.id,
            amount: iv.amountPaid,
            paymentMode: iv.paymentMode,
            receivedBy: user.id,
          },
        })
      }
    }

    revalidatePath("/patients")
    return { success: true as const, data: { prescriptionId: prescription.id, prescriptionNumber } }
  } catch (error) {
    console.error("Error creating prescription:", error)
    return { success: false as const, error: "Failed to create prescription. Please try again." }
  }
}

export async function updatePatientStatus(patientId: string, status: string) {
  const user = await requireAuth()
  try {
    const patient = await db.patient.update({
      where: { patientId },
      data: { status, updatedBy: user.id },
    })
    revalidatePath("/patients")
    return { success: true as const, data: patient }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}

export async function movePatientToDate(patientId: string, newDate: string, reason?: string) {
  const user = await requireAuth()
  try {
    const patient = await db.patient.findUnique({ where: { patientId } })
    if (!patient) return { success: false as const, error: "Patient not found" }

    await db.patient.update({
      where: { patientId },
      data: {
        appointmentDate: new Date(newDate + "T00:00:00+05:30"),
        movedFromDate: patient.appointmentDate,
        movedToDate: new Date(newDate + "T00:00:00+05:30"),
        moveReason: reason ?? null,
        status: "MOVED",
        updatedBy: user.id,
      },
    })

    revalidatePath("/patients")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to move appointment" }
  }
}

export async function addServiceToPatient(data: {
  patientId: string
  services: z.infer<typeof ServiceItemSchema>[]
  paymentMode: string
  amountPaid: number
  discount: number
  notes?: string
}) {
  const user = await requireAuth()
  try {
    const patient = await db.patient.findUnique({
      where: { patientId: data.patientId },
      select: { id: true, patientId: true, patientType: true },
    })
    if (!patient) return { success: false as const, error: "Patient not found" }

    const { start: todayStart, end: todayEnd } = getISTDayBounds()

    // Check for existing prescription today — add items to it instead of creating a new one
    const existingPrescription = await db.prescription.findFirst({
      where: {
        patientId: patient.patientId,
        prescriptionDate: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    })

    const newSubtotal = data.services.reduce((s, item) => s + item.amount, 0)
    let prescription

    if (existingPrescription) {
      // Add new items to the existing prescription and update totals
      const updatedSubtotal = existingPrescription.subtotal + newSubtotal
      const updatedDiscount = existingPrescription.discount + data.discount
      const updatedTotal = updatedSubtotal - updatedDiscount
      const updatedAmountPaid = existingPrescription.amountPaid + data.amountPaid
      const updatedBalanceDue = updatedTotal - updatedAmountPaid

      prescription = await db.prescription.update({
        where: { id: existingPrescription.id },
        data: {
          subtotal: updatedSubtotal,
          discount: updatedDiscount,
          total: updatedTotal,
          amountPaid: updatedAmountPaid,
          balanceDue: updatedBalanceDue,
          notes: data.notes
            ? [existingPrescription.notes, data.notes].filter(Boolean).join("; ")
            : existingPrescription.notes,
          items: {
            create: data.services.map((s, i) => ({
              description: s.description,
              category: s.category ?? null,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              amount: s.amount,
              sortOrder: existingPrescription.items.length + i,
            })),
          },
        },
      })

      if (data.amountPaid > 0) {
        await db.payment.create({
          data: {
            prescriptionId: existingPrescription.id,
            amount: data.amountPaid,
            paymentMode: data.paymentMode,
            receivedBy: user.id,
          },
        })
      }
    } else {
      // No prescription today — create a new one for this visit
      const prescriptionNumber = await getNextPrescriptionNumber()
      const total = newSubtotal - data.discount
      const balanceDue = total - data.amountPaid

      prescription = await db.prescription.create({
        data: {
          prescriptionNumber,
          patientId: patient.patientId,
          patientType: patient.patientType,
          doctorName: null,
          medicines: "[]",
          investigations: "[]",
          subtotal: newSubtotal,
          discount: data.discount,
          total,
          amountPaid: data.amountPaid,
          balanceDue,
          paymentMode: data.paymentMode,
          paymentDate: new Date(),
          status: "BILLING_ONLY",
          prescriptionDate: new Date(),
          notes: data.notes ?? null,
          createdBy: user.id,
          items: {
            create: data.services.map((s, i) => ({
              description: s.description,
              category: s.category ?? null,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              amount: s.amount,
              sortOrder: i,
            })),
          },
        },
      })

      if (data.amountPaid > 0) {
        await db.payment.create({
          data: {
            prescriptionId: prescription.id,
            amount: data.amountPaid,
            paymentMode: data.paymentMode,
            receivedBy: user.id,
          },
        })
      }
    }

    // Status is computed from data (eyeReadings + prescriptions), not stored in DB.
    // No status update needed here.

    revalidatePath("/patients")
    revalidatePath("/workup")
    revalidatePath("/doctor")
    return { success: true as const, data: prescription }
  } catch {
    return { success: false as const, error: "Failed to add service" }
  }
}

// ─── Search Existing Patients ─────────────────────────────────────────────────

export async function searchExistingPatients(query: string) {
  if (!query || query.length < 2) return []

  const patients = await db.patient.findMany({
    where: {
      OR: [
        { patientId: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      phone: true,
      age: true,
      gender: true,
      patientType: true,
      appointmentDate: true,
      prescriptions: {
        orderBy: { prescriptionDate: "desc" },
        take: 1,
        select: { prescriptionDate: true },
      },
    },
  })

  return patients.map(p => ({
    ...p,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(" "),
    lastVisitDate: p.prescriptions[0]?.prescriptionDate ?? p.appointmentDate,
  }))
}

export async function getPatientWithLastVisit(patientId: string) {
  const patient = await db.patient.findUnique({
    where: { patientId },
    include: {
      prescriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!patient) return null

  const lastVisitDate = patient.prescriptions[0]?.prescriptionDate ?? patient.appointmentDate
  const daysSinceLastVisit = Math.floor(
    (new Date().getTime() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    ...patient,
    fullName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    lastVisitDate,
    daysSinceLastVisit,
  }
}

// ─── Service Templates ────────────────────────────────────────────────────────

export async function getServiceTemplates() {
  return db.serviceTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function createServiceTemplate(data: {
  name: string
  category: string
  description?: string
  amount: number
}) {
  const user = await requireAuth()
  if (user.role !== "ADMIN") return { success: false, error: "Admin only" }
  try {
    const template = await db.serviceTemplate.create({
      data: { ...data, createdBy: user.id },
    })
    revalidatePath("/settings/services")
    return { success: true, data: template }
  } catch {
    return { success: false, error: "Failed to create service template" }
  }
}

export async function updateServiceTemplate(id: string, data: {
  name?: string
  category?: string
  amount?: number
  isActive?: boolean
}) {
  const user = await requireAuth()
  if (user.role !== "ADMIN") return { success: false, error: "Admin only" }
  try {
    const template = await db.serviceTemplate.update({ where: { id }, data })
    revalidatePath("/settings/services")
    return { success: true, data: template }
  } catch {
    return { success: false, error: "Failed to update service template" }
  }
}

export async function deleteServiceTemplate(id: string) {
  const user = await requireAuth()
  if (user.role !== "ADMIN") return { success: false, error: "Admin only" }
  try {
    await db.serviceTemplate.delete({ where: { id } })
    revalidatePath("/settings/services")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete service template" }
  }
}

// ─── User Role ───────────────────────────────────────────────────────────────

export async function getCurrentUserRole() {
  const user = await requireAuth()
  return { role: user.role }
}

// ─── Delete Patient (Admin only) ─────────────────────────────────────────────

export async function deletePatient(patientId: string) {
  const user = await requireAuth()
  if (user.role !== "ADMIN") return { success: false as const, error: "Admin only" }
  try {
    await db.$transaction(async (tx) => {
      // Find all prescriptions for this patient
      const prescriptions = await tx.prescription.findMany({
        where: { patientId },
        select: { id: true },
      })
      const prescriptionIds = prescriptions.map(p => p.id)

      // Delete payments and invoice items linked to prescriptions
      if (prescriptionIds.length > 0) {
        await tx.payment.deleteMany({ where: { prescriptionId: { in: prescriptionIds } } })
        await tx.invoiceItem.deleteMany({ where: { prescriptionId: { in: prescriptionIds } } })
      }

      // Delete eye readings (linked by patientId string)
      await tx.eyeReading.deleteMany({ where: { patientId } })

      // Delete prescriptions
      await tx.prescription.deleteMany({ where: { patientId } })

      // Find linked inpatient (if any) and delete its insurance claims
      const patient = await tx.patient.findUnique({ where: { patientId }, select: { id: true } })
      if (patient) {
        const inpatient = await tx.inPatient.findUnique({ where: { patientId: patient.id }, select: { id: true } })
        if (inpatient) {
          await tx.insuranceClaim.deleteMany({ where: { inPatientId: inpatient.id } })
          await tx.inPatient.delete({ where: { id: inpatient.id } })
        }
      }

      // Delete the patient
      await tx.patient.delete({ where: { patientId } })
    })
    revalidatePath("/patients")
    revalidatePath("/inpatients")
    revalidatePath("/insurance")
    return { success: true as const }
  } catch (error) {
    console.error("Error deleting patient:", error)
    return { success: false as const, error: "Failed to delete patient" }
  }
}

// ─── Dropdown Options (doctor name, department, referred by) ──────────────────

export async function getDropdownOptions(fieldName: string): Promise<string[]> {
  const options = await db.dropdownOption.findMany({
    where: { fieldName },
    orderBy: { value: "asc" },
  })
  return options.map((o) => o.value)
}

export async function addDropdownOption(fieldName: string, value: string) {
  const user = await requireAuth()
  try {
    await db.dropdownOption.upsert({
      where: { fieldName_value: { fieldName, value } },
      create: { fieldName, value, createdBy: user.id },
      update: {},
    })
    return { success: true }
  } catch {
    return { success: false, error: "Failed to add option" }
  }
}
