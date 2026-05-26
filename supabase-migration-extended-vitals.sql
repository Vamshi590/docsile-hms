-- Add height + weight to Prescription for hospitals that capture anthropometry.
-- BMI is computed on the fly in the UI from these two fields; no need to store.
-- Gated in admin by the "vitals-extended" feature flag.

ALTER TABLE "Prescription"
  ADD COLUMN IF NOT EXISTS "heightCm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "weightKg" DOUBLE PRECISION;
