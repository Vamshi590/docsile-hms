"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { getISTDayBounds, toLocalDateISO, computePatientStatus } from "@/lib/utils"

export async function getWorkupQueue(date?: string) {
  const targetDate = date ?? toLocalDateISO()
  const { start, end } = getISTDayBounds(targetDate)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const startISO = start.toISOString()
  const endISO = end.toISOString()
  const supabase = await createClient()

  const SELECT_FULL =
    "*, eyeReadings:EyeReading(*), prescriptions:Prescription(id, status, prescriptionDate, doctorName, createdAt)"
  const SELECT_FULL_RX_INNER =
    "*, eyeReadings:EyeReading(*), prescriptions:Prescription!inner(id, status, prescriptionDate, doctorName, createdAt)"
  const SELECT_FULL_ER_INNER =
    "*, eyeReadings:EyeReading!inner(*), prescriptions:Prescription(id, status, prescriptionDate, doctorName, createdAt)"

  // Three parallel queries — a patient belongs in today's queue if ANY of:
  //   (A) their appointment is today, OR
  //   (B) they have a prescription written today, OR
  //   (C) they have an eye reading saved today.
  // (C) catches the "patient came yesterday but workup is being entered today"
  // case where the appointment date doesn't match the day of the actual visit.
  const [apptRes, rxRes, erRes] = await Promise.all([
    supabase
      .from("Patient")
      .select(SELECT_FULL)
      .eq("patientType", "OPD")
      .gte("appointmentDate", startISO)
      .lte("appointmentDate", endISO)
      .order("createdAt", { ascending: true }),
    supabase
      .from("Patient")
      .select(SELECT_FULL_RX_INNER)
      .eq("patientType", "OPD")
      .gte("prescriptions.prescriptionDate", startISO)
      .lte("prescriptions.prescriptionDate", endISO)
      .order("createdAt", { ascending: true }),
    supabase
      .from("Patient")
      .select(SELECT_FULL_ER_INNER)
      .eq("patientType", "OPD")
      .gte("eyeReadings.readingDate", startISO)
      .lte("eyeReadings.readingDate", endISO)
      .order("createdAt", { ascending: true }),
  ])

  if (apptRes.error) throw apptRes.error
  if (rxRes.error) throw rxRes.error
  if (erRes.error) throw erRes.error

  // Merge by patientId. Query A wins on collision (it has the full unfiltered
  // prescription list); the !inner queries only join in-range rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = new Map<string, any>()
  for (const p of (apptRes.data ?? [])) merged.set(p.patientId, p)
  for (const p of (rxRes.data ?? [])) {
    if (!merged.has(p.patientId)) merged.set(p.patientId, p)
  }
  for (const p of (erRes.data ?? [])) {
    if (!merged.has(p.patientId)) merged.set(p.patientId, p)
  }
  const filtered = Array.from(merged.values())

  function isInDay(dateStr: string) {
    const t = new Date(dateStr).getTime()
    return t >= startMs && t <= endMs
  }

  // Filter nested relations to today only and compute status
  return filtered.map(p => {
    const todayEyeReadings = (p.eyeReadings ?? []).filter(
      (er: { readingDate: string }) => isInDay(er.readingDate)
    ).sort((a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1)

    const todayPrescriptions = (p.prescriptions ?? []).filter(
      (rx: { prescriptionDate: string }) => isInDay(rx.prescriptionDate)
    ).sort((a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1)

    const hasWorkup = todayEyeReadings.length > 0
    const hasDoctorPrescription = todayPrescriptions.some(
      (rx: { status: string; doctorName: string | null }) => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
    )
    return {
      ...p,
      eyeReadings: todayEyeReadings,
      prescriptions: todayPrescriptions,
      status: computePatientStatus(hasWorkup, hasDoctorPrescription, p.status),
    }
  })
}

export async function getPatientForWorkup(patientId: string) {
  const { start, end } = getISTDayBounds()
  const startMs = start.getTime()
  const endMs = end.getTime()
  const supabase = await createClient()

  function isInDay(dateStr: string) {
    const t = new Date(dateStr).getTime()
    return t >= startMs && t <= endMs
  }

  const { data: patient, error } = await supabase
    .from("Patient")
    .select("*, eyeReadings:EyeReading(*), prescriptions:Prescription(id, prescriptionDate)")
    .eq("patientId", patientId)
    .single()

  if (error) return null

  // Filter nested relations to today only
  patient.eyeReadings = (patient.eyeReadings ?? [])
    .filter((er: { readingDate: string }) => isInDay(er.readingDate))
    .sort((a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt))

  patient.prescriptions = (patient.prescriptions ?? [])
    .filter((rx: { prescriptionDate: string }) => isInDay(rx.prescriptionDate))
    .sort((a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1)

  return patient
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
  const supabase = await createClient()

  try {
    // Find patient
    const { data: patient } = await supabase
      .from("Patient")
      .select("id, patientId")
      .eq("patientId", data.patientId)
      .single()
    if (!patient) return { success: false, error: "Patient not found" }

    // Find today's prescription for this patient to link the eye reading
    const { start: today, end: tomorrow } = getISTDayBounds(data.readingDate)

    const { data: todayPrescription } = await supabase
      .from("Prescription")
      .select("id")
      .eq("patientId", patient.patientId)
      .gte("prescriptionDate", today.toISOString())
      .lte("prescriptionDate", tomorrow.toISOString())
      .is("eyeReadingId", null)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single()

    // Check for existing eye reading today
    const { data: existing } = await supabase
      .from("EyeReading")
      .select("id")
      .eq("patientId", patient.patientId)
      .gte("readingDate", today.toISOString())
      .lte("readingDate", tomorrow.toISOString())
      .limit(1)
      .single()

    const eyeData = {
      autoRefractometer: data.autoRefractometer ? JSON.stringify(data.autoRefractometer) : null,
      glassesReading: data.glassesReading ? JSON.stringify(data.glassesReading) : null,
      previousPrescription: data.previousPrescription ? JSON.stringify(data.previousPrescription) : null,
      presentPrescription: data.presentPrescription ? JSON.stringify(data.presentPrescription) : null,
      clinicalFindings: data.clinicalFindings ? JSON.stringify(data.clinicalFindings) : null,
      status: "COMPLETED",
    }

    if (existing) {
      await supabase
        .from("EyeReading")
        .update({ ...eyeData, updatedBy: user.id })
        .eq("id", existing.id)
    } else {
      const now = new Date().toISOString()
      await supabase
        .from("EyeReading")
        .insert({
          patientId: patient.patientId,
          ...eyeData,
          readingDate: new Date(data.readingDate + "T00:00:00+05:30").toISOString(),
          createdById: user.id,
          createdAt: now,
          updatedAt: now,
          ...(todayPrescription ? { prescriptionId: todayPrescription.id } : {}),
        })
    }

    revalidatePath("/workup")
    revalidatePath("/patients")
    revalidatePath("/doctor")
    return { success: true }
  } catch (error) {
    console.error("Error saving eye reading:", error)
    return { success: false, error: "Failed to save reading" }
  }
}
