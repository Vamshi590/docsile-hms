"use server"

import { requireServerPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { callGemini, type GeminiMessage } from "@/lib/ai/gemini"
import { getISTDayBounds, calculateAge } from "@/lib/utils"
import {
  getAnalyticsOverview, getTimeSeries, getTopServices,
  getDoctorPerformance, getExpenseBreakdown, getFinancialSummary,
  getGenderDistribution, getAgeDistribution, getStatusDistribution,
  getReferralStats,
} from "@/app/(hospital)/analytics/actions"

// Cap conversation history sent to the model (3 user + 3 assistant pairs).
const MAX_HISTORY_TURNS = 6

// System prompt — establishes Sitha's role and tells the model exactly what
// data is in the patient context block so it answers from facts, not guesses.
const SYSTEM_PROMPT = `You are Sitha, an AI assistant for ophthalmology clinicians at this hospital.

The first user message in this conversation contains a "PATIENT BRIEF". One of three things will be true:
1. A patient is locked in — the brief begins with "=== PATIENT ===" and contains real data. Use it.
2. No patient identifier was provided yet — the brief is a short note starting with "(NO PATIENT)". In this case, ask the user politely for the patient's UID (e.g. P-0005) or 10-digit phone number, then they can re-send the question.
3. The user's identifier matched no record — the brief starts with "(NOT FOUND)". Tell the user no patient matches and ask them to recheck the ID or phone.

Output format (IMPORTANT — your reply is rendered as markdown):
- Default to short paragraphs or compact bullet lists ("- item"). Avoid walls of text.
- For multi-fact answers, use bullets — one fact per line.
- For grouped answers (e.g. "dues by source"), use a short bold label then the value: "**Cash:** ₹2,500".
- Use "## Section" headings only when the answer naturally splits into two or more topics.
- Quote numbers, dates, names and IDs EXACTLY as they appear in the brief.
- Currency is ₹ (Indian Rupees). Dates are YYYY-MM-DD.
- Keep replies tight — 3–6 bullets or 2–3 short paragraphs is usually right. No filler.

Accuracy rules:
- Answer from the brief whenever the data is there. Be specific (amounts, dates, doctor names).
- If the brief does NOT contain the answer, say so plainly. Do NOT invent visits, bills, surgeries, medications or amounts.
- For clinical advice (dosing, differentials, drug interactions), be cautious and recommend the clinician verify. You are decision support, not authority.
- Skip filler disclaimers; one short caveat per session is enough.`

// Analytics system prompt — hospital-level data advisor.
const ANALYTICS_SYSTEM_PROMPT = `You are Sitha, an AI analytics advisor for a hospital's management team.

The first user message contains a "HOSPITAL ANALYTICS BRIEF" with real, live data pulled from the hospital's database — patients, revenue, collections, dues, expenses, doctor performance, services, and more.

Your role:
- Answer any question about hospital performance, revenue, operations, or patient trends using ONLY the data in the brief.
- Calculate rates, ratios, and comparisons on-the-fly (e.g. "collection rate = collected / billed × 100").
- Give concrete, data-driven recommendations when asked how to improve (e.g. "your collection rate is 61% — here are three ways to close the gap").
- Flag anomalies you notice even if not asked — high dues, low-performing days, expense spikes.

When asked for a FINANCIAL HEALTH REPORT or FINANCIAL SUMMARY, always cover ALL of the following in order, using the exact section structure the user requested:
1. Revenue & Collections — total billed, collected, collection rate %, net cash flow; category breakdown (Consultations/Labs/Pharmacy/Optical/IPD) with ₹ and % of total.
2. Outstanding Dues — by module (OPD/IPD/Lab/Optical/Pharmacy) and grand total; flag the module with highest outstanding.
3. Expense Health — total expenses, top categories, expense-to-revenue ratio (expenses ÷ billed × 100); assess if healthy (<30% is good, 30–50% needs attention, >50% is concerning).
4. Performance Highlights — top doctor (patients + revenue), top service (revenue + count), weakest category.
5. Financial Health Score & Improvement Plan — score the overall health as Good / Needs Attention / Critical based on: collection rate (>85% = good, 70–85% = attention, <70% = critical), expense ratio, and dues-to-revenue ratio. Then give 4–6 specific, actionable improvement steps tied directly to the numbers — name exact figures, exact modules, exact gaps.

Output format (your reply is rendered as markdown):
- Use **bold labels** for financial figures: "**Consultations:** ₹1,20,000 (45%)"
- Use "## Heading" for each major section of a financial report.
- Use compact bullet lists inside sections; avoid walls of text.
- Quote numbers EXACTLY from the brief. Currency is ₹. Dates are YYYY-MM-DD.
- For improvement advice, anchor every point to actual data — never give generic advice.
- If a metric is not in the brief, say so plainly. Never invent numbers.`

export type AskInput = {
  /** Optional — when set the brief is built for this patient directly. */
  patientId?: string | null
  question: string
  history?: GeminiMessage[]
  /** Which page/module the user is asking from — drives context type. */
  module?: string
}

export type AskOutput =
  | { ok: true; answer: string }
  | { ok: false; error: string }

export async function askSithaAI(input: AskInput): Promise<AskOutput> {
  await requireServerPermission("doctor:consult")

  const question = (input.question ?? "").trim()
  if (!question) return { ok: false, error: "Empty question." }
  if (question.length > 4000) {
    return { ok: false, error: "Question is too long (max 4000 characters)." }
  }

  const isAnalytics = input.module === "analytics"
  const trimmedHistory = (input.history ?? []).slice(-MAX_HISTORY_TURNS)

  if (isAnalytics) {
    const brief = await buildAnalyticsContext()
    const messages: GeminiMessage[] = [
      { role: "user", text: `HOSPITAL ANALYTICS BRIEF (do not echo verbatim):\n${brief}` },
      { role: "model", text: "Analytics brief loaded. Ask anything about hospital performance." },
      ...trimmedHistory,
      { role: "user", text: question },
    ]
    const result = await callGemini({
      system: ANALYTICS_SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 2500,
      temperature: 0.3,
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, answer: result.text }
  }

  const context = await resolvePatientContext(input)

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

// ── Context resolver — handles both locked-patient and generic chat modes ──

async function resolvePatientContext(input: AskInput): Promise<string> {
  // Caller (e.g. inline patient view) locked in a patient — use it directly.
  if (input.patientId) {
    return buildPatientContext(input.patientId)
  }

  // Generic mode: scan the user's question + recent history for a patient
  // identifier (UID like P-0005 / 0005, or a 10-digit phone). Most recent
  // mention wins so the user can switch patients mid-chat.
  const userTexts = [
    input.question,
    ...(input.history ?? []).filter(m => m.role === "user").map(m => m.text).reverse(),
  ]
  const token = extractPatientToken(userTexts.join("\n"))
  if (!token) {
    return "(NO PATIENT)\nNo patient identifier was provided. Ask the user to share a patient UID (e.g. P-0005) or 10-digit phone number, then they can re-send the question."
  }

  const resolved = await findPatientByToken(token)
  if (!resolved) {
    return `(NOT FOUND)\nNo patient record matched "${token}". Ask the user to double-check the UID or phone and try again.`
  }
  return buildPatientContext(resolved)
}

// Pulls the most likely patient identifier out of free-form text:
//   - 10-digit phone number → prefer when seen alone
//   - "P-0005" / "P0005" style UID
//   - bare 3+ digit sequence (e.g. "0005") — used as a UID prefix
// Returns the raw token (server will fuzzy-match it). Null if nothing matched.
function extractPatientToken(text: string): string | null {
  if (!text) return null
  const blob = text.replace(/[‐-―]/g, "-") // normalise unicode dashes
  // 10-digit phone (allow optional +91 prefix).
  const phone = blob.match(/(?:\+?91)?[\s-]?([6-9]\d{9})\b/)
  if (phone) return phone[1]
  // UID with prefix letters and digits (P-0005, OPD-0001, etc.)
  const uid = blob.match(/\b[A-Za-z]{1,5}-?\d{3,7}\b/)
  if (uid) return uid[0]
  // Bare digit sequence (3-7 digits) — treat as a UID search.
  const digits = blob.match(/\b\d{3,7}\b/)
  if (digits) return digits[0]
  return null
}

// Resolves a free-form token to a Patient.patientId (human UID). Tries
// multiple shapes since users type UIDs inconsistently ("P-0005", "P0005",
// "0005" — the DB just stores the digits) and Indian phone numbers may come
// with or without "+91". Returns null if no match.
async function findPatientByToken(token: string): Promise<string | null> {
  const supabase = await createClient()
  const cleaned = token.trim()
  if (!cleaned) return null

  // Build an ordered list of search variants to try.
  const variants: Array<{ field: "patientId" | "phone"; pattern: string }> = []

  // 10-digit phone — match trailing 10 digits (handles +91 prefix in stored values too).
  if (/^\d{10}$/.test(cleaned)) {
    variants.push({ field: "phone", pattern: `%${cleaned}` })
  }

  // UID variants — try the literal first, then digit-only fallback (covers
  // the common "P-0005" typed against a "0005" record).
  if (/^[A-Za-z0-9-]+$/.test(cleaned)) {
    variants.push({ field: "patientId", pattern: `%${cleaned}%` })
    const digitsOnly = cleaned.replace(/\D/g, "")
    if (digitsOnly && digitsOnly !== cleaned) {
      variants.push({ field: "patientId", pattern: `%${digitsOnly}%` })
    }
  }

  for (const v of variants) {
    const { data } = await supabase
      .from("Patient")
      .select("patientId")
      .ilike(v.field, v.pattern)
      .limit(1)
      .maybeSingle()
    if (data?.patientId) return data.patientId as string
  }

  return null
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

async function buildPatientContext(idOrPatientId: string): Promise<string> {
  const supabase = await createClient()

  const PATIENT_SELECT =
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

  // Look up by human patientId first (OPD list passes this). If that misses
  // (e.g. caller passed the Patient.id cuid because they came from the IPD
  // list, where InPatient.patientId is a cuid FK to Patient.id), retry by id.
  let { data: patientRaw } = await supabase
    .from("Patient")
    .select(PATIENT_SELECT)
    .eq("patientId", idOrPatientId)
    .maybeSingle()

  if (!patientRaw) {
    const retry = await supabase
      .from("Patient")
      .select(PATIENT_SELECT)
      .eq("id", idOrPatientId)
      .maybeSingle()
    patientRaw = retry.data
  }

  if (!patientRaw) return "Patient brief unavailable."
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient = patientRaw as any
  // From here on we always have the resolved human patientId for downstream
  // child queries (lab/optical/pharmacy all key off Patient.patientId).
  const humanPatientId: string = patient.patientId

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
// ── Analytics context builder ────────────────────────────────────────────────
// Builds a comprehensive hospital-level brief: revenue, collections, dues,
// expenses, doctor performance, top services, trends, demographics.
// Fetches data in parallel — p95 latency ~600 ms on a warm Supabase instance.

async function buildAnalyticsContext(): Promise<string> {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthName = now.toLocaleString("en-IN", { month: "long", year: "numeric" })

  const [
    overviewToday,
    overviewMonth,
    financialMonth,
    topServices,
    doctorPerf,
    expenses,
    weekSeries,
    gender,
    ageGroups,
    statusDist,
    referrals,
    opdDuesRes,
    ipdDuesRes,
    labDuesRes,
    optDuesRes,
    pharmDuesRes,
    paymentModesRes,
    ipdStatsRes,
  ] = await Promise.all([
    getAnalyticsOverview("today"),
    getAnalyticsOverview("month"),
    getFinancialSummary("month"),
    getTopServices("month"),
    getDoctorPerformance("month"),
    getExpenseBreakdown("month"),
    getTimeSeries("week"),
    getGenderDistribution("month"),
    getAgeDistribution("month"),
    getStatusDistribution("month"),
    getReferralStats("month"),

    // Outstanding dues across all modules (all-time, not period-filtered)
    supabase.from("Prescription").select("balanceDue").gt("balanceDue", 0),
    supabase.from("InPatient").select("balanceAmount").gt("balanceAmount", 0),
    supabase.from("LabBill").select("balanceDue").gt("balanceDue", 0),
    supabase.from("OpticalBill").select("balanceDue").gt("balanceDue", 0),
    supabase.from("PharmacyBill").select("billAmount, paidAmount").gt("billAmount", 0),

    // Payment mode breakdown for this month (OPD payments)
    supabase.from("Payment").select("paymentMode, amount").gte("paymentDate", startOfMonth),

    // IPD this month: admission count, operations, financials
    supabase.from("InPatient")
      .select("operationName, netAmount, totalReceivedAmount, balanceAmount, packageAmount")
      .gte("admissionDate", startOfMonth),
  ])

  // ── Aggregate dues ────────────────────────────────────────────────────────
  type DueRow = { balanceDue?: number; balanceAmount?: number; billAmount?: number; paidAmount?: number }
  const opdDue  = ((opdDuesRes.data ?? []) as DueRow[]).reduce((s, r) => s + (r.balanceDue ?? 0), 0)
  const ipdDue  = ((ipdDuesRes.data ?? []) as DueRow[]).reduce((s, r) => s + (r.balanceAmount ?? 0), 0)
  const labDue  = ((labDuesRes.data ?? []) as DueRow[]).reduce((s, r) => s + (r.balanceDue ?? 0), 0)
  const optDue  = ((optDuesRes.data ?? []) as DueRow[]).reduce((s, r) => s + (r.balanceDue ?? 0), 0)
  const pharmDue= ((pharmDuesRes.data ?? []) as DueRow[]).reduce((s, r) => s + Math.max(0, (r.billAmount ?? 0) - (r.paidAmount ?? 0)), 0)
  const totalDue = opdDue + ipdDue + labDue + optDue + pharmDue

  // ── Aggregate payment modes ───────────────────────────────────────────────
  const modeMap = new Map<string, number>()
  for (const p of (paymentModesRes.data ?? []) as Array<{ paymentMode: string | null; amount: number }>) {
    if (!p.amount) continue
    const mode = (p.paymentMode ?? "Other").trim() || "Other"
    modeMap.set(mode, (modeMap.get(mode) ?? 0) + p.amount)
  }
  const totalModeAmt = Array.from(modeMap.values()).reduce((s, a) => s + a, 0)

  // ── Aggregate IPD this month ──────────────────────────────────────────────
  type IpdRow = { operationName: string | null; netAmount: number; totalReceivedAmount: number; balanceAmount: number; packageAmount: number }
  const ipdRows = (ipdStatsRes.data ?? []) as IpdRow[]
  const ipdAdmissions = ipdRows.length
  const ipdOps = ipdRows.filter(r => r.operationName).length
  const ipdRevenue = ipdRows.reduce((s, r) => s + (r.netAmount ?? 0), 0)
  const ipdCollected = ipdRows.reduce((s, r) => s + (r.totalReceivedAmount ?? 0), 0)
  const ipdBalance = ipdRows.reduce((s, r) => s + (r.balanceAmount ?? 0), 0)
  const avgPackage = ipdAdmissions > 0 ? Math.round(ipdRevenue / ipdAdmissions) : 0

  // ── Build brief ───────────────────────────────────────────────────────────
  const lines: string[] = []

  lines.push("=== HOSPITAL ANALYTICS BRIEF ===")
  lines.push(`Date: ${now.toISOString().slice(0, 10)}   Period context: ${monthName}`)

  // TODAY
  if (overviewToday) {
    const o = overviewToday
    lines.push("")
    lines.push("=== TODAY ===")
    lines.push(`Patients seen: ${o.totalPatients}  |  New registrations: ${o.newPatientsToday}`)
    lines.push(`Revenue billed: ₹${fmtMoney(o.totalRevenue)}  |  Collected: ₹${fmtMoney(o.totalCollected)}`)
    if (o.totalExpenses > 0) lines.push(`Expenses today: ₹${fmtMoney(o.totalExpenses)}`)
    if (o.totalInpatients > 0) lines.push(`Active IPD patients: ${o.activeInpatients}  |  Total IPD admissions today: ${o.totalInpatients}`)
    if (o.totalSurgeries > 0) lines.push(`Surgeries today: ${o.totalSurgeries}`)
  }

  // THIS MONTH
  if (overviewMonth) {
    const o = overviewMonth
    const fin = financialMonth
    const collRate = o.totalRevenue > 0 ? ((o.totalCollected / o.totalRevenue) * 100).toFixed(1) : "0"
    const netFlow = o.totalCollected - o.totalExpenses
    lines.push("")
    lines.push(`=== THIS MONTH (${monthName}) ===`)
    lines.push(`Total patients: ${o.totalPatients}`)
    lines.push(`Revenue billed:  ₹${fmtMoney(o.totalRevenue)}`)
    lines.push(`Collected:       ₹${fmtMoney(o.totalCollected)}  (collection rate: ${collRate}%)`)
    if (fin) lines.push(`Discount given:  ₹${fmtMoney(fin.totalDiscount)}`)
    lines.push(`Dues added:      ₹${fmtMoney(o.totalDues)}`)
    lines.push(`Expenses:        ₹${fmtMoney(o.totalExpenses)}`)
    lines.push(`Net cash flow:   ₹${fmtMoney(netFlow)}  (${netFlow >= 0 ? "SURPLUS" : "DEFICIT"})`)
    if (o.collectionRate > 0) lines.push(`Revenue per patient: ₹${fmtMoney(o.revenuePerPatient)}`)
    lines.push("")
    lines.push("Revenue breakdown by category:")
    const totalRev = o.totalRevenue || 1
    if (o.totalConsultationRevenue > 0) lines.push(`  Consultations: ₹${fmtMoney(o.totalConsultationRevenue)} (${pct(o.totalConsultationRevenue, totalRev)})`)
    if (o.totalLabRevenue > 0)          lines.push(`  Labs:          ₹${fmtMoney(o.totalLabRevenue)} (${pct(o.totalLabRevenue, totalRev)})`)
    if (o.totalPharmacyRevenue > 0)     lines.push(`  Pharmacy:      ₹${fmtMoney(o.totalPharmacyRevenue)} (${pct(o.totalPharmacyRevenue, totalRev)})`)
    if (o.totalOpticalRevenue > 0)      lines.push(`  Optical:       ₹${fmtMoney(o.totalOpticalRevenue)} (${pct(o.totalOpticalRevenue, totalRev)})`)
    if (o.totalInpatientRevenue > 0)    lines.push(`  In-Patient:    ₹${fmtMoney(o.totalInpatientRevenue)} (${pct(o.totalInpatientRevenue, totalRev)})`)
  }

  // OUTSTANDING DUES (all-time unpaid balances across all modules)
  lines.push("")
  lines.push("=== OUTSTANDING DUES (all-time, unpaid) ===")
  if (totalDue <= 0) {
    lines.push("No outstanding dues across any module.")
  } else {
    if (opdDue > 0)   lines.push(`  OPD (consultations): ₹${fmtMoney(opdDue)}`)
    if (ipdDue > 0)   lines.push(`  IPD (inpatients):    ₹${fmtMoney(ipdDue)}`)
    if (labDue > 0)   lines.push(`  Lab:                 ₹${fmtMoney(labDue)}`)
    if (optDue > 0)   lines.push(`  Optical:             ₹${fmtMoney(optDue)}`)
    if (pharmDue > 0) lines.push(`  Pharmacy:            ₹${fmtMoney(pharmDue)}`)
    lines.push(`  TOTAL OUTSTANDING:   ₹${fmtMoney(totalDue)}`)
  }

  // PAYMENT MODE BREAKDOWN (this month, OPD)
  if (modeMap.size > 0) {
    lines.push("")
    lines.push("=== PAYMENT MODE BREAKDOWN (this month, OPD collections) ===")
    const sorted = Array.from(modeMap.entries()).sort((a, b) => b[1] - a[1])
    for (const [mode, amount] of sorted) {
      lines.push(`  ${mode}: ₹${fmtMoney(amount)} (${pct(amount, totalModeAmt)})`)
    }
  }

  // IPD THIS MONTH
  if (ipdAdmissions > 0) {
    lines.push("")
    lines.push(`=== IN-PATIENT (IPD) THIS MONTH ===`)
    lines.push(`Admissions: ${ipdAdmissions}`)
    lines.push(`Operations/surgeries: ${ipdOps}`)
    lines.push(`Average package: ₹${fmtMoney(avgPackage)}`)
    lines.push(`Revenue billed: ₹${fmtMoney(ipdRevenue)}  |  Collected: ₹${fmtMoney(ipdCollected)}  |  Outstanding: ₹${fmtMoney(ipdBalance)}`)
    const ipdRate = ipdRevenue > 0 ? ((ipdCollected / ipdRevenue) * 100).toFixed(1) : "0"
    lines.push(`IPD collection rate: ${ipdRate}%`)
  }

  // LAST 7 DAYS TREND
  if (weekSeries.length > 0) {
    lines.push("")
    lines.push("=== LAST 7 DAYS TREND ===")
    for (const day of weekSeries) {
      const net = day.collected - day.expenses
      lines.push(`  ${day.date}: ${day.patients} patients · billed ₹${fmtMoney(day.revenue)} · collected ₹${fmtMoney(day.collected)} · expenses ₹${fmtMoney(day.expenses)} · net ₹${fmtMoney(net)}`)
    }
  }

  // TOP SERVICES (this month)
  if (topServices.length > 0) {
    lines.push("")
    lines.push("=== TOP SERVICES THIS MONTH (by revenue) ===")
    for (let i = 0; i < Math.min(topServices.length, 12); i++) {
      const s = topServices[i]
      const avgPerService = s.count > 0 ? Math.round(s.revenue / s.count) : 0
      lines.push(`  ${i + 1}. ${s.name}: ₹${fmtMoney(s.revenue)} (${s.count}× · avg ₹${fmtMoney(avgPerService)})`)
    }
  }

  // DOCTOR PERFORMANCE (this month)
  if (doctorPerf.length > 0) {
    lines.push("")
    lines.push("=== DOCTOR PERFORMANCE THIS MONTH ===")
    for (let i = 0; i < Math.min(doctorPerf.length, 10); i++) {
      const d = doctorPerf[i]
      const revPerPt = d.patients > 0 ? Math.round(d.revenue / d.patients) : 0
      lines.push(`  ${i + 1}. ${d.name}: ${d.patients} patients · ₹${fmtMoney(d.revenue)} revenue · ₹${fmtMoney(revPerPt)}/patient`)
    }
  }

  // EXPENSE BREAKDOWN (this month)
  if (expenses.length > 0) {
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
    lines.push("")
    lines.push(`=== EXPENSE BREAKDOWN THIS MONTH (total ₹${fmtMoney(totalExp)}) ===`)
    const sorted = [...expenses].sort((a, b) => b.amount - a.amount)
    for (const exp of sorted) {
      lines.push(`  ${exp.category}: ₹${fmtMoney(exp.amount)} (${pct(exp.amount, totalExp)})`)
    }
  }

  // PATIENT DEMOGRAPHICS
  lines.push("")
  lines.push("=== PATIENT DEMOGRAPHICS (this month) ===")
  if (gender) {
    const total = gender.male + gender.female + gender.other
    lines.push(`Gender: Male ${gender.male} (${pct(gender.male, total)}), Female ${gender.female} (${pct(gender.female, total)}), Other ${gender.other}`)
  }
  if (ageGroups.length > 0) {
    const topAges = [...ageGroups].sort((a, b) => b.count - a.count).slice(0, 6)
    lines.push(`Age groups (most to least): ${topAges.map(a => `${a.label} (${a.count})`).join(", ")}`)
  }

  // PATIENT STATUS DISTRIBUTION
  if (statusDist.length > 0) {
    lines.push("")
    lines.push("=== PATIENT STATUS DISTRIBUTION ===")
    const sorted = [...statusDist].sort((a, b) => b.count - a.count)
    const totalPts = sorted.reduce((s, d) => s + d.count, 0)
    for (const s of sorted.slice(0, 8)) {
      lines.push(`  ${s.status}: ${s.count} (${pct(s.count, totalPts)})`)
    }
  }

  // TOP REFERRAL SOURCES
  if (referrals.length > 0) {
    lines.push("")
    lines.push("=== TOP REFERRAL SOURCES ===")
    for (const r of referrals.slice(0, 8)) {
      lines.push(`  ${r.name}: ${r.count} patients`)
    }
  }

  return lines.join("\n")
}

function pct(value: number, total: number): string {
  if (!total || !Number.isFinite(value) || !Number.isFinite(total)) return "0%"
  return `${((value / total) * 100).toFixed(1)}%`
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
