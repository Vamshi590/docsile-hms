"use server"

import { createClient } from "@/lib/supabase/server"
import { requireServerPermission } from "@/lib/auth"
import type { Database } from "@/lib/supabase/types"

// ─── DB ROW TYPES ───────────────────────────────────

type PatientRow = Database["public"]["Tables"]["Patient"]["Row"]
type PrescriptionRow = Database["public"]["Tables"]["Prescription"]["Row"]
type ExpenseRow = Database["public"]["Tables"]["Expense"]["Row"]
type LabBillRow = Database["public"]["Tables"]["LabBill"]["Row"]
type PharmacyBillRow = Database["public"]["Tables"]["PharmacyBill"]["Row"]
type OpticalBillRow = Database["public"]["Tables"]["OpticalBill"]["Row"]
type InPatientRow = Database["public"]["Tables"]["InPatient"]["Row"]
type InvoiceItemRow = Database["public"]["Tables"]["InvoiceItem"]["Row"]

// ─── TYPES ───────────────────────────────────────────

export type TimeFilter = "today" | "week" | "month" | "year" | "custom"

export interface AnalyticsOverview {
  totalPatients: number
  newPatientsToday: number
  totalRevenue: number
  totalCollected: number
  totalDues: number
  totalExpenses: number
  totalConsultationRevenue: number
  totalLabRevenue: number
  totalPharmacyRevenue: number
  totalOpticalRevenue: number
  totalInpatientRevenue: number
  totalInpatients: number
  activeInpatients: number
  totalSurgeries: number
  patientChange: number
  revenueChange: number
  collectionRate: number
  revenuePerPatient: number
  followUpVisits: number
  avgDailyPatients: number
  surgeryRecommended: number
  surgeryConverted: number
  conversionRate: number
  consultationDiscount: number
  labDiscount: number
  pharmacyDiscount: number
  opticalDiscount: number
  inpatientDiscount: number
  totalDiscount: number
}

export interface GenderDistribution {
  male: number
  female: number
  other: number
}

export interface AgeGroup {
  label: string
  count: number
}

export interface RevenueByCategory {
  category: string
  amount: number
  color: string
}

export interface TimeSeriesPoint {
  date: string
  patients: number
  revenue: number
  collected: number
  expenses: number
}

export interface TopService {
  name: string
  count: number
  revenue: number
}

export interface ExpenseByCategory {
  category: string
  amount: number
  color: string
}

export interface FinancialSummary {
  totalBilled: number
  totalCollected: number
  totalDiscount: number
  totalDues: number
  totalExpenses: number
  netCashFlow: number
  dailyBreakdown: DailyFinancial[]
  discountByModule: {
    consultations: number
    labs: number
    pharmacy: number
    optical: number
    inpatient: number
  }
}

export interface PaymentModeBreakdown {
  mode: string
  amount: number
  percentage: number
}

export interface SurgeryBreakdown {
  name: string
  count: number
}

export interface RegionStat {
  region: string
  total: number
  newPatients: number
  returning: number
  percentage: number
}

export interface DailyFinancial {
  date: string
  billed: number
  collected: number
  discount: number
  dues: number
  expenses: number
}

export interface DoctorPerformance {
  name: string
  patients: number
  revenue: number
}

export interface StatusDistribution {
  status: string
  count: number
}

// ─── HELPERS ────────────────────────────────────────

function getDateRange(filter: TimeFilter, customStart?: string, customEnd?: string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)

  switch (filter) {
    case "today":
      return { start: todayStart, end: todayEnd }
    case "week": {
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - 7)
      return { start: weekStart, end: todayEnd }
    }
    case "month": {
      const monthStart = new Date(todayStart)
      monthStart.setDate(monthStart.getDate() - 30)
      return { start: monthStart, end: todayEnd }
    }
    case "year": {
      const yearStart = new Date(todayStart)
      yearStart.setFullYear(yearStart.getFullYear() - 1)
      return { start: yearStart, end: todayEnd }
    }
    case "custom": {
      return {
        start: customStart ? new Date(customStart) : todayStart,
        end: customEnd ? new Date(new Date(customEnd).getTime() + 86400000) : todayEnd,
      }
    }
  }
}

function getPreviousRange(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime()
  return {
    start: new Date(start.getTime() - diff),
    end: start,
  }
}

// ─── OVERVIEW ────────────────────────────────────────

export async function getAnalyticsOverview(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<AnalyticsOverview> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const prev = getPreviousRange(start, end)
  const from = start.toISOString()
  const to = end.toISOString()
  const prevFrom = prev.start.toISOString()
  const prevTo = prev.end.toISOString()

  const [
    totalPatientsRes,
    prevPatientsRes,
    prescriptionsData,
    prevPrescriptionsData,
    expensesData,
    labBillsData,
    pharmacyBillsData,
    opticalBillsData,
    totalInpatientsRes,
    activeInpatientsRes,
    surgeriesData,
    inpatientBillingData,
    prevLabBillsData,
    prevPharmacyBillsData,
    prevOpticalBillsData,
    prevInpatientData,
  ] = await Promise.all([
    // Current period patients
    supabase.from("Patient").select("*", { count: "exact", head: true })
      .gte("appointmentDate", from).lt("appointmentDate", to)
      .returns<PatientRow[]>(),
    // Previous period patients
    supabase.from("Patient").select("*", { count: "exact", head: true })
      .gte("appointmentDate", prevFrom).lt("appointmentDate", prevTo)
      .returns<PatientRow[]>(),
    // Current prescriptions
    supabase.from("Prescription").select("*")
      .gte("prescriptionDate", from).lt("prescriptionDate", to).neq("status", "CANCELLED")
      .returns<PrescriptionRow[]>(),
    // Previous prescriptions
    supabase.from("Prescription").select("*")
      .gte("prescriptionDate", prevFrom).lt("prescriptionDate", prevTo).neq("status", "CANCELLED")
      .returns<PrescriptionRow[]>(),
    // Expenses
    supabase.from("Expense").select("*")
      .gte("date", from).lt("date", to)
      .returns<ExpenseRow[]>(),
    // Lab bills
    supabase.from("LabBill").select("*")
      .gte("createdAt", from).lt("createdAt", to)
      .returns<LabBillRow[]>(),
    // Pharmacy bills
    supabase.from("PharmacyBill").select("*")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<PharmacyBillRow[]>(),
    // Optical bills
    supabase.from("OpticalBill").select("*")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<OpticalBillRow[]>(),
    // Total inpatients in period
    supabase.from("InPatient").select("*", { count: "exact", head: true })
      .gte("admissionDate", from).lt("admissionDate", to)
      .returns<InPatientRow[]>(),
    // Currently active inpatients
    supabase.from("InPatient").select("*", { count: "exact", head: true })
      .neq("status", "DISCHARGED")
      .returns<InPatientRow[]>(),
    // Surgeries in period
    supabase.from("InPatient").select("*")
      .gte("operationDate", from).lt("operationDate", to).not("operationName", "is", null)
      .returns<InPatientRow[]>(),
    // Inpatient billing amounts
    supabase.from("InPatient").select("*")
      .gte("admissionDate", from).lt("admissionDate", to)
      .returns<InPatientRow[]>(),
    // Previous period lab bills
    supabase.from("LabBill").select("*")
      .gte("createdAt", prevFrom).lt("createdAt", prevTo).neq("status", "CANCELLED")
      .returns<LabBillRow[]>(),
    // Previous period pharmacy bills
    supabase.from("PharmacyBill").select("*")
      .gte("billDate", prevFrom).lt("billDate", prevTo).neq("status", "CANCELLED")
      .returns<PharmacyBillRow[]>(),
    // Previous period optical bills
    supabase.from("OpticalBill").select("*")
      .gte("billDate", prevFrom).lt("billDate", prevTo).neq("status", "CANCELLED")
      .returns<OpticalBillRow[]>(),
    // Previous period inpatient — partial select (only netAmount needed for revenueChange)
    supabase.from("InPatient").select("netAmount")
      .gte("admissionDate", prevFrom).lt("admissionDate", prevTo)
      .returns<Pick<InPatientRow, "netAmount">[]>(),
  ])

  const totalPatients = totalPatientsRes.count ?? 0
  const prevPatients = prevPatientsRes.count ?? 0

  const prescriptionsRows = prescriptionsData.data ?? []
  const prescriptionsSum = {
    total: prescriptionsRows.reduce((s, r) => s + (r.total || 0), 0),
    amountPaid: prescriptionsRows.reduce((s, r) => s + (r.amountPaid || 0), 0),
    balanceDue: prescriptionsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discount: prescriptionsRows.reduce((s, r) => s + (r.discount || 0), 0),
  }

  const prevPrescriptionsRows = prevPrescriptionsData.data ?? []
  const prevPrescriptionsTotal = prevPrescriptionsRows.reduce((s, r) => s + (r.total || 0), 0)

  const expensesTotal = (expensesData.data ?? []).reduce((s, r) => s + (r.amount || 0), 0)

  const labBillsRows = labBillsData.data ?? []
  const labBillsSum = {
    total: labBillsRows.reduce((s, r) => s + (r.total || 0), 0),
    amountPaid: labBillsRows.reduce((s, r) => s + (r.amountPaid || 0), 0),
    balanceDue: labBillsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discount: labBillsRows.reduce((s, r) => s + (r.discount || 0), 0),
  }

  const pharmacyBillsRows = pharmacyBillsData.data ?? []
  const pharmacyBillsSum = {
    billAmount: pharmacyBillsRows.reduce((s, r) => s + (r.billAmount || 0), 0),
    paidAmount: pharmacyBillsRows.reduce((s, r) => s + (r.paidAmount || 0), 0),
    balanceDue: pharmacyBillsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discountAmount: pharmacyBillsRows.reduce((s, r) => s + (r.discountAmount || 0), 0),
  }

  const opticalBillsRows = opticalBillsData.data ?? []
  const opticalBillsSum = {
    billAmount: opticalBillsRows.reduce((s, r) => s + (r.billAmount || 0), 0),
    paidAmount: opticalBillsRows.reduce((s, r) => s + (r.paidAmount || 0), 0),
    balanceDue: opticalBillsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discountAmount: opticalBillsRows.reduce((s, r) => s + (r.discountAmount || 0), 0),
  }

  const totalInpatients = totalInpatientsRes.count ?? 0
  const activeInpatients = activeInpatientsRes.count ?? 0
  const surgeries = (surgeriesData.data ?? []).length

  const inpatientBillingRows = inpatientBillingData.data ?? []
  const inpatientBillingSum = {
    netAmount: inpatientBillingRows.reduce((s, r) => s + (r.netAmount || 0), 0),
    totalReceivedAmount: inpatientBillingRows.reduce((s, r) => s + (r.totalReceivedAmount || 0), 0),
    balanceAmount: inpatientBillingRows.reduce((s, r) => s + (r.balanceAmount || 0), 0),
    discount: inpatientBillingRows.reduce((s, r) => s + (r.discount || 0), 0),
  }

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const { count: newPatientsToday } = await supabase.from("Patient")
    .select("*", { count: "exact", head: true })
    .gte("appointmentDate", todayStart.toISOString())
    .lt("appointmentDate", todayEnd.toISOString())

  const consultationRevenue = prescriptionsSum.total
  const labRevenue = labBillsSum.total
  const pharmacyRevenue = pharmacyBillsSum.billAmount
  const opticalRevenue = opticalBillsSum.billAmount
  const inpatientRevenue = inpatientBillingSum.netAmount

  const totalRevenue = consultationRevenue + labRevenue + pharmacyRevenue + opticalRevenue + inpatientRevenue

  const totalCollected =
    prescriptionsSum.amountPaid +
    labBillsSum.amountPaid +
    pharmacyBillsSum.paidAmount +
    opticalBillsSum.paidAmount +
    inpatientBillingSum.totalReceivedAmount

  const totalDues =
    prescriptionsSum.balanceDue +
    labBillsSum.balanceDue +
    pharmacyBillsSum.balanceDue +
    opticalBillsSum.balanceDue +
    inpatientBillingSum.balanceAmount

  const prevLabRevenue = (prevLabBillsData.data ?? []).reduce((s, r) => s + (r.total || 0), 0)
  const prevPharmacyRevenue = (prevPharmacyBillsData.data ?? []).reduce((s, r) => s + (r.billAmount || 0), 0)
  const prevOpticalRevenue = (prevOpticalBillsData.data ?? []).reduce((s, r) => s + (r.billAmount || 0), 0)
  const prevInpatientRevenue = (prevInpatientData.data ?? []).reduce((s, r) => s + (r.netAmount || 0), 0)
  const prevRevenue = prevPrescriptionsTotal + prevLabRevenue + prevPharmacyRevenue + prevOpticalRevenue + prevInpatientRevenue

  const patientChange = prevPatients > 0
    ? Math.round(((totalPatients - prevPatients) / prevPatients) * 100)
    : 0
  const revenueChange = prevRevenue > 0
    ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
    : 0

  const collectionRate = totalRevenue > 0
    ? Math.round((totalCollected / totalRevenue) * 100)
    : 0
  const revenuePerPatient = totalPatients > 0
    ? Math.round(totalRevenue / totalPatients)
    : 0

  // Follow-up visits: patients who visited in this period AND had a prior prescription
  const currentPatientIds = new Set(prescriptionsRows.map(r => r.patientId).filter(Boolean))
  let followUpVisits = 0
  if (currentPatientIds.size > 0) {
    const { count } = await supabase.from("Prescription")
      .select("patientId", { count: "exact", head: true })
      .lt("prescriptionDate", from)
      .in("patientId", Array.from(currentPatientIds) as string[])
    followUpVisits = Math.min(count ?? 0, currentPatientIds.size)
  }

  const daysInPeriod = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
  const avgDailyPatients = Math.round(totalPatients / daysInPeriod)

  // Conversion rate: prescriptions with "surgery" in additionalNotes → checked against InPatient
  const { data: surgeryRxData } = await supabase.from("Prescription")
    .select("patientId")
    .gte("prescriptionDate", from).lt("prescriptionDate", to)
    .neq("status", "CANCELLED")
    .ilike("additionalNotes", "%surgery%")
    .returns<{ patientId: string }[]>()

  const surgeryPatientIds = [...new Set((surgeryRxData ?? []).map(r => r.patientId).filter(Boolean))]
  const surgeryRecommended = surgeryPatientIds.length

  let surgeryConverted = 0
  if (surgeryPatientIds.length > 0) {
    const { count } = await supabase.from("InPatient")
      .select("patientId", { count: "exact", head: true })
      .in("patientId", surgeryPatientIds)
    surgeryConverted = count ?? 0
  }

  const conversionRate = surgeryRecommended > 0
    ? Math.round((surgeryConverted / surgeryRecommended) * 100)
    : 0

  const consultationDiscount = prescriptionsSum.discount
  const labDiscount = labBillsSum.discount
  const pharmacyDiscount = pharmacyBillsSum.discountAmount
  const opticalDiscount = opticalBillsSum.discountAmount
  const inpatientDiscount = inpatientBillingSum.discount
  const totalDiscount = consultationDiscount + labDiscount + pharmacyDiscount + opticalDiscount + inpatientDiscount

  return {
    totalPatients,
    newPatientsToday: newPatientsToday ?? 0,
    totalRevenue,
    totalCollected,
    totalDues,
    totalExpenses: expensesTotal,
    totalConsultationRevenue: consultationRevenue,
    totalLabRevenue: labRevenue,
    totalPharmacyRevenue: pharmacyRevenue,
    totalOpticalRevenue: opticalRevenue,
    totalInpatientRevenue: inpatientRevenue,
    totalInpatients,
    activeInpatients,
    totalSurgeries: surgeries,
    patientChange,
    revenueChange,
    collectionRate,
    revenuePerPatient,
    followUpVisits,
    avgDailyPatients,
    surgeryRecommended,
    surgeryConverted,
    conversionRate,
    consultationDiscount,
    labDiscount,
    pharmacyDiscount,
    opticalDiscount,
    inpatientDiscount,
    totalDiscount,
  }
}

// ─── GENDER DISTRIBUTION ─────────────────────────────

export async function getGenderDistribution(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<GenderDistribution> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const [maleRes, femaleRes, allRes] = await Promise.all([
    supabase.from("Patient").select("*", { count: "exact", head: true })
      .gte("appointmentDate", from).lt("appointmentDate", to).eq("gender", "MALE"),
    supabase.from("Patient").select("*", { count: "exact", head: true })
      .gte("appointmentDate", from).lt("appointmentDate", to).eq("gender", "FEMALE"),
    supabase.from("Patient").select("*", { count: "exact", head: true })
      .gte("appointmentDate", from).lt("appointmentDate", to),
  ])

  const male = maleRes.count ?? 0
  const female = femaleRes.count ?? 0
  const total = allRes.count ?? 0
  const other = total - male - female

  return { male, female, other }
}

// ─── AGE DISTRIBUTION ────────────────────────────────

export async function getAgeDistribution(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<AgeGroup[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const { data } = await supabase.from("Patient").select("*")
    .gte("appointmentDate", from).lt("appointmentDate", to)

  const patients = data ?? []

  const groups: Record<string, number> = {
    "0-10": 0, "11-20": 0, "21-30": 0, "31-40": 0,
    "41-50": 0, "51-60": 0, "61-70": 0, "71+": 0,
  }

  for (const p of patients) {
    const age = p.age ?? 0
    if (age <= 10) groups["0-10"]++
    else if (age <= 20) groups["11-20"]++
    else if (age <= 30) groups["21-30"]++
    else if (age <= 40) groups["31-40"]++
    else if (age <= 50) groups["41-50"]++
    else if (age <= 60) groups["51-60"]++
    else if (age <= 70) groups["61-70"]++
    else groups["71+"]++
  }

  return Object.entries(groups).map(([label, count]) => ({ label, count }))
}

// ─── REVENUE BY CATEGORY ─────────────────────────────

export async function getRevenueByCategory(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<RevenueByCategory[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const [consultationsData, labsData, pharmacyData, opticalData, inpatientData] = await Promise.all([
    supabase.from("Prescription").select("*")
      .gte("prescriptionDate", from).lt("prescriptionDate", to).neq("status", "CANCELLED")
      .returns<PrescriptionRow[]>(),
    supabase.from("LabBill").select("*")
      .gte("createdAt", from).lt("createdAt", to)
      .returns<LabBillRow[]>(),
    supabase.from("PharmacyBill").select("*")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<PharmacyBillRow[]>(),
    supabase.from("OpticalBill").select("*")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<OpticalBillRow[]>(),
    supabase.from("InPatient").select("*")
      .gte("admissionDate", from).lt("admissionDate", to)
      .returns<InPatientRow[]>(),
  ])

  const consultationsTotal = (consultationsData.data ?? []).reduce((s, r) => s + (r.total || 0), 0)
  const labsTotal = (labsData.data ?? []).reduce((s, r) => s + (r.total || 0), 0)
  const pharmacyTotal = (pharmacyData.data ?? []).reduce((s, r) => s + (r.billAmount || 0), 0)
  const opticalTotal = (opticalData.data ?? []).reduce((s, r) => s + (r.billAmount || 0), 0)
  const inpatientTotal = (inpatientData.data ?? []).reduce((s, r) => s + (r.netAmount || 0), 0)

  return [
    { category: "Consultations", amount: consultationsTotal, color: "#3b82f6" },
    { category: "Labs", amount: labsTotal, color: "#14b8a6" },
    { category: "Pharmacy", amount: pharmacyTotal, color: "#10b981" },
    { category: "Optical", amount: opticalTotal, color: "#8b5cf6" },
    { category: "In-Patient", amount: inpatientTotal, color: "#f59e0b" },
  ]
}

// ─── TIME SERIES DATA ─────────────────────────────────

export async function getTimeSeries(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<TimeSeriesPoint[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  // Generate date buckets
  const dates: Date[] = []
  const current = new Date(start)
  while (current < end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  // Fetch raw data
  const [patientsData, prescriptionsData, expensesData] = await Promise.all([
    supabase.from("Patient").select("*")
      .gte("appointmentDate", from).lt("appointmentDate", to)
      .returns<PatientRow[]>(),
    supabase.from("Prescription").select("*")
      .gte("prescriptionDate", from).lt("prescriptionDate", to).neq("status", "CANCELLED")
      .returns<PrescriptionRow[]>(),
    supabase.from("Expense").select("*")
      .gte("date", from).lt("date", to)
      .returns<ExpenseRow[]>(),
  ])

  const patients = patientsData.data ?? []
  const prescriptions = prescriptionsData.data ?? []
  const expenses = expensesData.data ?? []

  const fmt = (d: string | Date) => new Date(d).toISOString().split("T")[0]

  return dates.map((date) => {
    const key = fmt(date)
    const dayPatients = patients.filter((p) => fmt(p.appointmentDate) === key).length
    const dayRx = prescriptions.filter((p) => fmt(p.prescriptionDate) === key)
    const dayExp = expenses.filter((e) => fmt(e.date) === key)

    return {
      date: key,
      patients: dayPatients,
      revenue: dayRx.reduce((s, r) => s + (r.total || 0), 0),
      collected: dayRx.reduce((s, r) => s + (r.amountPaid || 0), 0),
      expenses: dayExp.reduce((s, e) => s + (e.amount || 0), 0),
    }
  })
}

// ─── TOP SERVICES ─────────────────────────────────────

export async function getTopServices(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<TopService[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  // Step 1: get valid prescription IDs in the date range
  const { data: rxData } = await supabase.from("Prescription")
    .select("id")
    .gte("prescriptionDate", from)
    .lt("prescriptionDate", to)
    .neq("status", "CANCELLED")
    .returns<{ id: string }[]>()

  const rxIds = (rxData ?? []).map(r => r.id)
  if (rxIds.length === 0) return []

  // Step 2: get invoice items for those prescriptions
  const { data } = await supabase.from("InvoiceItem")
    .select("description, amount")
    .in("prescriptionId", rxIds)
    .returns<{ description: string; amount: number }[]>()

  const items = data ?? []

  const map = new Map<string, { count: number; revenue: number }>()
  for (const item of items) {
    const key = item.description
    const existing = map.get(key) ?? { count: 0, revenue: 0 }
    existing.count++
    existing.revenue += item.amount
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
}

// ─── EXPENSE BREAKDOWN ────────────────────────────────

export async function getExpenseBreakdown(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<ExpenseByCategory[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const { data } = await supabase.from("Expense")
    .select("*, category:ExpenseCategory(*)")
    .gte("date", from).lt("date", to)
    .returns<(ExpenseRow & { category: { name: string; color: string } })[]>()

  const expenses = data ?? []

  const map = new Map<string, { amount: number; color: string }>()
  for (const exp of expenses) {
    const key = exp.category.name
    const existing = map.get(key) ?? { amount: 0, color: exp.category.color }
    existing.amount += exp.amount
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount)
}

// ─── FINANCIAL SUMMARY ────────────────────────────────

export async function getFinancialSummary(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<FinancialSummary> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const [prescriptionsData, expensesData, labBillsData, pharmacyBillsData, opticalBillsData, inpatientBillingData] = await Promise.all([
    supabase.from("Prescription").select("*")
      .gte("prescriptionDate", from).lt("prescriptionDate", to).neq("status", "CANCELLED")
      .returns<PrescriptionRow[]>(),
    supabase.from("Expense").select("*")
      .gte("date", from).lt("date", to)
      .returns<ExpenseRow[]>(),
    supabase.from("LabBill").select("*")
      .gte("createdAt", from).lt("createdAt", to)
      .returns<LabBillRow[]>(),
    supabase.from("PharmacyBill").select("*")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<PharmacyBillRow[]>(),
    supabase.from("OpticalBill").select("*")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<OpticalBillRow[]>(),
    supabase.from("InPatient").select("*")
      .gte("admissionDate", from).lt("admissionDate", to)
      .returns<InPatientRow[]>(),
  ])

  const prescriptions = prescriptionsData.data ?? []
  const expenses = expensesData.data ?? []
  const labBillsRows = labBillsData.data ?? []
  const pharmacyBillsRows = pharmacyBillsData.data ?? []
  const opticalBillsRows = opticalBillsData.data ?? []
  const inpatientBillingRows = inpatientBillingData.data ?? []

  const rxBilled = prescriptions.reduce((s, p) => s + (p.total || 0), 0)
  const rxCollected = prescriptions.reduce((s, p) => s + (p.amountPaid || 0), 0)
  const rxDiscount = prescriptions.reduce((s, p) => s + (p.discount || 0), 0)
  const rxDues = prescriptions.reduce((s, p) => s + (p.balanceDue || 0), 0)

  const labBillsSum = {
    total: labBillsRows.reduce((s, r) => s + (r.total || 0), 0),
    amountPaid: labBillsRows.reduce((s, r) => s + (r.amountPaid || 0), 0),
    balanceDue: labBillsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discount: labBillsRows.reduce((s, r) => s + (r.discount || 0), 0),
  }

  const pharmacyBillsSum = {
    billAmount: pharmacyBillsRows.reduce((s, r) => s + (r.billAmount || 0), 0),
    paidAmount: pharmacyBillsRows.reduce((s, r) => s + (r.paidAmount || 0), 0),
    balanceDue: pharmacyBillsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discountAmount: pharmacyBillsRows.reduce((s, r) => s + (r.discountAmount || 0), 0),
  }

  const opticalBillsSum = {
    billAmount: opticalBillsRows.reduce((s, r) => s + (r.billAmount || 0), 0),
    paidAmount: opticalBillsRows.reduce((s, r) => s + (r.paidAmount || 0), 0),
    balanceDue: opticalBillsRows.reduce((s, r) => s + (r.balanceDue || 0), 0),
    discountAmount: opticalBillsRows.reduce((s, r) => s + (r.discountAmount || 0), 0),
  }

  const inpatientBillingSum = {
    netAmount: inpatientBillingRows.reduce((s, r) => s + (r.netAmount || 0), 0),
    totalReceivedAmount: inpatientBillingRows.reduce((s, r) => s + (r.totalReceivedAmount || 0), 0),
    balanceAmount: inpatientBillingRows.reduce((s, r) => s + (r.balanceAmount || 0), 0),
    discount: inpatientBillingRows.reduce((s, r) => s + (r.discount || 0), 0),
  }

  const totalBilled = rxBilled
    + labBillsSum.total
    + pharmacyBillsSum.billAmount
    + opticalBillsSum.billAmount
    + inpatientBillingSum.netAmount

  const totalCollected = rxCollected
    + labBillsSum.amountPaid
    + pharmacyBillsSum.paidAmount
    + opticalBillsSum.paidAmount
    + inpatientBillingSum.totalReceivedAmount

  const totalDiscount = rxDiscount
    + labBillsSum.discount
    + pharmacyBillsSum.discountAmount
    + opticalBillsSum.discountAmount
    + inpatientBillingSum.discount

  const totalDues = rxDues
    + labBillsSum.balanceDue
    + pharmacyBillsSum.balanceDue
    + opticalBillsSum.balanceDue
    + inpatientBillingSum.balanceAmount

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  // Daily breakdown
  const fmt = (d: string | Date) => new Date(d).toISOString().split("T")[0]
  const dayMap = new Map<string, DailyFinancial>()

  const dates: Date[] = []
  const current = new Date(start)
  while (current < end) {
    const key = fmt(current)
    dayMap.set(key, { date: key, billed: 0, collected: 0, discount: 0, dues: 0, expenses: 0 })
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  for (const p of prescriptions) {
    const key = fmt(p.prescriptionDate)
    const day = dayMap.get(key)
    if (day) {
      day.billed += p.total || 0
      day.collected += p.amountPaid || 0
      day.discount += p.discount || 0
      day.dues += p.balanceDue || 0
    }
  }

  for (const e of expenses) {
    const key = fmt(e.date)
    const day = dayMap.get(key)
    if (day) {
      day.expenses += e.amount || 0
    }
  }

  return {
    totalBilled,
    totalCollected,
    totalDiscount,
    totalDues,
    totalExpenses,
    netCashFlow: totalCollected - totalExpenses,
    dailyBreakdown: Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    discountByModule: {
      consultations: rxDiscount,
      labs: labBillsSum.discount,
      pharmacy: pharmacyBillsSum.discountAmount,
      optical: opticalBillsSum.discountAmount,
      inpatient: inpatientBillingSum.discount,
    },
  }
}

// ─── PAYMENT MODE BREAKDOWN ───────────────────────────

function normalizePaymentMode(raw: string | null | undefined): string {
  if (!raw) return "Cash"
  const s = raw.trim().toUpperCase()
  if (s === "CASH") return "Cash"
  if (s === "UPI") return "UPI"
  if (s === "CARD") return "Card"
  if (s === "CHEQUE" || s === "NEFT" || s === "BANK TRANSFER" || s === "ONLINE") return "Cheque/NEFT"
  if (s === "INSURANCE") return "Insurance"
  return "Others"
}

export async function getPaymentModeBreakdown(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<PaymentModeBreakdown[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const [rxData, labData, pharmacyData, opticalData, inpatientData] = await Promise.all([
    supabase.from("Prescription").select("paymentMode, amountPaid")
      .gte("prescriptionDate", from).lt("prescriptionDate", to).neq("status", "CANCELLED")
      .returns<{ paymentMode: string | null; amountPaid: number | null }[]>(),
    supabase.from("LabBill").select("paymentMode, amountPaid")
      .gte("createdAt", from).lt("createdAt", to)
      .returns<{ paymentMode: string | null; amountPaid: number | null }[]>(),
    supabase.from("PharmacyBill").select("paymentMode, paidAmount")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<{ paymentMode: string | null; paidAmount: number | null }[]>(),
    supabase.from("OpticalBill").select("paymentMode, paidAmount")
      .gte("billDate", from).lt("billDate", to).neq("status", "CANCELLED")
      .returns<{ paymentMode: string | null; paidAmount: number | null }[]>(),
    supabase.from("InPatient").select("paymentRecords")
      .gte("admissionDate", from).lt("admissionDate", to)
      .returns<{ paymentRecords: string | null }[]>(),
  ])

  const map = new Map<string, number>()

  const add = (mode: string | null | undefined, amount: number | null | undefined) => {
    const key = normalizePaymentMode(mode)
    map.set(key, (map.get(key) ?? 0) + (amount ?? 0))
  }

  for (const r of rxData.data ?? []) add(r.paymentMode, r.amountPaid)
  for (const r of labData.data ?? []) add(r.paymentMode, r.amountPaid)
  for (const r of pharmacyData.data ?? []) add(r.paymentMode, r.paidAmount)
  for (const r of opticalData.data ?? []) add(r.paymentMode, r.paidAmount)

  for (const row of inpatientData.data ?? []) {
    try {
      const records: { paymentMode?: string; amount?: number }[] = JSON.parse(row.paymentRecords ?? "[]")
      for (const rec of records) add(rec.paymentMode, rec.amount)
    } catch { /* skip malformed */ }
  }

  const total = [...map.values()].reduce((s, v) => s + v, 0)
  const ORDER = ["Cash", "UPI", "Card", "Cheque/NEFT", "Insurance", "Others"]

  return ORDER
    .filter(m => (map.get(m) ?? 0) > 0)
    .map(m => ({
      mode: m,
      amount: map.get(m) ?? 0,
      percentage: total > 0 ? Math.round(((map.get(m) ?? 0) / total) * 100) : 0,
    }))
}

// ─── DOCTOR PERFORMANCE ──────────────────────────────

export async function getDoctorPerformance(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<DoctorPerformance[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const { data } = await supabase.from("Prescription")
    .select("*")
    .gte("prescriptionDate", from).lt("prescriptionDate", to)
    .neq("status", "CANCELLED")
    .not("doctorName", "is", null)

  const prescriptions = data ?? []

  const map = new Map<string, { patients: number; revenue: number }>()
  for (const p of prescriptions) {
    const key = p.doctorName ?? "Unknown"
    const existing = map.get(key) ?? { patients: 0, revenue: 0 }
    existing.patients++
    existing.revenue += p.total || 0
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.patients - a.patients)
}

// ─── PATIENT STATUS DISTRIBUTION ─────────────────────

export async function getStatusDistribution(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<StatusDistribution[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const { data } = await supabase.from("Patient")
    .select("*")
    .gte("appointmentDate", from).lt("appointmentDate", to)

  const patients = data ?? []

  const map = new Map<string, number>()
  for (const p of patients) {
    const key = p.status
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return Array.from(map.entries()).map(([status, count]) => ({
    status,
    count,
  }))
}

// ─── COMMON DIAGNOSES ────────────────────────────────

export interface CommonDiagnosis {
  diagnosis: string
  count: number
  percentage: number
}

export async function getCommonDiagnoses(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<CommonDiagnosis[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const { data } = await supabase.from("Prescription")
    .select("diagnosis")
    .gte("prescriptionDate", start.toISOString())
    .lt("prescriptionDate", end.toISOString())
    .neq("status", "CANCELLED")
    .not("diagnosis", "is", null)
    .returns<{ diagnosis: string }[]>()

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const key = (row.diagnosis ?? "").trim()
    if (key) map.set(key, (map.get(key) ?? 0) + 1)
  }

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 5)
  const othersCount = sorted.slice(5).reduce((s, [, c]) => s + c, 0)
  const total = sorted.reduce((s, [, c]) => s + c, 0)

  const result = top.map(([diagnosis, count]) => ({
    diagnosis,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }))

  if (othersCount > 0) {
    result.push({
      diagnosis: "Others",
      count: othersCount,
      percentage: total > 0 ? Math.round((othersCount / total) * 100) : 0,
    })
  }

  return result
}

// ─── COMMON MEDICINES ────────────────────────────────

export interface CommonMedicine {
  name: string
  count: number
  percentage: number
}

export async function getCommonMedicines(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<CommonMedicine[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const { data } = await supabase.from("Prescription")
    .select("medicines")
    .gte("prescriptionDate", start.toISOString())
    .lt("prescriptionDate", end.toISOString())
    .neq("status", "CANCELLED")
    .returns<{ medicines: string }[]>()

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    try {
      const meds: { name: string }[] = JSON.parse(row.medicines ?? "[]")
      for (const med of meds) {
        const key = (med.name ?? "").trim()
        if (key) map.set(key, (map.get(key) ?? 0) + 1)
      }
    } catch {
      // skip malformed JSON
    }
  }

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 5)
  const othersCount = sorted.slice(5).reduce((s, [, c]) => s + c, 0)
  const total = sorted.reduce((s, [, c]) => s + c, 0)

  const result = top.map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }))

  if (othersCount > 0) {
    result.push({
      name: "Others",
      count: othersCount,
      percentage: total > 0 ? Math.round((othersCount / total) * 100) : 0,
    })
  }

  return result
}

// ─── TOP PRESCRIBED INVESTIGATIONS ───────────────────

export interface CommonInvestigation {
  name: string
  count: number
  percentage: number
}

export async function getTopPrescribedInvestigations(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<CommonInvestigation[]> {
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const { data } = await supabase.from("Prescription")
    .select("investigations")
    .gte("prescriptionDate", start.toISOString())
    .lt("prescriptionDate", end.toISOString())
    .neq("status", "CANCELLED")
    .returns<{ investigations: string }[]>()

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    try {
      const invs: { name: string }[] = JSON.parse(row.investigations ?? "[]")
      for (const inv of invs) {
        const key = (inv.name ?? "").trim()
        if (key) map.set(key, (map.get(key) ?? 0) + 1)
      }
    } catch { /* skip malformed */ }
  }

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 8)
  const total = sorted.reduce((s, [, c]) => s + c, 0)

  return top.map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }))
}

// ─── TOP PHARMACY SALES ───────────────────────────────

export interface PharmacySaleStat {
  name: string
  quantity: number
  revenue: number
}

export async function getTopPharmacySales(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<PharmacySaleStat[]> {
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)

  // Get valid bill IDs in the date range
  const { data: billData } = await supabase.from("PharmacyBill")
    .select("id")
    .gte("billDate", start.toISOString())
    .lt("billDate", end.toISOString())
    .not("status", "eq", "CANCELLED")
    .not("status", "eq", "RETURNED")
    .returns<{ id: string }[]>()

  const billIds = (billData ?? []).map(b => b.id)
  if (billIds.length === 0) return []

  const { data } = await supabase.from("PharmacyBillItem")
    .select("medicineName, quantity, amount")
    .in("billId", billIds)
    .returns<{ medicineName: string; quantity: number; amount: number }[]>()

  const map = new Map<string, { quantity: number; revenue: number }>()
  for (const item of data ?? []) {
    const key = (item.medicineName ?? "").trim()
    if (!key) continue
    const existing = map.get(key) ?? { quantity: 0, revenue: 0 }
    existing.quantity += item.quantity
    existing.revenue += item.amount
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
}

// ─── TOP LAB TESTS BILLED ─────────────────────────────

export interface LabTestStat {
  name: string
  count: number
  revenue: number
}

export async function getTopLabTests(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<LabTestStat[]> {
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const { data: billData } = await supabase.from("LabBill")
    .select("id")
    .gte("createdAt", start.toISOString())
    .lt("createdAt", end.toISOString())
    .neq("status", "CANCELLED")
    .returns<{ id: string }[]>()

  const billIds = (billData ?? []).map(b => b.id)
  if (billIds.length === 0) return []

  const { data } = await supabase.from("LabBillItem")
    .select("name, amount")
    .in("labBillId", billIds)
    .returns<{ name: string; amount: number }[]>()

  const map = new Map<string, { count: number; revenue: number }>()
  for (const item of data ?? []) {
    const key = (item.name ?? "").trim()
    if (!key) continue
    const existing = map.get(key) ?? { count: 0, revenue: 0 }
    existing.count++
    existing.revenue += item.amount
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
}

// ─── REFERRAL STATS ──────────────────────────────────

export async function getReferralStats(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<{ name: string; count: number }[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const { data } = await supabase.from("Patient")
    .select("*")
    .gte("appointmentDate", from).lt("appointmentDate", to)
    .not("referredBy", "is", null)

  const patients = data ?? []

  const map = new Map<string, number>()
  for (const p of patients) {
    const key = p.referredBy ?? "Direct"
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

// ─── SURGERY BREAKDOWN ────────────────────────────────

export async function getSurgeryBreakdown(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<SurgeryBreakdown[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const { data } = await supabase.from("InPatient")
    .select("operationName")
    .gte("admissionDate", start.toISOString())
    .lt("admissionDate", end.toISOString())
    .not("operationName", "is", null)
    .returns<{ operationName: string | null }[]>()

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const key = (row.operationName ?? "").trim()
    if (key) map.set(key, (map.get(key) ?? 0) + 1)
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

// ─── REGION STATS ─────────────────────────────────────

export async function getRegionStats(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<RegionStat[]> {
  await requireServerPermission("reports:view")
  const supabase = await createClient()
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const from = start.toISOString()
  const to = end.toISOString()

  const { data } = await supabase.from("Patient")
    .select("id, address, appointmentDate")
    .gte("appointmentDate", from)
    .lt("appointmentDate", to)
    .not("address", "is", null)
    .returns<{ id: string; address: string | null; appointmentDate: string }[]>()

  const patients = data ?? []

  // Count total visits per patient id to determine new vs returning
  const { data: allVisits } = await supabase.from("Patient")
    .select("id, address")
    .not("address", "is", null)
    .lt("appointmentDate", to)
    .returns<{ id: string; address: string | null }[]>()

  const visitCountById = new Map<string, number>()
  for (const v of allVisits ?? []) {
    visitCountById.set(v.id, (visitCountById.get(v.id) ?? 0) + 1)
  }

  const regionMap = new Map<string, { total: number; newPatients: number; returning: number }>()

  for (const p of patients) {
    const key = (p.address ?? "").trim()
    if (!key) continue
    const existing = regionMap.get(key) ?? { total: 0, newPatients: 0, returning: 0 }
    existing.total++
    const totalVisits = visitCountById.get(p.id) ?? 1
    if (totalVisits <= 1) existing.newPatients++
    else existing.returning++
    regionMap.set(key, existing)
  }

  const sorted = Array.from(regionMap.entries())
    .map(([region, stats]) => ({ region, ...stats }))
    .sort((a, b) => b.total - a.total)

  const grandTotal = sorted.reduce((s, r) => s + r.total, 0)

  return sorted.map(r => ({
    ...r,
    percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
  }))
}
