-- Adds a generic per-user preferences JSON store on the User table.
-- Used for things like the Doctor-page queue column visibility config so it
-- persists across sessions and devices instead of living in localStorage.
--
-- Stored as a JSON text blob (consistent with this app's pattern for
-- Role.permissions, etc.). Default is an empty object so existing rows are
-- safe.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferences" TEXT NOT NULL DEFAULT '{}';
