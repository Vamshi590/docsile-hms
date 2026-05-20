"use server"

import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { callGemini, type GeminiMessage } from "@/lib/ai/gemini"
import { getISTDayBounds, calculateAge } from "@/lib/utils"

// Cap conversation history sent to the model (3 user + 3 assistant pairs).
const MAX_HISTORY_TURNS = 6

// System prompt — establishes Sitha's role and tells the model exactly what
// data is in the patient context block so it answers from facts, not guesses.
const SYSTEM_PROMPT = `You are Sitha, an AI assistant for ophthalmology clinicians at this hospital.

Below in the first user message you will see a structured patient brief with these sections:
PATIENT, TODAY, DUES, OPD VISITS, REFRACTION HISTORY, LAB BILLS, IPD ADMISSIONS,
INSURANCE CLAIMS, OPTICAL ORDERS, PHARMACY. Quote numbers, dates and names
EXACTLY as they appear there.

Rules:
- Answer from the patient brief whenever the answer is there. Be specific (₹ amounts, exact dates, doctor names).
- If the brief does not contain the answer, say so plainly. Do NOT invent visits, bills, surgeries, medications, or amounts.
- Currency is Indian Rupees (₹). Dates are YYYY-MM-DD.
- For clinical advice (dosing, differentials, drug interactions), be cautious and recommend the clinician verify. You are decision support, not authority.
- Default to concise replies — short paragraphs or compact bullet lists. Skip filler disclaimers; one short caveat per session is enough.`

export type AskInput = {
  patientId: string
  question: string
  history?: GeminiMessage[]
}

export type AskOutput =
  | { ok: true; answer: string }
  | { ok: false; error: string }

export async function askSithaAI(input: AskInput): Promise<AskOutput> {
  await requireAuth()

  const question = (input.question ?? "").trim()
  if (!question) return { ok: false, error: "Empty question." }
  if (question.length > 4000) {
    return { ok: false, error: "Question is too long (max 4000 characters)." }
  }

  const context = await buildPatientContext(input.patientId)

  const trimmedHistory = (input.history ?? []).slice(-MAX_HISTORY_TURNS)

  const messages: GeminiMessage[] = [
    { role: "user", text: `PATIENT BRIEF (do not echo verbatim):\n${context}` },
    { role: "model", text: "Patient brief read. Ask anything about this patient." },
    ...trimmedHistory,
    { role: "user", text: question },
  ]

  const result = await callGemini({
    system: SYSTEM_PROMPT,
    messages,
    maxOutputTokens: 1024,
    temperature: 0.4,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, answer: result.text }
}

// ── Patient context builder ──────────────────────────────────────────────────
// Builds a structured, comprehensive brief covering visits, financials,
// refractions, lab bills, IPD, insurance, optical and pharmacy. Sized so the
// full block stays well under Flash-Lite's context window even for heavy users.
//
// PII rule: no phone, email, address, guardian phone — name + patientId only.

const VISITS_CAP = 10
const REFRACTIONS_CAP = 5
const LAB_BILLS_CAP = 10
const OPTICAL_CAP = 5
const PHARMACY_CAP = 5
const TEXT_FIELD_MAX = 220

type RxRow = {
  id: string
  prescriptionDate: string
  status: string
  doctorName: string | null
  diagnosis: string | null
  presentComplaint: string | null
  previousHistory: string | null
  medicines: string | null
  investigations: string | null
  followUpDate: string | null
  temperature: number | null
  pulseRate: number | null
  spo2: number | null
  total: number
  amountPaid: number
  balanceDue: number
  paymentMode: string | null
  createdAt: string
  items?: Array<{ description: string; amount: number; sortOrder?: number }>
  payments?: Array<{ amount: number; paymentMode: string | null; paymentDate: string | null }>
  eyeReading?: { presentPrescription: string | null; clinicalFindings: string | null } | null
}

type EyeReadingRow = {
  presentPrescription: string | null
  autoRefractometer: string | null
  readingDate: string
  createdAt: string
}

type InPatientRow = {
  id: string
  ipNumber: string
  admissionDate: string
  operationName: string | null
  operationDate: string | null
  doctorNames: string | null
  packageAmount: number
  netAmount: number
  totalReceivedAmount: number
  balanceAmount: number
  discount: number
  provisionDiagnosis: string | null
  insuranceClaims?: Array<{
    claimNumber: string
    operationName: string | null
    insuranceCompanyName: string | null
    totalBillAmount: number | null
    totalApprovedAmount: number | null
    finalSettledAmount: number | null
    patientBalance: number | null
    status: string
  }>
}

type LabBillRow = {
  billNumber: string
  total: number
  amountPaid: number
  balanceDue: number
  status: string
  createdAt: string
  items?: Array<{ name: string; amount: number }>
}

type OpticalBillRow = {
  billNumber: string
  billDate: string
  netAmount: number
  paidAmount: number
  balanceDue: number
  status: string
  lensPrescription: string | null
  deliveryDate: string | null
}

type PharmacyBillRow = {
  billNumber: string
  billDate: string
  netAmount: number
  paidAmount: number
  items?: Array<{ medicineName?: string; quantity?: number }>
}

async function buildPatientContext(humanPatientId: string): Promise<string> {
  const supabase = await createClient()

  // 1. Fetch patient + tightly-coupled records in one query.
  const { data: patientRaw, error: patientErr } = await supabase
    .from("Patient")
    .select(
      "id, patientId, firstName, lastName, age, dateOfBirth, gender, " +
      "patientType, status, appointmentDate, createdAt, doctorName, " +
      "department, referredBy, " +
      "prescriptions:Prescription(" +
        "id, prescriptionDate, status, doctorName, diagnosis, presentComplaint, " +
        "previousHistory, medicines, investigations, followUpDate, " +
        "temperature, pulseRate, spo2, total, amountPaid, balanceDue, paymentMode, createdAt, " +
        "items:InvoiceItem(description, amount, sortOrder), " +
        "payments:Payment(amount, paymentMode, paymentDate), " +
        "eyeReading:EyeReading(presentPrescription, clinicalFindings)" +
      "), " +
      "eyeReadings:EyeReading(presentPrescription, autoRefractometer, readingDate, createdAt)"
    )
    .eq("patientId", humanPatientId)
    .single()

  if (patientErr || !patientRaw) return "Patient brief unavailable."
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient = patientRaw as any

  // 2. Side queries (parallel) keyed by the human patientId / cuid.
  const [
    inpatientsRes,
    labBillsRes,
    opticalBillsRes,
    pharmacyBillsRes,
  ] = await Promise.all([
    // InPatient FK targets Patient.id (cuid), not the human patientId.
    supabase
      .from("InPatient")
      .select(
        "id, ipNumber, admissionDate, operationName, operationDate, doctorNames, " +
        "packageAmount, netAmount, totalReceivedAmount, balanceAmount, discount, " +
        "provisionDiagnosis, " +
        "insuranceClaims:InsuranceClaim(claimNumber, operationName, insuranceCompanyName, totalBillAmount, totalApprovedAmount, finalSettledAmount, patientBalance, status)"
      )
      .eq("patientId", patient.id)
      .order("admissionDate", { ascending: false }),

    supabase
      .from("LabBill")
      .select(
        "billNumber, total, amountPaid, balanceDue, status, createdAt, " +
        "items:LabBillItem(name, amount)"
      )
      .eq("patientId", humanPatientId)
      .order("createdAt", { ascending: false })
      .limit(LAB_BILLS_CAP),

    supabase
      .from("OpticalBill")
      .select("billNumber, billDate, netAmount, paidAmount, balanceDue, status, lensPrescription, deliveryDate")
      .eq("patientId", humanPatientId)
      .order("billDate", { ascending: false })
      .limit(OPTICAL_CAP),

    supabase
      .from("PharmacyBill")
      .select("billNumber, billDate, netAmount, paidAmount, items:PharmacyBillItem(medicineName, quantity)")
      .eq("patientId", humanPatientId)
      .order("billDate", { ascending: false })
      .limit(PHARMACY_CAP),
  ])

  const inpatients = (inpatientsRes.data ?? []) as unknown as InPatientRow[]
  const labBills = (labBillsRes.data ?? []) as unknown as LabBillRow[]
  const opticalBills = (opticalBillsRes.data ?? []) as unknown as OpticalBillRow[]
  const pharmacyBills = (pharmacyBillsRes.data ?? []) as unknown as PharmacyBillRow[]

  // ── Format ──────────────────────────────────────────────────────────────
  const today = todayISTBounds()
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim() || "—"
  const age = patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"
  const gender = patient.gender ?? "—"

  const sortedRx: RxRow[] = ((patient.prescriptions ?? []) as RxRow[])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const todayRx = sortedRx.find(rx => withinDay(rx.prescriptionDate, today))
  const pastRx = sortedRx.filter(rx => !todayRx || rx.id !== todayRx.id)

  const eyeReadingsAll: EyeReadingRow[] = ((patient.eyeReadings ?? []) as EyeReadingRow[])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const lines: string[] = []

  // ── PATIENT ──
  lines.push("=== PATIENT ===")
  lines.push(`Name: ${fullName}  (UID ${patient.patientId})`)
  lines.push(`Age: ${age}    Gender: ${gender}    Type: ${patient.patientType ?? "OPD"}`)
  if (patient.createdAt) {
    lines.push(`First registered: ${isoDate(patient.createdAt)}`)
  }
  const totalVisits = sortedRx.length
  lines.push(`Total recorded visits: ${totalVisits}`)
  const lastPastRx = pastRx[0]
  if (lastPastRx) {
    const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(lastPastRx.prescriptionDate).getTime()) / 86400000))
    lines.push(`Last past visit: ${isoDate(lastPastRx.prescriptionDate)} (${daysAgo} day${daysAgo === 1 ? "" : "s"} ago)`)
  }
  const upcomingFollowUp = futureFollowUp(sortedRx)
  if (upcomingFollowUp) {
    lines.push(`Next follow-up due: ${isoDate(upcomingFollowUp)}`)
  }
  if (patient.referredBy) lines.push(`Referred by: ${patient.referredBy}`)
  if (patient.department) lines.push(`Primary department: ${patient.department}`)

  // ── TODAY ──
  lines.push("")
  lines.push("=== TODAY ===")
  lines.push(`Status: ${patient.status ?? "—"}`)
  if (todayRx) {
    if (todayRx.doctorName) lines.push(`Doctor: ${todayRx.doctorName}`)
    if (todayRx.presentComplaint) lines.push(`Complaint: ${trunc(todayRx.presentComplaint, TEXT_FIELD_MAX)}`)
    if (todayRx.previousHistory) lines.push(`History: ${trunc(todayRx.previousHistory, TEXT_FIELD_MAX)}`)
    if (todayRx.diagnosis) lines.push(`Diagnosis: ${trunc(todayRx.diagnosis, TEXT_FIELD_MAX)}`)
    const vitals = formatVitals(todayRx)
    if (vitals) lines.push(`Vitals: ${vitals}`)
    const meds = parseMedicines(todayRx.medicines)
    if (meds.length) lines.push(`Current Rx: ${meds.slice(0, 10).join("; ")}`)
    const invs = parseInvestigations(todayRx.investigations)
    if (invs.length) lines.push(`Investigations ordered today: ${invs.slice(0, 8).join(", ")}`)
    if (todayRx.total > 0) {
      lines.push(`Today's bill: ₹${fmtMoney(todayRx.total)} | paid ₹${fmtMoney(todayRx.amountPaid)} | due ₹${fmtMoney(todayRx.balanceDue)}` +
        (todayRx.paymentMode ? ` (mode: ${todayRx.paymentMode})` : ""))
    }
    if (todayRx.followUpDate) lines.push(`Follow-up planned: ${isoDate(todayRx.followUpDate)}`)
  } else {
    lines.push("No consultation recorded today yet.")
  }

  // ── DUES ──
  const opdDue = sortedRx.reduce((s, r) => s + (r.balanceDue ?? 0), 0)
  const ipdDue = inpatients.reduce((s, ip) => s + (ip.balanceAmount ?? 0), 0)
  const labDue = labBills.reduce((s, l) => s + (l.balanceDue ?? 0), 0)
  const opticalDue = opticalBills.reduce((s, o) => s + (o.balanceDue ?? 0), 0)
  // PharmacyBill schema does not expose balanceDue in our query — derive.
  const pharmDue = pharmacyBills.reduce((s, p) => s + Math.max(0, (p.netAmount ?? 0) - (p.paidAmount ?? 0)), 0)
  const totalDue = opdDue + ipdDue + labDue + opticalDue + pharmDue

  lines.push("")
  lines.push("=== DUES (OUTSTANDING) ===")
  if (totalDue <= 0) {
    lines.push("No outstanding dues across any module.")
  } else {
    if (opdDue > 0) lines.push(`OPD: ₹${fmtMoney(opdDue)}`)
    if (ipdDue > 0) lines.push(`IPD: ₹${fmtMoney(ipdDue)}`)
    if (labDue > 0) lines.push(`Lab: ₹${fmtMoney(labDue)}`)
    if (opticalDue > 0) lines.push(`Optical: ₹${fmtMoney(opticalDue)}`)
    if (pharmDue > 0) lines.push(`Pharmacy: ₹${fmtMoney(pharmDue)}`)
    lines.push(`GRAND TOTAL DUE: ₹${fmtMoney(totalDue)}`)
  }

  // Lifetime billing snapshot for "what have they spent" questions.
  const opdBilled = sortedRx.reduce((s, r) => s + (r.total ?? 0), 0)
  const opdPaid = sortedRx.reduce((s, r) => s + (r.amountPaid ?? 0), 0)
  const ipdBilled = inpatients.reduce((s, ip) => s + (ip.netAmount ?? 0), 0)
  const ipdPaid = inpatients.reduce((s, ip) => s + (ip.totalReceivedAmount ?? 0), 0)
  lines.push(`Lifetime OPD: billed ₹${fmtMoney(opdBilled)} | paid ₹${fmtMoney(opdPaid)}`)
  if (inpatients.length) {
    lines.push(`Lifetime IPD: billed ₹${fmtMoney(ipdBilled)} | paid ₹${fmtMoney(ipdPaid)}`)
  }

  // Payment-mode breakdown across all OPD payments.
  const modeMap = new Map<string, number>()
  for (const rx of sortedRx) {
    for (const p of (rx.payments ?? [])) {
      if (!p.amount) continue
      const mode = (p.paymentMode ?? "Other").trim() || "Other"
      modeMap.set(mode, (modeMap.get(mode) ?? 0) + p.amount)
    }
  }
  if (modeMap.size) {
    const parts = Array.from(modeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([m, a]) => `${m} ₹${fmtMoney(a)}`)
    lines.push(`OPD payments by mode: ${parts.join(", ")}`)
  }

  // ── OPD VISITS ──
  if (sortedRx.length) {
    lines.push("")
    lines.push(`=== OPD VISITS (last ${Math.min(sortedRx.length, VISITS_CAP)}) ===`)
    for (const rx of sortedRx.slice(0, VISITS_CAP)) {
      const date = isoDate(rx.prescriptionDate)
      const doctor = rx.doctorName ? ` · Dr. ${rx.doctorName}` : ""
      const dx = rx.diagnosis ? trunc(rx.diagnosis, 140) : "—"
      const meds = parseMedicines(rx.medicines).slice(0, 6)
      const invs = parseInvestigations(rx.investigations).slice(0, 6)
      const items = (rx.items ?? []).slice(0, 6).map(it => it.description).filter(Boolean)
      const bill = rx.total > 0
        ? ` · Bill ₹${fmtMoney(rx.total)} (paid ₹${fmtMoney(rx.amountPaid)}, due ₹${fmtMoney(rx.balanceDue)})`
        : ""
      const follow = rx.followUpDate ? ` · Follow-up ${isoDate(rx.followUpDate)}` : ""
      lines.push(`[${date}]${doctor}: ${dx}${bill}${follow}`)
      if (rx.presentComplaint) lines.push(`    Complaint: ${trunc(rx.presentComplaint, 140)}`)
      if (meds.length)         lines.push(`    Meds: ${meds.join("; ")}`)
      if (invs.length)         lines.push(`    Investigations: ${invs.join(", ")}`)
      if (items.length)        lines.push(`    Services: ${items.join(", ")}`)
    }
    if (sortedRx.length > VISITS_CAP) {
      lines.push(`  …and ${sortedRx.length - VISITS_CAP} older visit(s) not shown.`)
    }
  }

  // ── REFRACTION HISTORY ──
  const refractionLines = eyeReadingsAll
    .map(er => {
      const ref = er.presentPrescription ? summariseRefraction(er.presentPrescription) : null
      return ref ? { date: isoDate(er.readingDate), summary: ref } : null
    })
    .filter((x): x is { date: string; summary: string } => x !== null)
    .slice(0, REFRACTIONS_CAP)

  if (refractionLines.length) {
    lines.push("")
    lines.push(`=== REFRACTION HISTORY (last ${refractionLines.length}) ===`)
    for (const r of refractionLines) lines.push(`[${r.date}] ${r.summary}`)
  }

  // ── LAB BILLS ──
  if (labBills.length) {
    lines.push("")
    lines.push(`=== LAB BILLS (last ${labBills.length}) ===`)
    for (const lb of labBills) {
      const items = (lb.items ?? []).map(i => i.name).filter(Boolean).slice(0, 6)
      lines.push(`[${isoDate(lb.createdAt)}] ${lb.billNumber} · ₹${fmtMoney(lb.total)} (paid ₹${fmtMoney(lb.amountPaid)}, due ₹${fmtMoney(lb.balanceDue)}) · ${lb.status}`)
      if (items.length) lines.push(`    Tests: ${items.join(", ")}`)
    }
  }

  // ── IPD ──
  if (inpatients.length) {
    lines.push("")
    lines.push(`=== IPD ADMISSIONS (${inpatients.length}) ===`)
    for (const ip of inpatients) {
      const doctors = parseDoctorNames(ip.doctorNames)
      const opLine = ip.operationName
        ? `${ip.operationName}${ip.operationDate ? ` on ${isoDate(ip.operationDate)}` : ""}`
        : "Admitted"
      lines.push(`[${isoDate(ip.admissionDate)}] ${ip.ipNumber} · ${opLine}${doctors.length ? ` · Dr. ${doctors.join(", Dr. ")}` : ""}`)
      lines.push(`    Net ₹${fmtMoney(ip.netAmount)} | received ₹${fmtMoney(ip.totalReceivedAmount)} | balance ₹${fmtMoney(ip.balanceAmount)}`)
      if (ip.provisionDiagnosis) lines.push(`    Provisional dx: ${trunc(ip.provisionDiagnosis, 140)}`)
      const claims = ip.insuranceClaims ?? []
      if (claims.length) {
        for (const c of claims) {
          const company = c.insuranceCompanyName ? ` (${c.insuranceCompanyName})` : ""
          const billed = c.totalBillAmount ?? 0
          const approved = c.totalApprovedAmount ?? 0
          const settled = c.finalSettledAmount ?? 0
          const balance = c.patientBalance ?? 0
          lines.push(`    Insurance ${c.claimNumber}${company}: billed ₹${fmtMoney(billed)} · approved ₹${fmtMoney(approved)} · settled ₹${fmtMoney(settled)} · patient balance ₹${fmtMoney(balance)} · ${c.status}`)
        }
      }
    }
  }

  // ── OPTICAL ──
  if (opticalBills.length) {
    lines.push("")
    lines.push(`=== OPTICAL ORDERS (last ${opticalBills.length}) ===`)
    for (const ob of opticalBills) {
      const lens = ob.lensPrescription ? summariseRefraction(ob.lensPrescription) : null
      const delivery = ob.deliveryDate ? ` · delivery ${isoDate(ob.deliveryDate)}` : ""
      lines.push(`[${isoDate(ob.billDate)}] ${ob.billNumber} · ₹${fmtMoney(ob.netAmount)} (paid ₹${fmtMoney(ob.paidAmount)}, due ₹${fmtMoney(ob.balanceDue)}) · ${ob.status}${delivery}`)
      if (lens) lines.push(`    Lens Rx: ${lens}`)
    }
  }

  // ── PHARMACY ──
  if (pharmacyBills.length) {
    lines.push("")
    lines.push(`=== PHARMACY (last ${pharmacyBills.length}) ===`)
    for (const pb of pharmacyBills) {
      const items = (pb.items ?? [])
        .map(i => {
          const n = (i.medicineName ?? "").trim()
          if (!n) return ""
          return i.quantity && i.quantity > 1 ? `${n} × ${i.quantity}` : n
        })
        .filter(Boolean)
        .slice(0, 6)
      lines.push(`[${isoDate(pb.billDate)}] ${pb.billNumber} · ₹${fmtMoney(pb.netAmount)} paid ₹${fmtMoney(pb.paidAmount)}`)
      if (items.length) lines.push(`    Items: ${items.join(", ")}`)
    }
  }

  return lines.join("\n")
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayISTBounds() {
  const { start, end } = getISTDayBounds()
  return { startMs: start.getTime(), endMs: end.getTime() }
}
function withinDay(dateStr: string, bounds: { startMs: number; endMs: number }) {
  const t = new Date(dateStr).getTime()
  return t >= bounds.startMs && t <= bounds.endMs
}
function isoDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "—"
  return d.toISOString().slice(0, 10)
}
function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return Math.round(n).toLocaleString("en-IN")
}
function trunc(s: string, max: number): string {
  if (!s) return ""
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}
function formatVitals(rx: { temperature: number | null; pulseRate: number | null; spo2: number | null }): string | null {
  const parts: string[] = []
  if (rx.temperature != null) parts.push(`Temp ${rx.temperature}°F`)
  if (rx.pulseRate != null) parts.push(`Pulse ${rx.pulseRate} bpm`)
  if (rx.spo2 != null) parts.push(`SpO₂ ${rx.spo2}%`)
  return parts.length ? parts.join(" · ") : null
}
function parseMedicines(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json) as Array<{ name?: string; days?: string; timing?: string }>
    return arr.map(m => {
      const name = (m?.name ?? "").trim()
      if (!name) return ""
      const timing = (m?.timing ?? "").trim()
      const days = (m?.days ?? "").trim()
      const suffix = [timing, days ? `× ${days}` : ""].filter(Boolean).join(" ")
      return suffix ? `${name} (${suffix})` : name
    }).filter(Boolean)
  } catch { return [] }
}
function parseInvestigations(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json) as Array<{ name?: string }>
    return arr.map(i => (i?.name ?? "").trim()).filter(Boolean)
  } catch { return [] }
}
function parseDoctorNames(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json) as string[]
    return arr.filter(Boolean)
  } catch { return [] }
}
function summariseRefraction(json: string): string | null {
  try {
    const sr = JSON.parse(json) as {
      re?: { sph?: string; cyl?: string; axis?: string; add?: string; va?: string }
      le?: { sph?: string; cyl?: string; axis?: string; add?: string; va?: string }
      sightType?: string
      d?: unknown
    }
    const fmt = (e?: { sph?: string; cyl?: string; axis?: string; add?: string; va?: string }) => {
      if (!e) return "—"
      let s = `${e.sph || "PL"} / ${e.cyl || "DS"} × ${e.axis || "0"}`
      if (e.add) s += ` add ${e.add}`
      if (e.va) s += ` VA ${e.va}`
      return s
    }
    let out = `RE ${fmt(sr.re)} | LE ${fmt(sr.le)}`
    if (sr.sightType) out += ` | type ${sr.sightType}`
    return out
  } catch { return null }
}
function futureFollowUp(rxs: RxRow[]): string | null {
  const today = Date.now()
  // First future-dated follow-up, sorted ascending.
  const upcoming = rxs
    .map(r => r.followUpDate ? new Date(r.followUpDate).getTime() : null)
    .filter((t): t is number => t !== null && t >= today)
    .sort((a, b) => a - b)
  if (!upcoming.length) return null
  return new Date(upcoming[0]).toISOString()
}
