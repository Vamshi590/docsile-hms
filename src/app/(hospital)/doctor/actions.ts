"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"
import { getISTDayBounds, toLocalDateISO, computePatientStatus } from "@/lib/utils"
import { z } from "zod"

export async function getDoctorQueue(date?: string) {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const targetDate = date ?? toLocalDateISO()
  const { start, end } = getISTDayBounds(targetDate)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const SELECT_FULL =
    "*, eyeReadings:EyeReading(*), prescriptions:Prescription(*, items:InvoiceItem(*)), labBills:LabBill(*, lab:Lab(name), items:LabBillItem(*))"
  const SELECT_FULL_RX_INNER =
    "*, eyeReadings:EyeReading(*), prescriptions:Prescription!inner(*, items:InvoiceItem(*)), labBills:LabBill(*, lab:Lab(name), items:LabBillItem(*))"
  const SELECT_FULL_ER_INNER =
    "*, eyeReadings:EyeReading!inner(*), prescriptions:Prescription(*, items:InvoiceItem(*)), labBills:LabBill(*, lab:Lab(name), items:LabBillItem(*))"

  // Three parallel queries: a patient belongs in today's queue if they have an
  // appointment, a prescription, or an eye reading saved in this date range.
  // Query C (eye reading) catches "appointment was yesterday, workup entered today".
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

  if (apptRes.error) {
    console.error("getDoctorQueue error (appointment):", apptRes.error)
    return []
  }
  if (rxRes.error) {
    console.error("getDoctorQueue error (prescription):", rxRes.error)
    return []
  }
  if (erRes.error) {
    console.error("getDoctorQueue error (eye reading):", erRes.error)
    return []
  }

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

  // Filter nested relations to today's date and compute status
  return filtered.map((p: any) => {
    const todayEyeReadings = (p.eyeReadings ?? [])
      .filter((er: any) => isInDay(er.readingDate))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1)

    const todayPrescriptions = (p.prescriptions ?? [])
      .filter((rx: any) => isInDay(rx.prescriptionDate))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1)

    const hasWorkup = todayEyeReadings.length > 0
    const hasDoctorPrescription = todayPrescriptions.some(
      (rx: any) => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
    )

    return {
      ...p,
      eyeReadings: todayEyeReadings,
      prescriptions: todayPrescriptions,
      status: computePatientStatus(hasWorkup, hasDoctorPrescription, p.status),
    }
  })
}

export async function getPatientForConsultation(patientId: string, date?: string) {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const { start, end } = getISTDayBounds(date)
  const startMs = start.getTime()
  const endMs = end.getTime()

  function isInDay(dateStr: string) {
    const t = new Date(dateStr).getTime()
    return t >= startMs && t <= endMs
  }

  const { data: patient, error } = await supabase
    .from("Patient")
    .select("*, eyeReadings:EyeReading(*), prescriptions:Prescription(*, items:InvoiceItem(*), payments:Payment(*))")
    .eq("patientId", patientId)
    .single()

  if (error || !patient) return null

  // Filter eye readings to today
  const todayEyeReadings = (patient.eyeReadings ?? [])
    .filter((er: any) => isInDay(er.readingDate))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Compute status from actual data
  const hasWorkup = todayEyeReadings.length > 0
  const hasDoctorPrescription = (patient.prescriptions ?? []).some(
    (rx: any) => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
  )
  const computedStatus = computePatientStatus(hasWorkup, hasDoctorPrescription, patient.status)

  // Sort prescriptions by createdAt desc
  const sortedPrescriptions = (patient.prescriptions ?? []).sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Split prescriptions into today vs past on the server (reliable date handling)
  const todayPrescription = sortedPrescriptions.find(
    (rx: any) => isInDay(rx.prescriptionDate)
  ) ?? null

  const pastPrescriptions = sortedPrescriptions.filter(
    (rx: any) => !todayPrescription || rx.id !== todayPrescription.id
  )

  return {
    ...patient,
    eyeReadings: todayEyeReadings,
    prescriptions: sortedPrescriptions,
    status: computedStatus,
    todayPrescription,
    pastPrescriptions,
  }
}

const PrescriptionSchema = z.object({
  patientId: z.string(),
  doctorName: z.string().optional(),
  department: z.string().optional(),
  temperature: z.number().optional().nullable(),
  pulseRate: z.number().int().optional().nullable(),
  spo2: z.number().int().optional().nullable(),
  heightCm: z.number().optional().nullable(),
  weightKg: z.number().optional().nullable(),
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
  const user = await requireServerPermission("doctor:consult")
  const validated = PrescriptionSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Invalid data" }
  }

  const pd = validated.data
  try {
    const supabase = await createClient()

    const { data: patient, error: patientError } = await supabase
      .from("Patient")
      .select("*")
      .eq("patientId", pd.patientId)
      .single()

    if (patientError || !patient) return { success: false, error: "Patient not found" }

    // Find today's billing-only prescription to update with medical data
    const { start: todayStart, end: todayEnd } = getISTDayBounds()

    const { data: existing } = await supabase
      .from("Prescription")
      .select("*")
      .eq("patientId", pd.patientId)
      .gte("prescriptionDate", todayStart.toISOString())
      .lte("prescriptionDate", todayEnd.toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .single()

    const medicalData = {
      doctorId: user.role === "DOCTOR" ? user.id : null,
      doctorName: pd.doctorName || user.fullName,
      department: pd.department ?? null,
      temperature: pd.temperature ?? null,
      pulseRate: pd.pulseRate ?? null,
      spo2: pd.spo2 ?? null,
      heightCm: pd.heightCm ?? null,
      weightKg: pd.weightKg ?? null,
      presentComplaint: pd.presentComplaint ?? null,
      previousHistory: pd.previousHistory ?? null,
      diagnosis: pd.diagnosis ?? null,
      additionalNotes: pd.additionalNotes ?? null,
      medicines: JSON.stringify(pd.medicines),
      investigations: JSON.stringify(pd.investigations),
      followUpDate: pd.followUpDate ? new Date(pd.followUpDate + "T00:00:00+05:30").toISOString() : null,
      notes: pd.notes ?? null,
      status: "COMPLETED",
    }

    let prescription
    const now = new Date().toISOString()

    if (existing) {
      // Update the billing prescription with medical data
      const { data: updated, error: updateError } = await supabase
        .from("Prescription")
        .update({ ...medicalData, updatedBy: user.id, updatedAt: now })
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) throw updateError
      prescription = updated
    } else {
      // No billing prescription today — create a new one with medical data only
      const { data: created, error: createError } = await supabase
        .from("Prescription")
        .insert({
          patientId: pd.patientId,
          patientType: "OPD",
          ...medicalData,
          prescriptionDate: now,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .select()
        .single()

      if (createError) throw createError
      prescription = created
    }

    // Status is computed from data — no DB status update needed.

    revalidatePath("/doctor")
    revalidatePath("/patients")
    return { success: true, data: prescription }
  } catch (error) {
    console.error("Save prescription error:", error)
    return { success: false, error: "Failed to save prescription" }
  }
}

// ─── Configurations (Medicine Master, Templates, etc.) ────────────────────────

// Single round-trip that bundles every piece of reference data the
// PrescriptionForm needs at mount time. Loaded once per page (server-side) so
// the form no longer fires 6 separate calls on every patient click.
export async function getPrescriptionReferenceData() {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()

  const [medsRes, invsRes, dropdownsRes, templatesRes] = await Promise.all([
    supabase
      .from("MedicineMaster")
      .select("*")
      .eq("isActive", true)
      .order("sortOrder", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("InvestigationMaster")
      .select("*")
      .eq("isActive", true)
      .order("sortOrder", { ascending: true })
      .order("name", { ascending: true }),
    // Collapse 3 separate getDropdownOptions calls into one with .in()
    supabase
      .from("DropdownOption")
      .select("fieldName, value")
      .in("fieldName", ["presentComplaint", "previousHistory", "diagnosis", "additionalNotes"])
      .order("value", { ascending: true }),
    supabase
      .from("PredefinedTemplate")
      .select("*")
      .eq("isActive", true)
      .order("name", { ascending: true }),
  ])

  const bucket: Record<string, string[]> = { presentComplaint: [], previousHistory: [], diagnosis: [], additionalNotes: [] }
  for (const row of (dropdownsRes.data ?? []) as { fieldName: string; value: string }[]) {
    if (bucket[row.fieldName]) bucket[row.fieldName].push(row.value)
  }

  return {
    medicines: medsRes.data ?? [],
    investigations: (invsRes.data ?? []).map((x: { name: string }) => x.name),
    complaintOptions: bucket.presentComplaint,
    previousHistoryOptions: bucket.previousHistory,
    diagnosisOptions: bucket.diagnosis,
    additionalNotesOptions: bucket.additionalNotes,
    templates: templatesRes.data ?? [],
  }
}

export async function getMedicineMaster() {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const { data } = await supabase
    .from("MedicineMaster")
    .select("*")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  return data ?? []
}

export async function getInvestigationMaster() {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const { data } = await supabase
    .from("InvestigationMaster")
    .select("*")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  return data ?? []
}

export async function getPredefinedTemplates() {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const { data } = await supabase
    .from("PredefinedTemplate")
    .select("*")
    .eq("isActive", true)
    .order("name", { ascending: true })
  return data ?? []
}

export async function getDropdownOptions(fieldName: string) {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const { data: options } = await supabase
    .from("DropdownOption")
    .select("*")
    .eq("fieldName", fieldName)
    .order("value", { ascending: true })
  return (options ?? []).map((o: any) => o.value)
}

export async function addDropdownOption(fieldName: string, value: string) {
  const user = await requireServerPermission("doctor:consult")
  try {
    const supabase = await createClient()

    // Check if already exists (upsert equivalent)
    const { data: existing } = await supabase
      .from("DropdownOption")
      .select("id")
      .eq("fieldName", fieldName)
      .eq("value", value)
      .limit(1)
      .single()

    if (!existing) {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("DropdownOption")
        .insert({ fieldName, value, createdBy: user.id, createdAt: now })

      if (error) throw error
    }

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
  const user = await requireServerPermission("doctor:consult")
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: med, error } = await supabase
      .from("MedicineMaster")
      .insert({ ...data, createdBy: user.id, createdAt: now, updatedAt: now })
      .select()
      .single()

    if (error) throw error
    revalidatePath("/doctor")
    return { success: true, data: med }
  } catch {
    return { success: false, error: "Failed to create medicine" }
  }
}

export async function updatePatientToWithDoctor(patientId: string) {
  // Status is computed from data — no DB status update needed.
  // Kept for compatibility but is now a no-op.
  await requireServerPermission("doctor:consult")
  revalidatePath("/doctor")
}

/**
 * Load the data needed to render a patient's receipts.
 *
 * Default behavior: returns only today's prescription / eye reading (matches the
 * doctor queue UX, where receipts are for the active consultation).
 *
 * Pass `{ latest: true }` to return the patient's most recent prescription and
 * eye reading regardless of date — used by the patients page where a completed
 * visit may have happened on an earlier day.
 */
export async function getReceiptData(patientId: string, opts?: { latest?: boolean }) {
  await requireServerPermission("doctor:view")
  const supabase = await createClient()
  const useLatest = opts?.latest === true
  const { start, end } = getISTDayBounds()
  const startMs = start.getTime()
  const endMs = end.getTime()

  function isInDay(dateStr: string) {
    const t = new Date(dateStr).getTime()
    return t >= startMs && t <= endMs
  }

  const [patientResult, hospitalResult] = await Promise.all([
    supabase
      .from("Patient")
      .select("*, eyeReadings:EyeReading(*), prescriptions:Prescription(*, items:InvoiceItem(*), payments:Payment(*))")
      .eq("patientId", patientId)
      .single(),
    supabase
      .from("HospitalProfile")
      .select("*")
      .limit(1)
      .single(),
  ])

  const patient = patientResult.data
  const hospital = hospitalResult.data

  if (patient) {
    const sortByCreatedDesc = (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

    patient.eyeReadings = (patient.eyeReadings ?? [])
      .filter((er: any) => useLatest ? true : isInDay(er.readingDate))
      .sort(sortByCreatedDesc)
      .slice(0, 1)

    patient.prescriptions = (patient.prescriptions ?? [])
      .filter((rx: any) => useLatest ? true : isInDay(rx.prescriptionDate))
      .sort(sortByCreatedDesc)
      .slice(0, 1)
  }

  return {
    patient,
    hospital,
    prescription: patient?.prescriptions?.[0] ?? null,
    eyeReading: patient?.eyeReadings?.[0] ?? null,
  }
}
