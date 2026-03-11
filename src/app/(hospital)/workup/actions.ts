"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { getISTDayBounds, toLocalDateISO, computePatientStatus } from "@/lib/utils"

export async function getWorkupQueue(date?: string) {
  const targetDate = date ?? toLocalDateISO()
  const { start, end } = getISTDayBounds(targetDate)

  const patients = await db.patient.findMany({
    where: {
      patientType: "OPD",
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
        select: { id: true, status: true, prescriptionDate: true, doctorName: true },
      },
    },
  })

  // Compute status from actual data
  return patients.map(p => {
    const hasWorkup = p.eyeReadings.length > 0
    const hasDoctorPrescription = p.prescriptions.some(
      rx => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
    )
    return {
      ...p,
      status: computePatientStatus(hasWorkup, hasDoctorPrescription, p.status),
    }
  })
}

export async function getPatientForWorkup(patientId: string) {
  const { start, end } = getISTDayBounds()

  return db.patient.findUnique({
    where: { patientId },
    include: {
      eyeReadings: {
        where: { readingDate: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
      },
      prescriptions: {
        where: { prescriptionDate: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, prescriptionDate: true },
      },
    },
  })
}

export async function startWorkup(patientId: string) {
  // Status is computed from data (eyeReadings + prescriptions), not stored.
  // This function is kept for compatibility but no longer updates status.
  await requireAuth()
  revalidatePath("/workup")
  return { success: true }
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
    const { start: today, end: tomorrow } = getISTDayBounds(data.readingDate)

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
          readingDate: new Date(data.readingDate + "T00:00:00+05:30"),
          createdById: user.id,
          // Link to today's billing prescription if one exists and has no eye reading yet
          ...(todayPrescription ? { prescriptionId: todayPrescription.id } : {}),
        },
      })
    }

    // Status is computed from data — no DB status update needed.

    revalidatePath("/workup")
    revalidatePath("/patients")
    return { success: true }
  } catch (error) {
    console.error("Error saving eye reading:", error)
    return { success: false, error: "Failed to save reading" }
  }
}
