-- ─── PredefinedSurgery: new table ───────────────────────────
CREATE TABLE IF NOT EXISTS "PredefinedSurgery" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT UNIQUE NOT NULL,
  "department" TEXT,
  "doctorNames" TEXT NOT NULL DEFAULT '[]',
  "onDutyDoctors" TEXT NOT NULL DEFAULT '[]',
  "provisionDiagnosis" TEXT,
  "operationProcedure" TEXT,
  "operationDetails" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "PredefinedSurgery_isActive_idx"  ON "PredefinedSurgery" ("isActive");
CREATE INDEX IF NOT EXISTS "PredefinedSurgery_sortOrder_idx" ON "PredefinedSurgery" ("sortOrder");

CREATE TRIGGER trg_predefined_surgery_updated_at BEFORE UPDATE ON "PredefinedSurgery"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── InPatient.onDutyDoctor → onDutyDoctors (JSON array) ────
ALTER TABLE "InPatient" ADD COLUMN IF NOT EXISTS "onDutyDoctors" TEXT NOT NULL DEFAULT '[]';
UPDATE "InPatient"
   SET "onDutyDoctors" = CASE
     WHEN "onDutyDoctor" IS NULL OR "onDutyDoctor" = '' THEN '[]'
     ELSE to_jsonb(ARRAY["onDutyDoctor"])::text
   END
 WHERE "onDutyDoctors" = '[]';
ALTER TABLE "InPatient" DROP COLUMN IF EXISTS "onDutyDoctor";
