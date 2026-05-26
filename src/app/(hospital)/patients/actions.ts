"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getHospitalProfile as getCachedHospitalProfile } from "@/lib/db"
import { requireAuth, requireServerPermission } from "@/lib/auth"
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
  patientCategory: z.string().optional(),
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
  const supabase = await createClient()
  const { data: lastPatient } = await supabase
    .from("Patient")
    .select("patientId")
    .order("createdAt", { ascending: false })
    .limit(1)
    .single()

  if (!lastPatient) return "0001"

  const lastNum = parseInt(lastPatient.patientId.replace(/\D/g, ""), 10) || 0
  return String(lastNum + 1).padStart(4, "0")
}

async function getNextPrescriptionNumber(): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const prefix = `PRX-${year}`
  const { data: last } = await supabase
    .from("Prescription")
    .select("prescriptionNumber")
    .like("prescriptionNumber", `${prefix}%`)
    .order("prescriptionNumber", { ascending: false })
    .limit(1)
    .single()

  if (!last || !last.prescriptionNumber) return `${prefix}-0001`
  const lastNum = parseInt(last.prescriptionNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function getNextPatientId(_type: "OPD" | "IPD" = "OPD") {
  await requireServerPermission("patients:view")
  return getNextPatientNumber()
}

export async function getPatients(filters: {
  date?: string
  search?: string
  status?: string
  type?: "OPD" | "IPD"
}) {
  await requireServerPermission("patients:view")
  const supabase = await createClient()
  const { date, search, status, type = "OPD" } = filters

  // Narrow select: only the fields the list view (PatientTable) and the
  // post-fetch status/stats computation actually read. Dropping items/payments
  // (unused by the list) and the heavy EyeReading text columns cuts row size
  // dramatically.
  const PAYMENT_FIELDS = "amount, paymentMode"
  const ITEM_FIELDS = "description, sortOrder"
  const PRESCRIPTION_FIELDS =
    `id, status, doctorName, createdAt, prescriptionDate, total, balanceDue, amountPaid, payments:Payment(${PAYMENT_FIELDS}), items:InvoiceItem(${ITEM_FIELDS})`
  const EYE_READING_FIELDS = "id, readingDate, createdAt"
  const SELECT_FULL =
    `*, prescriptions:Prescription(${PRESCRIPTION_FIELDS}), eyeReadings:EyeReading(${EYE_READING_FIELDS})`
  // Query B (prescription-date branch) and Query C (eye-reading-date branch).
  // The `!inner` filters out patients with no matching child row in the range.
  const SELECT_FULL_RX_INNER =
    `*, prescriptions:Prescription!inner(${PRESCRIPTION_FIELDS}), eyeReadings:EyeReading(${EYE_READING_FIELDS})`
  const SELECT_FULL_ER_INNER =
    `*, prescriptions:Prescription(${PRESCRIPTION_FIELDS}), eyeReadings:EyeReading!inner(${EYE_READING_FIELDS})`

  // No date filter — just fetch all patients of this type (unchanged behavior).
  if (!date) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("Patient")
      .select(SELECT_FULL)
      .eq("patientType", type)
      .order("createdAt", { ascending: true })
    if (status) q = q.eq("status", status)
    if (search) {
      q = q.or(
        `patientId.ilike.%${search}%,firstName.ilike.%${search}%,lastName.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }
    const { data, error } = await q
    if (error) {
      console.error("Error fetching patients:", error)
      return []
    }
    return mapPatients(data ?? [], null)
  }

  // Date filter — push the work into Postgres via two parallel queries.
  const dateBounds = getISTDayBounds(date)
  const startISO = dateBounds.start.toISOString()
  const endISO = dateBounds.end.toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qAppt: any = supabase
    .from("Patient")
    .select(SELECT_FULL)
    .eq("patientType", type)
    .gte("appointmentDate", startISO)
    .lte("appointmentDate", endISO)
    .order("createdAt", { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qRx: any = supabase
    .from("Patient")
    .select(SELECT_FULL_RX_INNER)
    .eq("patientType", type)
    .gte("prescriptions.prescriptionDate", startISO)
    .lte("prescriptions.prescriptionDate", endISO)
    .order("createdAt", { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qEr: any = supabase
    .from("Patient")
    .select(SELECT_FULL_ER_INNER)
    .eq("patientType", type)
    .gte("eyeReadings.readingDate", startISO)
    .lte("eyeReadings.readingDate", endISO)
    .order("createdAt", { ascending: true })

  if (status) {
    qAppt = qAppt.eq("status", status)
    qRx = qRx.eq("status", status)
    qEr = qEr.eq("status", status)
  }
  if (search) {
    const orFilter = `patientId.ilike.%${search}%,firstName.ilike.%${search}%,lastName.ilike.%${search}%,phone.ilike.%${search}%`
    qAppt = qAppt.or(orFilter)
    qRx = qRx.or(orFilter)
    qEr = qEr.or(orFilter)
  }

  const [apptRes, rxRes, erRes] = await Promise.all([qAppt, qRx, qEr])

  if (apptRes.error) console.error("Error fetching patients (by appointment):", apptRes.error)
  if (rxRes.error) console.error("Error fetching patients (by prescription):", rxRes.error)
  if (erRes.error) console.error("Error fetching patients (by eye reading):", erRes.error)

  // Merge by patientId. Query A wins on collision because it has the full
  // (unfiltered) prescription + eye-reading lists; the !inner queries only
  // join in-range rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = new Map<string, any>()
  for (const p of (apptRes.data ?? [])) merged.set(p.patientId, p)
  for (const p of (rxRes.data ?? [])) {
    if (!merged.has(p.patientId)) merged.set(p.patientId, p)
  }
  for (const p of (erRes.data ?? [])) {
    if (!merged.has(p.patientId)) merged.set(p.patientId, p)
  }

  return mapPatients(Array.from(merged.values()), dateBounds)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPatients(patients: any[], dateBounds: { start: Date; end: Date } | null) {
  const startMs = dateBounds?.start.getTime() ?? 0
  const endMs = dateBounds?.end.getTime() ?? 0
  const isInBounds = dateBounds
    ? (s: string) => {
        const t = new Date(s).getTime()
        return t >= startMs && t <= endMs
      }
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return patients.map((p: any) => {
    let prescriptions = (p.prescriptions ?? []) as {
      id: string; status: string; doctorName: string | null; createdAt: string;
      prescriptionDate: string; total: number; balanceDue: number; amountPaid: number;
      payments?: { amount: number; paymentMode: string | null }[]
    }[]
    let eyeReadings = (p.eyeReadings ?? []) as { id: string; readingDate: string; createdAt: string }[]

    if (isInBounds) {
      prescriptions = prescriptions.filter((rx) => isInBounds(rx.prescriptionDate))
      eyeReadings = eyeReadings.filter((er) => isInBounds(er.readingDate))
    }

    prescriptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    prescriptions = prescriptions.slice(0, 1)
    eyeReadings = eyeReadings.slice(0, 1)

    const hasWorkup = eyeReadings.length > 0
    const hasDoctorPrescription = prescriptions.some(
      (rx) => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
    )
    return {
      ...p,
      prescriptions,
      eyeReadings,
      status: computePatientStatus(hasWorkup, hasDoctorPrescription, p.status as string),
    }
  })
}

export async function getPatientById(patientId: string) {
  await requireServerPermission("patients:view")
  const supabase = await createClient()
  const { data: patient, error } = await supabase
    .from("Patient")
    .select("*, prescriptions:Prescription(*, items:InvoiceItem(*), payments:Payment(*), eyeReading:EyeReading(*)), eyeReadings:EyeReading(*)")
    .eq("patientId", patientId)
    .single()

  if (error || !patient) return null

  // Sort prescriptions desc by createdAt
  const prescriptions = (patient.prescriptions ?? []) as {
    status: string; doctorName: string | null; createdAt: string
  }[]
  prescriptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Sort eyeReadings desc by createdAt, take 1
  const eyeReadings = (patient.eyeReadings ?? []) as { createdAt: string }[]
  eyeReadings.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const limitedEyeReadings = eyeReadings.slice(0, 1)

  const hasWorkup = limitedEyeReadings.length > 0
  const hasDoctorPrescription = prescriptions.some(
    (rx) => rx.status !== "BILLING_ONLY" && rx.doctorName !== null
  )
  return {
    ...patient,
    prescriptions,
    eyeReadings: limitedEyeReadings,
    status: computePatientStatus(hasWorkup, hasDoctorPrescription, patient.status),
  }
}

// ─── Step 1: Create Patient ───────────────────────────────────────────────────

export async function createPatient(data: z.infer<typeof PatientSchema>) {
  const user = await requireServerPermission("patients:create")
  const validated = PatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid patient data" }
  }

  const pd = validated.data

  try {
    const supabase = await createClient()
    const patientId = await getNextPatientNumber()

    const { data: patient, error } = await supabase
      .from("Patient")
      .insert({
        patientId,
        firstName: pd.firstName,
        lastName: pd.lastName ?? null,
        dateOfBirth: pd.dateOfBirth ? new Date(pd.dateOfBirth + "T00:00:00+05:30").toISOString() : null,
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
        patientCategory: pd.patientCategory ?? "Regular",
        status: "REGISTERED",
        appointmentDate: new Date(pd.appointmentDate + "T00:00:00+05:30").toISOString(),
        notes: pd.notes ?? null,
        createdById: user.id,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath("/patients")
    return { success: true as const, data: { patientId: patient.patientId, id: patient.id } }
  } catch (error) {
    console.error("Error creating patient:", error)
    return { success: false as const, error: "Failed to create patient. Please try again." }
  }
}

// ─── Update Patient (if user edits Step 1 after creation) ─────────────────────

export async function updatePatientInfo(patientId: string, data: z.infer<typeof PatientSchema>) {
  const user = await requireServerPermission("patients:edit")
  const validated = PatientSchema.safeParse(data)
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? "Invalid patient data" }
  }

  const pd = validated.data
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("Patient")
      .update({
        firstName: pd.firstName,
        lastName: pd.lastName ?? null,
        dateOfBirth: pd.dateOfBirth ? new Date(pd.dateOfBirth + "T00:00:00+05:30").toISOString() : null,
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
        patientCategory: pd.patientCategory ?? "Regular",
        appointmentDate: new Date(pd.appointmentDate + "T00:00:00+05:30").toISOString(),
        notes: pd.notes ?? null,
        updatedBy: user.id,
      })
      .eq("patientId", patientId)

    if (error) throw error

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
  const user = await requireServerPermission("doctor:consult")
  const billingValidated = BillingSchema.safeParse(data.billing)

  if (!billingValidated.success) {
    return { success: false as const, error: billingValidated.error.issues[0]?.message ?? "Invalid billing data" }
  }

  const iv = billingValidated.data

  try {
    const supabase = await createClient()

    const { data: patient, error: patientError } = await supabase
      .from("Patient")
      .select("id, patientId, patientType")
      .eq("patientId", data.patientId)
      .single()

    if (patientError || !patient) return { success: false as const, error: "Patient not found" }

    const newSubtotal = iv.services.reduce((sum, s) => sum + s.amount, 0)

    // Check if there's already a prescription for today — add to it
    const { start: todayStart, end: todayEnd } = getISTDayBounds()

    const { data: existingPrescription } = await supabase
      .from("Prescription")
      .select("*, items:InvoiceItem(*)")
      .eq("patientId", patient.patientId)
      .gte("prescriptionDate", todayStart.toISOString())
      .lte("prescriptionDate", todayEnd.toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .single()

    let prescription
    let prescriptionNumber: string | null = null

    if (existingPrescription) {
      // Add items to existing today's prescription
      const existingItems = (existingPrescription.items ?? []) as unknown[]
      const updatedSubtotal = existingPrescription.subtotal + newSubtotal
      const updatedDiscount = existingPrescription.discount + iv.discount
      const updatedTotal = updatedSubtotal - updatedDiscount
      const updatedAmountPaid = existingPrescription.amountPaid + iv.amountPaid
      const updatedBalanceDue = updatedTotal - updatedAmountPaid

      const { data: updatedPrescription, error: updateError } = await supabase
        .from("Prescription")
        .update({
          subtotal: updatedSubtotal,
          discount: updatedDiscount,
          discountReason: iv.discountReason ?? existingPrescription.discountReason,
          total: updatedTotal,
          amountPaid: updatedAmountPaid,
          balanceDue: updatedBalanceDue,
          notes: iv.notes
            ? [existingPrescription.notes, iv.notes].filter(Boolean).join("; ")
            : existingPrescription.notes,
        })
        .eq("id", existingPrescription.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Insert new items
      const itemsToInsert = iv.services.map((s, i) => ({
        prescriptionId: existingPrescription.id,
        description: s.description,
        category: s.category ?? null,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.amount,
        sortOrder: existingItems.length + i,
      }))

      const { error: itemsError } = await supabase
        .from("InvoiceItem")
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      prescription = updatedPrescription
      prescriptionNumber = existingPrescription.prescriptionNumber

      if (iv.amountPaid > 0) {
        const { error: paymentError } = await supabase
          .from("Payment")
          .insert({
            prescriptionId: existingPrescription.id,
            amount: iv.amountPaid,
            paymentMode: iv.paymentMode,
            receivedBy: user.id,
          })
        if (paymentError) throw paymentError
      }
    } else {
      // No prescription today — create a new one
      prescriptionNumber = await getNextPrescriptionNumber()
      const total = newSubtotal - iv.discount
      const balanceDue = total - iv.amountPaid
      const now = new Date().toISOString()

      const { data: newPrescription, error: createError } = await supabase
        .from("Prescription")
        .insert({
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
          paymentDate: now,
          status: "BILLING_ONLY",
          prescriptionDate: now,
          notes: iv.notes ?? null,
          createdBy: user.id,
        })
        .select()
        .single()

      if (createError) throw createError

      // Insert items
      const itemsToInsert = iv.services.map((s, i) => ({
        prescriptionId: newPrescription.id,
        description: s.description,
        category: s.category ?? null,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.amount,
        sortOrder: i,
      }))

      const { error: itemsError } = await supabase
        .from("InvoiceItem")
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      prescription = newPrescription

      if (iv.amountPaid > 0) {
        const { error: paymentError } = await supabase
          .from("Payment")
          .insert({
            prescriptionId: newPrescription.id,
            amount: iv.amountPaid,
            paymentMode: iv.paymentMode,
            receivedBy: user.id,
          })
        if (paymentError) throw paymentError
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
  const user = await requireServerPermission("patients:edit")
  try {
    const supabase = await createClient()
    const { data: patient, error } = await supabase
      .from("Patient")
      .update({ status, updatedBy: user.id })
      .eq("patientId", patientId)
      .select()
      .single()

    if (error) throw error

    revalidatePath("/patients")
    return { success: true as const, data: patient }
  } catch {
    return { success: false as const, error: "Failed to update status" }
  }
}

export async function movePatientToDate(patientId: string, newDate: string, reason?: string) {
  const user = await requireServerPermission("patients:edit")
  try {
    const supabase = await createClient()

    const { data: patient, error: fetchError } = await supabase
      .from("Patient")
      .select("*")
      .eq("patientId", patientId)
      .single()

    if (fetchError || !patient) return { success: false as const, error: "Patient not found" }

    const { error: updateError } = await supabase
      .from("Patient")
      .update({
        appointmentDate: new Date(newDate + "T00:00:00+05:30").toISOString(),
        movedFromDate: patient.appointmentDate,
        movedToDate: new Date(newDate + "T00:00:00+05:30").toISOString(),
        moveReason: reason ?? null,
        status: "MOVED",
        updatedBy: user.id,
      })
      .eq("patientId", patientId)

    if (updateError) throw updateError

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
  const user = await requireServerPermission("patients:edit")
  try {
    const supabase = await createClient()

    const { data: patient, error: patientError } = await supabase
      .from("Patient")
      .select("id, patientId, patientType")
      .eq("patientId", data.patientId)
      .single()

    if (patientError || !patient) return { success: false as const, error: "Patient not found" }

    const { start: todayStart, end: todayEnd } = getISTDayBounds()

    // Check for existing prescription today — add items to it instead of creating a new one
    const { data: existingPrescription } = await supabase
      .from("Prescription")
      .select("*, items:InvoiceItem(*)")
      .eq("patientId", patient.patientId)
      .gte("prescriptionDate", todayStart.toISOString())
      .lte("prescriptionDate", todayEnd.toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .single()

    const newSubtotal = data.services.reduce((s, item) => s + item.amount, 0)
    let prescription

    if (existingPrescription) {
      // Add new items to the existing prescription and update totals
      const existingItems = (existingPrescription.items ?? []) as unknown[]
      const updatedSubtotal = existingPrescription.subtotal + newSubtotal
      const updatedDiscount = existingPrescription.discount + data.discount
      const updatedTotal = updatedSubtotal - updatedDiscount
      const updatedAmountPaid = existingPrescription.amountPaid + data.amountPaid
      const updatedBalanceDue = updatedTotal - updatedAmountPaid

      const { data: updatedPrescription, error: updateError } = await supabase
        .from("Prescription")
        .update({
          subtotal: updatedSubtotal,
          discount: updatedDiscount,
          total: updatedTotal,
          amountPaid: updatedAmountPaid,
          balanceDue: updatedBalanceDue,
          notes: data.notes
            ? [existingPrescription.notes, data.notes].filter(Boolean).join("; ")
            : existingPrescription.notes,
        })
        .eq("id", existingPrescription.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Insert new items
      const itemsToInsert = data.services.map((s, i) => ({
        prescriptionId: existingPrescription.id,
        description: s.description,
        category: s.category ?? null,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.amount,
        sortOrder: existingItems.length + i,
      }))

      const { error: itemsError } = await supabase
        .from("InvoiceItem")
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      prescription = updatedPrescription

      if (data.amountPaid > 0) {
        const { error: paymentError } = await supabase
          .from("Payment")
          .insert({
            prescriptionId: existingPrescription.id,
            amount: data.amountPaid,
            paymentMode: data.paymentMode,
            receivedBy: user.id,
          })
        if (paymentError) throw paymentError
      }
    } else {
      // No prescription today — create a new one for this visit
      const prescriptionNumber = await getNextPrescriptionNumber()
      const total = newSubtotal - data.discount
      const balanceDue = total - data.amountPaid
      const now = new Date().toISOString()

      const { data: newPrescription, error: createError } = await supabase
        .from("Prescription")
        .insert({
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
          paymentDate: now,
          status: "BILLING_ONLY",
          prescriptionDate: now,
          notes: data.notes ?? null,
          createdBy: user.id,
        })
        .select()
        .single()

      if (createError) throw createError

      // Insert items
      const itemsToInsert = data.services.map((s, i) => ({
        prescriptionId: newPrescription.id,
        description: s.description,
        category: s.category ?? null,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.amount,
        sortOrder: i,
      }))

      const { error: itemsError } = await supabase
        .from("InvoiceItem")
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      prescription = newPrescription

      if (data.amountPaid > 0) {
        const { error: paymentError } = await supabase
          .from("Payment")
          .insert({
            prescriptionId: newPrescription.id,
            amount: data.amountPaid,
            paymentMode: data.paymentMode,
            receivedBy: user.id,
          })
        if (paymentError) throw paymentError
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
  await requireServerPermission("patients:view")
  if (!query || query.length < 2) return []

  const supabase = await createClient()

  const { data: patients, error } = await supabase
    .from("Patient")
    .select("id, patientId, firstName, lastName, phone, age, gender, patientType, appointmentDate, address, guardianName, guardianRelation, dateOfBirth, prescriptions:Prescription(prescriptionDate)")
    .or(
      `patientId.ilike.%${query}%,phone.ilike.%${query}%,firstName.ilike.%${query}%,lastName.ilike.%${query}%`
    )
    .order("updatedAt", { ascending: false })
    .limit(10)

  if (error || !patients) return []

  return patients.map((p) => {
    const prescriptions = (p.prescriptions ?? []) as { prescriptionDate: string }[]
    // Sort prescriptions desc by prescriptionDate, take first
    prescriptions.sort((a, b) => b.prescriptionDate.localeCompare(a.prescriptionDate))
    return {
      ...p,
      fullName: [p.firstName, p.lastName].filter(Boolean).join(" "),
      lastVisitDate: prescriptions[0]?.prescriptionDate ?? p.appointmentDate,
    }
  })
}

export async function getPatientWithLastVisit(patientId: string) {
  await requireServerPermission("patients:view")
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from("Patient")
    .select("*, prescriptions:Prescription(*)")
    .eq("patientId", patientId)
    .single()

  if (error || !patient) return null

  const prescriptions = (patient.prescriptions ?? []) as { prescriptionDate: string; createdAt: string }[]
  // Sort prescriptions desc by createdAt, take first
  prescriptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const latestPrescription = prescriptions[0]

  const lastVisitDate = latestPrescription?.prescriptionDate ?? patient.appointmentDate
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
  await requireServerPermission("patients:view")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ServiceTemplate")
    .select("*")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching service templates:", error)
    return []
  }
  return data ?? []
}

export async function createServiceTemplate(data: {
  name: string
  category: string
  description?: string
  amount: number
}) {
  const user = await requireServerPermission("settings:edit")
  try {
    const supabase = await createClient()
    const { data: template, error } = await supabase
      .from("ServiceTemplate")
      .insert({ ...data, createdBy: user.id })
      .select()
      .single()

    if (error) throw error

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
  const user = await requireServerPermission("settings:edit")
  try {
    const supabase = await createClient()
    const { data: template, error } = await supabase
      .from("ServiceTemplate")
      .update(data)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    revalidatePath("/settings/services")
    return { success: true, data: template }
  } catch {
    return { success: false, error: "Failed to update service template" }
  }
}

export async function deleteServiceTemplate(id: string) {
  const user = await requireServerPermission("settings:edit")
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("ServiceTemplate")
      .delete()
      .eq("id", id)

    if (error) throw error

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
  const user = await requireServerPermission("patients:delete")
  try {
    const supabase = await createClient()

    // Find all prescriptions for this patient
    const { data: prescriptions } = await supabase
      .from("Prescription")
      .select("id")
      .eq("patientId", patientId)

    const prescriptionIds = (prescriptions ?? []).map((p) => p.id)

    // Delete payments and invoice items linked to prescriptions
    if (prescriptionIds.length > 0) {
      const { error: paymentsError } = await supabase
        .from("Payment")
        .delete()
        .in("prescriptionId", prescriptionIds)
      if (paymentsError) throw paymentsError

      const { error: itemsError } = await supabase
        .from("InvoiceItem")
        .delete()
        .in("prescriptionId", prescriptionIds)
      if (itemsError) throw itemsError
    }

    // Delete eye readings (linked by patientId string)
    const { error: eyeError } = await supabase
      .from("EyeReading")
      .delete()
      .eq("patientId", patientId)
    if (eyeError) throw eyeError

    // Delete prescriptions
    const { error: rxError } = await supabase
      .from("Prescription")
      .delete()
      .eq("patientId", patientId)
    if (rxError) throw rxError

    // Find linked inpatient (if any) and delete its insurance claims
    const { data: patient } = await supabase
      .from("Patient")
      .select("id")
      .eq("patientId", patientId)
      .single()

    if (patient) {
      const { data: inpatient } = await supabase
        .from("InPatient")
        .select("id")
        .eq("patientId", patient.id)
        .single()

      if (inpatient) {
        const { error: claimsError } = await supabase
          .from("InsuranceClaim")
          .delete()
          .eq("inPatientId", inpatient.id)
        if (claimsError) throw claimsError

        const { error: inpatientError } = await supabase
          .from("InPatient")
          .delete()
          .eq("id", inpatient.id)
        if (inpatientError) throw inpatientError
      }
    }

    // Delete the patient
    const { error: deleteError } = await supabase
      .from("Patient")
      .delete()
      .eq("patientId", patientId)
    if (deleteError) throw deleteError

    revalidatePath("/patients")
    revalidatePath("/inpatients")
    revalidatePath("/insurance")
    return { success: true as const }
  } catch (error) {
    console.error("Error deleting patient:", error)
    return { success: false as const, error: "Failed to delete patient" }
  }
}

// ─── Receipt Data (for print modal) ──────────────────────────────────────────

export async function getPatientReceiptData(patientId: string) {
  await requireServerPermission("patients:view")
  const supabase = await createClient()

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
    // Sort eye readings desc by createdAt, take latest
    patient.eyeReadings = (patient.eyeReadings ?? [])
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1)

    // Sort prescriptions desc by createdAt
    patient.prescriptions = (patient.prescriptions ?? [])
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  return {
    patient,
    hospital,
    prescription: patient?.prescriptions?.[0] ?? null,
    eyeReading: patient?.eyeReadings?.[0] ?? null,
  }
}

// ─── Dropdown Options (doctor name, department, referred by) ──────────────────

export async function getDropdownOptions(fieldName: string): Promise<string[]> {
  await requireServerPermission("patients:view")
  const supabase = await createClient()
  const { data: options, error } = await supabase
    .from("DropdownOption")
    .select("value")
    .eq("fieldName", fieldName)
    .order("value", { ascending: true })

  if (error || !options) return []
  return options.map((o) => o.value)
}

/**
 * Bundled fetch for the Add/Edit patient stepper. Replaces 6 separate calls
 * (hospital profile + next id + service templates + 3 dropdowns) with a single
 * server-action round-trip. The three dropdown lookups are also combined into
 * one DB query via `IN (...)`.
 *
 * Edit mode may not need `nextId`/`serviceTemplates` but the bundle is still
 * cheaper than the multi-call alternative.
 */
export async function getPatientRegistrationFormData() {
  await requireServerPermission("patients:create")
  const supabase = await createClient()

  const [hospitalCached, nextId, serviceTemplates, dropdownRes] = await Promise.all([
    getCachedHospitalProfile(),
    getNextPatientNumber(),
    getServiceTemplates(),
    supabase
      .from("DropdownOption")
      .select("fieldName, value")
      .in("fieldName", ["doctorName", "department", "referredBy", "address", "patientCategory"])
      .order("value", { ascending: true }),
  ])

  const grouped: { doctorName: string[]; department: string[]; referredBy: string[]; address: string[]; patientCategory: string[] } = {
    doctorName: [], department: [], referredBy: [], address: [], patientCategory: [],
  }
  for (const row of dropdownRes.data ?? []) {
    if (row.fieldName === "doctorName") grouped.doctorName.push(row.value)
    else if (row.fieldName === "department") grouped.department.push(row.value)
    else if (row.fieldName === "referredBy") grouped.referredBy.push(row.value)
    else if (row.fieldName === "address") grouped.address.push(row.value)
    else if (row.fieldName === "patientCategory") grouped.patientCategory.push(row.value)
  }

  return {
    hospitalProfile: hospitalCached.hospital,
    nextId,
    serviceTemplates,
    doctorOptions: grouped.doctorName,
    departmentOptions: grouped.department,
    referralOptions: grouped.referredBy,
    addressOptions: grouped.address,
    patientCategoryOptions: grouped.patientCategory,
  }
}

export async function addDropdownOption(fieldName: string, value: string) {
  const user = await requireServerPermission("patients:create")
  try {
    const supabase = await createClient()

    // Check if exists (upsert equivalent)
    const { data: existing } = await supabase
      .from("DropdownOption")
      .select("id")
      .eq("fieldName", fieldName)
      .eq("value", value)
      .single()

    if (!existing) {
      const { error } = await supabase
        .from("DropdownOption")
        .insert({ fieldName, value, createdBy: user.id })
      if (error) throw error
    }

    return { success: true }
  } catch {
    return { success: false, error: "Failed to add option" }
  }
}
