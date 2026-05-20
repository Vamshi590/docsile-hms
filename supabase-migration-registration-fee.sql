-- Adds hospital-level configuration for a one-time Registration Fee that can
-- be auto-applied when registering a new out-patient.
--
-- Columns:
--   registrationFeeEnabled         BOOLEAN  -- master toggle
--   registrationFeeAmount          NUMERIC  -- fee amount in ₹
--   registrationFeeDefaultChecked  BOOLEAN  -- whether the Step 2 checkbox starts ticked

ALTER TABLE "HospitalProfile"
  ADD COLUMN IF NOT EXISTS "registrationFeeEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "HospitalProfile"
  ADD COLUMN IF NOT EXISTS "registrationFeeAmount" NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE "HospitalProfile"
  ADD COLUMN IF NOT EXISTS "registrationFeeDefaultChecked" BOOLEAN NOT NULL DEFAULT TRUE;
