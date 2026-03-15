-- Docsile HMS: Full Database Schema Migration
-- Translates Prisma schema (36 models) → Supabase PostgreSQL

-- ============================================================
-- 0. HELPER: auto-update "updatedAt" trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. AUTH & USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS "User" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email"            TEXT NOT NULL UNIQUE,
  "passwordHash"     TEXT NOT NULL,
  "fullName"         TEXT NOT NULL,
  "phone"            TEXT,
  "role"             TEXT NOT NULL DEFAULT 'RECEPTIONIST',
  "department"       TEXT,
  "designation"      TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "lastLogin"        TIMESTAMPTZ,
  "employeeId"       TEXT UNIQUE,
  "qualifications"   TEXT,
  "joiningDate"      TIMESTAMPTZ,
  "address"          TEXT,
  "emergencyContact" TEXT,
  "bloodGroup"       TEXT,
  "salary"           DOUBLE PRECISION,
  "salaryType"       TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_role ON "User"("role");
CREATE INDEX IF NOT EXISTS idx_user_department ON "User"("department");
CREATE INDEX IF NOT EXISTS idx_user_is_active ON "User"("isActive");
CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "Role" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_is_active ON "Role"("isActive");
CREATE TRIGGER trg_role_updated_at BEFORE UPDATE ON "Role"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. HOSPITAL PROFILE
-- ============================================================
CREATE TABLE IF NOT EXISTS "HospitalProfile" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"           TEXT NOT NULL,
  "displayName"    TEXT,
  "address"        TEXT,
  "phone"          TEXT,
  "email"          TEXT,
  "website"        TEXT,
  "logoUrl"        TEXT,
  "registrationNo" TEXT,
  "gstin"          TEXT,
  "settings"       TEXT NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_hospital_profile_updated_at BEFORE UPDATE ON "HospitalProfile"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. SERVICE TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS "ServiceTemplate" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "description" TEXT,
  "amount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_template_category ON "ServiceTemplate"("category");
CREATE INDEX IF NOT EXISTS idx_service_template_is_active ON "ServiceTemplate"("isActive");
CREATE TRIGGER trg_service_template_updated_at BEFORE UPDATE ON "ServiceTemplate"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "Patient" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "patientId"        TEXT NOT NULL UNIQUE,
  "firstName"        TEXT NOT NULL,
  "lastName"         TEXT,
  "dateOfBirth"      TIMESTAMPTZ,
  "age"              INTEGER,
  "gender"           TEXT NOT NULL,
  "phone"            TEXT NOT NULL,
  "email"            TEXT,
  "address"          TEXT,
  "guardianName"     TEXT,
  "guardianRelation" TEXT,
  "emergencyContact" TEXT,
  "referredBy"       TEXT,
  "doctorName"       TEXT,
  "department"       TEXT,
  "patientType"      TEXT NOT NULL DEFAULT 'OPD',
  "status"           TEXT NOT NULL DEFAULT 'REGISTERED',
  "appointmentDate"  TIMESTAMPTZ NOT NULL,
  "movedFromDate"    TIMESTAMPTZ,
  "movedToDate"      TIMESTAMPTZ,
  "moveReason"       TEXT,
  "notes"            TEXT,
  "createdById"      TEXT REFERENCES "User"("id"),
  "updatedBy"        TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_phone ON "Patient"("phone");
CREATE INDEX IF NOT EXISTS idx_patient_first_name ON "Patient"("firstName");
CREATE INDEX IF NOT EXISTS idx_patient_last_name ON "Patient"("lastName");
CREATE INDEX IF NOT EXISTS idx_patient_appointment_date ON "Patient"("appointmentDate");
CREATE INDEX IF NOT EXISTS idx_patient_patient_type ON "Patient"("patientType");
CREATE INDEX IF NOT EXISTS idx_patient_status ON "Patient"("status");
CREATE TRIGGER trg_patient_updated_at BEFORE UPDATE ON "Patient"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. PRESCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "Prescription" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prescriptionNumber" TEXT UNIQUE,
  "patientId"          TEXT NOT NULL REFERENCES "Patient"("patientId"),
  "patientType"        TEXT NOT NULL DEFAULT 'OPD',
  "doctorId"           TEXT REFERENCES "User"("id"),
  "doctorName"         TEXT,
  "department"         TEXT,
  "temperature"        DOUBLE PRECISION,
  "pulseRate"          INTEGER,
  "spo2"               INTEGER,
  "presentComplaint"   TEXT,
  "previousHistory"    TEXT,
  "diagnosis"          TEXT,
  "additionalNotes"    TEXT,
  "medicines"          TEXT NOT NULL DEFAULT '[]',
  "investigations"     TEXT NOT NULL DEFAULT '[]',
  "followUpDate"       TIMESTAMPTZ,
  "notes"              TEXT,
  "subtotal"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountReason"     TEXT,
  "total"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"        TEXT,
  "paymentDate"        TIMESTAMPTZ,
  "status"             TEXT NOT NULL DEFAULT 'DRAFT',
  "prescriptionDate"   TIMESTAMPTZ NOT NULL,
  "createdBy"          TEXT NOT NULL,
  "updatedBy"          TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prescription_patient_id ON "Prescription"("patientId");
CREATE INDEX IF NOT EXISTS idx_prescription_date ON "Prescription"("prescriptionDate");
CREATE INDEX IF NOT EXISTS idx_prescription_doctor_name ON "Prescription"("doctorName");
CREATE INDEX IF NOT EXISTS idx_prescription_status ON "Prescription"("status");
CREATE TRIGGER trg_prescription_updated_at BEFORE UPDATE ON "Prescription"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. INVOICE ITEMS (Prescription line items)
-- ============================================================
CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prescriptionId" TEXT NOT NULL REFERENCES "Prescription"("id") ON DELETE CASCADE,
  "description"    TEXT NOT NULL,
  "category"       TEXT,
  "quantity"       INTEGER NOT NULL DEFAULT 1,
  "unitPrice"      DOUBLE PRECISION NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "Payment" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prescriptionId" TEXT NOT NULL REFERENCES "Prescription"("id"),
  "amount"         DOUBLE PRECISION NOT NULL,
  "paymentMode"    TEXT NOT NULL,
  "paymentRef"     TEXT,
  "receivedBy"     TEXT,
  "paymentDate"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notes"          TEXT
);

-- ============================================================
-- 9. EYE READINGS (Workup Module)
-- ============================================================
CREATE TABLE IF NOT EXISTS "EyeReading" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "patientId"            TEXT NOT NULL REFERENCES "Patient"("patientId"),
  "prescriptionId"       TEXT UNIQUE REFERENCES "Prescription"("id"),
  "autoRefractometer"    TEXT,
  "glassesReading"       TEXT,
  "previousPrescription" TEXT,
  "presentPrescription"  TEXT,
  "clinicalFindings"     TEXT,
  "readingDate"          TIMESTAMPTZ NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdById"          TEXT REFERENCES "User"("id"),
  "updatedBy"            TEXT,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eye_reading_patient_id ON "EyeReading"("patientId");
CREATE INDEX IF NOT EXISTS idx_eye_reading_date ON "EyeReading"("readingDate");
CREATE INDEX IF NOT EXISTS idx_eye_reading_status ON "EyeReading"("status");
CREATE TRIGGER trg_eye_reading_updated_at BEFORE UPDATE ON "EyeReading"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 10. PREDEFINED TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS "PredefinedTemplate" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"                 TEXT NOT NULL UNIQUE,
  "name"                 TEXT NOT NULL,
  "presentComplaint"     TEXT,
  "previousHistory"      TEXT,
  "provisionalDiagnosis" TEXT,
  "medicines"            TEXT NOT NULL DEFAULT '[]',
  "investigations"       TEXT NOT NULL DEFAULT '[]',
  "followUpDays"         INTEGER,
  "additionalNotes"      TEXT,
  "isActive"             BOOLEAN NOT NULL DEFAULT true,
  "createdBy"            TEXT NOT NULL,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_predefined_template_code ON "PredefinedTemplate"("code");
CREATE INDEX IF NOT EXISTS idx_predefined_template_is_active ON "PredefinedTemplate"("isActive");
CREATE TRIGGER trg_predefined_template_updated_at BEFORE UPDATE ON "PredefinedTemplate"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 11. MEDICINE MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS "MedicineMaster" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"          TEXT NOT NULL UNIQUE,
  "defaultTiming" TEXT,
  "defaultDays"   TEXT,
  "category"      TEXT,
  "note"          TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "createdBy"     TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medicine_master_category ON "MedicineMaster"("category");
CREATE INDEX IF NOT EXISTS idx_medicine_master_is_active ON "MedicineMaster"("isActive");
CREATE TRIGGER trg_medicine_master_updated_at BEFORE UPDATE ON "MedicineMaster"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 12. INVESTIGATION MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS "InvestigationMaster" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL UNIQUE,
  "category"    TEXT,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investigation_master_category ON "InvestigationMaster"("category");
CREATE INDEX IF NOT EXISTS idx_investigation_master_is_active ON "InvestigationMaster"("isActive");
CREATE TRIGGER trg_investigation_master_updated_at BEFORE UPDATE ON "InvestigationMaster"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 13. DROPDOWN OPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "DropdownOption" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fieldName" TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("fieldName", "value")
);
CREATE INDEX IF NOT EXISTS idx_dropdown_option_field_name ON "DropdownOption"("fieldName");

-- ============================================================
-- 14. PREDEFINED PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS "PredefinedPackage" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL UNIQUE,
  "inclusions"  TEXT NOT NULL DEFAULT '[]',
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_predefined_package_is_active ON "PredefinedPackage"("isActive");
CREATE TRIGGER trg_predefined_package_updated_at BEFORE UPDATE ON "PredefinedPackage"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 15. INPATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "InPatient" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "patientId"           TEXT NOT NULL UNIQUE REFERENCES "Patient"("id"),
  "ipNumber"            TEXT NOT NULL UNIQUE,
  "name"                TEXT NOT NULL,
  "age"                 INTEGER NOT NULL,
  "gender"              TEXT NOT NULL,
  "phone"               TEXT NOT NULL,
  "address"             TEXT,
  "dateOfBirth"         TIMESTAMPTZ,
  "guardianName"        TEXT,
  "admissionDate"       TIMESTAMPTZ NOT NULL,
  "admissionNotes"      TEXT,
  "referredBy"          TEXT,
  "department"          TEXT,
  "doctorNames"         TEXT NOT NULL DEFAULT '[]',
  "onDutyDoctor"        TEXT,
  "operationName"       TEXT,
  "operationDate"       TIMESTAMPTZ,
  "operationProcedure"  TEXT,
  "operationDetails"    TEXT,
  "provisionDiagnosis"  TEXT,
  "medicalValues"       TEXT,
  "packageAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "packageInclusions"   TEXT,
  "discount"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalReceivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentRecords"      TEXT,
  "prescriptions"       TEXT,
  "followUpDate"        TIMESTAMPTZ,
  "status"              TEXT NOT NULL DEFAULT 'ADMITTED',
  "dischargeDate"       TIMESTAMPTZ,
  "dischargeNotes"      TEXT,
  "bedNumber"           TEXT,
  "wardName"            TEXT,
  "createdById"         TEXT REFERENCES "User"("id"),
  "updatedBy"           TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inpatient_status ON "InPatient"("status");
CREATE INDEX IF NOT EXISTS idx_inpatient_admission_date ON "InPatient"("admissionDate");
CREATE INDEX IF NOT EXISTS idx_inpatient_department ON "InPatient"("department");
CREATE TRIGGER trg_inpatient_updated_at BEFORE UPDATE ON "InPatient"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 16. INSURANCE COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS "InsuranceCompany" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"          TEXT NOT NULL UNIQUE,
  "tpaName"       TEXT,
  "contactNumber" TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insurance_company_is_active ON "InsuranceCompany"("isActive");
CREATE TRIGGER trg_insurance_company_updated_at BEFORE UPDATE ON "InsuranceCompany"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 17. INSURANCE CLAIMS
-- ============================================================
CREATE TABLE IF NOT EXISTS "InsuranceClaim" (
  "id"                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "claimNumber"                 TEXT NOT NULL UNIQUE,
  "inPatientId"                 TEXT NOT NULL REFERENCES "InPatient"("id"),
  "insuranceCompanyId"          TEXT REFERENCES "InsuranceCompany"("id"),
  "patientName"                 TEXT NOT NULL,
  "ipNumber"                    TEXT NOT NULL,
  "age"                         INTEGER NOT NULL,
  "gender"                      TEXT NOT NULL,
  "phone"                       TEXT NOT NULL,
  "guardianName"                TEXT,
  "department"                  TEXT,
  "doctorNames"                 TEXT NOT NULL DEFAULT '[]',
  "operationName"               TEXT,
  "provisionDiagnosis"          TEXT,
  "admissionDate"               TIMESTAMPTZ NOT NULL,
  "dischargeDate"               TIMESTAMPTZ,
  "insuranceCompanyName"        TEXT NOT NULL,
  "tpaName"                     TEXT,
  "policyNumber"                TEXT,
  "policyHolderName"            TEXT,
  "insuranceCardNumber"         TEXT,
  "relationToInsured"           TEXT,
  "packageAmount"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalBillAmount"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "preauthAmount"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "enhancementAmount"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "enhancementApproved"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalApprovedAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalSettledAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deductions"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"                    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "patientPayableAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "patientPaidAmount"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "patientBalance"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"                      TEXT NOT NULL DEFAULT 'PREAUTH_SUBMITTED',
  "preauthSubmittedDate"        TIMESTAMPTZ,
  "preauthApprovedDate"         TIMESTAMPTZ,
  "preauthRejectionReason"      TEXT,
  "preauthQueryNotes"           TEXT,
  "enhancementClaimedDate"      TIMESTAMPTZ,
  "enhancementApprovedDate"     TIMESTAMPTZ,
  "enhancementRejectionReason"  TEXT,
  "enhancementQueryNotes"       TEXT,
  "finalBillSubmittedDate"      TIMESTAMPTZ,
  "settlementDate"              TIMESTAMPTZ,
  "settlementReference"         TEXT,
  "statusHistory"               TEXT,
  "notes"                       TEXT,
  "packageInclusions"           TEXT,
  "createdById"                 TEXT REFERENCES "User"("id"),
  "updatedBy"                   TEXT,
  "createdAt"                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insurance_claim_status ON "InsuranceClaim"("status");
CREATE INDEX IF NOT EXISTS idx_insurance_claim_company_name ON "InsuranceClaim"("insuranceCompanyName");
CREATE INDEX IF NOT EXISTS idx_insurance_claim_created_at ON "InsuranceClaim"("createdAt");
CREATE INDEX IF NOT EXISTS idx_insurance_claim_inpatient_id ON "InsuranceClaim"("inPatientId");
CREATE TRIGGER trg_insurance_claim_updated_at BEFORE UPDATE ON "InsuranceClaim"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 18. LAB
-- ============================================================
CREATE TABLE IF NOT EXISTS "Lab" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "location"    TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_lab_updated_at BEFORE UPDATE ON "Lab"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 19. LAB INVESTIGATION (junction: Lab ↔ InvestigationMaster)
-- ============================================================
CREATE TABLE IF NOT EXISTS "LabInvestigation" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "labId"           TEXT NOT NULL REFERENCES "Lab"("id") ON DELETE CASCADE,
  "investigationId" TEXT NOT NULL REFERENCES "InvestigationMaster"("id") ON DELETE CASCADE,
  "amount"          DOUBLE PRECISION NOT NULL,
  "isDefault"       BOOLEAN NOT NULL DEFAULT false,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE("labId", "investigationId")
);
CREATE INDEX IF NOT EXISTS idx_lab_investigation_inv_id ON "LabInvestigation"("investigationId");

-- ============================================================
-- 20. LAB BILL
-- ============================================================
CREATE TABLE IF NOT EXISTS "LabBill" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "billNumber"     TEXT NOT NULL UNIQUE,
  "labId"          TEXT NOT NULL REFERENCES "Lab"("id"),
  "patientId"      TEXT NOT NULL REFERENCES "Patient"("patientId"),
  "prescriptionId" TEXT NOT NULL REFERENCES "Prescription"("id"),
  "subtotal"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountReason" TEXT,
  "total"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"    TEXT,
  "paymentDate"    TIMESTAMPTZ,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "notes"          TEXT,
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_bill_patient_id ON "LabBill"("patientId");
CREATE INDEX IF NOT EXISTS idx_lab_bill_lab_id ON "LabBill"("labId");
CREATE INDEX IF NOT EXISTS idx_lab_bill_status ON "LabBill"("status");
CREATE INDEX IF NOT EXISTS idx_lab_bill_created_at ON "LabBill"("createdAt");
CREATE TRIGGER trg_lab_bill_updated_at BEFORE UPDATE ON "LabBill"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 21. LAB BILL ITEM
-- ============================================================
CREATE TABLE IF NOT EXISTS "LabBillItem" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "labBillId"       TEXT NOT NULL REFERENCES "LabBill"("id") ON DELETE CASCADE,
  "investigationId" TEXT,
  "name"            TEXT NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 22. LAB PAYMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS "LabPayment" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "labBillId"   TEXT NOT NULL REFERENCES "LabBill"("id") ON DELETE CASCADE,
  "amount"      DOUBLE PRECISION NOT NULL,
  "paymentMode" TEXT NOT NULL,
  "paymentRef"  TEXT,
  "receivedBy"  TEXT,
  "paymentDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notes"       TEXT
);

-- ============================================================
-- 23. EXPENSE CATEGORY
-- ============================================================
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"      TEXT NOT NULL UNIQUE,
  "color"     TEXT NOT NULL DEFAULT '#6B7280',
  "icon"      TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_category_is_active ON "ExpenseCategory"("isActive");
CREATE INDEX IF NOT EXISTS idx_expense_category_sort_order ON "ExpenseCategory"("sortOrder");
CREATE TRIGGER trg_expense_category_updated_at BEFORE UPDATE ON "ExpenseCategory"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 24. EXPENSE
-- ============================================================
CREATE TABLE IF NOT EXISTS "Expense" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title"       TEXT NOT NULL,
  "categoryId"  TEXT NOT NULL REFERENCES "ExpenseCategory"("id"),
  "amount"      DOUBLE PRECISION NOT NULL,
  "date"        TIMESTAMPTZ NOT NULL,
  "reason"      TEXT,
  "paymentMode" TEXT,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_category_id ON "Expense"("categoryId");
CREATE INDEX IF NOT EXISTS idx_expense_date ON "Expense"("date");
CREATE INDEX IF NOT EXISTS idx_expense_created_at ON "Expense"("createdAt");
CREATE TRIGGER trg_expense_updated_at BEFORE UPDATE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 25. PHARMACY MEDICINE
-- ============================================================
CREATE TABLE IF NOT EXISTS "PharmacyMedicine" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"          TEXT NOT NULL,
  "genericName"   TEXT,
  "manufacturer"  TEXT,
  "composition"   TEXT,
  "category"      TEXT,
  "dosageForm"    TEXT,
  "strength"      TEXT,
  "unitOfMeasure" TEXT NOT NULL DEFAULT 'Nos',
  "hsnCode"       TEXT,
  "gstPercent"    DOUBLE PRECISION NOT NULL DEFAULT 12,
  "scheduleType"  TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdBy"     TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("name", "manufacturer")
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicine_name ON "PharmacyMedicine"("name");
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicine_generic ON "PharmacyMedicine"("genericName");
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicine_category ON "PharmacyMedicine"("category");
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicine_is_active ON "PharmacyMedicine"("isActive");
CREATE TRIGGER trg_pharmacy_medicine_updated_at BEFORE UPDATE ON "PharmacyMedicine"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 26. PHARMACY SUPPLIER
-- ============================================================
CREATE TABLE IF NOT EXISTS "PharmacySupplier" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"           TEXT NOT NULL UNIQUE,
  "contactPerson"  TEXT,
  "phone"          TEXT,
  "email"          TEXT,
  "address"        TEXT,
  "gstin"          TEXT,
  "drugLicenseNo"  TEXT,
  "creditDays"     INTEGER NOT NULL DEFAULT 30,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdBy"      TEXT NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_supplier_is_active ON "PharmacySupplier"("isActive");
CREATE TRIGGER trg_pharmacy_supplier_updated_at BEFORE UPDATE ON "PharmacySupplier"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 27. PHARMACY STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS "PharmacyStock" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "medicineId"        TEXT NOT NULL REFERENCES "PharmacyMedicine"("id") ON DELETE CASCADE,
  "batchNumber"       TEXT NOT NULL,
  "quantity"          INTEGER NOT NULL DEFAULT 0,
  "mrp"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costPrice"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"        DOUBLE PRECISION NOT NULL DEFAULT 12,
  "unitsPerPack"      INTEGER NOT NULL DEFAULT 1,
  "expiryDate"        TIMESTAMPTZ NOT NULL,
  "manufacturingDate" TIMESTAMPTZ,
  "supplierId"        TEXT REFERENCES "PharmacySupplier"("id"),
  "purchaseOrderId"   TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdBy"         TEXT NOT NULL,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("medicineId", "batchNumber")
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_medicine_id ON "PharmacyStock"("medicineId");
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_batch ON "PharmacyStock"("batchNumber");
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_expiry ON "PharmacyStock"("expiryDate");
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_supplier ON "PharmacyStock"("supplierId");
CREATE TRIGGER trg_pharmacy_stock_updated_at BEFORE UPDATE ON "PharmacyStock"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 28. PURCHASE ORDER
-- ============================================================
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderNumber"   TEXT NOT NULL UNIQUE,
  "supplierId"    TEXT NOT NULL REFERENCES "PharmacySupplier"("id"),
  "orderDate"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expectedDate"  TIMESTAMPTZ,
  "invoiceNumber" TEXT,
  "invoiceDate"   TIMESTAMPTZ,
  "subtotal"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"   TEXT,
  "status"        TEXT NOT NULL DEFAULT 'DRAFT',
  "notes"         TEXT,
  "createdBy"     TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier ON "PurchaseOrder"("supplierId");
CREATE INDEX IF NOT EXISTS idx_purchase_order_status ON "PurchaseOrder"("status");
CREATE INDEX IF NOT EXISTS idx_purchase_order_date ON "PurchaseOrder"("orderDate");
CREATE TRIGGER trg_purchase_order_updated_at BEFORE UPDATE ON "PurchaseOrder"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 29. PURCHASE ORDER ITEM
-- ============================================================
CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "purchaseOrderId" TEXT NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE,
  "medicineId"      TEXT NOT NULL REFERENCES "PharmacyMedicine"("id"),
  "batchNumber"     TEXT,
  "quantity"        INTEGER NOT NULL DEFAULT 0,
  "receivedQty"     INTEGER NOT NULL DEFAULT 0,
  "costPrice"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mrp"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"      DOUBLE PRECISION NOT NULL DEFAULT 12,
  "expiryDate"      TIMESTAMPTZ,
  "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_item_po ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS idx_purchase_order_item_medicine ON "PurchaseOrderItem"("medicineId");

-- ============================================================
-- 30. PHARMACY BILL
-- ============================================================
CREATE TABLE IF NOT EXISTS "PharmacyBill" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "billNumber"      TEXT NOT NULL UNIQUE,
  "patientId"       TEXT,
  "patientName"     TEXT NOT NULL,
  "patientPhone"    TEXT,
  "gender"          TEXT,
  "email"           TEXT,
  "referredDoctor"  TEXT,
  "prescriptionId"  TEXT,
  "billDate"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "subtotal"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roundOff"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "billAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"     TEXT NOT NULL DEFAULT 'CASH',
  "paymentRef"      TEXT,
  "status"          TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdBy"       TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_bill_patient ON "PharmacyBill"("patientId");
CREATE INDEX IF NOT EXISTS idx_pharmacy_bill_date ON "PharmacyBill"("billDate");
CREATE INDEX IF NOT EXISTS idx_pharmacy_bill_status ON "PharmacyBill"("status");
CREATE TRIGGER trg_pharmacy_bill_updated_at BEFORE UPDATE ON "PharmacyBill"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 31. PHARMACY BILL ITEM
-- ============================================================
CREATE TABLE IF NOT EXISTS "PharmacyBillItem" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "billId"          TEXT NOT NULL REFERENCES "PharmacyBill"("id") ON DELETE CASCADE,
  "stockId"         TEXT NOT NULL REFERENCES "PharmacyStock"("id"),
  "medicineName"    TEXT NOT NULL,
  "batchNumber"     TEXT NOT NULL,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "mrp"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"      DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_bill_item_bill ON "PharmacyBillItem"("billId");
CREATE INDEX IF NOT EXISTS idx_pharmacy_bill_item_stock ON "PharmacyBillItem"("stockId");

-- ============================================================
-- 32. LICENSE TRACKER
-- ============================================================
CREATE TABLE IF NOT EXISTS "License" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"           TEXT NOT NULL,
  "licenseNumber"  TEXT,
  "issuingBody"    TEXT,
  "category"       TEXT,
  "issueDate"      TIMESTAMPTZ,
  "expiryDate"     TIMESTAMPTZ NOT NULL,
  "reminderDays"   INTEGER NOT NULL DEFAULT 30,
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes"          TEXT,
  "documentUrl"    TEXT,
  "createdBy"      TEXT NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_license_expiry ON "License"("expiryDate");
CREATE INDEX IF NOT EXISTS idx_license_status ON "License"("status");
CREATE INDEX IF NOT EXISTS idx_license_category ON "License"("category");
CREATE TRIGGER trg_license_updated_at BEFORE UPDATE ON "License"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 33. OPTICAL PRODUCT
-- ============================================================
CREATE TABLE IF NOT EXISTS "OpticalProduct" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL,
  "brand"       TEXT,
  "category"    TEXT NOT NULL,
  "type"        TEXT,
  "material"    TEXT,
  "color"       TEXT,
  "size"        TEXT,
  "coating"     TEXT,
  "index"       TEXT,
  "modelNumber" TEXT,
  "hsnCode"     TEXT,
  "gstPercent"  DOUBLE PRECISION NOT NULL DEFAULT 12,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("name", "brand")
);
CREATE INDEX IF NOT EXISTS idx_optical_product_name ON "OpticalProduct"("name");
CREATE INDEX IF NOT EXISTS idx_optical_product_brand ON "OpticalProduct"("brand");
CREATE INDEX IF NOT EXISTS idx_optical_product_category ON "OpticalProduct"("category");
CREATE INDEX IF NOT EXISTS idx_optical_product_is_active ON "OpticalProduct"("isActive");
CREATE TRIGGER trg_optical_product_updated_at BEFORE UPDATE ON "OpticalProduct"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 34. OPTICAL STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS "OpticalStock" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId"  TEXT NOT NULL REFERENCES "OpticalProduct"("id") ON DELETE CASCADE,
  "batchNumber" TEXT,
  "quantity"   INTEGER NOT NULL DEFAULT 0,
  "mrp"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costPrice"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
  "power"      TEXT,
  "supplierId" TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdBy"  TEXT NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("productId", "batchNumber", "power")
);
CREATE INDEX IF NOT EXISTS idx_optical_stock_product ON "OpticalStock"("productId");
CREATE INDEX IF NOT EXISTS idx_optical_stock_supplier ON "OpticalStock"("supplierId");
CREATE TRIGGER trg_optical_stock_updated_at BEFORE UPDATE ON "OpticalStock"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 35. OPTICAL BILL
-- ============================================================
CREATE TABLE IF NOT EXISTS "OpticalBill" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "billNumber"       TEXT NOT NULL UNIQUE,
  "patientId"        TEXT,
  "patientName"      TEXT NOT NULL,
  "patientPhone"     TEXT,
  "gender"           TEXT,
  "referredDoctor"   TEXT,
  "prescriptionId"   TEXT,
  "lensPrescription" TEXT,
  "billDate"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "subtotal"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roundOff"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "billAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"      TEXT NOT NULL DEFAULT 'CASH',
  "paymentRef"       TEXT,
  "deliveryDate"     TIMESTAMPTZ,
  "orderNotes"       TEXT,
  "status"           TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdBy"        TEXT NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_optical_bill_patient ON "OpticalBill"("patientId");
CREATE INDEX IF NOT EXISTS idx_optical_bill_date ON "OpticalBill"("billDate");
CREATE INDEX IF NOT EXISTS idx_optical_bill_status ON "OpticalBill"("status");
CREATE TRIGGER trg_optical_bill_updated_at BEFORE UPDATE ON "OpticalBill"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 36. OPTICAL BILL ITEM
-- ============================================================
CREATE TABLE IF NOT EXISTS "OpticalBillItem" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "billId"          TEXT NOT NULL REFERENCES "OpticalBill"("id") ON DELETE CASCADE,
  "stockId"         TEXT REFERENCES "OpticalStock"("id"),
  "itemName"        TEXT NOT NULL,
  "category"        TEXT NOT NULL,
  "eye"             TEXT,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "mrp"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"      DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_optical_bill_item_bill ON "OpticalBillItem"("billId");
CREATE INDEX IF NOT EXISTS idx_optical_bill_item_stock ON "OpticalBillItem"("stockId");

-- ============================================================
-- DONE: 36 tables created with all relations, indexes, and triggers
-- ============================================================
