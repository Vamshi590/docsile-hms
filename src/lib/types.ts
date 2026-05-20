// ─── Patient Types ────────────────────────────────────────────────────────────

export type PatientStatus =
  | "REGISTERED"
  | "IN_WORKUP"
  | "WORKUP_DONE"
  | "WITH_DOCTOR"
  | "VISITED"
  | "COMPLETED"
  | "MEDICAL_ONLY"
  | "MOVED"
  | "CANCELLED"
  | "NO_SHOW"

export type PatientGender = "MALE" | "FEMALE" | "OTHER"
export type PatientType = "OPD" | "IPD"

export type Patient = {
  id: string
  patientId: string
  firstName: string
  lastName: string | null
  dateOfBirth: Date | null
  age: number | null
  gender: string
  phone: string
  email: string | null
  address: string | null
  guardianName: string | null
  guardianRelation: string | null
  emergencyContact: string | null
  referredBy: string | null
  doctorName: string | null
  department: string | null
  patientType: string
  status: PatientStatus
  appointmentDate: Date
  movedFromDate: Date | null
  movedToDate: Date | null
  moveReason: string | null
  notes: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}

export type PatientWithRelations = Patient & {
  eyeReadings?: EyeReading[]
  prescriptions?: Prescription[]
}

// ─── Prescription Types (Doctor + Billing combined) ───────────────────────────

export type PrescriptionStatus = "DRAFT" | "BILLING_ONLY" | "COMPLETED" | "CANCELLED"

export type Prescription = {
  id: string
  prescriptionNumber: string | null
  patientId: string
  patientType: string

  // Medical fields
  doctorId: string | null
  doctorName: string | null
  department: string | null
  temperature: number | null
  pulseRate: number | null
  spo2: number | null
  presentComplaint: string | null
  previousHistory: string | null
  diagnosis: string | null
  additionalNotes: string | null
  medicines: string // JSON
  investigations: string // JSON
  followUpDate: Date | null
  notes: string | null

  // Billing fields (merged from Invoice)
  subtotal: number
  discount: number
  discountReason: string | null
  total: number
  amountPaid: number
  balanceDue: number
  paymentMode: string | null
  paymentDate: Date | null

  status: string
  prescriptionDate: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date

  items?: InvoiceItem[]
  payments?: Payment[]
  eyeReading?: EyeReading | null
}

// ─── Prescription Line Items (formerly InvoiceItem) ───────────────────────────

export type InvoiceItem = {
  id: string
  prescriptionId: string
  description: string
  category: string | null
  quantity: number
  unitPrice: number
  amount: number
  sortOrder: number
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type Payment = {
  id: string
  prescriptionId: string
  amount: number
  paymentMode: string
  paymentRef: string | null
  receivedBy: string | null
  paymentDate: Date
  notes: string | null
}

export type ServiceTemplate = {
  id: string
  name: string
  category: string
  description: string | null
  amount: number
  discount: number
  isActive: boolean
  sortOrder: number
}

// ─── Eye Reading Types (Workup) ───────────────────────────────────────────────

export type EyeValue = {
  sph: string
  cyl: string
  axis: string
  va: string
  add?: string
  prism?: string
}

export type EyeReading2Eye = {
  re: EyeValue
  le: EyeValue
}

export type ARReading = EyeReading2Eye    // Auto Refractometer
export type GRReading = EyeReading2Eye    // Glasses Reading
export type PGPReading = EyeReading2Eye   // Previous Glasses Prescription
export type SRReading = EyeReading2Eye    // Subjective Refraction

export type CFReading = {
  re: {
    iop?: string
    iopMethod?: string
    lids?: string
    conjunctiva?: string
    cornea?: string
    ac?: string
    iris?: string
    pupil?: string
    lens?: string
    vitreous?: string
    fundus?: string
    cdr?: string
  }
  le: {
    iop?: string
    iopMethod?: string
    lids?: string
    conjunctiva?: string
    cornea?: string
    ac?: string
    iris?: string
    pupil?: string
    lens?: string
    vitreous?: string
    fundus?: string
    cdr?: string
  }
}

export type EyeReading = {
  id: string
  patientId: string
  prescriptionId: string | null
  autoRefractometer: string | null
  glassesReading: string | null
  previousPrescription: string | null
  presentPrescription: string | null
  clinicalFindings: string | null
  readingDate: Date
  status: string
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Prescription Medicine / Investigation sub-types ──────────────────────────

export type PrescriptionMedicine = {
  id?: string
  name: string
  days: string
  timing: string
  note?: string
}

export type PrescriptionInvestigation = {
  id?: string
  name: string
  note?: string
}

// ─── InPatient Types ──────────────────────────────────────────────────────────

export type InPatientStatus =
  | "ADMITTED"
  | "PRE_OP"
  | "IN_SURGERY"
  | "POST_OP"
  | "READY_FOR_DISCHARGE"
  | "DISCHARGED"

export type PaymentRecord = {
  date: string
  amountType: string
  paymentMode: string
  amount: number
  notes?: string
}

export type PackageInclusion = {
  name: string
  amount: number
  subItems?: {
    itemName: string
    quantity: number
    rate: number
    amount: number
  }[]
}

export type MedicalValues = {
  iop?: string
  syringing?: string
  bp?: string
  xst?: string
  cbp?: string
  rbs?: string
  hiv?: string
  hbsAg?: string
  aScan?: string
  preOpVision?: string
  postOpVision?: string
}

export type IPPrescription = {
  medicine: string
  days: string
  timing: string
  note?: string
}

export type InPatient = {
  id: string
  patientId: string
  ipNumber: string
  name: string
  age: number
  gender: string
  phone: string
  address: string | null
  dateOfBirth: Date | null
  guardianName: string | null
  admissionDate: Date
  admissionNotes: string | null
  referredBy: string | null
  department: string | null
  doctorNames: string
  onDutyDoctors: string   // JSON-encoded string[]
  operationName: string | null
  operationDate: Date | null
  operationProcedure: string | null
  operationDetails: string | null
  provisionDiagnosis: string | null
  medicalValues: string | null
  packageAmount: number
  packageInclusions: string | null
  discount: number
  netAmount: number
  totalReceivedAmount: number
  balanceAmount: number
  paymentRecords: string | null
  prescriptions: string | null
  followUpDate: Date | null
  status: InPatientStatus
  dischargeDate: Date | null
  dischargeNotes: string | null
  bedNumber: string | null
  wardName: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── User Types ───────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "DOCTOR" | "RECEPTIONIST" | "OPTOMETRIST" | "NURSE"

export type User = {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: string
  department: string | null
  designation: string | null
  isActive: boolean
  lastLogin: Date | null
  createdAt: Date
}

// ─── Shared UI Types ──────────────────────────────────────────────────────────

export type SelectOption = {
  value: string
  label: string
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Insurance Types ────────────────────────────────────────────────────────

export type InsuranceClaimStatus =
  | "PREAUTH_SUBMITTED"
  | "PREAUTH_QUERY"
  | "PREAUTH_APPROVED"
  | "PREAUTH_REJECTED"
  | "ENHANCEMENT_CLAIMED"
  | "ENHANCEMENT_QUERY"
  | "ENHANCEMENT_APPROVED"
  | "ENHANCEMENT_REJECTED"
  | "FINAL_BILL_SUBMITTED"
  | "SETTLED"
  | "PARTIALLY_SETTLED"
  | "CLAIM_REJECTED"
  | "CLOSED"

export type InsuranceCompany = {
  id: string
  name: string
  tpaName: string | null
  contactNumber: string | null
  email: string | null
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type InsuranceClaim = {
  id: string
  claimNumber: string
  inPatientId: string
  insuranceCompanyId: string | null

  patientName: string
  ipNumber: string
  age: number
  gender: string
  phone: string
  guardianName: string | null
  department: string | null
  doctorNames: string
  operationName: string | null
  provisionDiagnosis: string | null
  admissionDate: Date
  dischargeDate: Date | null

  insuranceCompanyName: string
  tpaName: string | null
  policyNumber: string | null
  policyHolderName: string | null
  insuranceCardNumber: string | null
  relationToInsured: string | null

  packageAmount: number
  totalBillAmount: number
  preauthAmount: number
  enhancementAmount: number
  enhancementApproved: number
  totalApprovedAmount: number
  finalSettledAmount: number
  deductions: number
  discount: number
  patientPayableAmount: number
  patientPaidAmount: number
  patientBalance: number

  status: InsuranceClaimStatus

  preauthSubmittedDate: Date | null
  preauthApprovedDate: Date | null
  preauthRejectionReason: string | null
  preauthQueryNotes: string | null
  enhancementClaimedDate: Date | null
  enhancementApprovedDate: Date | null
  enhancementRejectionReason: string | null
  enhancementQueryNotes: string | null
  finalBillSubmittedDate: Date | null
  settlementDate: Date | null
  settlementReference: string | null

  statusHistory: string | null
  notes: string | null
  packageInclusions: string | null

  createdById: string | null
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export type InsuranceStatusHistoryEntry = {
  status: InsuranceClaimStatus
  date: string
  notes?: string
  updatedBy?: string
}
