-- Docsile HMS - Hospital Database Setup Script
-- Run this once against a fresh PostgreSQL database to set up all tables.
-- Compatible with: PostgreSQL 13+
--
-- Usage:
--   psql -U <user> -d <database> -f create-hospital-db.sql
--
-- Or with connection string:
--   psql "postgresql://user:password@host:5432/dbname" -f create-hospital-db.sql

-- ─── AUTH & USERS ───────────────────────────────────

CREATE TABLE "User" (
  "id"               TEXT        NOT NULL,
  "email"            TEXT        NOT NULL,
  "passwordHash"     TEXT        NOT NULL,
  "fullName"         TEXT        NOT NULL,
  "phone"            TEXT,
  "role"             TEXT        NOT NULL DEFAULT 'RECEPTIONIST',
  "department"       TEXT,
  "designation"      TEXT,
  "isActive"         BOOLEAN     NOT NULL DEFAULT TRUE,
  "lastLogin"        TIMESTAMP(3),
  "employeeId"       TEXT,
  "qualifications"   TEXT,
  "joiningDate"      TIMESTAMP(3),
  "address"          TEXT,
  "emergencyContact" TEXT,
  "bloodGroup"       TEXT,
  "salary"           DOUBLE PRECISION,
  "salaryType"       TEXT,
  "preferences"      TEXT        NOT NULL DEFAULT '{}',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key"      ON "User"("email");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
CREATE INDEX "User_role_idx"             ON "User"("role");
CREATE INDEX "User_department_idx"       ON "User"("department");
CREATE INDEX "User_isActive_idx"         ON "User"("isActive");

-- ─── ROLES & PERMISSIONS ──────────────────────────────

CREATE TABLE "Role" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "displayName" TEXT        NOT NULL,
  "description" TEXT,
  "permissions" TEXT        NOT NULL DEFAULT '[]',
  "isSystem"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE INDEX "Role_isActive_idx"    ON "Role"("isActive");

-- ─── HOSPITAL PROFILE ───────────────────────────────

CREATE TABLE "HospitalProfile" (
  "id"             TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "displayName"    TEXT,
  "address"        TEXT,
  "phone"          TEXT,
  "email"          TEXT,
  "website"        TEXT,
  "logoUrl"        TEXT,
  "registrationNo" TEXT,
  "gstin"          TEXT,
  "settings"       TEXT        NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HospitalProfile_pkey" PRIMARY KEY ("id")
);

-- ─── SERVICE TEMPLATES ──────────────────────────────

CREATE TABLE "ServiceTemplate" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "category"    TEXT        NOT NULL,
  "description" TEXT,
  "amount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "sortOrder"   INTEGER     NOT NULL DEFAULT 0,
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceTemplate_category_idx" ON "ServiceTemplate"("category");
CREATE INDEX "ServiceTemplate_isActive_idx" ON "ServiceTemplate"("isActive");

-- ─── PATIENTS ───────────────────────────────────────

CREATE TABLE "Patient" (
  "id"               TEXT        NOT NULL,
  "patientId"        TEXT        NOT NULL,
  "firstName"        TEXT        NOT NULL,
  "lastName"         TEXT,
  "dateOfBirth"      TIMESTAMP(3),
  "age"              INTEGER,
  "gender"           TEXT        NOT NULL,
  "phone"            TEXT        NOT NULL,
  "email"            TEXT,
  "address"          TEXT,
  "guardianName"     TEXT,
  "guardianRelation" TEXT,
  "emergencyContact" TEXT,
  "referredBy"       TEXT,
  "doctorName"       TEXT,
  "department"       TEXT,
  "patientType"      TEXT        NOT NULL DEFAULT 'OPD',
  "status"           TEXT        NOT NULL DEFAULT 'REGISTERED',
  "appointmentDate"  TIMESTAMP(3) NOT NULL,
  "movedFromDate"    TIMESTAMP(3),
  "movedToDate"      TIMESTAMP(3),
  "moveReason"       TEXT,
  "notes"            TEXT,
  "createdById"      TEXT,
  "updatedBy"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Patient_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Patient_patientId_key"     ON "Patient"("patientId");
CREATE INDEX "Patient_phone_idx"                ON "Patient"("phone");
CREATE INDEX "Patient_firstName_idx"            ON "Patient"("firstName");
CREATE INDEX "Patient_lastName_idx"             ON "Patient"("lastName");
CREATE INDEX "Patient_appointmentDate_idx"      ON "Patient"("appointmentDate");
CREATE INDEX "Patient_patientType_idx"          ON "Patient"("patientType");
CREATE INDEX "Patient_status_idx"               ON "Patient"("status");

-- ─── PRESCRIPTIONS ──────────────────────────────────

CREATE TABLE "Prescription" (
  "id"                 TEXT        NOT NULL,
  "prescriptionNumber" TEXT,
  "patientId"          TEXT        NOT NULL,
  "patientType"        TEXT        NOT NULL DEFAULT 'OPD',
  "doctorId"           TEXT,
  "doctorName"         TEXT,
  "department"         TEXT,
  "temperature"        DOUBLE PRECISION,
  "pulseRate"          INTEGER,
  "spo2"               INTEGER,
  "presentComplaint"   TEXT,
  "previousHistory"    TEXT,
  "diagnosis"          TEXT,
  "additionalNotes"    TEXT,
  "medicines"          TEXT        NOT NULL DEFAULT '[]',
  "investigations"     TEXT        NOT NULL DEFAULT '[]',
  "followUpDate"       TIMESTAMP(3),
  "notes"              TEXT,
  "subtotal"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountReason"     TEXT,
  "total"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"        TEXT,
  "paymentDate"        TIMESTAMP(3),
  "status"             TEXT        NOT NULL DEFAULT 'DRAFT',
  "prescriptionDate"   TIMESTAMP(3) NOT NULL,
  "createdBy"          TEXT        NOT NULL,
  "updatedBy"          TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Prescription_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Prescription_doctorId_fkey"  FOREIGN KEY ("doctorId")  REFERENCES "User"("id")           ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Prescription_prescriptionNumber_key" ON "Prescription"("prescriptionNumber");
CREATE INDEX "Prescription_patientId_idx"                 ON "Prescription"("patientId");
CREATE INDEX "Prescription_prescriptionDate_idx"          ON "Prescription"("prescriptionDate");
CREATE INDEX "Prescription_doctorName_idx"                ON "Prescription"("doctorName");
CREATE INDEX "Prescription_status_idx"                    ON "Prescription"("status");

-- ─── PRESCRIPTION LINE ITEMS ─────────────────────────

CREATE TABLE "InvoiceItem" (
  "id"             TEXT    NOT NULL,
  "prescriptionId" TEXT    NOT NULL,
  "description"    TEXT    NOT NULL,
  "category"       TEXT,
  "quantity"       INTEGER NOT NULL DEFAULT 1,
  "unitPrice"      DOUBLE PRECISION NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "InvoiceItem_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─── PAYMENTS ────────────────────────────────────────

CREATE TABLE "Payment" (
  "id"             TEXT        NOT NULL,
  "prescriptionId" TEXT        NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "paymentMode"    TEXT        NOT NULL,
  "paymentRef"     TEXT,
  "receivedBy"     TEXT,
  "paymentDate"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"          TEXT,

  CONSTRAINT "Payment_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "Payment_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─── EYE READINGS ───────────────────────────────────

CREATE TABLE "EyeReading" (
  "id"                   TEXT        NOT NULL,
  "patientId"            TEXT        NOT NULL,
  "prescriptionId"       TEXT,
  "autoRefractometer"    TEXT,
  "glassesReading"       TEXT,
  "previousPrescription" TEXT,
  "presentPrescription"  TEXT,
  "clinicalFindings"     TEXT,
  "readingDate"          TIMESTAMP(3) NOT NULL,
  "status"               TEXT        NOT NULL DEFAULT 'COMPLETED',
  "createdById"          TEXT,
  "updatedBy"            TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EyeReading_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "EyeReading_patientId_fkey"   FOREIGN KEY ("patientId")      REFERENCES "Patient"("patientId")     ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EyeReading_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id")   ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EyeReading_createdById_fkey" FOREIGN KEY ("createdById")    REFERENCES "User"("id")               ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EyeReading_prescriptionId_key" ON "EyeReading"("prescriptionId");
CREATE INDEX "EyeReading_patientId_idx"             ON "EyeReading"("patientId");
CREATE INDEX "EyeReading_readingDate_idx"           ON "EyeReading"("readingDate");
CREATE INDEX "EyeReading_status_idx"                ON "EyeReading"("status");

-- ─── PREDEFINED TEMPLATES ────────────────────────────

CREATE TABLE "PredefinedTemplate" (
  "id"                   TEXT        NOT NULL,
  "code"                 TEXT        NOT NULL,
  "name"                 TEXT        NOT NULL,
  "presentComplaint"     TEXT,
  "previousHistory"      TEXT,
  "provisionalDiagnosis" TEXT,
  "medicines"            TEXT        NOT NULL DEFAULT '[]',
  "investigations"       TEXT        NOT NULL DEFAULT '[]',
  "followUpDays"         INTEGER,
  "additionalNotes"      TEXT,
  "isActive"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"            TEXT        NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PredefinedTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredefinedTemplate_code_key" ON "PredefinedTemplate"("code");
CREATE INDEX "PredefinedTemplate_code_idx"        ON "PredefinedTemplate"("code");
CREATE INDEX "PredefinedTemplate_isActive_idx"    ON "PredefinedTemplate"("isActive");

-- ─── INPATIENT TEMPLATES ─────────────────────────────

CREATE TABLE "InpatientTemplate" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "code"               TEXT        NOT NULL,
  "name"               TEXT        NOT NULL,
  "operationName"      TEXT,
  "provisionDiagnosis" TEXT,
  "medicines"          TEXT        NOT NULL DEFAULT '[]',
  "followUpDays"       INTEGER,
  "additionalNotes"    TEXT,
  "isActive"           BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"          TEXT        NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InpatientTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InpatientTemplate_code_key" ON "InpatientTemplate"("code");
CREATE INDEX "InpatientTemplate_code_idx"        ON "InpatientTemplate"("code");
CREATE INDEX "InpatientTemplate_isActive_idx"    ON "InpatientTemplate"("isActive");

-- ─── MEDICINE MASTER ─────────────────────────────────

CREATE TABLE "MedicineMaster" (
  "id"            TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "defaultTiming" TEXT,
  "defaultDays"   TEXT,
  "category"      TEXT,
  "note"          TEXT,
  "isActive"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "sortOrder"     INTEGER     NOT NULL DEFAULT 0,
  "createdBy"     TEXT        NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MedicineMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicineMaster_name_key"  ON "MedicineMaster"("name");
CREATE INDEX "MedicineMaster_category_idx"     ON "MedicineMaster"("category");
CREATE INDEX "MedicineMaster_isActive_idx"     ON "MedicineMaster"("isActive");

-- ─── INVESTIGATION MASTER ────────────────────────────

CREATE TABLE "InvestigationMaster" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "category"    TEXT,
  "description" TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "sortOrder"   INTEGER     NOT NULL DEFAULT 0,
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvestigationMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestigationMaster_name_key"  ON "InvestigationMaster"("name");
CREATE INDEX "InvestigationMaster_category_idx"     ON "InvestigationMaster"("category");
CREATE INDEX "InvestigationMaster_isActive_idx"     ON "InvestigationMaster"("isActive");

-- ─── DROPDOWN OPTIONS ────────────────────────────────

CREATE TABLE "DropdownOption" (
  "id"        TEXT        NOT NULL,
  "fieldName" TEXT        NOT NULL,
  "value"     TEXT        NOT NULL,
  "createdBy" TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DropdownOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DropdownOption_fieldName_value_key" ON "DropdownOption"("fieldName", "value");
CREATE INDEX "DropdownOption_fieldName_idx"              ON "DropdownOption"("fieldName");

-- ─── PREDEFINED PACKAGES ────────────────────────────

CREATE TABLE "PredefinedPackage" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "inclusions"  TEXT        NOT NULL DEFAULT '[]',
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PredefinedPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredefinedPackage_name_key" ON "PredefinedPackage"("name");
CREATE INDEX "PredefinedPackage_isActive_idx"    ON "PredefinedPackage"("isActive");

-- ─── INPATIENTS ─────────────────────────────────────

CREATE TABLE "InPatient" (
  "id"                  TEXT        NOT NULL,
  "patientId"           TEXT        NOT NULL,
  "ipNumber"            TEXT        NOT NULL,
  "name"                TEXT        NOT NULL,
  "age"                 INTEGER     NOT NULL,
  "gender"              TEXT        NOT NULL,
  "phone"               TEXT        NOT NULL,
  "address"             TEXT,
  "dateOfBirth"         TIMESTAMP(3),
  "guardianName"        TEXT,
  "admissionDate"       TIMESTAMP(3) NOT NULL,
  "admissionNotes"      TEXT,
  "referredBy"          TEXT,
  "department"          TEXT,
  "doctorNames"         TEXT        NOT NULL DEFAULT '[]',
  "onDutyDoctors"       TEXT        NOT NULL DEFAULT '[]',
  "operationName"       TEXT,
  "operationDate"       TIMESTAMP(3),
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
  "followUpDate"        TIMESTAMP(3),
  "status"              TEXT        NOT NULL DEFAULT 'ADMITTED',
  "dischargeDate"       TIMESTAMP(3),
  "dischargeNotes"      TEXT,
  "bedNumber"           TEXT,
  "wardName"            TEXT,
  "createdById"         TEXT,
  "updatedBy"           TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InPatient_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "InPatient_patientId_fkey" FOREIGN KEY ("patientId")   REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InPatient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InPatient_patientId_key" ON "InPatient"("patientId");
CREATE UNIQUE INDEX "InPatient_ipNumber_key"  ON "InPatient"("ipNumber");
CREATE INDEX "InPatient_status_idx"           ON "InPatient"("status");
CREATE INDEX "InPatient_admissionDate_idx"    ON "InPatient"("admissionDate");
CREATE INDEX "InPatient_department_idx"       ON "InPatient"("department");

-- ─── INSURANCE COMPANIES ────────────────────────────

CREATE TABLE "InsuranceCompany" (
  "id"            TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "tpaName"       TEXT,
  "contactNumber" TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "isActive"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsuranceCompany_name_key" ON "InsuranceCompany"("name");
CREATE INDEX "InsuranceCompany_isActive_idx"    ON "InsuranceCompany"("isActive");

-- ─── INSURANCE CLAIMS ───────────────────────────────

CREATE TABLE "InsuranceClaim" (
  "id"                         TEXT        NOT NULL,
  "claimNumber"                TEXT        NOT NULL,
  "inPatientId"                TEXT        NOT NULL,
  "insuranceCompanyId"         TEXT,
  "patientName"                TEXT        NOT NULL,
  "ipNumber"                   TEXT        NOT NULL,
  "age"                        INTEGER     NOT NULL,
  "gender"                     TEXT        NOT NULL,
  "phone"                      TEXT        NOT NULL,
  "guardianName"               TEXT,
  "department"                 TEXT,
  "doctorNames"                TEXT        NOT NULL DEFAULT '[]',
  "operationName"              TEXT,
  "provisionDiagnosis"         TEXT,
  "admissionDate"              TIMESTAMP(3) NOT NULL,
  "dischargeDate"              TIMESTAMP(3),
  "insuranceCompanyName"       TEXT        NOT NULL,
  "tpaName"                    TEXT,
  "policyNumber"               TEXT,
  "policyHolderName"           TEXT,
  "insuranceCardNumber"        TEXT,
  "relationToInsured"          TEXT,
  "packageAmount"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalBillAmount"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "preauthAmount"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "enhancementAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "enhancementApproved"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalApprovedAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalSettledAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deductions"                 DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"                   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "patientPayableAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "patientPaidAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "patientBalance"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"                     TEXT        NOT NULL DEFAULT 'PREAUTH_SUBMITTED',
  "preauthSubmittedDate"       TIMESTAMP(3),
  "preauthApprovedDate"        TIMESTAMP(3),
  "preauthRejectionReason"     TEXT,
  "preauthQueryNotes"          TEXT,
  "enhancementClaimedDate"     TIMESTAMP(3),
  "enhancementApprovedDate"    TIMESTAMP(3),
  "enhancementRejectionReason" TEXT,
  "enhancementQueryNotes"      TEXT,
  "finalBillSubmittedDate"     TIMESTAMP(3),
  "settlementDate"             TIMESTAMP(3),
  "settlementReference"        TEXT,
  "statusHistory"              TEXT,
  "notes"                      TEXT,
  "packageInclusions"          TEXT,
  "createdById"                TEXT,
  "updatedBy"                  TEXT,
  "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceClaim_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "InsuranceClaim_inPatientId_fkey"   FOREIGN KEY ("inPatientId")          REFERENCES "InPatient"("id")         ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InsuranceClaim_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InsuranceClaim_createdById_fkey"   FOREIGN KEY ("createdById")          REFERENCES "User"("id")              ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InsuranceClaim_claimNumber_key"  ON "InsuranceClaim"("claimNumber");
CREATE INDEX "InsuranceClaim_status_idx"              ON "InsuranceClaim"("status");
CREATE INDEX "InsuranceClaim_insuranceCompanyName_idx" ON "InsuranceClaim"("insuranceCompanyName");
CREATE INDEX "InsuranceClaim_createdAt_idx"           ON "InsuranceClaim"("createdAt");
CREATE INDEX "InsuranceClaim_inPatientId_idx"         ON "InsuranceClaim"("inPatientId");

-- ─── LABS MODULE ─────────────────────────────────────

CREATE TABLE "Lab" (
  "id"             TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "description"    TEXT,
  "location"       TEXT,
  "printHeaderKey" TEXT,
  "isActive"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "sortOrder"      INTEGER     NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lab_name_key" ON "Lab"("name");

CREATE TABLE "LabInvestigation" (
  "id"              TEXT    NOT NULL,
  "labId"           TEXT    NOT NULL,
  "investigationId" TEXT    NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "isDefault"       BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive"        BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT "LabInvestigation_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "LabInvestigation_labId_fkey"        FOREIGN KEY ("labId")           REFERENCES "Lab"("id")                ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LabInvestigation_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "InvestigationMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LabInvestigation_labId_investigationId_key" ON "LabInvestigation"("labId", "investigationId");
CREATE INDEX "LabInvestigation_investigationId_idx"              ON "LabInvestigation"("investigationId");

CREATE TABLE "LabBill" (
  "id"             TEXT        NOT NULL,
  "billNumber"     TEXT        NOT NULL,
  "labId"          TEXT        NOT NULL,
  "patientId"      TEXT        NOT NULL,
  "prescriptionId" TEXT,
  "subtotal"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountReason" TEXT,
  "total"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"    TEXT,
  "paymentDate"    TIMESTAMP(3),
  "status"         TEXT        NOT NULL DEFAULT 'PENDING',
  "notes"          TEXT,
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LabBill_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "LabBill_labId_fkey"        FOREIGN KEY ("labId")          REFERENCES "Lab"("id")              ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LabBill_patientId_fkey"    FOREIGN KEY ("patientId")      REFERENCES "Patient"("patientId")   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LabBill_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LabBill_billNumber_key" ON "LabBill"("billNumber");
CREATE INDEX "LabBill_patientId_idx"         ON "LabBill"("patientId");
CREATE INDEX "LabBill_labId_idx"             ON "LabBill"("labId");
CREATE INDEX "LabBill_status_idx"            ON "LabBill"("status");
CREATE INDEX "LabBill_createdAt_idx"         ON "LabBill"("createdAt");

CREATE TABLE "LabBillItem" (
  "id"              TEXT    NOT NULL,
  "labBillId"       TEXT    NOT NULL,
  "investigationId" TEXT,
  "name"            TEXT    NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "LabBillItem_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "LabBillItem_labBillId_fkey" FOREIGN KEY ("labBillId") REFERENCES "LabBill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LabPayment" (
  "id"          TEXT        NOT NULL,
  "labBillId"   TEXT        NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "paymentMode" TEXT        NOT NULL,
  "paymentRef"  TEXT,
  "receivedBy"  TEXT,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"       TEXT,

  CONSTRAINT "LabPayment_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "LabPayment_labBillId_fkey" FOREIGN KEY ("labBillId") REFERENCES "LabBill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─── EXPENSES MODULE ─────────────────────────────────

CREATE TABLE "ExpenseCategory" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "color"     TEXT        NOT NULL DEFAULT '#6B7280',
  "icon"      TEXT,
  "sortOrder" INTEGER     NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy" TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE INDEX "ExpenseCategory_isActive_idx"    ON "ExpenseCategory"("isActive");
CREATE INDEX "ExpenseCategory_sortOrder_idx"   ON "ExpenseCategory"("sortOrder");

CREATE TABLE "Expense" (
  "id"          TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "categoryId"  TEXT        NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "reason"      TEXT,
  "paymentMode" TEXT,
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Expense_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_date_idx"       ON "Expense"("date");
CREATE INDEX "Expense_createdAt_idx"  ON "Expense"("createdAt");

-- ─── PHARMACY MODULE ─────────────────────────────────

CREATE TABLE "PharmacyMedicine" (
  "id"            TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "genericName"   TEXT,
  "manufacturer"  TEXT,
  "composition"   TEXT,
  "category"      TEXT,
  "dosageForm"    TEXT,
  "strength"      TEXT,
  "unitOfMeasure" TEXT        NOT NULL DEFAULT 'Nos',
  "hsnCode"       TEXT,
  "gstPercent"    DOUBLE PRECISION NOT NULL DEFAULT 12,
  "scheduleType"  TEXT,
  "isActive"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"     TEXT        NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PharmacyMedicine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyMedicine_name_manufacturer_key" ON "PharmacyMedicine"("name", "manufacturer");
CREATE INDEX "PharmacyMedicine_name_idx"        ON "PharmacyMedicine"("name");
CREATE INDEX "PharmacyMedicine_genericName_idx" ON "PharmacyMedicine"("genericName");
CREATE INDEX "PharmacyMedicine_category_idx"    ON "PharmacyMedicine"("category");
CREATE INDEX "PharmacyMedicine_isActive_idx"    ON "PharmacyMedicine"("isActive");

CREATE TABLE "PharmacySupplier" (
  "id"            TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "contactPerson" TEXT,
  "phone"         TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "gstin"         TEXT,
  "drugLicenseNo" TEXT,
  "creditDays"    INTEGER     NOT NULL DEFAULT 30,
  "isActive"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"     TEXT        NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PharmacySupplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacySupplier_name_key" ON "PharmacySupplier"("name");
CREATE INDEX "PharmacySupplier_isActive_idx"    ON "PharmacySupplier"("isActive");

CREATE TABLE "PharmacyStock" (
  "id"                TEXT        NOT NULL,
  "medicineId"        TEXT        NOT NULL,
  "batchNumber"       TEXT        NOT NULL,
  "quantity"          INTEGER     NOT NULL DEFAULT 0,
  "mrp"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costPrice"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"        DOUBLE PRECISION NOT NULL DEFAULT 12,
  "unitsPerPack"      INTEGER     NOT NULL DEFAULT 1,
  "expiryDate"        TIMESTAMP(3) NOT NULL,
  "manufacturingDate" TIMESTAMP(3),
  "supplierId"        TEXT,
  "purchaseOrderId"   TEXT,
  "isActive"          BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"         TEXT        NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PharmacyStock_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyStock_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PharmacyStock_medicineId_batchNumber_key" ON "PharmacyStock"("medicineId", "batchNumber");
CREATE INDEX "PharmacyStock_medicineId_idx"  ON "PharmacyStock"("medicineId");
CREATE INDEX "PharmacyStock_batchNumber_idx" ON "PharmacyStock"("batchNumber");
CREATE INDEX "PharmacyStock_expiryDate_idx"  ON "PharmacyStock"("expiryDate");
CREATE INDEX "PharmacyStock_supplierId_idx"  ON "PharmacyStock"("supplierId");

CREATE TABLE "PurchaseOrder" (
  "id"            TEXT        NOT NULL,
  "orderNumber"   TEXT        NOT NULL,
  "supplierId"    TEXT        NOT NULL,
  "orderDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate"  TIMESTAMP(3),
  "invoiceNumber" TEXT,
  "invoiceDate"   TIMESTAMP(3),
  "subtotal"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"   TEXT,
  "status"        TEXT        NOT NULL DEFAULT 'DRAFT',
  "notes"         TEXT,
  "createdBy"     TEXT        NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrder_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");
CREATE INDEX "PurchaseOrder_supplierId_idx"         ON "PurchaseOrder"("supplierId");
CREATE INDEX "PurchaseOrder_status_idx"             ON "PurchaseOrder"("status");
CREATE INDEX "PurchaseOrder_orderDate_idx"          ON "PurchaseOrder"("orderDate");

CREATE TABLE "PurchaseOrderItem" (
  "id"              TEXT    NOT NULL,
  "purchaseOrderId" TEXT    NOT NULL,
  "medicineId"      TEXT    NOT NULL,
  "batchNumber"     TEXT,
  "quantity"        INTEGER NOT NULL DEFAULT 0,
  "receivedQty"     INTEGER NOT NULL DEFAULT 0,
  "costPrice"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mrp"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"      DOUBLE PRECISION NOT NULL DEFAULT 12,
  "expiryDate"      TIMESTAMP(3),
  "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,

  CONSTRAINT "PurchaseOrderItem_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrderItem_medicineId_fkey"   FOREIGN KEY ("medicineId")      REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "PurchaseOrderItem_medicineId_idx"      ON "PurchaseOrderItem"("medicineId");

CREATE TABLE "PharmacyBill" (
  "id"              TEXT        NOT NULL,
  "billNumber"      TEXT        NOT NULL,
  "patientId"       TEXT,
  "patientName"     TEXT        NOT NULL,
  "patientPhone"    TEXT,
  "gender"          TEXT,
  "email"           TEXT,
  "referredDoctor"  TEXT,
  "prescriptionId"  TEXT,
  "billDate"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subtotal"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roundOff"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "billAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"     TEXT        NOT NULL DEFAULT 'CASH',
  "paymentRef"      TEXT,
  "status"          TEXT        NOT NULL DEFAULT 'COMPLETED',
  "createdBy"       TEXT        NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PharmacyBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyBill_billNumber_key" ON "PharmacyBill"("billNumber");
CREATE INDEX "PharmacyBill_patientId_idx"         ON "PharmacyBill"("patientId");
CREATE INDEX "PharmacyBill_billDate_idx"          ON "PharmacyBill"("billDate");
CREATE INDEX "PharmacyBill_status_idx"            ON "PharmacyBill"("status");

CREATE TABLE "PharmacyBillItem" (
  "id"              TEXT    NOT NULL,
  "billId"          TEXT    NOT NULL,
  "stockId"         TEXT    NOT NULL,
  "medicineName"    TEXT    NOT NULL,
  "batchNumber"     TEXT    NOT NULL,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "mrp"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"      DOUBLE PRECISION NOT NULL DEFAULT 0,

  CONSTRAINT "PharmacyBillItem_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyBillItem_billId_fkey"  FOREIGN KEY ("billId")  REFERENCES "PharmacyBill"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyBillItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "PharmacyStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PharmacyBillItem_billId_idx"  ON "PharmacyBillItem"("billId");
CREATE INDEX "PharmacyBillItem_stockId_idx" ON "PharmacyBillItem"("stockId");

-- ─── LICENSE TRACKER ─────────────────────────────────

CREATE TABLE "License" (
  "id"            TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "licenseNumber" TEXT,
  "issuingBody"   TEXT,
  "category"      TEXT,
  "issueDate"     TIMESTAMP(3),
  "expiryDate"    TIMESTAMP(3) NOT NULL,
  "reminderDays"  INTEGER     NOT NULL DEFAULT 30,
  "status"        TEXT        NOT NULL DEFAULT 'ACTIVE',
  "notes"         TEXT,
  "documentUrl"   TEXT,
  "createdBy"     TEXT        NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "License_expiryDate_idx" ON "License"("expiryDate");
CREATE INDEX "License_status_idx"     ON "License"("status");
CREATE INDEX "License_category_idx"   ON "License"("category");

-- ─── OPTICAL MODULE ─────────────────────────────────

CREATE TABLE "OpticalProduct" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "brand"       TEXT,
  "category"    TEXT        NOT NULL,
  "type"        TEXT,
  "material"    TEXT,
  "color"       TEXT,
  "size"        TEXT,
  "coating"     TEXT,
  "index"       TEXT,
  "modelNumber" TEXT,
  "hsnCode"     TEXT,
  "gstPercent"  DOUBLE PRECISION NOT NULL DEFAULT 12,
  "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OpticalProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpticalProduct_name_brand_key" ON "OpticalProduct"("name", "brand");
CREATE INDEX "OpticalProduct_name_idx"     ON "OpticalProduct"("name");
CREATE INDEX "OpticalProduct_brand_idx"    ON "OpticalProduct"("brand");
CREATE INDEX "OpticalProduct_category_idx" ON "OpticalProduct"("category");
CREATE INDEX "OpticalProduct_isActive_idx" ON "OpticalProduct"("isActive");

CREATE TABLE "OpticalStock" (
  "id"          TEXT    NOT NULL,
  "productId"   TEXT    NOT NULL,
  "batchNumber" TEXT,
  "quantity"    INTEGER NOT NULL DEFAULT 0,
  "mrp"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costPrice"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"  DOUBLE PRECISION NOT NULL DEFAULT 12,
  "power"       TEXT,
  "supplierId"  TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy"   TEXT    NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OpticalStock_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "OpticalStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OpticalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OpticalStock_productId_batchNumber_power_key" ON "OpticalStock"("productId", "batchNumber", "power");
CREATE INDEX "OpticalStock_productId_idx"  ON "OpticalStock"("productId");
CREATE INDEX "OpticalStock_supplierId_idx" ON "OpticalStock"("supplierId");

CREATE TABLE "OpticalBill" (
  "id"              TEXT        NOT NULL,
  "billNumber"      TEXT        NOT NULL,
  "patientId"       TEXT,
  "patientName"     TEXT        NOT NULL,
  "patientPhone"    TEXT,
  "gender"          TEXT,
  "referredDoctor"  TEXT,
  "prescriptionId"  TEXT,
  "lensPrescription" TEXT,
  "billDate"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subtotal"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roundOff"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "billAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMode"     TEXT        NOT NULL DEFAULT 'CASH',
  "paymentRef"      TEXT,
  "deliveryDate"    TIMESTAMP(3),
  "orderNotes"      TEXT,
  "status"          TEXT        NOT NULL DEFAULT 'COMPLETED',
  "createdBy"       TEXT        NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OpticalBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpticalBill_billNumber_key" ON "OpticalBill"("billNumber");
CREATE INDEX "OpticalBill_patientId_idx"         ON "OpticalBill"("patientId");
CREATE INDEX "OpticalBill_billDate_idx"          ON "OpticalBill"("billDate");
CREATE INDEX "OpticalBill_status_idx"            ON "OpticalBill"("status");

CREATE TABLE "OpticalBillItem" (
  "id"              TEXT    NOT NULL,
  "billId"          TEXT    NOT NULL,
  "stockId"         TEXT,
  "itemName"        TEXT    NOT NULL,
  "category"        TEXT    NOT NULL,
  "eye"             TEXT,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "mrp"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent"      DOUBLE PRECISION NOT NULL DEFAULT 0,

  CONSTRAINT "OpticalBillItem_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "OpticalBillItem_billId_fkey"  FOREIGN KEY ("billId")  REFERENCES "OpticalBill"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OpticalBillItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "OpticalStock"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OpticalBillItem_billId_idx"  ON "OpticalBillItem"("billId");
CREATE INDEX "OpticalBillItem_stockId_idx" ON "OpticalBillItem"("stockId");

-- ─── PREDEFINED SURGERIES ────────────────────────────

CREATE TABLE "PredefinedSurgery" (
  "id"                 TEXT        NOT NULL,
  "name"               TEXT        NOT NULL,
  "department"         TEXT,
  "doctorNames"        TEXT        NOT NULL DEFAULT '[]',
  "onDutyDoctors"      TEXT        NOT NULL DEFAULT '[]',
  "provisionDiagnosis" TEXT,
  "operationProcedure" TEXT,
  "operationDetails"   TEXT,
  "isActive"           BOOLEAN     NOT NULL DEFAULT TRUE,
  "sortOrder"          INTEGER     NOT NULL DEFAULT 0,
  "createdBy"          TEXT        NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PredefinedSurgery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredefinedSurgery_name_key" ON "PredefinedSurgery"("name");
CREATE INDEX "PredefinedSurgery_isActive_idx"    ON "PredefinedSurgery"("isActive");
CREATE INDEX "PredefinedSurgery_sortOrder_idx"   ON "PredefinedSurgery"("sortOrder");

-- ─── PREDEFINED DISCHARGE TEMPLATES ─────────────────

CREATE TABLE "PredefinedDischarge" (
  "id"                   TEXT        NOT NULL,
  "name"                 TEXT        NOT NULL,
  "dischargeDiagnosis"   TEXT,
  "conditionAtDischarge" TEXT,
  "dischargeMedications" TEXT,
  "followUpInstructions" TEXT,
  "isActive"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "sortOrder"            INTEGER     NOT NULL DEFAULT 0,
  "createdBy"            TEXT        NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PredefinedDischarge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredefinedDischarge_name_key" ON "PredefinedDischarge"("name");
CREATE INDEX "PredefinedDischarge_isActive_idx"    ON "PredefinedDischarge"("isActive");
CREATE INDEX "PredefinedDischarge_sortOrder_idx"   ON "PredefinedDischarge"("sortOrder");

-- ─── STAFF ATTENDANCE ────────────────────────────────

CREATE TABLE "StaffAttendance" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "date"      DATE        NOT NULL,
  "inTime"    TIME,
  "outTime"   TIME,
  "status"    TEXT,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StaffAttendance_userId_date_key" ON "StaffAttendance"("userId", "date");
CREATE INDEX "StaffAttendance_userId_idx" ON "StaffAttendance"("userId");
CREATE INDEX "StaffAttendance_date_idx"   ON "StaffAttendance"("date");

-- ─── PRISMA MIGRATIONS TABLE ─────────────────────────
-- Required by Prisma to track migration state.

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                    VARCHAR(36)  NOT NULL,
  "checksum"              VARCHAR(64)  NOT NULL,
  "finished_at"           TIMESTAMPTZ,
  "migration_name"        VARCHAR(255) NOT NULL,
  "logs"                  TEXT,
  "rolled_back_at"        TIMESTAMPTZ,
  "started_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0,

  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
