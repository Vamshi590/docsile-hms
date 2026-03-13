"use server"

import { db } from "@/lib/db"

// ─── TYPES ───────────────────────────────────────────

export type TimeFilter = "today" | "week" | "month" | "year" | "custom"

export interface AnalyticsOverview {
  totalPatients: number
  newPatientsToday: number
  totalRevenue: number
  totalCollected: number
  totalDues: number
  totalExpenses: number
  totalLabRevenue: number
  totalPharmacyRevenue: number
  totalOpticalRevenue: number
  totalInpatients: number
  activeInpatients: number
  totalSurgeries: number
  patientChange: number
  revenueChange: number
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
  const { start, end } = getDateRange(filter, customStart, customEnd)
  const prev = getPreviousRange(start, end)

  const [
    totalPatients,
    prevPatients,
    prescriptions,
    prevPrescriptions,
    expenses,
    labBills,
    pharmacyBills,
    opticalBills,
    totalInpatients,
    activeInpatients,
    surgeries,
  ] = await Promise.all([
    // Current period patients
    db.patient.count({
      where: { appointmentDate: { gte: start, lt: end } },
    }),
    // Previous period patients
    db.patient.count({
      where: { appointmentDate: { gte: prev.start, lt: prev.end } },
    }),
    // Current prescriptions
    db.prescription.aggregate({
      where: { prescriptionDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { total: true, amountPaid: true, balanceDue: true, discount: true },
    }),
    // Previous prescriptions
    db.prescription.aggregate({
      where: { prescriptionDate: { gte: prev.start, lt: prev.end }, status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
    // Expenses
    db.expense.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    // Lab bills
    db.labBill.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { total: true },
    }),
    // Pharmacy bills
    db.pharmacyBill.aggregate({
      where: { billDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { billAmount: true },
    }),
    // Optical bills
    db.opticalBill.aggregate({
      where: { billDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { billAmount: true },
    }),
    // Total inpatients in period
    db.inPatient.count({
      where: { admissionDate: { gte: start, lt: end } },
    }),
    // Currently active inpatients
    db.inPatient.count({
      where: { status: { not: "DISCHARGED" } },
    }),
    // Surgeries in period
    db.inPatient.count({
      where: { operationDate: { gte: start, lt: end }, operationName: { not: null } },
    }),
  ])

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const newPatientsToday = await db.patient.count({
    where: { appointmentDate: { gte: todayStart, lt: todayEnd } },
  })

  const totalRevenue = prescriptions._sum.total ?? 0
  const totalCollected = prescriptions._sum.amountPaid ?? 0
  const totalDues = prescriptions._sum.balanceDue ?? 0
  const prevRevenue = prevPrescriptions._sum.total ?? 0

  const patientChange = prevPatients > 0
    ? Math.round(((totalPatients - prevPatients) / prevPatients) * 100)
    : 0
  const revenueChange = prevRevenue > 0
    ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
    : 0

  return {
    totalPatients,
    newPatientsToday,
    totalRevenue,
    totalCollected,
    totalDues,
    totalExpenses: expenses._sum.amount ?? 0,
    totalLabRevenue: labBills._sum.total ?? 0,
    totalPharmacyRevenue: pharmacyBills._sum.billAmount ?? 0,
    totalOpticalRevenue: opticalBills._sum.billAmount ?? 0,
    totalInpatients,
    activeInpatients,
    totalSurgeries: surgeries,
    patientChange,
    revenueChange,
  }
}

// ─── GENDER DISTRIBUTION ─────────────────────────────

export async function getGenderDistribution(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<GenderDistribution> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const [male, female, other] = await Promise.all([
    db.patient.count({ where: { appointmentDate: { gte: start, lt: end }, gender: "MALE" } }),
    db.patient.count({ where: { appointmentDate: { gte: start, lt: end }, gender: "FEMALE" } }),
    db.patient.count({ where: { appointmentDate: { gte: start, lt: end }, gender: { notIn: ["MALE", "FEMALE"] } } }),
  ])

  return { male, female, other }
}

// ─── AGE DISTRIBUTION ────────────────────────────────

export async function getAgeDistribution(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<AgeGroup[]> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const patients = await db.patient.findMany({
    where: { appointmentDate: { gte: start, lt: end } },
    select: { age: true },
  })

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
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const [consultations, labs, pharmacy, optical, inpatient] = await Promise.all([
    db.prescription.aggregate({
      where: { prescriptionDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
    db.labBill.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { total: true },
    }),
    db.pharmacyBill.aggregate({
      where: { billDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { billAmount: true },
    }),
    db.opticalBill.aggregate({
      where: { billDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { billAmount: true },
    }),
    db.inPatient.aggregate({
      where: { admissionDate: { gte: start, lt: end } },
      _sum: { netAmount: true },
    }),
  ])

  return [
    { category: "Consultations", amount: consultations._sum.total ?? 0, color: "#3b82f6" },
    { category: "Labs", amount: labs._sum.total ?? 0, color: "#14b8a6" },
    { category: "Pharmacy", amount: pharmacy._sum.billAmount ?? 0, color: "#10b981" },
    { category: "Optical", amount: optical._sum.billAmount ?? 0, color: "#8b5cf6" },
    { category: "In-Patient", amount: inpatient._sum.netAmount ?? 0, color: "#f59e0b" },
  ]
}

// ─── TIME SERIES DATA ─────────────────────────────────

export async function getTimeSeries(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<TimeSeriesPoint[]> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  // Generate date buckets
  const dates: Date[] = []
  const current = new Date(start)
  while (current < end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  // Fetch raw data
  const [patients, prescriptions, expenses] = await Promise.all([
    db.patient.findMany({
      where: { appointmentDate: { gte: start, lt: end } },
      select: { appointmentDate: true },
    }),
    db.prescription.findMany({
      where: { prescriptionDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      select: { prescriptionDate: true, total: true, amountPaid: true },
    }),
    db.expense.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, amount: true },
    }),
  ])

  const fmt = (d: Date) => d.toISOString().split("T")[0]

  return dates.map((date) => {
    const key = fmt(date)
    const dayPatients = patients.filter((p) => fmt(p.appointmentDate) === key).length
    const dayRx = prescriptions.filter((p) => fmt(p.prescriptionDate) === key)
    const dayExp = expenses.filter((e) => fmt(e.date) === key)

    return {
      date: key,
      patients: dayPatients,
      revenue: dayRx.reduce((s, r) => s + r.total, 0),
      collected: dayRx.reduce((s, r) => s + r.amountPaid, 0),
      expenses: dayExp.reduce((s, e) => s + e.amount, 0),
    }
  })
}

// ─── TOP SERVICES ─────────────────────────────────────

export async function getTopServices(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<TopService[]> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const items = await db.invoiceItem.findMany({
    where: {
      prescription: {
        prescriptionDate: { gte: start, lt: end },
        status: { not: "CANCELLED" },
      },
    },
    select: { description: true, amount: true },
  })

  const map = new Map<string, { count: number; revenue: number }>()
  for (const item of items) {
    const key = item.description
    const existing = map.get(key) ?? { count: 0, revenue: 0 }
    existing.count++
    existing.revenue += item.amount
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
}

// ─── EXPENSE BREAKDOWN ────────────────────────────────

export async function getExpenseBreakdown(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<ExpenseByCategory[]> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const expenses = await db.expense.findMany({
    where: { date: { gte: start, lt: end } },
    include: { category: { select: { name: true, color: true } } },
  })

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
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const [prescriptions, expenses] = await Promise.all([
    db.prescription.findMany({
      where: { prescriptionDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      select: { prescriptionDate: true, total: true, amountPaid: true, balanceDue: true, discount: true },
    }),
    db.expense.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, amount: true },
    }),
  ])

  const totalBilled = prescriptions.reduce((s, p) => s + p.total, 0)
  const totalCollected = prescriptions.reduce((s, p) => s + p.amountPaid, 0)
  const totalDiscount = prescriptions.reduce((s, p) => s + p.discount, 0)
  const totalDues = prescriptions.reduce((s, p) => s + p.balanceDue, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // Daily breakdown
  const fmt = (d: Date) => d.toISOString().split("T")[0]
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
      day.billed += p.total
      day.collected += p.amountPaid
      day.discount += p.discount
      day.dues += p.balanceDue
    }
  }

  for (const e of expenses) {
    const key = fmt(e.date)
    const day = dayMap.get(key)
    if (day) {
      day.expenses += e.amount
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
  }
}

// ─── DOCTOR PERFORMANCE ──────────────────────────────

export async function getDoctorPerformance(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<DoctorPerformance[]> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const prescriptions = await db.prescription.findMany({
    where: {
      prescriptionDate: { gte: start, lt: end },
      status: { not: "CANCELLED" },
      doctorName: { not: null },
    },
    select: { doctorName: true, total: true },
  })

  const map = new Map<string, { patients: number; revenue: number }>()
  for (const p of prescriptions) {
    const key = p.doctorName ?? "Unknown"
    const existing = map.get(key) ?? { patients: 0, revenue: 0 }
    existing.patients++
    existing.revenue += p.total
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
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const patients = await db.patient.groupBy({
    by: ["status"],
    where: { appointmentDate: { gte: start, lt: end } },
    _count: { _all: true },
  })

  return patients.map((p) => ({
    status: p.status,
    count: p._count._all,
  }))
}

// ─── REFERRAL STATS ──────────────────────────────────

export async function getReferralStats(
  filter: TimeFilter,
  customStart?: string,
  customEnd?: string
): Promise<{ name: string; count: number }[]> {
  const { start, end } = getDateRange(filter, customStart, customEnd)

  const patients = await db.patient.findMany({
    where: {
      appointmentDate: { gte: start, lt: end },
      referredBy: { not: null },
    },
    select: { referredBy: true },
  })

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
