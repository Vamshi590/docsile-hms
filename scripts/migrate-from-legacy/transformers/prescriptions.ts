import { SupabaseClient } from "@supabase/supabase-js"
import { config } from "../config"
import { Lookups } from "../lookups"
import {
  info,
  insertInBatches,
  logError,
  newId,
  normalizeUsername,
  parseDate,
  parseFloatOrNull,
  parseIntOrNull,
  trimOrNull,
} from "../utils"

/** Extracts a {re, le} block from columns like `${prefix}-RE-${field}` */
function eyeBlock(r: any, prefix: string, fields: { src: string; out: string }[]): { re: any; le: any } | null {
  const re: any = {}
  const le: any = {}
  let any = false
  for (const f of fields) {
    const rv = trimOrNull(r[`${prefix}-RE-${f.src}`])
    const lv = trimOrNull(r[`${prefix}-LE-${f.src}`])
    if (rv) {
      re[f.out] = rv
      any = true
    }
    if (lv) {
      le[f.out] = lv
      any = true
    }
  }
  return any ? { re, le } : null
}

/** Extracts a {re: {d, n}, le: {d, n}} glasses-style block. */
function eyeDnBlock(r: any, prefix: string): any | null {
  const result: any = {}
  let any = false
  for (const side of ["re", "le"] as const) {
    const SIDE = side.toUpperCase()
    const distance: any = {}
    const near: any = {}
    for (const part of ["SPH", "CYL", "AXIS"]) {
      const dv = trimOrNull(r[`${prefix}-${SIDE}-D-${part}`])
      const nv = trimOrNull(r[`${prefix}-${SIDE}-N-${part}`])
      if (dv) {
        distance[part.toLowerCase()] = dv
        any = true
      }
      if (nv) {
        near[part.toLowerCase()] = nv
        any = true
      }
    }
    const dvision =
      trimOrNull(r[`${prefix}-${SIDE}-D-VISION`]) ?? trimOrNull(r[`${prefix}-${SIDE}-D-VA`]) ?? trimOrNull(r[`${prefix}-${SIDE}-D-BCVA`])
    const nvision =
      trimOrNull(r[`${prefix}-${SIDE}-N-VISION`]) ?? trimOrNull(r[`${prefix}-${SIDE}-N-VA`]) ?? trimOrNull(r[`${prefix}-${SIDE}-N-BCVA`])
    if (dvision) {
      distance.vision = dvision
      any = true
    }
    if (nvision) {
      near.vision = nvision
      any = true
    }
    if (Object.keys(distance).length) result[`${side}_distance`] = distance
    if (Object.keys(near).length) result[`${side}_near`] = near
  }
  return any ? result : null
}

function buildMedicines(r: any): { name: string; days: string | null; timing: string | null }[] {
  const out: { name: string; days: string | null; timing: string | null }[] = []
  for (let i = 1; i <= 15; i++) {
    const name = trimOrNull(r[`PRESCRIPTION ${i}`])
    if (!name) continue
    out.push({
      name,
      days: trimOrNull(r[`DAYS ${i}`]),
      timing: trimOrNull(r[`TIMING ${i}`]),
    })
  }
  return out
}

function buildAdvices(r: any): string[] {
  const out: string[] = []
  for (let i = 1; i <= 15; i++) {
    const a = trimOrNull(r[`ADVICE ${i}`])
    if (a) out.push(a)
  }
  return out
}

function normalizePaidFor(s: string | null | undefined): string {
  if (!s) return "Consultation"
  const t = s.trim()
  const upper = t.toUpperCase()
  if (upper === "FOC") return "FOC"
  if (upper === "OP CONSULTATION") return "OP Consultation"
  if (upper.includes("AROGYA")) return "Arogya Sri"
  if (upper.includes("YAG") || upper.includes("LAZER") || upper.includes("LASER")) return "Laser Procedure"
  return t
}

export async function migratePrescriptions(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== prescriptions → Prescription + InvoiceItem + EyeReading ===")

  let from = 0
  const PAGE = 500
  const prescriptions: any[] = []
  const items: any[] = []
  const readings: any[] = []
  const seenRxNum = new Map<string, number>() // base → next suffix

  while (true) {
    const { data, error } = await source
      .from("prescriptions")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Read prescriptions: ${error.message}`)
    if (!data || data.length === 0) break

    for (const r of data) {
      const patientIdText = trimOrNull(r.patientId) ?? trimOrNull(r["PATIENT ID"])
      if (!patientIdText) {
        logError("prescriptions", r.id, "no patientId")
        continue
      }
      // Prescription.patient relation references Patient.patientId (text), not Patient.id
      // So we use the legacy patientId text directly
      if (!lookups.patientById.has(patientIdText)) {
        logError("prescriptions", r.id, `unknown patientId ${patientIdText}`)
        continue
      }

      const presId = newId()
      const doctorUsername = normalizeUsername(r["CREATED BY"])
      const doctorId = lookups.userByUsername.get(doctorUsername) ?? null
      const date = parseDate(r.DATE) ?? parseDate(r["CREATED AT"]) ?? new Date().toISOString()

      const total = parseFloatOrNull(r["TOTAL AMOUNT"]) ?? 0
      const received = parseFloatOrNull(r["AMOUNT RECEIVED"]) ?? 0
      const due = parseFloatOrNull(r["AMOUNT DUE"]) ?? Math.max(0, total - received)
      const discount = parseFloatOrNull(r["DISCOUNT AMOUNT"]) ?? 0

      const medicines = buildMedicines(r)
      const advices = buildAdvices(r) // ADVICE 1..15 — these are investigations per legacy convention
      const investigationsJson = JSON.stringify(advices.map((a) => ({ name: a })))
      const additionalNotes = trimOrNull(r.NOTES)

      // Lookup map for labs
      const dateKey = date.slice(0, 10)
      lookups.prescriptionByPatientDate.set(`${patientIdText}::${dateKey}`, presId)

      // Dedupe prescriptionNumber — legacy has duplicate RECEIPT NO values
      const rawRx = trimOrNull(r["RECEIPT NO"]) ?? `R-MIG-${presId.slice(0, 8)}`
      const dupCount = seenRxNum.get(rawRx) ?? 0
      const prescriptionNumber = dupCount === 0 ? rawRx : `${rawRx}-${dupCount + 1}`
      seenRxNum.set(rawRx, dupCount + 1)

      prescriptions.push({
        id: presId,
        prescriptionNumber,
        patientId: patientIdText,
        patientType: "OPD",
        doctorId,
        doctorName: trimOrNull(r["DOCTOR NAME"]),
        department: trimOrNull(r.DEPARTMENT),
        temperature: parseFloatOrNull(r.TEMPARATURE),
        pulseRate: parseIntOrNull(r["P.R."]),
        spo2: parseIntOrNull(r.SPO2),
        presentComplaint: trimOrNull(r["PRESENT COMPLAIN"]),
        previousHistory: trimOrNull(r["PREVIOUS HISTORY"]),
        diagnosis: [trimOrNull(r.OTHERS), trimOrNull(r.OTHERS1)].filter(Boolean).join("; ") || null,
        additionalNotes,
        medicines: JSON.stringify(medicines),
        investigations: investigationsJson,
        followUpDate: parseDate(r["FOLLOW UP DATE"]),
        notes: trimOrNull(r["NOTES"]),
        subtotal: total,
        discount,
        total,
        amountPaid: received,
        balanceDue: due,
        paymentMode: trimOrNull(r.MODE),
        paymentDate: received > 0 ? date : null,
        status: "COMPLETED",
        prescriptionDate: date,
        createdBy: doctorId ?? lookups.defaultUserId ?? "system",
        updatedBy: lookups.userByUsername.get(normalizeUsername(r["UPDATED BY"])) ?? null,
        createdAt: parseDate(r["CREATED AT"]) ?? date,
        updatedAt: parseDate(r["UPDATED AT"]) ?? date,
      })

      // One InvoiceItem for PAID FOR
      items.push({
        id: newId(),
        prescriptionId: presId,
        description: normalizePaidFor(r["PAID FOR"]),
        category: "Consultation",
        quantity: 1,
        unitPrice: total,
        amount: total,
        sortOrder: 0,
      })

      // EyeReading if any eye data present
      const ar = eyeBlock(r, "AR", [
        { src: "SPH", out: "sph" },
        { src: "CYL", out: "cyl" },
        { src: "AXIS", out: "axis" },
        { src: "VA", out: "va" },
        { src: "VAC.P.H", out: "vacph" },
      ])
      const glasses = eyeDnBlock(r, "GR")
      const previousPgp = eyeDnBlock(r, "PGP")
      const presentSr = eyeDnBlock(r, "SR")
      const clinicalRe: any = {}
      const clinicalLe: any = {}
      const cfFields = [
        ["LIDS", "lids"],
        ["CONJUCTIVA", "conjunctiva"],
        ["CORNEA", "cornea"],
        ["A.C.", "ac"],
        ["IRIS", "iris"],
        ["PUPIL", "pupil"],
        ["LENS", "lens"],
        ["SAC", "sac"],
        ["TENSION", "tension"],
        ["FUNDUS", "fundus"],
        ["MACULA", "macula"],
        ["OPTICALDISK", "opticalDisk"],
        ["VESSELS", "vessels"],
        ["PERIPHERALRETINA", "peripheralRetina"],
      ] as const
      for (const [src, out] of cfFields) {
        const rv = trimOrNull(r[`CF-RE-${src}`])
        const lv = trimOrNull(r[`CF-LE-${src}`])
        if (rv) clinicalRe[out] = rv
        if (lv) clinicalLe[out] = lv
      }
      const pdeFields = [
        ["OPTIC DISK", "opticDisk"],
        ["OPTIC MACULA", "macula"],
        ["OPTIC BLOOD VESSELS", "bloodVessels"],
        ["PR", "pr"],
      ] as const
      const pdeRe: any = {}
      const pdeLe: any = {}
      for (const [src, out] of pdeFields) {
        const rv = trimOrNull(r[`PDE-RE-${src}`])
        const lv = trimOrNull(r[`PDE-LE-${src}`])
        if (rv) pdeRe[out] = rv
        if (lv) pdeLe[out] = lv
      }

      const hasEyeData =
        ar ||
        glasses ||
        previousPgp ||
        presentSr ||
        Object.keys(clinicalRe).length ||
        Object.keys(clinicalLe).length ||
        Object.keys(pdeRe).length ||
        Object.keys(pdeLe).length

      if (hasEyeData) {
        readings.push({
          id: newId(),
          patientId: patientIdText,
          prescriptionId: presId,
          autoRefractometer: ar ? JSON.stringify(ar) : null,
          glassesReading: glasses ? JSON.stringify({ ...glasses, pd: trimOrNull(r.PD), sightType: trimOrNull(r.SIGHTTYPE) }) : null,
          previousPrescription: previousPgp ? JSON.stringify(previousPgp) : null,
          presentPrescription: presentSr ? JSON.stringify(presentSr) : null,
          clinicalFindings:
            Object.keys(clinicalRe).length || Object.keys(clinicalLe).length || Object.keys(pdeRe).length || Object.keys(pdeLe).length
              ? JSON.stringify({ re: clinicalRe, le: clinicalLe, pde: { re: pdeRe, le: pdeLe } })
              : null,
          readingDate: date,
          status: "COMPLETED",
          createdById: doctorId,
          createdAt: date,
          updatedAt: date,
        })
      }
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  info(`  transformed ${prescriptions.length} Prescriptions + ${items.length} items + ${readings.length} eye readings`)
  if (config.dryRun) {
    console.log(JSON.stringify(prescriptions[0], null, 2))
    return
  }
  await insertInBatches(target, "Prescription", prescriptions)
  await insertInBatches(target, "InvoiceItem", items)
  await insertInBatches(target, "EyeReading", readings)
  info(`  ✓ inserted`)
}
