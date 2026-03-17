-- CallLog table for storing Exotel call records
CREATE TABLE IF NOT EXISTS "CallLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "exotelCallSid" TEXT UNIQUE,
  "callFrom" TEXT NOT NULL,
  "callTo" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'inbound',
  "status" TEXT NOT NULL DEFAULT 'ringing',
  "startTime" TIMESTAMPTZ,
  "endTime" TIMESTAMPTZ,
  "duration" INTEGER DEFAULT 0,
  "recordingUrl" TEXT,
  "callerName" TEXT,
  "patientId" TEXT,
  "notes" TEXT,
  "rawResponse" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS "CallLog_callFrom_idx" ON "CallLog" ("callFrom");
CREATE INDEX IF NOT EXISTS "CallLog_status_idx" ON "CallLog" ("status");
CREATE INDEX IF NOT EXISTS "CallLog_startTime_idx" ON "CallLog" ("startTime" DESC);
CREATE INDEX IF NOT EXISTS "CallLog_direction_idx" ON "CallLog" ("direction");
CREATE INDEX IF NOT EXISTS "CallLog_exotelCallSid_idx" ON "CallLog" ("exotelCallSid");
