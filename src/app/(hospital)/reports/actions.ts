"use server"

import { db } from "@/lib/db"

// ─── Patient Search ──────────────────────────────────────────────────────────

export async function searchPatients(query: string) {
  if (!query || query.length < 2) return []

  const patients = await db.patient.findMany({
    where: {
      OR: [
        { patientId: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      phone: true,
      age: true,
      gender: true,
      dateOfBirth: true,
      patientType: true,
      appointmentDate: true,
      createdAt: true,
      prescriptions: {
        orderBy: { prescriptionDate: "desc" },
        take: 1,
        select: { prescriptionDate: true },
      },
    },
  })

  return patients.map((p) => ({
    id: p.id,
    patientId: p.patientId,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(" "),
    phone: p.phone,
    age: p.age,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    patientType: p.patientType,
    registeredOn: p.createdAt,
    lastVisitDate: p.prescriptions[0]?.prescriptionDate ?? p.appointmentDate,
  }))
}

// ─── Patient Summary ─────────────────────────────────────────────────────────

export async function getPatientSummary(patientId: string) {
  const patient = await db.patient.findUnique({
    where: { patientId },
    include: {
      prescriptions: {
        select: {
          id: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
          prescriptionDate: true,
          status: true,
        },
        orderBy: { prescriptionDate: "desc" },
      },
      labBills: {
        select: {
          total: true,
          amountPaid: true,
          balanceDue: true,
        },
      },
      inpatient: {
        select: {
          netAmount: true,
          totalReceivedAmount: true,
          balanceAmount: true,
          status: true,
        },
      },
    },
  })

  if (!patient) return null

  const opdVisits = patient.prescriptions.filter((p) => p.status !== "DRAFT").length
  const lastVisit = patient.prescriptions[0]?.prescriptionDate ?? patient.appointmentDate

  const opdBilled = patient.prescriptions.reduce((s, p) => s + p.total, 0)
  const opdPaid = patient.prescriptions.reduce((s, p) => s + p.amountPaid, 0)
  const labBilled = patient.labBills.reduce((s, b) => s + b.total, 0)
  const labPaid = patient.labBills.reduce((s, b) => s + b.amountPaid, 0)
  const ipdBilled = patient.inpatient?.netAmount ?? 0
  const ipdPaid = patient.inpatient?.totalReceivedAmount ?? 0

  const totalBilled = opdBilled + labBilled + ipdBilled
  const totalPaid = opdPaid + labPaid + ipdPaid
  const totalDues = totalBilled - totalPaid

  return {
    id: patient.id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    fullName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    phone: patient.phone,
    email: patient.email,
    age: patient.age,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    address: patient.address,
    registeredOn: patient.createdAt,
    lastVisit,
    opdVisits,
    hasInpatient: !!patient.inpatient,
    inpatientStatus: patient.inpatient?.status ?? null,
    totalBilled,
    totalPaid,
    totalDues,
  }
}

// ─── Visit History (Prescriptions as visits) ─────────────────────────────────

export async function getVisitHistory(patientId: string) {
  const prescriptions = await db.prescription.findMany({
    where: { patientId },
    orderBy: { prescriptionDate: "desc" },
    select: {
      id: true,
      prescriptionNumber: true,
      prescriptionDate: true,
      doctorName: true,
      department: true,
      presentComplaint: true,
      diagnosis: true,
      status: true,
      patientType: true,
      total: true,
      amountPaid: true,
      balanceDue: true,
      followUpDate: true,
    },
  })

  return prescriptions
}

// ─── Prescriptions with medicines ────────────────────────────────────────────

export async function getPrescriptions(patientId: string) {
  const prescriptions = await db.prescription.findMany({
    where: { patientId },
    orderBy: { prescriptionDate: "desc" },
    select: {
      id: true,
      prescriptionNumber: true,
      prescriptionDate: true,
      doctorName: true,
      department: true,
      presentComplaint: true,
      previousHistory: true,
      diagnosis: true,
      medicines: true,
      investigations: true,
      additionalNotes: true,
      followUpDate: true,
      status: true,
      patientType: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          category: true,
          quantity: true,
          unitPrice: true,
          amount: true,
        },
      },
    },
  })

  return prescriptions
}

// ─── Inpatient Records ───────────────────────────────────────────────────────

export async function getInpatientRecords(patientInternalId: string) {
  const inpatient = await db.inPatient.findUnique({
    where: { patientId: patientInternalId },
    include: {
      insuranceClaims: {
        select: {
          id: true,
          claimNumber: true,
          insuranceCompanyName: true,
          status: true,
          totalApprovedAmount: true,
          finalSettledAmount: true,
        },
      },
    },
  })

  return inpatient
}

// ─── Lab Records ─────────────────────────────────────────────────────────────

export async function getLabRecords(patientId: string) {
  const labBills = await db.labBill.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    include: {
      lab: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          amount: true,
        },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
        select: {
          id: true,
          amount: true,
          paymentMode: true,
          paymentDate: true,
        },
      },
    },
  })

  return labBills
}

// ─── Billing & Payments ──────────────────────────────────────────────────────

export async function getBillingOverview(patientId: string, patientInternalId: string) {
  const [prescriptions, labBills, inpatient] = await Promise.all([
    db.prescription.findMany({
      where: { patientId },
      orderBy: { prescriptionDate: "desc" },
      select: {
        id: true,
        prescriptionNumber: true,
        prescriptionDate: true,
        total: true,
        amountPaid: true,
        balanceDue: true,
        status: true,
        paymentMode: true,
        payments: {
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            paymentDate: true,
            notes: true,
          },
        },
      },
    }),
    db.labBill.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        billNumber: true,
        total: true,
        amountPaid: true,
        balanceDue: true,
        status: true,
        createdAt: true,
        lab: { select: { name: true } },
        payments: {
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            paymentDate: true,
          },
        },
      },
    }),
    db.inPatient.findUnique({
      where: { patientId: patientInternalId },
      select: {
        ipNumber: true,
        packageAmount: true,
        discount: true,
        netAmount: true,
        totalReceivedAmount: true,
        balanceAmount: true,
        paymentRecords: true,
        status: true,
        admissionDate: true,
        dischargeDate: true,
      },
    }),
  ])

  // Aggregate
  const opdTotal = prescriptions.reduce((s, p) => s + p.total, 0)
  const opdPaid = prescriptions.reduce((s, p) => s + p.amountPaid, 0)
  const labTotal = labBills.reduce((s, b) => s + b.total, 0)
  const labPaid = labBills.reduce((s, b) => s + b.amountPaid, 0)
  const ipdTotal = inpatient?.netAmount ?? 0
  const ipdPaid = inpatient?.totalReceivedAmount ?? 0

  return {
    summary: {
      opdTotal,
      opdPaid,
      opdDue: opdTotal - opdPaid,
      labTotal,
      labPaid,
      labDue: labTotal - labPaid,
      ipdTotal,
      ipdPaid,
      ipdDue: ipdTotal - ipdPaid,
      grandTotal: opdTotal + labTotal + ipdTotal,
      grandPaid: opdPaid + labPaid + ipdPaid,
      grandDue: (opdTotal - opdPaid) + (labTotal - labPaid) + (ipdTotal - ipdPaid),
    },
    prescriptions,
    labBills,
    inpatient,
  }
}
