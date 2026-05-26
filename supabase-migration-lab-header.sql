-- Add printHeaderKey column to Lab table for per-lab receipt header selection
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "printHeaderKey" TEXT;
