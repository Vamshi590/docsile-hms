"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"

export async function getDoctorQueue(date?: string) {
  const targetDate = date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  const start = new Date(targetDate + "T00:00:00")
  const end = new Date(targetDate + "T23:59:59")

  return db.patient.findMany({
    where: {
      patientType: "OPD",
      status: { in: ["WORKUP_DONE", "WITH_DOCTOR", "REGISTERED", "COMPLETED", "MEDICAL_ONLY"] },
      // Find patients by prescription date OR original appointmentDate
      OR: [
        { prescriptions: { some: { prescriptionDate: { gte: start, lte: end } } } },
        { appointmentDate: { gte: start, lte: end } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      eyeReadings: {
        where: { readingDate: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      prescriptions: {
        where: { prescriptionDate: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { items: true },
      },
      labBills: {
        include: { lab: { select: { name: true } }, items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function getPatientForConsultation(patientId: string) {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  const start = new Date(todayStr + "T00:00:00")
  const end = new Date(todayStr + "T23:59:59")

  const patient = await db.patient.findUnique({
    where: { patientId },
    include: {
      eyeReadings: {
        where: { readingDate: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
      },
      prescriptions: {
        include: { items: true, payments: true, eyeReading: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!patient) return null

  // Split prescriptions into today vs past on the server (reliable date handling)
  const todayPrescription = patient.prescriptions.find(
    rx => rx.prescriptionDate >= start && rx.prescriptionDate <= end
  ) ?? null

  const pastPrescriptions = patient.prescriptions.filter(
    rx => !todayPrescription || rx.id !== todayPrescription.id
  )

  return {
    ...JSON.parse(JSON.stringify(patient)) as typeof patient,
    todayPrescription: todayPrescription as typeof patient.prescriptions[0] | null,
    pastPrescriptions: pastPrescriptions as typeof patient.prescriptions,
  }
}

const PrescriptionSchema = z.object({
  patientId: z.string(),
  doctorName: z.string().optional(),
  department: z.string().optional(),
  temperature: z.number().optional().nullable(),
  pulseRate: z.number().int().optional().nullable(),
  spo2: z.number().int().optional().nullable(),
  presentComplaint: z.string().optional(),
  previousHistory: z.string().optional(),
  diagnosis: z.string().optional(),
  additionalNotes: z.string().optional(),
  medicines: z.array(z.object({
    name: z.string().min(1),
    days: z.string(),
    timing: z.string(),
    note: z.string().optional(),
  })),
  investigations: z.array(z.object({
    name: z.string().min(1),
    note: z.string().optional(),
  })),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function savePrescription(data: z.infer<typeof PrescriptionSchema>) {
  const user = await requireAuth()
  const validated = PrescriptionSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const patient = await db.patient.findUnique({
      where: { patientId: pd.patientId },
      include: { eyeReadings: { take: 1 } },
    })
    if (!patient) return { success: false, error: "Patient not found" }
    const hasWorkup = patient.eyeReadings.length > 0

    // Find today's billing-only prescription to update with medical data
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const existing = await db.prescription.findFirst({
      where: {
        patientId: pd.patientId,
        prescriptionDate: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: "desc" },
    })

    const medicalData = {
      doctorId: user.role === "DOCTOR" ? user.id : null,
      doctorName: pd.doctorName || user.fullName,
      department: pd.department ?? null,
      temperature: pd.temperature ?? null,
      pulseRate: pd.pulseRate ?? null,
      spo2: pd.spo2 ?? null,
      presentComplaint: pd.presentComplaint ?? null,
      previousHistory: pd.previousHistory ?? null,
      diagnosis: pd.diagnosis ?? null,
      additionalNotes: pd.additionalNotes ?? null,
      medicines: JSON.stringify(pd.medicines),
      investigations: JSON.stringify(pd.investigations),
      followUpDate: pd.followUpDate ? new Date(pd.followUpDate + "T00:00:00") : null,
      notes: pd.notes ?? null,
      status: "COMPLETED",
    }

    let prescription
    if (existing) {
      // Update the billing prescription with medical data
      prescription = await db.prescription.update({
        where: { id: existing.id },
        data: { ...medicalData, updatedBy: user.id },
      })
    } else {
      // No billing prescription today — create a new one with medical data only
      prescription = await db.prescription.create({
        data: {
          patientId: pd.patientId,
          patientType: "OPD",
          ...medicalData,
          prescriptionDate: new Date(),
          createdBy: user.id,
        },
      })
    }

    // Update patient status
    await db.patient.update({
      where: { patientId: pd.patientId },
      data: { status: hasWorkup ? "COMPLETED" : "MEDICAL_ONLY", updatedBy: user.id },
    })

    revalidatePath("/doctor")
    revalidatePath("/patients")
    return { success: true, data: prescription }
  } catch (error) {
    console.error("Save prescription error:", error)
    return { success: false, error: "Failed to save prescription" }
  }
}

// ─── Configurations (Medicine Master, Templates, etc.) ────────────────────────

export async function getMedicineMaster() {
  return db.medicineMaster.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function getInvestigationMaster() {
  return db.investigationMaster.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function getPredefinedTemplates() {
  return db.predefinedTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })
}

export async function getDropdownOptions(fieldName: string) {
  const options = await db.dropdownOption.findMany({
    where: { fieldName },
    orderBy: { value: "asc" },
  })
  return options.map(o => o.value)
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

export async function createMedicine(data: {
  name: string
  category?: string
  defaultTiming?: string
  defaultDays?: string
  note?: string
}) {
  const user = await requireAuth()
  try {
    const med = await db.medicineMaster.create({
      data: { ...data, createdBy: user.id },
    })
    revalidatePath("/doctor")
    return { success: true, data: med }
  } catch {
    return { success: false, error: "Failed to create medicine" }
  }
}

export async function updatePatientToWithDoctor(patientId: string) {
  const user = await requireAuth()
  await db.patient.update({
    where: { patientId },
    data: { status: "WITH_DOCTOR", updatedBy: user.id },
  })
  revalidatePath("/doctor")
}

export async function getReceiptData(patientId: string) {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  const start = new Date(todayStr + "T00:00:00")
  const end = new Date(todayStr + "T23:59:59")

  const [patient, hospital] = await Promise.all([
    db.patient.findUnique({
      where: { patientId },
      include: {
        eyeReadings: {
          where: { readingDate: { gte: start, lte: end } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        prescriptions: {
          where: { prescriptionDate: { gte: start, lte: end } },
          include: { items: true, payments: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.hospitalProfile.findFirst(),
  ])

  return {
    patient,
    hospital,
    prescription: patient?.prescriptions?.[0] ?? null,
    eyeReading: patient?.eyeReadings?.[0] ?? null,
  }
}
