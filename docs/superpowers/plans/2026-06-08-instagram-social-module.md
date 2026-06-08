# Instagram Social Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/social` module in Docsile HMS that connects to a hospital's Instagram Business account, generates posts via Gemini (AI-only or from uploaded photos), renders branded images server-side, and publishes directly to Instagram.

**Architecture:** All code lives inside the existing Next.js 16 app. Image rendering uses `satori` + `@resvg/resvg-js` + `sharp` (no Chromium). Storage uses Supabase. Instagram auth/publish uses Meta Graph v22.0, ported from the Sitha-ai reference implementation. Spec: `docs/superpowers/specs/2026-06-08-instagram-social-module-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase JS SDK, Gemini REST (existing wrapper at `src/lib/ai/gemini.ts`), `satori`, `@resvg/resvg-js`, `sharp`, `vitest` (added by this plan), Node `crypto` for AES-256-GCM.

**Existing helpers to use:**
- `requireServerPermission(permission)` from `src/lib/auth.ts` — auth + perm gate; ADMIN passes automatically.
- `callGemini(opts)` from `src/lib/ai/gemini.ts` — existing Gemini REST wrapper.
- `ALL_PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `MODULE_ROUTE_MAP` in `src/lib/permissions.ts`.
- Supabase server client from `src/lib/supabase/server.ts`.

---

## File Plan

**New files** (33):

```
prisma/migrations/social-module.sql                      ← schema migration
scripts/migrate-social-admin-perms.ts                    ← one-shot ADMIN role backfill
vitest.config.ts                                          ← test runner config
tests/setup.ts                                            ← global test setup
public/social/fonts/Inter-Regular.ttf                    ← bundled font (binary)
public/social/fonts/Inter-SemiBold.ttf
public/social/fonts/Inter-ExtraBold.ttf
src/lib/social/env.ts                                     ← env validator
src/lib/social/tokens.ts                                  ← AES-256-GCM encrypt/decrypt
src/lib/social/instagram.ts                               ← Meta Graph wrapper
src/lib/social/storage.ts                                 ← Supabase Storage wrapper
src/lib/social/quota.ts                                   ← daily-cap check
src/lib/social/generation/types.ts                        ← shared types
src/lib/social/generation/ai-prompt.ts
src/lib/social/generation/vision-prompt.ts
src/lib/social/templates/shared/tokens.ts                 ← palettes
src/lib/social/templates/shared/primitives.tsx            ← Logo, Badge
src/lib/social/templates/DoctorTemplate.tsx
src/lib/social/templates/EducationalTemplate.tsx
src/lib/social/templates/PromoTemplate.tsx
src/lib/social/templates/EngagementTemplate.tsx
src/lib/social/templates/TrustTemplate.tsx
src/lib/social/templates/PhotoOverlayTemplate.tsx
src/lib/social/templates/index.ts                         ← dispatcher
src/lib/social/renderer.ts                                ← Satori → resvg → sharp pipeline
src/app/api/social/instagram/connect/route.ts
src/app/api/social/instagram/callback/route.ts
src/app/(hospital)/social/layout.tsx
src/app/(hospital)/social/page.tsx
src/app/(hospital)/social/posts/page.tsx
src/app/(hospital)/social/posts/components/PostsGallery.tsx
src/app/(hospital)/social/posts/components/PostCard.tsx
src/app/(hospital)/social/posts/components/PostStatusBadge.tsx
src/app/(hospital)/social/posts/actions.ts
src/app/(hospital)/social/generate/page.tsx
src/app/(hospital)/social/generate/components/GeneratePanel.tsx
src/app/(hospital)/social/generate/components/AiGenerateForm.tsx
src/app/(hospital)/social/generate/components/ImageUploadForm.tsx
src/app/(hospital)/social/generate/actions.ts
src/app/(hospital)/social/[postId]/page.tsx
src/app/(hospital)/social/[postId]/components/PostEditor.tsx
src/app/(hospital)/social/[postId]/components/PublishButton.tsx
src/app/(hospital)/social/[postId]/actions.ts
src/app/(hospital)/social/settings/page.tsx
src/app/(hospital)/social/settings/components/InstagramConnectionCard.tsx
src/app/(hospital)/social/settings/components/SocialConfigForm.tsx
src/app/(hospital)/social/settings/actions.ts
```

**Modified files** (4):

- `package.json` — add deps + test scripts
- `src/lib/permissions.ts` — add `social:*` permissions
- `src/components/layout/nav-items.ts` — add Social nav entry
- `src/app/(hospital)/staff/components/StaffPage.tsx` (or matching profile form) — add avatar upload field for users with role=DOCTOR

---

## Phase 0 — Foundation

### Task 1: Install dependencies and add scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
yarn add satori @resvg/resvg-js sharp
```

- [ ] **Step 2: Install dev deps**

```bash
yarn add -D vitest @vitest/ui @types/sharp
```

- [ ] **Step 3: Add test scripts to `package.json`**

Edit the `"scripts"` block to include:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add satori/resvg/sharp/vitest for social module"
```

### Task 2: Configure vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
```

- [ ] **Step 2: Create `tests/setup.ts`**

```ts
// Global test setup. Loads env vars used by unit tests that exercise
// the encryption helpers. Other env vars are mocked per-test.
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ??
  Buffer.alloc(32, 1).toString("base64") // deterministic 32-byte key for tests
```

- [ ] **Step 3: Smoke-test the test runner**

Add throwaway `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest"
describe("vitest", () => {
  it("runs", () => expect(1 + 1).toBe(2))
})
```

Run: `yarn test`
Expected: 1 passed.

- [ ] **Step 4: Delete the smoke test**

```bash
rm tests/smoke.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "chore: configure vitest"
```

### Task 3: Apply schema migration

**Files:**
- Create: `prisma/migrations/social-module.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Apply to Supabase (dev DB)**

Use the Supabase SQL editor in the dashboard, or run via psql:

```bash
psql "$SUPABASE_DB_URL" -f prisma/migrations/social-module.sql
```

Expected output: `ALTER TABLE` and `CREATE TABLE` confirmations; no errors.

- [ ] **Step 3: Verify in Supabase**

In Supabase Studio → Table Editor → confirm `SocialPost`, `OAuthState` exist and `HospitalProfile` has the new columns.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/social-module.sql
git commit -m "feat(social): add schema migration"
```

### Task 4: Add Supabase Storage bucket

**Files:** none (manual config)

- [ ] **Step 1: Create the bucket**

In Supabase Studio → Storage → "New Bucket":
- Name: `social-posts`
- Public: ON

- [ ] **Step 2: Add RLS policy for service-role writes**

Supabase Studio → Storage → `social-posts` → Policies:
- The default public bucket already allows anonymous SELECT.
- INSERT/UPDATE/DELETE: leave restricted to service_role (this is the default for public buckets — confirm).

- [ ] **Step 3: Verify**

```bash
curl -s "https://<your-project>.supabase.co/storage/v1/bucket/social-posts" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: returns bucket metadata with `"public": true`.

### Task 5: Add social permissions

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add `social` block to `ALL_PERMISSIONS`**

Append before the closing `} as const`:

```ts
social: {
  label: "Social Media",
  permissions: [
    { key: "social:view",     label: "View Social Posts" },
    { key: "social:generate", label: "Generate Posts" },
    { key: "social:edit",     label: "Edit Drafts" },
    { key: "social:publish",  label: "Publish to Instagram" },
    { key: "social:delete",   label: "Delete Posts" },
    { key: "social:connect",  label: "Connect/Disconnect Instagram" },
    { key: "social:config",   label: "Edit Social Config" },
  ],
},
```

- [ ] **Step 2: Add to `MODULE_ROUTE_MAP`**

```ts
social: "/social",
```

(Add to the `MODULE_ROUTE_MAP` object near the bottom of the file.)

- [ ] **Step 3: Add unit test**

Create `src/lib/permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, MODULE_ROUTE_MAP, getAllPermissionKeys } from "./permissions"

describe("social permissions", () => {
  it("registers all 7 social permission keys", () => {
    const keys = ALL_PERMISSIONS.social.permissions.map((p) => p.key)
    expect(keys).toEqual([
      "social:view", "social:generate", "social:edit",
      "social:publish", "social:delete", "social:connect", "social:config",
    ])
  })

  it("includes social route in MODULE_ROUTE_MAP", () => {
    expect(MODULE_ROUTE_MAP.social).toBe("/social")
  })

  it("ADMIN role auto-receives social:* permissions", () => {
    const adminPerms = DEFAULT_ROLE_PERMISSIONS.ADMIN
    expect(adminPerms).toContain("social:view")
    expect(adminPerms).toContain("social:publish")
  })

  it("DOCTOR/RECEPTIONIST/NURSE/OPTOMETRIST do NOT get social by default", () => {
    for (const role of ["DOCTOR", "RECEPTIONIST", "NURSE", "OPTOMETRIST"]) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role]
      expect(perms.some((p) => p.startsWith("social:"))).toBe(false)
    }
  })

  it("getAllPermissionKeys includes social keys", () => {
    expect(getAllPermissionKeys()).toContain("social:connect")
  })
})
```

- [ ] **Step 4: Run tests**

```bash
yarn test src/lib/permissions.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts src/lib/permissions.test.ts
git commit -m "feat(social): register social:* permissions"
```

### Task 6: Backfill social:* on existing ADMIN role rows

**Files:**
- Create: `scripts/migrate-social-admin-perms.ts`

- [ ] **Step 1: Write the script**

```ts
import { createClient } from "@supabase/supabase-js"
import { ALL_PERMISSIONS } from "../src/lib/permissions"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const socialKeys = ALL_PERMISSIONS.social.permissions.map((p) => p.key)

  const { data: roles, error } = await supabase
    .from("Role")
    .select("id, name, permissions")
    .eq("name", "ADMIN")

  if (error) throw error
  if (!roles?.length) {
    console.log("No ADMIN role rows found — nothing to backfill.")
    return
  }

  for (const role of roles) {
    const existing: string[] = JSON.parse(role.permissions || "[]")
    const missing = socialKeys.filter((k) => !existing.includes(k))
    if (missing.length === 0) {
      console.log(`Role ${role.id}: already has all social:* perms.`)
      continue
    }
    const updated = JSON.stringify([...existing, ...missing])
    const { error: upErr } = await supabase
      .from("Role").update({ permissions: updated }).eq("id", role.id)
    if (upErr) throw upErr
    console.log(`Role ${role.id}: added ${missing.join(", ")}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Add npm script**

In `package.json`:

```json
"migrate:social-admin": "tsx --env-file=.env scripts/migrate-social-admin-perms.ts"
```

- [ ] **Step 3: Run it against dev DB**

```bash
yarn migrate:social-admin
```

Expected: prints "added social:view, social:generate, ..." for each ADMIN row, or "already has all" if nothing to do.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-social-admin-perms.ts package.json
git commit -m "feat(social): backfill ADMIN role with social:* permissions"
```

### Task 7: Add Social nav entry (hidden by permission)

**Files:**
- Modify: `src/components/layout/nav-items.ts`

- [ ] **Step 1: Add Instagram icon import**

Edit the lucide-react import at the top:

```ts
import {
  // ...existing icons,
  Instagram,
} from "lucide-react"
```

- [ ] **Step 2: Add a "Marketing" section with the Social entry**

Append to `NAV_SECTIONS` (before the closing `]`):

```ts
{
  label: "Marketing",
  items: [
    { href: "/social", icon: Instagram, label: "Social", moduleCode: "social", permission: "social:view" },
  ],
},
```

- [ ] **Step 3: Manual verification**

Run `yarn dev`. Log in as admin → sidebar shows "Marketing → Social". Log in as a doctor user → "Marketing" section is empty/hidden (sidebar filter already drops items without permission).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav-items.ts
git commit -m "feat(social): add Social nav entry"
```

---

## Phase 1 — Pure utility libs

### Task 8: Env validator

**Files:**
- Create: `src/lib/social/env.ts`
- Create: `src/lib/social/env.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/social/env.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { requireSocialEnv } from "./env"

const REQUIRED = [
  "META_APP_ID", "META_APP_SECRET", "META_OAUTH_REDIRECT_BASE",
  "GEMINI_API_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
]

describe("requireSocialEnv", () => {
  beforeEach(() => {
    for (const k of REQUIRED) process.env[k] = "x"
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64")
  })

  it("returns env object when all vars present", () => {
    const env = requireSocialEnv()
    expect(env.META_APP_ID).toBe("x")
    expect(env.GEMINI_MODEL).toBeDefined() // has default
  })

  it("throws if META_APP_ID missing", () => {
    delete process.env.META_APP_ID
    expect(() => requireSocialEnv()).toThrow(/META_APP_ID/)
  })

  it("throws if SOCIAL_TOKEN_ENCRYPTION_KEY is not 32 bytes after base64 decode", () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64")
    expect(() => requireSocialEnv()).toThrow(/32 bytes/)
  })
})
```

- [ ] **Step 2: Run test, see it fail**

Run: `yarn test src/lib/social/env.test.ts`
Expected: "Cannot find module './env'".

- [ ] **Step 3: Implement `env.ts`**

```ts
// src/lib/social/env.ts
const REQUIRED = [
  "META_APP_ID", "META_APP_SECRET", "META_OAUTH_REDIRECT_BASE",
  "GEMINI_API_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
] as const

export type SocialEnv = {
  META_APP_ID: string
  META_APP_SECRET: string
  META_OAUTH_REDIRECT_BASE: string
  META_OAUTH_CALLBACK: string
  GEMINI_API_KEY: string
  GEMINI_MODEL: string
  SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer
  NEXT_PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export function requireSocialEnv(): SocialEnv {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Social module env vars missing: ${missing.join(", ")}`)
  }
  const key = Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY!, "base64")
  if (key.length !== 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -base64 32)")
  }
  const base = process.env.META_OAUTH_REDIRECT_BASE!.replace(/\/$/, "")
  return {
    META_APP_ID: process.env.META_APP_ID!,
    META_APP_SECRET: process.env.META_APP_SECRET!,
    META_OAUTH_REDIRECT_BASE: base,
    META_OAUTH_CALLBACK: `${base}/api/social/instagram/callback`,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    SOCIAL_TOKEN_ENCRYPTION_KEY: key,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test src/lib/social/env.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/env.ts src/lib/social/env.test.ts
git commit -m "feat(social): env validator"
```

### Task 9: AES-256-GCM token encryption

**Files:**
- Create: `src/lib/social/tokens.ts`
- Create: `src/lib/social/tokens.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/social/tokens.test.ts
import { describe, it, expect } from "vitest"
import { encryptToken, decryptToken } from "./tokens"

describe("token encryption", () => {
  it("round-trips a token", () => {
    const enc = encryptToken("EAAGm0PX4ZCpsBA...example")
    expect(enc).not.toContain("EAAGm0PX4ZCpsBA")
    expect(decryptToken(enc)).toBe("EAAGm0PX4ZCpsBA...example")
  })

  it("produces different ciphertext each call (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"))
  })

  it("rejects tampered ciphertext", () => {
    const enc = encryptToken("secret")
    const [iv, tag, ct] = enc.split(":")
    const tamperedCt = Buffer.from(ct, "base64")
    tamperedCt[0] ^= 0xff
    const tampered = `${iv}:${tag}:${tamperedCt.toString("base64")}`
    expect(() => decryptToken(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `yarn test src/lib/social/tokens.test.ts`
Expected: "Cannot find module './tokens'".

- [ ] **Step 3: Implement `tokens.ts`**

```ts
// src/lib/social/tokens.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { requireSocialEnv } from "./env"

const ALGO = "aes-256-gcm"

export function encryptToken(plaintext: string): string {
  const { SOCIAL_TOKEN_ENCRYPTION_KEY: key } = requireSocialEnv()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`
}

export function decryptToken(encoded: string): string {
  const { SOCIAL_TOKEN_ENCRYPTION_KEY: key } = requireSocialEnv()
  const [ivB64, tagB64, ctB64] = encoded.split(":")
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed encrypted token")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const ct = Buffer.from(ctB64, "base64")
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test src/lib/social/tokens.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/tokens.ts src/lib/social/tokens.test.ts
git commit -m "feat(social): AES-256-GCM token encryption"
```

### Task 10: Instagram Meta Graph client

**Files:**
- Create: `src/lib/social/instagram.ts`
- Create: `src/lib/social/instagram.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/social/instagram.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { exchangeCodeForToken, publishPost, publishCarousel } from "./instagram"

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  process.env.META_APP_ID = "app-id"
  process.env.META_APP_SECRET = "app-secret"
  process.env.META_OAUTH_REDIRECT_BASE = "https://x.test"
})

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

describe("exchangeCodeForToken", () => {
  it("walks the 5-step OAuth flow and returns long-lived page token", async () => {
    fetchMock
      .mockReturnValueOnce(json({ access_token: "short-user" }))
      .mockReturnValueOnce(json({ data: [{
        id: "page-1", name: "Clinic", access_token: "short-page",
        instagram_business_account: { id: "ig-123" },
      }] }))
      .mockReturnValueOnce(json({ access_token: "long-user" }))
      .mockReturnValueOnce(json({ access_token: "never-expires-page" }))
    const r = await exchangeCodeForToken("code-xyz")
    expect(r).toEqual({ access_token: "never-expires-page", ig_user_id: "ig-123" })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("throws if no Facebook pages found", async () => {
    fetchMock
      .mockReturnValueOnce(json({ access_token: "short-user" }))
      .mockReturnValueOnce(json({ data: [] }))
    await expect(exchangeCodeForToken("code")).rejects.toThrow(/No Facebook Pages/)
  })

  it("throws if no page has an IG business account", async () => {
    fetchMock
      .mockReturnValueOnce(json({ access_token: "short-user" }))
      .mockReturnValueOnce(json({ data: [{ id: "p", name: "n", access_token: "t" }] }))
    await expect(exchangeCodeForToken("code")).rejects.toThrow(/Instagram Business/)
  })
})

describe("publishPost", () => {
  it("creates container then publishes", async () => {
    fetchMock
      .mockReturnValueOnce(json({ id: "container-1" }))
      .mockReturnValueOnce(json({ id: "ig-post-1" }))
    const id = await publishPost("ig-user", "tok", "https://img/u.jpg", "caption")
    expect(id).toBe("ig-post-1")
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({
      image_url: "https://img/u.jpg", media_type: "IMAGE", caption: "caption",
    })
  })

  it("maps Meta error code 190 to TOKEN_EXPIRED", async () => {
    fetchMock.mockReturnValueOnce(json({ error: { code: 190, message: "expired" } }, 400))
    await expect(publishPost("u", "t", "i", "c")).rejects.toThrow(/TOKEN_EXPIRED/)
  })
})

describe("publishCarousel", () => {
  it("creates a container per slide, then a carousel, then publishes", async () => {
    fetchMock
      .mockReturnValueOnce(json({ id: "c1" }))
      .mockReturnValueOnce(json({ id: "c2" }))
      .mockReturnValueOnce(json({ id: "carousel-1" }))
      .mockReturnValueOnce(json({ id: "ig-post-1" }))
    const id = await publishCarousel("u", "t", ["https://a", "https://b"], "cap")
    expect(id).toBe("ig-post-1")
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
```

- [ ] **Step 2: Run, see fail**

Run: `yarn test src/lib/social/instagram.test.ts`
Expected: "Cannot find module './instagram'".

- [ ] **Step 3: Implement `instagram.ts`**

Port the logic from `/Users/vamshidhar/Documents/Sitha-ai/clinicgrow-renderer/src/lib/instagram.ts`:

```ts
// src/lib/social/instagram.ts
import { requireSocialEnv } from "./env"

const META_API = "https://graph.facebook.com/v22.0"

type MetaErr = { error?: { code: number; message: string } }

async function metaFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  const data = (await res.json()) as T & MetaErr
  if (data.error) {
    if (data.error.code === 190) throw new Error("TOKEN_EXPIRED")
    throw new Error(data.error.message)
  }
  if (!res.ok) throw new Error(`Meta API error ${res.status}`)
  return data
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; ig_user_id: string }> {
  const { META_APP_ID, META_APP_SECRET, META_OAUTH_CALLBACK } = requireSocialEnv()

  const { access_token: shortToken } = await metaFetch<{ access_token: string }>(
    `${META_API}/oauth/access_token?` + new URLSearchParams({
      client_id: META_APP_ID, client_secret: META_APP_SECRET,
      redirect_uri: META_OAUTH_CALLBACK, code,
    }),
  )

  const pagesData = await metaFetch<{
    data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>
  }>(`${META_API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${shortToken}`)

  if (!pagesData.data?.length) {
    throw new Error("No Facebook Pages found. Make sure your account is the Admin of the page and you selected it during OAuth.")
  }
  const page = pagesData.data.find((p) => p.instagram_business_account?.id)
  if (!page?.instagram_business_account?.id) {
    throw new Error("None of your Facebook Pages have an Instagram Business account connected.")
  }
  const igUserId = page.instagram_business_account.id

  const { access_token: longUserToken } = await metaFetch<{ access_token: string }>(
    `${META_API}/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID, client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    }),
  )

  const neverExpires = await metaFetch<{ access_token: string }>(
    `${META_API}/${page.id}?fields=access_token&access_token=${longUserToken}`,
  )
  return { access_token: neverExpires.access_token ?? page.access_token, ig_user_id: igUserId }
}

export async function publishPost(igUserId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
  const container = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, media_type: "IMAGE", caption, access_token: accessToken }),
  })
  const published = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  })
  return published.id
}

export async function publishCarousel(igUserId: string, accessToken: string, imageUrls: string[], caption: string): Promise<string> {
  const containerIds: string[] = []
  for (const imageUrl of imageUrls) {
    const c = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, media_type: "IMAGE", is_carousel_item: true, access_token: accessToken }),
    })
    containerIds.push(c.id)
  }
  const carousel = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", children: containerIds.join(","), caption, access_token: accessToken }),
  })
  const published = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carousel.id, access_token: accessToken }),
  })
  return published.id
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test src/lib/social/instagram.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/instagram.ts src/lib/social/instagram.test.ts
git commit -m "feat(social): Meta Graph wrapper with OAuth + publish"
```

### Task 11: Supabase Storage wrapper

**Files:**
- Create: `src/lib/social/storage.ts`

- [ ] **Step 1: Implement (no unit test — exercised in integration via server actions)**

```ts
// src/lib/social/storage.ts
import { createClient } from "@supabase/supabase-js"
import { requireSocialEnv } from "./env"

const BUCKET = "social-posts"

function admin() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireSocialEnv()
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export async function uploadJpeg(buffer: Buffer, key: string): Promise<string> {
  const supabase = admin()
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: "image/jpeg", upsert: true, cacheControl: "86400",
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return data.publicUrl
}

export async function deleteByPrefix(prefix: string): Promise<void> {
  const supabase = admin()
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix)
  if (error) throw new Error(`Storage list failed: ${error.message}`)
  if (!data?.length) return
  const keys = data.map((f) => `${prefix}/${f.name}`)
  const { error: delErr } = await supabase.storage.from(BUCKET).remove(keys)
  if (delErr) throw new Error(`Storage delete failed: ${delErr.message}`)
}

export function publicUrlFor(key: string): string {
  const supabase = admin()
  return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
}
```

- [ ] **Step 2: Manual sanity check (Node REPL)**

```bash
node --env-file=.env -e "
import('./src/lib/social/storage.ts').then(async (m) => {
  const url = await m.uploadJpeg(Buffer.from('jpg-bytes-placeholder'), 'smoke-test/x.jpg')
  console.log('URL:', url)
  await m.deleteByPrefix('smoke-test')
})"
```

Expected: prints a public URL. (Bytes are not a valid JPEG, but the upload still succeeds — we're testing the storage path.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/social/storage.ts
git commit -m "feat(social): Supabase storage helpers"
```

### Task 12: Quota helper

**Files:**
- Create: `src/lib/social/quota.ts`
- Create: `src/lib/social/quota.test.ts`

- [ ] **Step 1: Write failing test (using mocked Supabase client)**

```ts
// src/lib/social/quota.test.ts
import { describe, it, expect, vi } from "vitest"
import { computeQuotaResult } from "./quota"

describe("computeQuotaResult", () => {
  it("allows when used < cap", () => {
    expect(computeQuotaResult(3, 5)).toEqual({ allowed: true, used: 3, limit: 5 })
  })
  it("blocks when used >= cap", () => {
    expect(computeQuotaResult(5, 5)).toEqual({ allowed: false, used: 5, limit: 5 })
    expect(computeQuotaResult(99, 5)).toEqual({ allowed: false, used: 99, limit: 5 })
  })
})
```

- [ ] **Step 2: Run, see fail**

Run: `yarn test src/lib/social/quota.test.ts`
Expected: "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// src/lib/social/quota.ts
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type QuotaResult = { allowed: boolean; used: number; limit: number }

export function computeQuotaResult(used: number, limit: number): QuotaResult {
  return { allowed: used < limit, used, limit }
}

export async function checkDailyCap(): Promise<QuotaResult> {
  const supabase = await createServerSupabaseClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { count, error } = await supabase
    .from("SocialPost")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .gte("postedAt", today.toISOString())
    .lt("postedAt", tomorrow.toISOString())
  if (error) throw new Error(`Quota query failed: ${error.message}`)

  const { data: profile, error: profErr } = await supabase
    .from("HospitalProfile").select("socialDailyCap").limit(1).single()
  if (profErr) throw new Error(`HospitalProfile query failed: ${profErr.message}`)

  return computeQuotaResult(count ?? 0, profile?.socialDailyCap ?? 5)
}
```

(Note: `createServerSupabaseClient` is the existing helper in `src/lib/supabase/server.ts`. Adjust import name if it differs.)

- [ ] **Step 4: Run unit tests**

Run: `yarn test src/lib/social/quota.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/quota.ts src/lib/social/quota.test.ts
git commit -m "feat(social): daily-cap quota helper"
```

---

## Phase 2 — Gemini generation

### Task 13: Generation types

**Files:**
- Create: `src/lib/social/generation/types.ts`

- [ ] **Step 1: Write the file**

```ts
// src/lib/social/generation/types.ts
export type PostType = "doctor" | "educational" | "promo" | "engagement" | "trust"

export type Slide = {
  heading?: string   // Optional bold title; first slide always uses this.
  body: string       // Main slide text (numbered point, testimonial quote, etc.)
}

export type GeneratedContent = {
  post_type: PostType
  caption: string
  hashtags: string[]
  image_idea: string
  department?: string
  slides?: Slide[]     // Required when post_type === 'educational' | 'trust'
}

export type VisionContent = {
  post_type: "trust" | "promo"
  caption: string
  hashtags: string[]
  quote?: string
}

export class GenerationError extends Error {
  constructor(message: string, public raw?: string) { super(message) }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/generation/types.ts
git commit -m "feat(social): generation types"
```

### Task 14: AI-only prompt + parser

**Files:**
- Create: `src/lib/social/generation/ai-prompt.ts`
- Create: `src/lib/social/generation/ai-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/social/generation/ai-prompt.test.ts
import { describe, it, expect, vi } from "vitest"
import { buildAiPrompt, parseAiResponse, generateAiContent } from "./ai-prompt"
import { GenerationError } from "./types"

describe("buildAiPrompt", () => {
  it("includes hospital tone, name, address, departments", () => {
    const sys = buildAiPrompt({
      name: "Vennela", address: "Eluru", tone: "friendly",
      departments: ["Eye", "General"],
    }, [])
    expect(sys).toMatch(/Vennela/)
    expect(sys).toMatch(/Eluru/)
    expect(sys).toMatch(/friendly/)
    expect(sys).toMatch(/Eye, General/)
  })

  it("includes doctor names when present", () => {
    const sys = buildAiPrompt(
      { name: "X", address: "Y", tone: "professional", departments: [] },
      [{ id: "1", fullName: "Dr. A", qualifications: "MBBS", department: "Eye" }],
    )
    expect(sys).toMatch(/Dr\. A/)
  })

  it("notes when no doctors are available (forbids doctor post type)", () => {
    const sys = buildAiPrompt({ name: "X", address: "Y", tone: "professional", departments: [] }, [])
    expect(sys).toMatch(/no doctors|do not generate.*doctor/i)
  })
})

describe("parseAiResponse", () => {
  it("parses valid JSON", () => {
    const json = JSON.stringify({
      post_type: "promo", caption: "Hello", hashtags: ["eye", "care"], image_idea: "x",
    })
    const r = parseAiResponse(json)
    expect(r.post_type).toBe("promo")
  })

  it("strips ```json fences", () => {
    const json = "```json\n" + JSON.stringify({
      post_type: "promo", caption: "Hi", hashtags: ["h"], image_idea: "x",
    }) + "\n```"
    expect(parseAiResponse(json).caption).toBe("Hi")
  })

  it("requires slides for educational", () => {
    const json = JSON.stringify({ post_type: "educational", caption: "c", hashtags: [], image_idea: "x" })
    expect(() => parseAiResponse(json)).toThrow(GenerationError)
  })

  it("rejects unknown post_type", () => {
    const json = JSON.stringify({ post_type: "weird", caption: "c", hashtags: [], image_idea: "x" })
    expect(() => parseAiResponse(json)).toThrow(GenerationError)
  })

  it("rejects malformed JSON", () => {
    expect(() => parseAiResponse("not json")).toThrow(GenerationError)
  })

  it("strips leading # from hashtags", () => {
    const json = JSON.stringify({
      post_type: "promo", caption: "c", hashtags: ["#eye", "care"], image_idea: "x",
    })
    expect(parseAiResponse(json).hashtags).toEqual(["eye", "care"])
  })
})

describe("generateAiContent", () => {
  it("calls Gemini and returns parsed content", async () => {
    const callGemini = vi.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        post_type: "promo", caption: "Hello", hashtags: ["x"], image_idea: "i",
      }),
    })
    const r = await generateAiContent(
      { name: "X", address: "Y", tone: "friendly", departments: [] },
      [], { callGemini } as never,
    )
    expect(r.caption).toBe("Hello")
    expect(callGemini).toHaveBeenCalledTimes(1)
  })

  it("throws GenerationError when Gemini returns ok:false", async () => {
    const callGemini = vi.fn().mockResolvedValue({ ok: false, error: "rate limit" })
    await expect(generateAiContent(
      { name: "X", address: "Y", tone: "friendly", departments: [] }, [],
      { callGemini } as never,
    )).rejects.toThrow(GenerationError)
  })
})
```

- [ ] **Step 2: Run, see fail**

Run: `yarn test src/lib/social/generation/ai-prompt.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/social/generation/ai-prompt.ts
import { callGemini as defaultCallGemini } from "@/lib/ai/gemini"
import type { GeneratedContent, PostType } from "./types"
import { GenerationError } from "./types"

type HospitalInput = {
  name: string
  address: string | null
  tone: string | null            // 'friendly' | 'professional' | 'luxe'
  departments: string[]
}

type DoctorInput = {
  id: string
  fullName: string
  qualifications: string | null
  department: string | null
}

const VALID_TYPES: PostType[] = ["doctor", "educational", "promo", "engagement", "trust"]

export function buildAiPrompt(hospital: HospitalInput, doctors: DoctorInput[]): string {
  const tone = hospital.tone ?? "friendly"
  const depts = hospital.departments.length ? hospital.departments.join(", ") : "general medicine"
  const doctorLines = doctors.length
    ? doctors.map((d) => `- ${d.fullName} (${d.department ?? "—"}, ${d.qualifications ?? "—"})`).join("\n")
    : "(no doctors available — do not generate a doctor post type)"

  return [
    `You are a social media manager for a ${tone} hospital named "${hospital.name}" located in ${hospital.address ?? "India"}.`,
    `Available departments: ${depts}.`,
    `Doctors on staff:`,
    doctorLines,
    ``,
    `Generate exactly one Instagram post.`,
    `Respond as STRICT JSON only (no prose, no markdown fences).`,
    `Schema:`,
    `{`,
    `  "post_type": one of ${VALID_TYPES.map((t) => `"${t}"`).join(" | ")},`,
    `  "caption": string (max 2200 chars, the Instagram caption),`,
    `  "hashtags": string[] (5-15 items, no leading #),`,
    `  "image_idea": string (brief description of the visual concept),`,
    `  "department": string | null (matches one of the available departments),`,
    `  "slides": Slide[] (REQUIRED iff post_type is "educational" or "trust"; 3-5 items)`,
    `}`,
    `where Slide = { "heading": string | null, "body": string }.`,
    `For educational: slide 1 = "Did You Know?" title; slides 2-N = numbered points.`,
    `For trust: each slide is a testimonial quote.`,
  ].join("\n")
}

export function parseAiResponse(raw: string): GeneratedContent {
  const stripped = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
  let obj: unknown
  try { obj = JSON.parse(stripped) } catch (e) {
    throw new GenerationError(`Gemini returned malformed JSON: ${(e as Error).message}`, raw)
  }
  const o = obj as Partial<GeneratedContent>
  if (!o.post_type || !VALID_TYPES.includes(o.post_type as PostType)) {
    throw new GenerationError(`Invalid post_type: ${o.post_type}`, raw)
  }
  if (typeof o.caption !== "string" || !o.caption.trim()) {
    throw new GenerationError("Missing caption", raw)
  }
  if (!Array.isArray(o.hashtags)) {
    throw new GenerationError("hashtags must be an array", raw)
  }
  if (typeof o.image_idea !== "string") {
    throw new GenerationError("Missing image_idea", raw)
  }
  if (o.post_type === "educational" || o.post_type === "trust") {
    if (!Array.isArray(o.slides) || o.slides.length < 2) {
      throw new GenerationError(`${o.post_type} requires slides[]`, raw)
    }
  }
  return {
    post_type: o.post_type as PostType,
    caption: o.caption.slice(0, 2200),
    hashtags: o.hashtags.map((h: string) => h.replace(/^#/, "")),
    image_idea: o.image_idea,
    department: o.department ?? undefined,
    slides: o.slides ?? undefined,
  }
}

type Deps = { callGemini: typeof defaultCallGemini }

export async function generateAiContent(
  hospital: HospitalInput,
  doctors: DoctorInput[],
  deps: Deps = { callGemini: defaultCallGemini },
): Promise<GeneratedContent> {
  const system = buildAiPrompt(hospital, doctors)
  const result = await deps.callGemini({
    system,
    messages: [{ role: "user", text: "Generate the post now." }],
    temperature: 0.9,
    maxOutputTokens: 2048,
  })
  if (!result.ok) throw new GenerationError(`Gemini error: ${result.error}`)
  return parseAiResponse(result.text)
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test src/lib/social/generation/ai-prompt.test.ts`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/generation/ai-prompt.ts src/lib/social/generation/ai-prompt.test.ts
git commit -m "feat(social): AI-only prompt and parser"
```

### Task 15: Vision prompt + parser

**Files:**
- Create: `src/lib/social/generation/vision-prompt.ts`
- Create: `src/lib/social/generation/vision-prompt.test.ts`

- [ ] **Step 1: Extend the Gemini wrapper to support inline image data**

Open `src/lib/ai/gemini.ts` and check whether it supports `inlineData`. If not, add an overload — append to `GeminiMessage`:

```ts
// src/lib/ai/gemini.ts (modify existing types)
export type GeminiMessage =
  | { role: "user" | "model"; text: string }
  | { role: "user"; image: { mimeType: string; data: string /* base64 */ } }
```

Update the request body builder inside `callGemini` to map image messages to `{ inlineData: { mimeType, data } }` parts alongside text. (If the existing wrapper already supports this, skip.)

- [ ] **Step 2: Write failing tests**

```ts
// src/lib/social/generation/vision-prompt.test.ts
import { describe, it, expect, vi } from "vitest"
import { buildVisionPrompt, parseVisionResponse, generateVisionContent } from "./vision-prompt"
import { GenerationError } from "./types"

describe("buildVisionPrompt", () => {
  it("forces post_type=trust for patient uploads", () => {
    const sys = buildVisionPrompt({ name: "X", tone: "friendly", departments: [] }, "patient", undefined, undefined)
    expect(sys).toMatch(/post_type.*trust/i)
  })

  it("forces post_type=promo for infrastructure uploads", () => {
    const sys = buildVisionPrompt({ name: "X", tone: "friendly", departments: [] }, "infrastructure", undefined, undefined)
    expect(sys).toMatch(/post_type.*promo/i)
  })

  it("includes user-provided text and language", () => {
    const sys = buildVisionPrompt({ name: "X", tone: "friendly", departments: [] }, "patient", "loved the care", "Telugu")
    expect(sys).toMatch(/loved the care/)
    expect(sys).toMatch(/Telugu/)
  })
})

describe("parseVisionResponse", () => {
  it("parses valid trust JSON", () => {
    const r = parseVisionResponse(JSON.stringify({
      post_type: "trust", caption: "Thank you", hashtags: ["care"], quote: "Amazing service",
    }))
    expect(r.post_type).toBe("trust")
    expect(r.quote).toBe("Amazing service")
  })

  it("rejects mismatched post_type", () => {
    expect(() => parseVisionResponse(JSON.stringify({
      post_type: "engagement", caption: "x", hashtags: [],
    }))).toThrow(GenerationError)
  })
})

describe("generateVisionContent", () => {
  it("sends image data inline to Gemini", async () => {
    const callGemini = vi.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({ post_type: "trust", caption: "c", hashtags: ["h"], quote: "q" }),
    })
    const r = await generateVisionContent(
      { name: "X", tone: "friendly", departments: [] },
      "patient", Buffer.from("img"), "image/jpeg",
      undefined, undefined, { callGemini } as never,
    )
    expect(r.caption).toBe("c")
    expect(callGemini).toHaveBeenCalledTimes(1)
    const msg = callGemini.mock.calls[0][0].messages[0]
    expect("image" in msg).toBe(true)
  })
})
```

- [ ] **Step 3: Run, see fail**

Run: `yarn test src/lib/social/generation/vision-prompt.test.ts`
Expected: module not found.

- [ ] **Step 4: Implement**

```ts
// src/lib/social/generation/vision-prompt.ts
import { callGemini as defaultCallGemini } from "@/lib/ai/gemini"
import type { VisionContent } from "./types"
import { GenerationError } from "./types"

type HospitalInput = { name: string; tone: string | null; departments: string[] }
type UploadType = "patient" | "infrastructure"
type Deps = { callGemini: typeof defaultCallGemini }

export function buildVisionPrompt(
  hospital: HospitalInput,
  uploadType: UploadType,
  userText: string | undefined,
  language: string | undefined,
): string {
  const forcedType = uploadType === "patient" ? "trust" : "promo"
  const tone = hospital.tone ?? "friendly"
  const lang = language ? `Write the caption and quote in ${language}.` : ""
  const ctx = userText ? `Additional context from the user: "${userText}".` : ""

  return [
    `You are a ${tone} social media writer for the hospital "${hospital.name}".`,
    `You are looking at an uploaded ${uploadType === "patient" ? "patient photo" : "hospital/infrastructure photo"}.`,
    ctx,
    lang,
    `Respond as STRICT JSON only:`,
    `{`,
    `  "post_type": "${forcedType}",`,
    `  "caption": string (max 2200 chars),`,
    `  "hashtags": string[] (5-15, no leading #),`,
    `  "quote": string | null (a short pull-quote, used as image overlay text)`,
    `}`,
    ``,
    `If post_type is not exactly "${forcedType}", the response is invalid.`,
  ].filter(Boolean).join("\n")
}

export function parseVisionResponse(raw: string): VisionContent {
  const stripped = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
  let obj: unknown
  try { obj = JSON.parse(stripped) } catch (e) {
    throw new GenerationError(`Vision JSON parse failed: ${(e as Error).message}`, raw)
  }
  const o = obj as Partial<VisionContent>
  if (o.post_type !== "trust" && o.post_type !== "promo") {
    throw new GenerationError(`Invalid vision post_type: ${o.post_type}`, raw)
  }
  if (typeof o.caption !== "string" || !o.caption.trim()) throw new GenerationError("Missing caption", raw)
  if (!Array.isArray(o.hashtags)) throw new GenerationError("hashtags must be array", raw)
  return {
    post_type: o.post_type,
    caption: o.caption.slice(0, 2200),
    hashtags: o.hashtags.map((h: string) => h.replace(/^#/, "")),
    quote: o.quote ?? undefined,
  }
}

export async function generateVisionContent(
  hospital: HospitalInput,
  uploadType: UploadType,
  imageBuffer: Buffer,
  mimeType: string,
  userText?: string,
  language?: string,
  deps: Deps = { callGemini: defaultCallGemini },
): Promise<VisionContent> {
  const system = buildVisionPrompt(hospital, uploadType, userText, language)
  const result = await deps.callGemini({
    system,
    messages: [{ role: "user", image: { mimeType, data: imageBuffer.toString("base64") } }],
    temperature: 0.8, maxOutputTokens: 1024,
  })
  if (!result.ok) throw new GenerationError(`Gemini error: ${result.error}`)
  return parseVisionResponse(result.text)
}
```

- [ ] **Step 5: Run tests**

Run: `yarn test src/lib/social/generation/vision-prompt.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/social/generation/vision-prompt.ts src/lib/social/generation/vision-prompt.test.ts src/lib/ai/gemini.ts
git commit -m "feat(social): vision prompt + parser; extend gemini for inline images"
```

---

## Phase 3 — Templates and renderer

### Task 16: Add bundled fonts

**Files:**
- Create: `public/social/fonts/Inter-Regular.ttf`
- Create: `public/social/fonts/Inter-SemiBold.ttf`
- Create: `public/social/fonts/Inter-ExtraBold.ttf`

- [ ] **Step 1: Download Inter from rsms.me**

```bash
mkdir -p public/social/fonts
curl -L -o /tmp/inter.zip https://rsms.me/inter/download/?inter
unzip -j /tmp/inter.zip "Inter Desktop/Inter-Regular.otf" -d /tmp/
# Note: download URL changes; alternative source is the GitHub release page:
# https://github.com/rsms/inter/releases
```

If `.otf` only, convert/download a `.ttf` distribution:

```bash
# Google Fonts has TTF versions
curl -L -o public/social/fonts/Inter-Regular.ttf  "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf"
```

Actually use the Inter static TTFs from Google Fonts (one weight per file). From `https://fonts.google.com/specimen/Inter`:

```bash
# Download the static TTF files manually and place at:
# public/social/fonts/Inter-Regular.ttf
# public/social/fonts/Inter-SemiBold.ttf
# public/social/fonts/Inter-ExtraBold.ttf
```

- [ ] **Step 2: Verify**

```bash
ls -lh public/social/fonts/
file public/social/fonts/Inter-Regular.ttf
```

Expected: each file is a TrueType Font, 200-500 KB.

- [ ] **Step 3: Commit**

```bash
git add public/social/fonts/
git commit -m "chore(social): bundle Inter TTFs for Satori"
```

### Task 17: Template shared tokens

**Files:**
- Create: `src/lib/social/templates/shared/tokens.ts`

- [ ] **Step 1: Write the file**

```ts
// src/lib/social/templates/shared/tokens.ts
export type Palette = {
  primary: string
  light: string
  dark: string
  gradientFrom: string
  gradientTo: string
}

export const DEPARTMENT_PALETTES: Record<string, Palette> = {
  Dental:     { primary: "#1D4ED8", light: "#DBEAFE", dark: "#1E3A8A", gradientFrom: "#1E40AF", gradientTo: "#3B82F6" },
  Eye:        { primary: "#0891B2", light: "#CFFAFE", dark: "#0C4A6E", gradientFrom: "#164E63", gradientTo: "#0EA5E9" },
  Skin:       { primary: "#B45309", light: "#FDE68A", dark: "#78350F", gradientFrom: "#92400E", gradientTo: "#F59E0B" },
  Orthopedic: { primary: "#1E40AF", light: "#BFDBFE", dark: "#1E3A5F", gradientFrom: "#172554", gradientTo: "#2563EB" },
  Pediatric:  { primary: "#7C3AED", light: "#EDE9FE", dark: "#3B0764", gradientFrom: "#4C1D95", gradientTo: "#8B5CF6" },
  General:    { primary: "#059669", light: "#D1FAE5", dark: "#022C22", gradientFrom: "#064E3B", gradientTo: "#10B981" },
}

export const DEFAULT_PALETTE: Palette = {
  primary: "#4338CA", light: "#E0E7FF", dark: "#312E81",
  gradientFrom: "#3730A3", gradientTo: "#6366F1",
}

export function paletteFor(department: string | null | undefined): Palette {
  if (!department) return DEFAULT_PALETTE
  return DEPARTMENT_PALETTES[department] ?? DEFAULT_PALETTE
}

export const LABELS: Record<string, string> = {
  educational: "Did You Know?",
  promo: "Special Offer",
  doctor: "Meet Our Doctor",
  trust: "Our Promise",
  engagement: "Quick Poll",
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/shared/tokens.ts
git commit -m "feat(social): palette tokens"
```

### Task 18: Renderer (Satori → resvg → sharp)

**Files:**
- Create: `src/lib/social/renderer.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/social/renderer.ts
import { readFile } from "node:fs/promises"
import path from "node:path"
import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import sharp from "sharp"
import type { ReactElement } from "react"

let fontsCache: Awaited<ReturnType<typeof loadFonts>> | null = null

async function loadFonts() {
  const base = path.join(process.cwd(), "public", "social", "fonts")
  const [regular, semibold, extrabold] = await Promise.all([
    readFile(path.join(base, "Inter-Regular.ttf")),
    readFile(path.join(base, "Inter-SemiBold.ttf")),
    readFile(path.join(base, "Inter-ExtraBold.ttf")),
  ])
  return [
    { name: "Inter", data: regular,   weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semibold,  weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: extrabold, weight: 800 as const, style: "normal" as const },
  ]
}

export async function renderElementToJpeg(element: ReactElement, width = 1080, height = 1080): Promise<Buffer> {
  if (!fontsCache) fontsCache = await loadFonts()
  const svg = await satori(element, { width, height, fonts: fontsCache })
  const png = new Resvg(svg, { background: "white" }).render().asPng()
  return sharp(png).jpeg({ quality: 90 }).toBuffer()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/renderer.ts
git commit -m "feat(social): satori/resvg/sharp render pipeline"
```

### Task 19: Doctor template

**Files:**
- Create: `src/lib/social/templates/DoctorTemplate.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/social/templates/DoctorTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type DoctorProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  doctorName: string
  doctorQualifications: string | null
  doctorAvatarUrl: string | null
  department: string | null
}

export function DoctorTemplate(props: DoctorProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
      fontFamily: "Inter", color: "white", padding: 64,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl ? (
          <img src={props.hospitalLogoUrl} width={56} height={56} style={{ borderRadius: 14 }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 26,
          }}>{props.hospitalName[0]}</div>
        )}
        <div style={{ fontSize: 22, fontWeight: 600 }}>{props.hospitalName}</div>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        flex: 1, justifyContent: "center", gap: 32,
      }}>
        {props.doctorAvatarUrl ? (
          <img src={props.doctorAvatarUrl} width={360} height={360}
               style={{ borderRadius: 180, border: "8px solid rgba(255,255,255,0.5)" }} />
        ) : (
          <div style={{
            width: 360, height: 360, borderRadius: 180,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 140,
          }}>{props.doctorName[0]}</div>
        )}
        <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9 }}>{LABELS.doctor}</div>
        <div style={{ fontSize: 64, fontWeight: 800, textAlign: "center" }}>{props.doctorName}</div>
        {props.doctorQualifications && (
          <div style={{ fontSize: 28, opacity: 0.85 }}>{props.doctorQualifications}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Smoke render**

Create `tests/render-smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { renderElementToJpeg } from "../src/lib/social/renderer"
import { DoctorTemplate } from "../src/lib/social/templates/DoctorTemplate"

describe("doctor template", () => {
  it("renders to a JPEG buffer", async () => {
    const buf = await renderElementToJpeg(DoctorTemplate({
      hospitalName: "Vennela Hospital", hospitalLogoUrl: null,
      doctorName: "Dr. Anita", doctorQualifications: "MS Ophthal", doctorAvatarUrl: null,
      department: "Eye",
    }))
    expect(buf.length).toBeGreaterThan(10_000)        // sanity: it's an image, not empty
    expect(buf[0]).toBe(0xff); expect(buf[1]).toBe(0xd8) // JPEG SOI marker
  })
})
```

- [ ] **Step 3: Run**

```bash
yarn test tests/render-smoke.test.ts
```

Expected: 1 passed. (If it fails with font errors, double-check Task 16 fonts.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/social/templates/DoctorTemplate.tsx tests/render-smoke.test.ts
git commit -m "feat(social): DoctorTemplate"
```

### Task 20: Educational template (carousel)

**Files:**
- Create: `src/lib/social/templates/EducationalTemplate.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/social/templates/EducationalTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"
import type { Slide } from "../generation/types"

export type EducationalSlideProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  slide: Slide
  index: number
  total: number
}

export function EducationalSlide(props: EducationalSlideProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const isCover = props.index === 0
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      backgroundImage: isCover
        ? `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`
        : "white",
      color: isCover ? "white" : p.dark,
      fontFamily: "Inter", padding: 64,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={48} height={48} style={{ borderRadius: 12 }} />
          : <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: isCover ? "rgba(255,255,255,0.2)" : p.light,
              color: isCover ? "white" : p.primary,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 20, fontWeight: 600 }}>{props.hospitalName}</div>
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", gap: 24,
      }}>
        {isCover ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.85 }}>{LABELS.educational}</div>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>{props.slide.body}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 96, fontWeight: 800, color: p.primary, lineHeight: 1 }}>
              {props.index}
            </div>
            {props.slide.heading && (
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.2 }}>{props.slide.heading}</div>
            )}
            <div style={{ fontSize: 32, lineHeight: 1.4 }}>{props.slide.body}</div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 18, opacity: 0.7 }}>
        {props.index + 1} / {props.total}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/EducationalTemplate.tsx
git commit -m "feat(social): EducationalTemplate (carousel slide)"
```

### Task 21: Promo template

**Files:**
- Create: `src/lib/social/templates/PromoTemplate.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/social/templates/PromoTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type PromoProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line treated as headline; rest as body.
}

export function PromoTemplate(props: PromoProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const lines = props.caption.split("\n").filter((l) => l.trim())
  const headline = lines[0] ?? props.caption
  const body = lines.slice(1).join(" ")

  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      fontFamily: "Inter",
    }}>
      <div style={{
        height: 540, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: 64, color: "white",
        backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
      }}>
        <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.85, marginBottom: 16 }}>
          {LABELS.promo}
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>{headline}</div>
      </div>
      <div style={{
        flex: 1, padding: 64, display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: "white", color: p.dark,
      }}>
        <div style={{ fontSize: 34, lineHeight: 1.4 }}>{body}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {props.hospitalLogoUrl
            ? <img src={props.hospitalLogoUrl} width={56} height={56} style={{ borderRadius: 14 }} />
            : <div style={{
                width: 56, height: 56, borderRadius: 14, background: p.light, color: p.primary,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 28,
              }}>{props.hospitalName[0]}</div>}
          <div style={{ fontSize: 26, fontWeight: 700 }}>{props.hospitalName}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/PromoTemplate.tsx
git commit -m "feat(social): PromoTemplate"
```

### Task 22: Engagement template

**Files:**
- Create: `src/lib/social/templates/EngagementTemplate.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/social/templates/EngagementTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type EngagementProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line is the question
}

export function EngagementTemplate(props: EngagementProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const lines = props.caption.split("\n").filter((l) => l.trim())
  const question = lines[0] ?? props.caption
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      background: p.light, fontFamily: "Inter", padding: 64, color: p.dark,
    }}>
      {/* Decorative geometric shape */}
      <div style={{
        position: "absolute", top: -80, right: -80, width: 360, height: 360,
        borderRadius: 360, background: p.primary, opacity: 0.18,
      }} />
      <div style={{
        position: "absolute", bottom: -120, left: -120, width: 480, height: 480,
        borderRadius: 480, backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
        opacity: 0.22,
      }} />

      <div style={{ fontSize: 26, fontWeight: 700, color: p.primary }}>{LABELS.engagement}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>{question}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={48} height={48} style={{ borderRadius: 12 }} />
          : <div style={{
              width: 48, height: 48, borderRadius: 12, background: p.primary, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 22, fontWeight: 600 }}>{props.hospitalName}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/EngagementTemplate.tsx
git commit -m "feat(social): EngagementTemplate"
```

### Task 23: Trust template (carousel)

**Files:**
- Create: `src/lib/social/templates/TrustTemplate.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/social/templates/TrustTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"
import type { Slide } from "../generation/types"

export type TrustSlideProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  slide: Slide
  index: number
  total: number
}

export function TrustSlide(props: TrustSlideProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      fontFamily: "Inter", padding: 64, background: "white", color: p.dark,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: p.primary }}>
        {LABELS.trust} · {props.index + 1}/{props.total}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
        <div style={{ fontSize: 120, fontWeight: 800, color: p.light, lineHeight: 0.8 }}>"</div>
        <div style={{ fontSize: 44, lineHeight: 1.4, fontWeight: 500 }}>{props.slide.body}</div>
        {props.slide.heading && (
          <div style={{ fontSize: 26, fontWeight: 600, color: p.primary, marginTop: 12 }}>— {props.slide.heading}</div>
        )}
      </div>
      <div style={{
        height: 96, marginTop: 32, borderRadius: 24, display: "flex",
        alignItems: "center", padding: "0 32px", gap: 16,
        backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
        color: "white",
      }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={56} height={56} style={{ borderRadius: 14 }} />
          : <div style={{
              width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 24, fontWeight: 700 }}>{props.hospitalName}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/TrustTemplate.tsx
git commit -m "feat(social): TrustTemplate (carousel slide)"
```

### Task 24: Photo overlay template

**Files:**
- Create: `src/lib/social/templates/PhotoOverlayTemplate.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/social/templates/PhotoOverlayTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, type Palette } from "./shared/tokens"

export type PhotoOverlayProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  photoDataUri: string   // data:image/jpeg;base64,...
  quote: string
}

export function PhotoOverlayTemplate(props: PhotoOverlayProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      position: "relative", fontFamily: "Inter",
    }}>
      {/* The photo as background — Satori treats the data URI as an inline image */}
      <img src={props.photoDataUri} width={1080} height={1080}
           style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
      {/* Dark gradient bottom for readable overlay text */}
      <div style={{
        position: "absolute", left: 0, bottom: 0, width: 1080, height: 520,
        backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
      }} />
      {/* Quote text bottom-left */}
      <div style={{
        position: "absolute", bottom: 96, left: 64, right: 64,
        color: "white", display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 0.8, color: p.light }}>"</div>
        <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.3 }}>{props.quote}</div>
      </div>
      {/* Hospital strip top */}
      <div style={{
        position: "absolute", top: 32, left: 32, padding: "12px 20px",
        borderRadius: 16, background: "rgba(255,255,255,0.92)", color: p.dark,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={36} height={36} style={{ borderRadius: 8 }} />
          : <div style={{
              width: 36, height: 36, borderRadius: 8, background: p.primary, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 18, fontWeight: 700 }}>{props.hospitalName}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/PhotoOverlayTemplate.tsx
git commit -m "feat(social): PhotoOverlayTemplate"
```

### Task 25: Template dispatcher

**Files:**
- Create: `src/lib/social/templates/index.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/social/templates/index.ts
import { renderElementToJpeg } from "../renderer"
import { DoctorTemplate } from "./DoctorTemplate"
import { EducationalSlide } from "./EducationalTemplate"
import { PromoTemplate } from "./PromoTemplate"
import { EngagementTemplate } from "./EngagementTemplate"
import { TrustSlide } from "./TrustTemplate"
import { PhotoOverlayTemplate } from "./PhotoOverlayTemplate"
import type { GeneratedContent, Slide, VisionContent } from "../generation/types"

export type HospitalForRender = {
  name: string
  logoUrl: string | null
}

export type DoctorForRender = {
  fullName: string
  qualifications: string | null
  avatarUrl: string | null
  department: string | null
}

export async function renderAiContent(
  content: GeneratedContent,
  hospital: HospitalForRender,
  doctor: DoctorForRender | null,
): Promise<{ cover: Buffer; slides: Buffer[] }> {
  switch (content.post_type) {
    case "doctor": {
      if (!doctor) throw new Error("Doctor post requires a doctor")
      const buf = await renderElementToJpeg(DoctorTemplate({
        hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
        doctorName: doctor.fullName, doctorQualifications: doctor.qualifications,
        doctorAvatarUrl: doctor.avatarUrl, department: doctor.department ?? content.department ?? null,
      }))
      return { cover: buf, slides: [] }
    }
    case "promo": {
      const buf = await renderElementToJpeg(PromoTemplate({
        hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
        department: content.department ?? null, caption: content.caption,
      }))
      return { cover: buf, slides: [] }
    }
    case "engagement": {
      const buf = await renderElementToJpeg(EngagementTemplate({
        hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
        department: content.department ?? null, caption: content.caption,
      }))
      return { cover: buf, slides: [] }
    }
    case "educational":
    case "trust": {
      const slides: Slide[] = content.slides!
      const total = slides.length
      const renderOne = (s: Slide, i: number) =>
        renderElementToJpeg(
          content.post_type === "educational"
            ? EducationalSlide({
                hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
                department: content.department ?? null, slide: s, index: i, total,
              })
            : TrustSlide({
                hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
                department: content.department ?? null, slide: s, index: i, total,
              }),
        )
      const buffers = await Promise.all(slides.map(renderOne))
      return { cover: buffers[0], slides: buffers.slice(1) }
    }
  }
}

export async function renderVisionContent(
  visions: Array<{ content: VisionContent; imageBuffer: Buffer; mimeType: string }>,
  hospital: HospitalForRender,
  department: string | null,
): Promise<{ cover: Buffer; slides: Buffer[] }> {
  const buffers = await Promise.all(visions.map(({ content, imageBuffer, mimeType }) =>
    renderElementToJpeg(PhotoOverlayTemplate({
      hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
      department, photoDataUri: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
      quote: content.quote ?? content.caption.slice(0, 120),
    })),
  ))
  return { cover: buffers[0], slides: buffers.slice(1) }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/templates/index.ts
git commit -m "feat(social): template dispatcher"
```

---

## Phase 4 — OAuth flow

### Task 26: Connect route handler

**Files:**
- Create: `src/app/api/social/instagram/connect/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/social/instagram/connect/route.ts
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { requireServerPermission } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireSocialEnv } from "@/lib/social/env"

export async function GET(_req: NextRequest) {
  const user = await requireServerPermission("social:connect")
  const { META_APP_ID, META_OAUTH_CALLBACK } = requireSocialEnv()
  const supabase = await createServerSupabaseClient()

  const state = randomBytes(16).toString("hex")
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { error } = await supabase.from("OAuthState").insert({
    state, userId: user.id, purpose: "instagram_connect", expiresAt,
  })
  if (error) return NextResponse.redirect(new URL("/social/settings?ig_error=state-init-failed", _req.url))

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_OAUTH_CALLBACK,
    scope: [
      "public_profile", "business_management", "instagram_basic",
      "instagram_content_publish", "pages_show_list",
      "pages_read_engagement", "pages_manage_posts",
    ].join(","),
    response_type: "code",
    state,
  })
  return NextResponse.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/social/instagram/connect/route.ts
git commit -m "feat(social): IG OAuth connect route"
```

### Task 27: Callback route handler

**Files:**
- Create: `src/app/api/social/instagram/callback/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/social/instagram/callback/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { exchangeCodeForToken } from "@/lib/social/instagram"
import { encryptToken } from "@/lib/social/tokens"

function redirect(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/social/settings?${query}`, req.url))
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error")

  if (error) return redirect(req, `ig_error=${encodeURIComponent(error)}`)
  if (!code || !state) return redirect(req, `ig_error=missing-code-or-state`)

  const supabase = await createServerSupabaseClient()
  const { data: stateRow } = await supabase
    .from("OAuthState").select("*").eq("state", state).maybeSingle()

  await supabase.from("OAuthState").delete().eq("state", state)
  if (!stateRow || new Date(stateRow.expiresAt).getTime() < Date.now()) {
    return redirect(req, `ig_error=invalid-or-expired-state`)
  }

  try {
    const { access_token, ig_user_id } = await exchangeCodeForToken(code)
    const enc = encryptToken(access_token)
    const { data: profile } = await supabase
      .from("HospitalProfile").select("id").limit(1).single()
    if (!profile) throw new Error("HospitalProfile not found")
    const { error: updErr } = await supabase
      .from("HospitalProfile")
      .update({ igAccessToken: enc, igUserId: ig_user_id, igConnectedAt: new Date().toISOString() })
      .eq("id", profile.id)
    if (updErr) throw new Error(updErr.message)
    return redirect(req, "ig_connected=1")
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown-error"
    return redirect(req, `ig_error=${encodeURIComponent(msg)}`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/social/instagram/callback/route.ts
git commit -m "feat(social): IG OAuth callback route"
```

---

## Phase 5 — Server actions

### Task 28: Generate AI server action

**Files:**
- Create: `src/app/(hospital)/social/generate/actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/(hospital)/social/generate/actions.ts
"use server"

import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { requireServerPermission } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generateAiContent } from "@/lib/social/generation/ai-prompt"
import { generateVisionContent } from "@/lib/social/generation/vision-prompt"
import { renderAiContent, renderVisionContent } from "@/lib/social/templates"
import { uploadJpeg, deleteByPrefix } from "@/lib/social/storage"

async function loadHospitalAndDoctors(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: hospital, error: hErr } = await supabase
    .from("HospitalProfile")
    .select("id, name, address, tone, departments, logoUrl")
    .limit(1).single()
  if (hErr || !hospital) throw new Error("HospitalProfile not configured.")
  const departments: string[] = JSON.parse(hospital.departments || "[]")

  const { data: doctors } = await supabase
    .from("User")
    .select("id, fullName, qualifications, department, avatarUrl")
    .eq("role", "DOCTOR").eq("isActive", true)

  return {
    hospital: {
      id: hospital.id, name: hospital.name, address: hospital.address,
      tone: hospital.tone, departments, logoUrl: hospital.logoUrl,
    },
    doctors: (doctors ?? []).map((d) => ({
      id: d.id, fullName: d.fullName,
      qualifications: d.qualifications, department: d.department,
      avatarUrl: d.avatarUrl,
    })),
  }
}

export async function generateAi(): Promise<void> {
  const user = await requireServerPermission("social:generate")
  const supabase = await createServerSupabaseClient()
  const { hospital, doctors } = await loadHospitalAndDoctors(supabase)

  const content = await generateAiContent(
    { name: hospital.name, address: hospital.address, tone: hospital.tone, departments: hospital.departments },
    doctors.map((d) => ({ id: d.id, fullName: d.fullName, qualifications: d.qualifications, department: d.department })),
  )

  let doctor = null
  if (content.post_type === "doctor") {
    const withAvatar = doctors.filter((d) => d.avatarUrl)
    const pool = withAvatar.length ? withAvatar : doctors
    if (!pool.length) throw new Error("No doctors available for doctor post")
    doctor = pool[Math.floor(Math.random() * pool.length)]
  }

  const postId = randomUUID()
  const { cover, slides } = await renderAiContent(content,
    { name: hospital.name, logoUrl: hospital.logoUrl }, doctor)

  let coverUrl: string
  let slideUrls: string[] = []
  try {
    coverUrl = await uploadJpeg(cover, `posts/${postId}/cover.jpg`)
    if (slides.length) {
      slideUrls = await Promise.all(slides.map((buf, i) =>
        uploadJpeg(buf, `posts/${postId}/slide-${i + 2}.jpg`),
      ))
    }
  } catch (e) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw e
  }

  const allSlideUrls = slideUrls.length ? [coverUrl, ...slideUrls] : null

  const { error: insErr } = await supabase.from("SocialPost").insert({
    id: postId, caption: content.caption,
    hashtags: JSON.stringify(content.hashtags), postType: content.post_type,
    imageUrl: coverUrl, slideUrls: allSlideUrls ? JSON.stringify(allSlideUrls) : null,
    status: "draft", source: "ai",
    doctorId: doctor?.id ?? null, createdById: user.id,
    updatedAt: new Date().toISOString(),
  })
  if (insErr) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw new Error(`DB insert failed: ${insErr.message}`)
  }

  redirect(`/social/${postId}`)
}

export async function generateFromImages(formData: FormData): Promise<void> {
  const user = await requireServerPermission("social:generate")
  const supabase = await createServerSupabaseClient()
  const { hospital } = await loadHospitalAndDoctors(supabase)

  const files = formData.getAll("images") as File[]
  const uploadType = (formData.get("upload_type") as string | null) ?? null
  const userText = (formData.get("text") as string | null)?.trim() || undefined
  const language = (formData.get("language") as string | null)?.trim() || undefined

  if (!files.length) throw new Error("At least one image is required.")
  if (files.length > 5) throw new Error("Maximum 5 images allowed.")
  if (uploadType !== "patient" && uploadType !== "infrastructure") {
    throw new Error('upload_type must be "patient" or "infrastructure".')
  }
  const ALLOWED = ["image/jpeg", "image/png", "image/webp"]
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) throw new Error(`Unsupported image type: ${f.type}`)
    if (f.size > 10 * 1024 * 1024) throw new Error("Each image must be ≤10MB.")
  }

  const visions = await Promise.all(files.map(async (file) => {
    const buf = Buffer.from(await file.arrayBuffer())
    const content = await generateVisionContent(
      { name: hospital.name, tone: hospital.tone, departments: hospital.departments },
      uploadType, buf, file.type, userText, language,
    )
    return { content, imageBuffer: buf, mimeType: file.type }
  }))

  // All slides share image[0]'s hashtags + caption (per Sitha convention)
  const sharedHashtags = visions[0].content.hashtags
  const sharedCaption = visions[0].content.caption

  const department = hospital.departments[0] ?? null
  const postId = randomUUID()
  const { cover, slides } = await renderVisionContent(visions,
    { name: hospital.name, logoUrl: hospital.logoUrl }, department)

  let coverUrl: string
  let slideUrls: string[] = []
  try {
    coverUrl = await uploadJpeg(cover, `posts/${postId}/cover.jpg`)
    if (slides.length) {
      slideUrls = await Promise.all(slides.map((buf, i) =>
        uploadJpeg(buf, `posts/${postId}/slide-${i + 2}.jpg`),
      ))
    }
  } catch (e) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw e
  }

  const allSlideUrls = slideUrls.length ? [coverUrl, ...slideUrls] : null

  const { error: insErr } = await supabase.from("SocialPost").insert({
    id: postId, caption: sharedCaption,
    hashtags: JSON.stringify(sharedHashtags),
    postType: visions[0].content.post_type,
    imageUrl: coverUrl,
    slideUrls: allSlideUrls ? JSON.stringify(allSlideUrls) : null,
    status: "draft", source: "image",
    doctorId: null, createdById: user.id,
    updatedAt: new Date().toISOString(),
  })
  if (insErr) {
    await deleteByPrefix(`posts/${postId}`).catch(() => {})
    throw new Error(`DB insert failed: ${insErr.message}`)
  }

  redirect(`/social/${postId}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(hospital\)/social/generate/actions.ts
git commit -m "feat(social): generate server actions (AI + image)"
```

### Task 29: Post detail server actions

**Files:**
- Create: `src/app/(hospital)/social/[postId]/actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/(hospital)/social/[postId]/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { requireServerPermission } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { decryptToken } from "@/lib/social/tokens"
import { publishPost as igPublishPost, publishCarousel as igPublishCarousel } from "@/lib/social/instagram"
import { checkDailyCap } from "@/lib/social/quota"

export async function updatePost(input: { postId: string; caption: string; hashtags: string[] }) {
  await requireServerPermission("social:edit")
  const supabase = await createServerSupabaseClient()
  const { data: post, error } = await supabase
    .from("SocialPost").select("id,status").eq("id", input.postId).single()
  if (error || !post) throw new Error("Post not found.")
  if (post.status !== "draft") throw new Error("Only drafts can be edited.")

  const cleanedHashtags = input.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean)
  const { error: upErr } = await supabase.from("SocialPost").update({
    caption: input.caption.slice(0, 2200),
    hashtags: JSON.stringify(cleanedHashtags),
    updatedAt: new Date().toISOString(),
  }).eq("id", input.postId)
  if (upErr) throw new Error(upErr.message)

  revalidatePath(`/social/${input.postId}`)
}

export async function publishPost(input: { postId: string }): Promise<{ success: boolean; igPostId?: string; error?: string; quota?: { used: number; limit: number } }> {
  await requireServerPermission("social:publish")
  const supabase = await createServerSupabaseClient()

  const { data: post, error } = await supabase
    .from("SocialPost")
    .select("id, status, caption, hashtags, imageUrl, slideUrls")
    .eq("id", input.postId).single()
  if (error || !post) throw new Error("Post not found.")
  if (post.status !== "draft") throw new Error("Only drafts can be published.")

  const { data: profile } = await supabase
    .from("HospitalProfile").select("id, igAccessToken, igUserId").limit(1).single()
  if (!profile?.igAccessToken || !profile?.igUserId) {
    return { success: false, error: "Instagram not connected. Connect it in Settings." }
  }

  const quota = await checkDailyCap()
  if (!quota.allowed) {
    return { success: false, error: "quota_exceeded", quota: { used: quota.used, limit: quota.limit } }
  }

  const token = decryptToken(profile.igAccessToken)
  const hashtags: string[] = JSON.parse(post.hashtags || "[]")
  const fullCaption = hashtags.length
    ? `${post.caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
    : post.caption

  const slideUrls: string[] | null = post.slideUrls ? JSON.parse(post.slideUrls) : null
  const isCarousel = slideUrls && slideUrls.length > 1

  try {
    const igPostId = isCarousel
      ? await igPublishCarousel(profile.igUserId, token, slideUrls, fullCaption)
      : await igPublishPost(profile.igUserId, token, post.imageUrl, fullCaption)
    await supabase.from("SocialPost").update({
      status: "posted", igPostId, postedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).eq("id", input.postId)
    revalidatePath("/social/posts")
    revalidatePath(`/social/${input.postId}`)
    return { success: true, igPostId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Publish failed"
    if (msg === "TOKEN_EXPIRED") {
      await supabase.from("HospitalProfile").update({
        igAccessToken: null, igUserId: null,
        updatedAt: new Date().toISOString(),
      }).eq("id", profile.id)
    }
    await supabase.from("SocialPost").update({
      status: "failed", errorMessage: msg,
      updatedAt: new Date().toISOString(),
    }).eq("id", input.postId)
    return { success: false, error: msg }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(hospital\)/social/\[postId\]/actions.ts
git commit -m "feat(social): post detail server actions (update + publish)"
```

### Task 30: Posts gallery server action (delete)

**Files:**
- Create: `src/app/(hospital)/social/posts/actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/(hospital)/social/posts/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { requireServerPermission } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { deleteByPrefix } from "@/lib/social/storage"

export async function deletePost(input: { postId: string }) {
  await requireServerPermission("social:delete")
  const supabase = await createServerSupabaseClient()

  const { data: post } = await supabase
    .from("SocialPost").select("id").eq("id", input.postId).single()
  if (!post) return

  // Best-effort storage cleanup; failure to delete files should not block row delete.
  await deleteByPrefix(`posts/${input.postId}`).catch((err) => {
    console.error("[social] storage cleanup failed:", err)
  })

  const { error: delErr } = await supabase.from("SocialPost").delete().eq("id", input.postId)
  if (delErr) throw new Error(delErr.message)

  revalidatePath("/social/posts")
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(hospital\)/social/posts/actions.ts
git commit -m "feat(social): delete post server action"
```

### Task 31: Settings server actions

**Files:**
- Create: `src/app/(hospital)/social/settings/actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/(hospital)/social/settings/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { requireServerPermission } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const VALID_TONES = ["friendly", "professional", "luxe"] as const

export async function updateSocialConfig(input: {
  tone: string
  departments: string[]
  socialDailyCap: number
}) {
  await requireServerPermission("social:config")
  if (!(VALID_TONES as readonly string[]).includes(input.tone)) {
    throw new Error(`tone must be one of: ${VALID_TONES.join(", ")}`)
  }
  if (input.socialDailyCap < 1 || input.socialDailyCap > 100) {
    throw new Error("socialDailyCap must be between 1 and 100.")
  }
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("HospitalProfile").select("id").limit(1).single()
  if (!profile) throw new Error("HospitalProfile not found.")

  const { error } = await supabase.from("HospitalProfile").update({
    tone: input.tone,
    departments: JSON.stringify(input.departments),
    socialDailyCap: input.socialDailyCap,
    updatedAt: new Date().toISOString(),
  }).eq("id", profile.id)
  if (error) throw new Error(error.message)

  revalidatePath("/social/settings")
}

export async function disconnectInstagram() {
  await requireServerPermission("social:connect")
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("HospitalProfile").select("id").limit(1).single()
  if (!profile) return
  const { error } = await supabase.from("HospitalProfile").update({
    igAccessToken: null, igUserId: null, igConnectedAt: null,
    updatedAt: new Date().toISOString(),
  }).eq("id", profile.id)
  if (error) throw new Error(error.message)
  revalidatePath("/social/settings")
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(hospital\)/social/settings/actions.ts
git commit -m "feat(social): settings server actions"
```

---

## Phase 6 — UI pages

### Task 32: Module layout with permission guard

**Files:**
- Create: `src/app/(hospital)/social/layout.tsx`
- Create: `src/app/(hospital)/social/page.tsx`

- [ ] **Step 1: Layout**

```tsx
// src/app/(hospital)/social/layout.tsx
import { requireServerPermission } from "@/lib/auth"

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  await requireServerPermission("social:view")
  return <>{children}</>
}
```

- [ ] **Step 2: Root page redirects to /social/posts**

```tsx
// src/app/(hospital)/social/page.tsx
import { redirect } from "next/navigation"
export default function SocialIndex() { redirect("/social/posts") }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/social/layout.tsx src/app/\(hospital\)/social/page.tsx
git commit -m "feat(social): module layout + index redirect"
```

### Task 33: Settings page (IG connection + config form)

**Files:**
- Create: `src/app/(hospital)/social/settings/page.tsx`
- Create: `src/app/(hospital)/social/settings/components/InstagramConnectionCard.tsx`
- Create: `src/app/(hospital)/social/settings/components/SocialConfigForm.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(hospital)/social/settings/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { InstagramConnectionCard } from "./components/InstagramConnectionCard"
import { SocialConfigForm } from "./components/SocialConfigForm"

export default async function SocialSettingsPage({
  searchParams,
}: { searchParams: Promise<{ ig_connected?: string; ig_error?: string }> }) {
  const sp = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("HospitalProfile")
    .select("tone, departments, socialDailyCap, igUserId, igConnectedAt")
    .limit(1).single()

  const tone = profile?.tone ?? "friendly"
  const departments: string[] = JSON.parse(profile?.departments || "[]")
  const dailyCap = profile?.socialDailyCap ?? 5
  const connected = Boolean(profile?.igUserId)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Social Settings</h1>

      {sp.ig_connected && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-green-800">
          Instagram connected successfully.
        </div>
      )}
      {sp.ig_error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-800">
          Instagram error: {sp.ig_error}
        </div>
      )}

      <InstagramConnectionCard
        connected={connected}
        igUserId={profile?.igUserId ?? null}
        connectedAt={profile?.igConnectedAt ?? null}
      />

      <SocialConfigForm tone={tone} departments={departments} socialDailyCap={dailyCap} />
    </div>
  )
}
```

- [ ] **Step 2: InstagramConnectionCard**

```tsx
// src/app/(hospital)/social/settings/components/InstagramConnectionCard.tsx
"use client"
import { Button } from "@/components/ui/button"
import { disconnectInstagram } from "../actions"

export function InstagramConnectionCard(props: { connected: boolean; igUserId: string | null; connectedAt: string | null }) {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="font-medium">Instagram Account</div>
      {props.connected ? (
        <>
          <div className="text-sm text-zinc-600">
            Connected (IG user id: <code>{props.igUserId}</code>)
            {props.connectedAt && <> · since {new Date(props.connectedAt).toLocaleDateString()}</>}
          </div>
          <form action={async () => { await disconnectInstagram() }}>
            <Button type="submit" variant="outline">Disconnect</Button>
          </form>
        </>
      ) : (
        <>
          <div className="text-sm text-zinc-600">Not connected.</div>
          <Button asChild>
            <a href="/api/social/instagram/connect">Connect Instagram</a>
          </Button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: SocialConfigForm**

```tsx
// src/app/(hospital)/social/settings/components/SocialConfigForm.tsx
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateSocialConfig } from "../actions"

const DEPT_OPTIONS = ["Eye", "Dental", "Skin", "Orthopedic", "Pediatric", "General"]

export function SocialConfigForm(props: { tone: string; departments: string[]; socialDailyCap: number }) {
  const [tone, setTone] = useState(props.tone)
  const [departments, setDepartments] = useState<string[]>(props.departments)
  const [cap, setCap] = useState(props.socialDailyCap)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const toggleDept = (d: string) =>
    setDepartments((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const submit = () => start(async () => {
    try {
      await updateSocialConfig({ tone, departments, socialDailyCap: cap })
      setMsg("Saved.")
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed.")
    }
  })

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="font-medium">AI Generation Config</div>

      <div className="space-y-2">
        <Label>Brand tone</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="luxe">Luxe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Departments</Label>
        <div className="flex flex-wrap gap-2">
          {DEPT_OPTIONS.map((d) => (
            <button key={d} type="button" onClick={() => toggleDept(d)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      departments.includes(d) ? "bg-zinc-900 text-white" : "bg-white"
                    }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Daily Instagram post cap</Label>
        <Input type="number" min={1} max={100} value={cap}
               onChange={(e) => setCap(parseInt(e.target.value || "5", 10))} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {msg && <span className="text-sm text-zinc-600">{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

`yarn dev` → log in as admin → `/social/settings`:
- Shows "Not connected" + "Connect Instagram" button.
- Config form save updates `HospitalProfile`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(hospital\)/social/settings/
git commit -m "feat(social): settings page (IG connection + config)"
```

### Task 34: Generate page

**Files:**
- Create: `src/app/(hospital)/social/generate/page.tsx`
- Create: `src/app/(hospital)/social/generate/components/GeneratePanel.tsx`
- Create: `src/app/(hospital)/social/generate/components/AiGenerateForm.tsx`
- Create: `src/app/(hospital)/social/generate/components/ImageUploadForm.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(hospital)/social/generate/page.tsx
import { GeneratePanel } from "./components/GeneratePanel"
export default function GeneratePage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Generate Post</h1>
      <GeneratePanel />
    </div>
  )
}
```

- [ ] **Step 2: GeneratePanel (tabs)**

```tsx
// src/app/(hospital)/social/generate/components/GeneratePanel.tsx
"use client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AiGenerateForm } from "./AiGenerateForm"
import { ImageUploadForm } from "./ImageUploadForm"

export function GeneratePanel() {
  return (
    <Tabs defaultValue="ai">
      <TabsList>
        <TabsTrigger value="ai">AI only</TabsTrigger>
        <TabsTrigger value="image">From photos</TabsTrigger>
      </TabsList>
      <TabsContent value="ai" className="mt-4"><AiGenerateForm /></TabsContent>
      <TabsContent value="image" className="mt-4"><ImageUploadForm /></TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 3: AiGenerateForm**

```tsx
// src/app/(hospital)/social/generate/components/AiGenerateForm.tsx
"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { generateAi } from "../actions"

export function AiGenerateForm() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Let Gemini pick a post type and write a draft using your hospital profile.
      </p>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <Button onClick={() => start(async () => {
        try { setError(null); await generateAi() }
        catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed.") }
      })} disabled={pending}>
        {pending ? "Generating…" : "Generate AI Post"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: ImageUploadForm**

```tsx
// src/app/(hospital)/social/generate/components/ImageUploadForm.tsx
"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { generateFromImages } from "../actions"

export function ImageUploadForm() {
  const [uploadType, setUploadType] = useState("patient")
  const [files, setFiles] = useState<FileList | null>(null)
  const [text, setText] = useState("")
  const [language, setLanguage] = useState("")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => start(async () => {
    setError(null)
    if (!files || files.length === 0) { setError("Pick at least one image."); return }
    const fd = new FormData()
    fd.set("upload_type", uploadType)
    if (text) fd.set("text", text)
    if (language) fd.set("language", language)
    for (const f of Array.from(files).slice(0, 5)) fd.append("images", f)
    try { await generateFromImages(fd) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed.") }
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload type</Label>
        <Select value={uploadType} onValueChange={setUploadType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="patient">Patient photo (testimonial)</SelectItem>
            <SelectItem value="infrastructure">Hospital / equipment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Images (1-5)</Label>
        <Input type="file" multiple accept="image/jpeg,image/png,image/webp"
               onChange={(e) => setFiles(e.target.files)} />
      </div>
      <div className="space-y-2">
        <Label>Optional context</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                  placeholder='e.g. "Patient said: the team made me feel at home."' />
      </div>
      <div className="space-y-2">
        <Label>Language (optional)</Label>
        <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English, Telugu, Hindi…" />
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <Button onClick={submit} disabled={pending}>
        {pending ? "Generating…" : "Generate from photos"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(hospital\)/social/generate/
git commit -m "feat(social): generate page (AI tab + image tab)"
```

### Task 35: Post detail page (edit + publish)

**Files:**
- Create: `src/app/(hospital)/social/[postId]/page.tsx`
- Create: `src/app/(hospital)/social/[postId]/components/PostEditor.tsx`
- Create: `src/app/(hospital)/social/[postId]/components/PublishButton.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(hospital)/social/[postId]/page.tsx
import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { PostEditor } from "./components/PostEditor"
import { PublishButton } from "./components/PublishButton"

export default async function PostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: post } = await supabase
    .from("SocialPost")
    .select("id, caption, hashtags, imageUrl, slideUrls, postType, status, errorMessage, igPostId")
    .eq("id", postId).single()
  if (!post) notFound()

  const hashtags: string[] = JSON.parse(post.hashtags || "[]")
  const slideUrls: string[] | null = post.slideUrls ? JSON.parse(post.slideUrls) : null
  const previews = slideUrls && slideUrls.length > 0 ? slideUrls : [post.imageUrl]

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Post · {post.postType}</h1>
          <div className="text-sm text-zinc-600 mt-1">Status: <span className="font-medium">{post.status}</span>
            {post.igPostId && <> · IG id <code>{post.igPostId}</code></>}
          </div>
        </div>
        {post.status === "draft" && <PublishButton postId={post.id} />}
      </div>

      {post.errorMessage && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">
          Last publish error: {post.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="font-medium">Preview {previews.length > 1 && `(${previews.length} slides)`}</div>
          <div className="flex gap-2 overflow-x-auto">
            {previews.map((u, i) => (
              <img key={u} src={u} alt={`slide ${i + 1}`} className="w-72 rounded-lg border" />
            ))}
          </div>
        </div>

        <PostEditor postId={post.id} initialCaption={post.caption} initialHashtags={hashtags} readOnly={post.status !== "draft"} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: PostEditor**

```tsx
// src/app/(hospital)/social/[postId]/components/PostEditor.tsx
"use client"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updatePost } from "../actions"

export function PostEditor(props: { postId: string; initialCaption: string; initialHashtags: string[]; readOnly: boolean }) {
  const [caption, setCaption] = useState(props.initialCaption)
  const [hashtagText, setHashtagText] = useState(props.initialHashtags.join(" "))
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const save = () => start(async () => {
    const tags = hashtagText.split(/\s+/).map((s) => s.replace(/^#/, "")).filter(Boolean)
    try {
      await updatePost({ postId: props.postId, caption, hashtags: tags })
      setMsg("Saved.")
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed.")
    }
  })

  return (
    <div className="space-y-3">
      <Label>Caption</Label>
      <Textarea rows={10} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={props.readOnly} />
      <div className="text-xs text-zinc-500">{caption.length}/2200</div>

      <Label>Hashtags (space-separated, no #)</Label>
      <Input value={hashtagText} onChange={(e) => setHashtagText(e.target.value)} disabled={props.readOnly} />

      {!props.readOnly && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          {msg && <span className="text-sm text-zinc-600">{msg}</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: PublishButton**

```tsx
// src/app/(hospital)/social/[postId]/components/PublishButton.tsx
"use client"
import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { publishPost } from "../actions"

export function PublishButton({ postId }: { postId: string }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const click = () => start(async () => {
    setErr(null)
    const r = await publishPost({ postId })
    if (!r.success) setErr(r.quota ? `Quota exceeded: ${r.quota.used}/${r.quota.limit} today` : (r.error ?? "Failed"))
  })
  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={click} disabled={pending}>{pending ? "Publishing…" : "Publish to Instagram"}</Button>
      {err && <div className="text-sm text-red-700">{err}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(hospital\)/social/\[postId\]/
git commit -m "feat(social): post detail page (edit + publish)"
```

### Task 36: Posts gallery page

**Files:**
- Create: `src/app/(hospital)/social/posts/page.tsx`
- Create: `src/app/(hospital)/social/posts/components/PostsGallery.tsx`
- Create: `src/app/(hospital)/social/posts/components/PostCard.tsx`
- Create: `src/app/(hospital)/social/posts/components/PostStatusBadge.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(hospital)/social/posts/page.tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { PostsGallery } from "./components/PostsGallery"

export default async function PostsListPage() {
  const supabase = await createServerSupabaseClient()
  const { data: posts } = await supabase
    .from("SocialPost")
    .select("id, caption, postType, status, imageUrl, slideUrls, createdAt, postedAt")
    .order("createdAt", { ascending: false })
    .limit(60)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Social Posts</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/social/settings">Settings</Link></Button>
          <Button asChild><Link href="/social/generate">+ Generate</Link></Button>
        </div>
      </div>
      <PostsGallery posts={posts ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: PostsGallery + PostCard + PostStatusBadge**

```tsx
// src/app/(hospital)/social/posts/components/PostsGallery.tsx
import { PostCard } from "./PostCard"

type Row = {
  id: string; caption: string; postType: string; status: string;
  imageUrl: string; slideUrls: string | null;
  createdAt: string; postedAt: string | null
}

export function PostsGallery({ posts }: { posts: Row[] }) {
  if (!posts.length) {
    return <div className="text-sm text-zinc-600">No posts yet. Click "Generate" to create your first one.</div>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => <PostCard key={p.id} {...p} />)}
    </div>
  )
}
```

```tsx
// src/app/(hospital)/social/posts/components/PostStatusBadge.tsx
export function PostStatusBadge({ status }: { status: string }) {
  const cls = status === "posted" ? "bg-green-100 text-green-800"
    : status === "failed" ? "bg-red-100 text-red-800"
    : "bg-zinc-100 text-zinc-700"
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{status}</span>
}
```

```tsx
// src/app/(hospital)/social/posts/components/PostCard.tsx
"use client"
import Link from "next/link"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { PostStatusBadge } from "./PostStatusBadge"
import { deletePost } from "../actions"

export function PostCard(props: {
  id: string; caption: string; postType: string; status: string;
  imageUrl: string; slideUrls: string | null;
  createdAt: string; postedAt: string | null;
}) {
  const [pending, start] = useTransition()
  const isCarousel = props.slideUrls && JSON.parse(props.slideUrls).length > 1
  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      <Link href={`/social/${props.id}`}>
        <img src={props.imageUrl} alt="" className="w-full aspect-square object-cover" />
      </Link>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{props.postType}{isCarousel && " · carousel"}</span>
          <PostStatusBadge status={props.status} />
        </div>
        <div className="text-sm line-clamp-2">{props.caption}</div>
        <div className="flex items-center justify-between pt-2">
          <Link href={`/social/${props.id}`} className="text-sm underline">Open</Link>
          <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => start(async () => {
                    if (confirm("Delete this post?")) await deletePost({ postId: props.id })
                  })}>Delete</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(hospital\)/social/posts/
git commit -m "feat(social): posts gallery page"
```

---

## Phase 7 — Doctor avatar upload

### Task 37: Add avatar upload to staff/doctor form

**Files:**
- Modify: the staff form component (`src/app/(hospital)/staff/components/StaffPage.tsx` or wherever doctor profile is edited — confirm during implementation)

- [ ] **Step 1: Locate the staff edit form**

```bash
grep -rln "fullName\|qualifications" src/app/\(hospital\)/staff/components/
```

Open the file that contains the form for editing a User row.

- [ ] **Step 2: Add an avatar upload field**

Add to the form, only shown when `role === "DOCTOR"`:

```tsx
<div className="space-y-2">
  <Label>Doctor photo (avatar)</Label>
  <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    // Upload to Supabase Storage under a `staff-avatars` bucket (create one if missing).
    const { createClient } = await import("@supabase/supabase-js")
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const key = `${formUserId}/${crypto.randomUUID()}.${file.name.split(".").pop()}`
    const { error } = await supa.storage.from("staff-avatars").upload(key, file, { upsert: true })
    if (error) { alert(error.message); return }
    const { data: pub } = supa.storage.from("staff-avatars").getPublicUrl(key)
    setAvatarUrl(pub.publicUrl)
  }} />
  {avatarUrl && <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover" />}
</div>
```

In the form's submit handler, include `avatarUrl` in the User update payload.

(Alternative: extend whatever existing image-upload pattern the staff form already uses. Audit the existing `StaffPage.tsx` first — if there's already a photo field convention, reuse it instead of introducing a new bucket.)

- [ ] **Step 3: Create `staff-avatars` bucket in Supabase if needed**

Supabase Studio → Storage → New bucket, public.

- [ ] **Step 4: Manual test**

`yarn dev` → /staff → edit a doctor → upload an avatar → save → reload → avatar persists → generate an AI doctor post → avatar appears in rendered image.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/\(hospital\)/staff/
git commit -m "feat(staff): doctor avatar upload (used by social module)"
```

---

## Phase 8 — Documentation

### Task 38: Document env vars in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a "Social module" section**

```markdown
## Social Module (Instagram)

The `/social` module requires these env vars:

| Var | Notes |
|---|---|
| `META_APP_ID` | Facebook App ID |
| `META_APP_SECRET` | Facebook App secret |
| `META_OAUTH_REDIRECT_BASE` | Base URL (no trailing slash); callback is `${BASE}/api/social/instagram/callback` |
| `GEMINI_API_KEY` | Already used elsewhere; reused for content + vision |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-byte base64. Generate: `openssl rand -base64 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for server-side storage writes |

**One-time setup**:
1. Create the `social-posts` public bucket in Supabase Storage.
2. Run the schema migration: `psql "$SUPABASE_DB_URL" -f prisma/migrations/social-module.sql`.
3. Backfill ADMIN role permissions: `yarn migrate:social-admin`.
4. Set the Meta App OAuth Redirect URI to `${META_OAUTH_REDIRECT_BASE}/api/social/instagram/callback`.
5. Submit the Meta App for review (`instagram_content_publish`, `pages_manage_posts`) before going live.

Manual QA: see `docs/superpowers/specs/2026-06-08-instagram-social-module-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(social): env vars and setup steps"
```

---

## Self-Review

**Spec coverage:**
- ✓ Section 1 (architecture): Tasks 1-3 (deps + vitest + migration) + 18 (renderer pipeline).
- ✓ Section 2 (data model): Task 3 (schema migration), 5 (permissions), 6 (admin backfill).
- ✓ Section 3 (module layout): file plan at top; Tasks 32-36 hit every UI path; Tasks 8-15, 18-25 hit every lib file.
- ✓ Section 4 (data flows): A→Tasks 26-27, B→28, C→28, D→29, E→29, F→30.
- ✓ Section 5 (templates): Tasks 16 (fonts), 17 (tokens), 19-24 (each template), 25 (dispatcher), 18 (renderer).
- ✓ Section 6 (testing/env/rollout): Task 2 (vitest), 38 (README), per-lib tests in their tasks.

**Placeholders/red-flags:** Task 16 (fonts) gives concrete download paths; if Inter TTFs are unavailable at the listed URL, the engineer downloads them manually from Google Fonts (instruction included).

**Type consistency:**
- `SocialPost.hashtags` is JSON string in DB; parsed to `string[]` everywhere it's read. ✓
- `SocialPost.slideUrls` is JSON string in DB or NULL; parsed to `string[] | null`. ✓
- `Slide` type defined in `generation/types.ts`, imported consistently. ✓
- `requireServerPermission` used in all server actions and route handlers. ✓
- `createServerSupabaseClient` reused throughout (this is the assumed name of the existing helper — implementer should adjust if the actual export name differs).

**Known assumptions to verify on first task:**
- The export name of the existing Supabase server helper (`src/lib/supabase/server.ts`). If different from `createServerSupabaseClient`, update all imports.
- Whether the existing `callGemini` already supports inline image data (Task 15 includes a fallback to extend it).
- The exact shape of the staff form (Task 37). The file path is identified at the start of that task.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-08-instagram-social-module.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
