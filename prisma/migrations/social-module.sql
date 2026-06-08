-- HospitalProfile additions
ALTER TABLE "HospitalProfile" ADD COLUMN IF NOT EXISTS "tone" TEXT;
ALTER TABLE "HospitalProfile" ADD COLUMN IF NOT EXISTS "departments" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HospitalProfile" ADD COLUMN IF NOT EXISTS "igAccessToken" TEXT;
ALTER TABLE "HospitalProfile" ADD COLUMN IF NOT EXISTS "igUserId" TEXT;
ALTER TABLE "HospitalProfile" ADD COLUMN IF NOT EXISTS "igConnectedAt" TIMESTAMP(3);
ALTER TABLE "HospitalProfile" ADD COLUMN IF NOT EXISTS "socialDailyCap" INTEGER NOT NULL DEFAULT 5;

-- User: avatar for doctor templates
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- SocialPost
CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id"            TEXT NOT NULL,
  "caption"       TEXT NOT NULL,
  "hashtags"      TEXT NOT NULL DEFAULT '[]',
  "postType"      TEXT NOT NULL,
  "imageUrl"      TEXT NOT NULL,
  "slideUrls"     TEXT,
  "status"        TEXT NOT NULL DEFAULT 'draft',
  "source"        TEXT NOT NULL,
  "doctorId"      TEXT,
  "errorMessage"  TEXT,
  "igPostId"      TEXT,
  "postedAt"      TIMESTAMP(3),
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialPost_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SocialPost_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SocialPost_status_idx"    ON "SocialPost"("status");
CREATE INDEX IF NOT EXISTS "SocialPost_createdAt_idx" ON "SocialPost"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SocialPost_postedAt_idx"  ON "SocialPost"("postedAt" DESC);

-- OAuthState (CSRF state for IG OAuth)
CREATE TABLE IF NOT EXISTS "OAuthState" (
  "state"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "purpose"   TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("state")
);

CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");
