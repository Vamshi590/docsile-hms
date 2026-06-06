export type Lookups = {
  userByLegacyId: Map<string, string>
  userByUsername: Map<string, string>
  defaultUserId: string | null

  // Patient.patientId (text like "0158") → Patient.id (cuid)
  patientById: Map<string, string>
  patientByLegacyUuid: Map<string, string>

  // PharmacyStock lookup: medicineId (legacy) → new stockId
  pharmacyStockByLegacyMedicineId: Map<string, string>
  // OpticalStock lookup: opticalId (legacy) → new stockId
  opticalStockByLegacyId: Map<string, string>

  // Lab lookup by name → id
  labByName: Map<string, string>

  // Prescription lookup by `${patientId}::${yyyy-mm-dd}` → prescription.id
  prescriptionByPatientDate: Map<string, string>

  // Expense category by lowercase name → id
  expenseCategoryByName: Map<string, string>
}

export function emptyLookups(): Lookups {
  return {
    userByLegacyId: new Map(),
    userByUsername: new Map(),
    defaultUserId: null,
    patientById: new Map(),
    patientByLegacyUuid: new Map(),
    pharmacyStockByLegacyMedicineId: new Map(),
    opticalStockByLegacyId: new Map(),
    labByName: new Map(),
    prescriptionByPatientDate: new Map(),
    expenseCategoryByName: new Map(),
  }
}
