-- ─── PredefinedDischarge: new table ───────────────────────────
CREATE TABLE IF NOT EXISTS "PredefinedDischarge" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT UNIQUE NOT NULL,
  "dischargeDiagnosis" TEXT,
  "conditionAtDischarge" TEXT,
  "dischargeMedications" TEXT,
  "followUpInstructions" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "PredefinedDischarge_isActive_idx"  ON "PredefinedDischarge" ("isActive");
CREATE INDEX IF NOT EXISTS "PredefinedDischarge_sortOrder_idx" ON "PredefinedDischarge" ("sortOrder");

CREATE TRIGGER trg_predefined_discharge_updated_at BEFORE UPDATE ON "PredefinedDischarge"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
