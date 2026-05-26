"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getNextLabBillNumber(): Promise<string> {
  const supabase = await createClient()
  const today = new Date()
  const prefix = `LB-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
  const { data: last } = await supabase
    .from("LabBill")
    .select("billNumber")
    .like("billNumber", `${prefix}%`)
    .order("billNumber", { ascending: false })
    .limit(1)
    .single()
  if (!last) return `${prefix}-0001`
  const lastNum = parseInt(last.billNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
}

// ─── Lab CRUD ────────────────────────────────────────────────────────────────

export async function getLabs() {
  await requireServerPermission("labs:view")
  const supabase = await createClient()
  const { data: labs, error } = await supabase
    .from("Lab")
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error

  // Get active investigation counts per lab
  const labsWithCounts = await Promise.all(
    (labs ?? []).map(async (lab) => {
      const { count } = await supabase
        .from("LabInvestigation")
        .select("*", { count: "exact", head: true })
        .eq("labId", lab.id)
        .eq("isActive", true)
      return { ...lab, _count: { investigations: count ?? 0 } }
    })
  )

  return labsWithCounts
}

export async function getLabById(id: string) {
  await requireServerPermission("labs:view")
  const supabase = await createClient()
  const { data: lab, error } = await supabase
    .from("Lab")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !lab) return null

  const { data: investigations } = await supabase
    .from("LabInvestigation")
    .select("*, investigation:InvestigationMaster(*)")
    .eq("labId", id)
    .eq("isActive", true)
    .order("investigation(name)", { ascending: true })

  return { ...lab, investigations: investigations ?? [] }
}

export async function createLab(data: { name: string; description?: string; location?: string; printHeaderKey?: string }) {
  await requireServerPermission("labs:config")
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: lab, error } = await supabase
      .from("Lab")
      .insert({
        name: data.name,
        description: data.description ?? null,
        location: data.location ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error

    // Apply printHeaderKey separately — column added via migration; skip silently if not yet migrated
    if (data.printHeaderKey && lab) {
      await supabase
        .from("Lab")
        .update({ printHeaderKey: data.printHeaderKey, updatedAt: new Date().toISOString() })
        .eq("id", lab.id)
    }

    revalidatePath("/labs")
    return { success: true as const, data: lab }
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes("Unique")
      ? "A lab with this name already exists"
      : "Failed to create lab"
    return { success: false as const, error: msg }
  }
}

export async function updateLab(id: string, data: { name?: string; description?: string; location?: string; isActive?: boolean; printHeaderKey?: string | null }) {
  await requireServerPermission("labs:config")
  try {
    const supabase = await createClient()
    const { data: lab, error } = await supabase
      .from("Lab")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    revalidatePath("/labs")
    return { success: true as const, data: lab }
  } catch {
    return { success: false as const, error: "Failed to update lab" }
  }
}

export async function deleteLab(id: string) {
  await requireServerPermission("labs:config")
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("Lab")
      .delete()
      .eq("id", id)
    if (error) throw error
    revalidatePath("/labs")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Cannot delete lab with existing bills. Deactivate it instead." }
  }
}

// ─── Lab Investigation Mapping ───────────────────────────────────────────────

export async function getLabInvestigations(labId: string) {
  await requireServerPermission("labs:view")
  const supabase = await createClient()
  const { data } = await supabase
    .from("LabInvestigation")
    .select("*, investigation:InvestigationMaster(*)")
    .eq("labId", labId)
    .eq("isActive", true)
    .order("investigation(name)", { ascending: true })
  return data ?? []
}

export async function getAllInvestigations() {
  await requireServerPermission("labs:view")
  const supabase = await createClient()
  const { data } = await supabase
    .from("InvestigationMaster")
    .select("*")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true })
  return data ?? []
}

export async function createInvestigation(data: { name: string; category?: string; description?: string }) {
  const user = await requireServerPermission("labs:config")
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: inv, error } = await supabase
      .from("InvestigationMaster")
      .insert({
        name: data.name,
        category: data.category ?? null,
        description: data.description ?? null,
        isActive: true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (error) throw error
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
  await requireServerPermission("labs:config")
  try {
    const supabase = await createClient()

    // Remove existing mappings for this lab
    await supabase
      .from("LabInvestigation")
      .delete()
      .eq("labId", labId)

    // Create new mappings
    if (investigations.length > 0) {
      const { error } = await supabase
        .from("LabInvestigation")
        .insert(
          investigations.map((inv) => ({
            labId,
            investigationId: inv.investigationId,
            amount: inv.amount,
            isDefault: inv.isDefault,
            isActive: true,
          }))
        )
      if (error) throw error
    }

    revalidatePath("/labs")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update lab investigations" }
  }
}

// ─── Lab Billing - Patient Investigation Lookup ──────────────────────────────

export async function getPatientInvestigations(patientId: string) {
  await requireServerPermission("labs:view")
  const supabase = await createClient()

  // Find patient
  const { data: patient } = await supabase
    .from("Patient")
    .select("id, patientId, firstName, lastName, age, gender, phone, doctorName")
    .eq("patientId", patientId)
    .single()

  if (!patient) return { success: false as const, error: "Patient not found" }

  // Find latest prescription with investigations
  const { data: prescriptions } = await supabase
    .from("Prescription")
    .select("id, prescriptionNumber, investigations, doctorName, prescriptionDate")
    .eq("patientId", patient.patientId)
    .in("status", ["COMPLETED", "DRAFT"])
    .neq("investigations", "[]")
    .order("prescriptionDate", { ascending: false })
    .limit(1)

  const prescription = prescriptions?.[0]
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
  const { data: investigationMasters } = await supabase
    .from("InvestigationMaster")
    .select("id, name")
    .in("name", investigationNames)
    .eq("isActive", true)

  const masterList = investigationMasters ?? []
  const masterMap = new Map(masterList.map((m) => [m.name, m.id]))

  // Get all lab-investigation mappings for these investigations
  const masterIds = masterList.map((m) => m.id)

  // Fetch lab-investigation mappings with lab and investigation details
  const { data: labMappingsRaw } = await supabase
    .from("LabInvestigation")
    .select("*, lab:Lab(*), investigation:InvestigationMaster(*)")
    .in("investigationId", masterIds.length > 0 ? masterIds : ["__none__"])
    .eq("isActive", true)

  // Filter out mappings where the lab is not active
  const labMappings = (labMappingsRaw ?? []).filter((m) => m.lab?.isActive === true)

  // Check for existing lab bills for this prescription
  const { data: existingBillsRaw } = await supabase
    .from("LabBill")
    .select("*, lab:Lab(*), items:LabBillItem(*)")
    .eq("prescriptionId", prescription.id)
    .neq("status", "CANCELLED")

  const existingBills = existingBillsRaw ?? []

  const billedInvestigationNames = new Set(
    existingBills.flatMap((b) => (b.items ?? []).map((item: { name: string }) => item.name))
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
      items: [] as { investigationId: string; name: string; amount: number }[],
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
        items: (b.items ?? []).map((i: { name: string }) => i.name),
      })),
    },
  }
}

// ─── Pending Lab Investigations (patients with unprocessed investigations) ────

export async function getPendingLabInvestigations(date?: string) {
  await requireServerPermission("labs:view")
  const supabase = await createClient()

  // Build IST day bounds for the given date (default today)
  const target = date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  const start = new Date(`${target}T00:00:00+05:30`).toISOString()
  const end   = new Date(`${target}T23:59:59+05:30`).toISOString()

  // Fetch prescriptions from the target day that have investigations written
  const { data: prescriptions } = await supabase
    .from("Prescription")
    .select(`
      id, prescriptionNumber, doctorName, investigations, prescriptionDate,
      patient:Patient(id, patientId, firstName, lastName, age, gender, phone)
    `)
    .gte("prescriptionDate", start)
    .lte("prescriptionDate", end)
    .neq("investigations", "[]")
    .not("investigations", "is", null)
    .order("prescriptionDate", { ascending: false })

  if (!prescriptions || prescriptions.length === 0) return []

  // Keep only prescriptions that parse to a non-empty investigations array
  const valid = prescriptions.filter((p) => {
    try {
      const arr = JSON.parse(p.investigations)
      return Array.isArray(arr) && arr.length > 0
    } catch { return false }
  })

  if (valid.length === 0) return []

  // Fetch existing lab bills for these prescriptions in one query
  const prescriptionIds = valid.map((p) => p.id)
  const { data: existingBills } = await supabase
    .from("LabBill")
    .select("prescriptionId, status")
    .in("prescriptionId", prescriptionIds)

  // Group bill statuses by prescriptionId
  const billsByPrescription = new Map<string, string[]>()
  for (const b of (existingBills ?? [])) {
    const list = billsByPrescription.get(b.prescriptionId) ?? []
    list.push(b.status)
    billsByPrescription.set(b.prescriptionId, list)
  }

  return valid.flatMap((p) => {
    const patient = p.patient as unknown as { patientId: string; firstName: string; lastName: string | null; age: number | null; gender: string; phone: string }
    let investigationCount = 0
    try {
      investigationCount = JSON.parse(p.investigations).length
    } catch { /* ignore */ }

    const billStatuses = billsByPrescription.get(p.id) ?? []
    const billed = billStatuses.length > 0 && !billStatuses.includes("PENDING") && !billStatuses.includes("PARTIAL")

    // Exclude fully-billed prescriptions from the pending list
    if (billed) return []

    return [{
      prescriptionId: p.id,
      prescriptionNumber: p.prescriptionNumber as string | null,
      doctorName: p.doctorName as string | null,
      investigationCount,
      patientId: patient.patientId,
      patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      billCount: billStatuses.length,
    }]
  })
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
  const user = await requireServerPermission("labs:create")
  try {
    const supabase = await createClient()
    const createdBills: { id: string; billNumber: string; labName: string; total: number }[] = []

    for (const bill of data.bills) {
      const billNumber = await getNextLabBillNumber()
      const subtotal = bill.items.reduce((sum, item) => sum + item.amount, 0)
      const total = subtotal - bill.discount
      const balanceDue = total - bill.amountPaid
      const now = new Date().toISOString()

      const { data: labBill, error: billError } = await supabase
        .from("LabBill")
        .insert({
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
          paymentDate: bill.amountPaid > 0 ? now : null,
          status: balanceDue <= 0 ? "PAID" : bill.amountPaid > 0 ? "PARTIAL" : "PENDING",
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .select("*, lab:Lab(*)")
        .single()

      if (billError) throw billError

      // Create bill items
      const { error: itemsError } = await supabase
        .from("LabBillItem")
        .insert(
          bill.items.map((item, i) => ({
            labBillId: labBill.id,
            investigationId: item.investigationId,
            name: item.name,
            amount: item.amount,
            sortOrder: i,
          }))
        )
      if (itemsError) throw itemsError

      if (bill.amountPaid > 0) {
        const { error: payError } = await supabase
          .from("LabPayment")
          .insert({
            labBillId: labBill.id,
            amount: bill.amountPaid,
            paymentMode: bill.paymentMode,
            receivedBy: user.id,
          })
        if (payError) throw payError
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
  await requireServerPermission("labs:view")
  const supabase = await createClient()
  let query = supabase
    .from("LabBill")
    .select("*, lab:Lab(name, printHeaderKey), patient:Patient(id, patientId, firstName, lastName, phone, age, gender, address), items:LabBillItem(*), payments:LabPayment(*)")
    .order("createdAt", { ascending: false })
    .limit(100)

  if (filters.dateFrom) {
    query = query.gte("createdAt", new Date(filters.dateFrom + "T00:00:00").toISOString())
  }
  if (filters.dateTo) {
    query = query.lte("createdAt", new Date(filters.dateTo + "T23:59:59").toISOString())
  }
  if (filters.labId) query = query.eq("labId", filters.labId)
  if (filters.patientId) query = query.eq("patientId", filters.patientId)
  if (filters.status) query = query.eq("status", filters.status)

  const { data: bills } = await query

  // Sort nested items and payments client-side
  return (bills ?? []).map((bill) => ({
    ...bill,
    items: (bill.items ?? []).sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder),
    payments: (bill.payments ?? []).sort((a: { paymentDate: string }, b: { paymentDate: string }) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    ),
  }))
}

export async function getLabBillById(id: string) {
  await requireServerPermission("labs:view")
  const supabase = await createClient()
  const { data: bill } = await supabase
    .from("LabBill")
    .select("*, lab:Lab(*), patient:Patient(*), prescription:Prescription(prescriptionNumber, doctorName), items:LabBillItem(*), payments:LabPayment(*)")
    .eq("id", id)
    .single()

  if (!bill) return null

  // Sort nested items and payments client-side
  return {
    ...bill,
    items: (bill.items ?? []).sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder),
    payments: (bill.payments ?? []).sort((a: { paymentDate: string }, b: { paymentDate: string }) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    ),
  }
}
