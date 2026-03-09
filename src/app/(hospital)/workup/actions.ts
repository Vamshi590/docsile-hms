"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

export async function getWorkupQueue(date?: string) {
  const targetDate = date ?? new Date().toISOString().split("T")[0]
  const start = new Date(targetDate + "T00:00:00")
  const end = new Date(targetDate + "T23:59:59")

  return db.patient.findMany({
    where: {
      patientType: "OPD",
      appointmentDate: { gte: start, lte: end },
      status: { in: ["REGISTERED", "IN_WORKUP", "WORKUP_DONE"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      eyeReadings: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })
}

export async function getPatientForWorkup(patientId: string) {
  return db.patient.findUnique({
    where: { patientId },
    include: {
      eyeReadings: {
        orderBy: { createdAt: "desc" },
      },
      prescriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, prescriptionDate: true },
      },
    },
  })
}

export async function startWorkup(patientId: string) {
  const user = await requireAuth()
  const result = await db.patient.update({
    where: { patientId },
    data: { status: "IN_WORKUP", updatedBy: user.id },
  })
  revalidatePath("/workup")
  return { success: true, data: result }
}

export async function saveEyeReading(data: {
  patientId: string
  autoRefractometer?: Record<string, unknown>
  glassesReading?: Record<string, unknown>
  previousPrescription?: Record<string, unknown>
  presentPrescription?: Record<string, unknown>
  clinicalFindings?: Record<string, unknown>
  readingDate: string
}) {
  const user = await requireAuth()

  try {
    const patient = await db.patient.findUnique({
      where: { patientId: data.patientId },
      select: { id: true, patientId: true },
    })
    if (!patient) return { success: false, error: "Patient not found" }

    // Find today's prescription for this patient to link the eye reading
    const today = new Date(data.readingDate + "T00:00:00")
    const tomorrow = new Date(data.readingDate + "T23:59:59")

    const todayPrescription = await db.prescription.findFirst({
      where: {
        patientId: patient.patientId,
        prescriptionDate: { gte: today, lte: tomorrow },
        eyeReading: null, // only link if not yet linked
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    // Check for existing eye reading today
    const existing = await db.eyeReading.findFirst({
      where: {
        patientId: patient.patientId,
        readingDate: { gte: today, lte: tomorrow },
      },
    })

    const eyeData = {
      autoRefractometer: data.autoRefractometer ? JSON.stringify(data.autoRefractometer) : null,
      glassesReading: data.glassesReading ? JSON.stringify(data.glassesReading) : null,
      previousPrescription: data.previousPrescription ? JSON.stringify(data.previousPrescription) : null,
      presentPrescription: data.presentPrescription ? JSON.stringify(data.presentPrescription) : null,
      clinicalFindings: data.clinicalFindings ? JSON.stringify(data.clinicalFindings) : null,
      status: "COMPLETED",
    }

    if (existing) {
      await db.eyeReading.update({
        where: { id: existing.id },
        data: { ...eyeData, updatedBy: user.id },
      })
    } else {
      await db.eyeReading.create({
        data: {
          patientId: patient.patientId,
          ...eyeData,
          readingDate: new Date(data.readingDate + "T00:00:00"),
          createdById: user.id,
          // Link to today's billing prescription if one exists and has no eye reading yet
          ...(todayPrescription ? { prescriptionId: todayPrescription.id } : {}),
        },
      })
    }

    // Update patient status to WORKUP_DONE
    await db.patient.update({
      where: { patientId: data.patientId },
      data: { status: "WORKUP_DONE", updatedBy: user.id },
    })

    revalidatePath("/workup")
    revalidatePath("/patients")
    return { success: true }
  } catch (error) {
    console.error("Error saving eye reading:", error)
    return { success: false, error: "Failed to save reading" }
  }
}
