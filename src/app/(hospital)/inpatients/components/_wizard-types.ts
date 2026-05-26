import type { PackageInclusion, PaymentRecord } from "@/lib/types"
import type { getInPatientAdmissionFormData } from "../actions"

export type WizardBundledData = Awaited<ReturnType<typeof getInPatientAdmissionFormData>>

export type WizardState = {
  // Step 1
  opPatientId: string         // empty if not linked to an existing OPD patient
  ipNumber: string
  admissionDate: string       // datetime-local string
  dischargeDate: string       // date string (expected discharge), empty when not set
  name: string
  age: string
  gender: string
  dateOfBirth: string
  phone: string
  address: string
  guardianName: string
  referredBy: string
  admissionNotes: string

  // Step 2
  operationDate: string
  operationName: string
  department: string
  doctorNames: string[]
  onDutyDoctors: string[]
  provisionDiagnosis: string
  operationProcedure: string
  operationDetails: string

  // Step 3
  packageInclusions: PackageInclusion[]
  discount: number
  paymentRecords: PaymentRecord[]
}

export type StepProps = {
  state: WizardState
  setState: (updater: (prev: WizardState) => WizardState) => void
  data: WizardBundledData
  isEditMode: boolean
}
