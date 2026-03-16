-- Run this in Supabase SQL Editor to create the InpatientTemplate table

CREATE TABLE IF NOT EXISTS "InpatientTemplate" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "operationName" text,
  "provisionDiagnosis" text,
  "medicines" text NOT NULL DEFAULT '[]',
  "followUpDays" integer,
  "additionalNotes" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdBy" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE "InpatientTemplate" ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated read" ON "InpatientTemplate"
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated write" ON "InpatientTemplate"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
