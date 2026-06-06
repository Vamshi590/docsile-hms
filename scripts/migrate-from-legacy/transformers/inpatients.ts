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

export async function migrateInpatients(
  source: SupabaseClient,
  target: SupabaseClient,
  lookups: Lookups,
): Promise<void> {
  info("\n=== inpatients → InPatient (creating Patient if missing) ===")

  const { data, error } = await source.from("inpatients").select("*")
  if (error) throw new Error(`Read inpatients: ${error.message}`)

  const newPatients: any[] = []
  const inpatients: any[] = []

  for (const r of data ?? []) {
    let patientCuid: string | undefined
    const patientId = trimOrNull(r.patientId)
    if (!patientId) {
      logError("inpatients", r.id, "blank patientId")
      continue
    }
    patientCuid = lookups.patientById.get(patientId)
    if (!patientCuid) {
      // Create a placeholder Patient
      patientCuid = newId()
      newPatients.push({
        id: patientCuid,
        patientId,
        firstName: trimOrNull(r.name) ?? "Unknown",
        lastName: null,
        age: parseIntOrNull(r.age) ?? 0,
        gender: trimOrNull(r.gender) ?? "Unknown",
        phone: trimOrNull(r.phone) ?? "",
        address: trimOrNull(r.address),
        dateOfBirth: parseDate(r.dateOfBirth),
        guardianName: trimOrNull(r.guardianName),
        patientType: "IPD",
        status: "REGISTERED",
        appointmentDate: parseDate(r.admissionDate) ?? parseDate(r.date) ?? new Date().toISOString(),
        createdAt: r.created_at ?? new Date().toISOString(),
        updatedAt: parseDate(r.updated_at) ?? new Date().toISOString(),
      })
      lookups.patientById.set(patientId, patientCuid)
    }

    const createdById = lookups.userByUsername.get(normalizeUsername(r.createdBy)) ?? null
    const admissionDate = parseDate(r.admissionDate) ?? parseDate(r.date) ?? new Date().toISOString()

    inpatients.push({
      id: newId(),
      patientId: patientCuid,
      ipNumber: patientId, // e.g. "IP-0015"
      name: trimOrNull(r.name) ?? "Unknown",
      age: parseIntOrNull(r.age) ?? 0,
      gender: trimOrNull(r.gender) ?? "Unknown",
      phone: trimOrNull(r.phone) ?? "",
      address: trimOrNull(r.address),
      dateOfBirth: parseDate(r.dateOfBirth),
      guardianName: trimOrNull(r.guardianName),
      admissionDate,
      referredBy: trimOrNull(r.referredBy),
      department: trimOrNull(r.department),
      doctorNames: JSON.stringify(r.doctorNames ?? []),
      onDutyDoctors: JSON.stringify(r.onDutyDoctor ? [r.onDutyDoctor] : []),
      operationName: trimOrNull(r.operationName),
      operationDate: parseDate(r.operationDate),
      operationProcedure: trimOrNull(r.operationProcedure),
      operationDetails: trimOrNull(r.operationDetails),
      provisionDiagnosis: trimOrNull(r.provisionDiagnosis),
      medicalValues: r.medicalValues ? JSON.stringify(r.medicalValues) : null,
      packageAmount: parseFloatOrNull(r.packageAmount) ?? 0,
      packageInclusions: r.packageInclusions ? JSON.stringify(r.packageInclusions) : null,
      discount: parseFloatOrNull(r.discount) ?? 0,
      netAmount: parseFloatOrNull(r.netAmount) ?? 0,
      totalReceivedAmount: parseFloatOrNull(r.totalReceivedAmount) ?? 0,
      balanceAmount: parseFloatOrNull(r.balanceAmount) ?? 0,
      paymentRecords: r.paymentRecords ? JSON.stringify(r.paymentRecords) : null,
      prescriptions: r.prescriptions ? JSON.stringify(r.prescriptions) : null,
      followUpDate: parseDate(r.followUpDate),
      status: parseDate(r.dischargeDate) ? "DISCHARGED" : "ADMITTED",
      dischargeDate: parseDate(r.dischargeDate),
      createdById,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: parseDate(r.updated_at) ?? new Date().toISOString(),
    })
  }

  info(`  transformed ${newPatients.length} new Patients + ${inpatients.length} InPatients`)
  if (config.dryRun) return
  if (newPatients.length) await insertInBatches(target, "Patient", newPatients)
  await insertInBatches(target, "InPatient", inpatients)
  info(`  ✓ inserted`)
}
