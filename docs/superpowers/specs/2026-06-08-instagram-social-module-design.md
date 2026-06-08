# Instagram Social Module — Design Spec

**Date:** 2026-06-08
**Module name:** `social` (route prefix `/social`, permission prefix `social:*`)
**Scope:** Connect the HMS to a hospital's Instagram Business account; generate posts via Gemini (AI-only or from uploaded photos); render branded images; publish directly to Instagram. **WhatsApp inbound is explicitly excluded.**

Reference implementation: `/Users/vamshidhar/Documents/Sitha-ai` (the `clinicgrow-renderer` Express service plus `clinicgrow-web` UI). Sitha's flows are the source of truth for OAuth, Meta Graph calls, and prompt design. This module re-implements that flow natively inside the existing Docsile Next.js 16 app — no separate service, no Puppeteer.

---

## 1. High-Level Architecture

Everything runs inside the existing Next.js app. Server-side logic uses Route Handlers and Server Actions. Client UI lives under `src/app/(hospital)/social/`.

### Subsystems

| Subsystem | Lives in | Notes |
|---|---|---|
| Instagram OAuth | `src/app/api/social/instagram/connect/route.ts` + `/callback/route.ts` | Stores long-lived page token on `HospitalProfile`. One IG account per hospital. |
| Content generation (Gemini) | `src/lib/social/generation/` | Reuses existing `src/lib/ai/gemini.ts`. Two entry points: AI-only and image-based (Gemini Vision). |
| Image rendering | `src/lib/social/templates/` (React) + `src/lib/social/renderer.ts` | **`satori` + `@resvg/resvg-js` + `sharp`**: React templates → SVG → PNG → JPG. Pure JS; works in Next.js serverless. No Chromium. |
| Image storage | Supabase Storage public bucket `social-posts` | Public CDN URL handed to IG Graph API directly. No proxy route needed. |
| Instagram publishing | `src/lib/social/instagram.ts` | Ports Sitha's `publishPost` + `publishCarousel`. Meta Graph v22.0, container → publish flow. |

### Request flow for "generate + publish"

1. User clicks Generate → Server Action runs Gemini → returns `{ post_type, caption, hashtags[], slides?[], image_idea, department? }`.
2. Render path: React template element → Satori SVG → resvg PNG → sharp JPG → upload to Supabase Storage → public URL.
3. Insert row in `SocialPost` table with `status='draft'`.
4. User clicks Publish → Server Action calls Meta Graph (1-step single, 3-step carousel) → updates row to `status='posted'` with `igPostId`.

### Out of scope (v1)

Scheduling, WhatsApp inbound, multi-IG-account, post analytics / insights, auto-pilot, Stories/Reels, AI-only caption translation (image-based path already supports language param from Sitha).

### Alternatives rejected during brainstorming

- **Puppeteer in Vercel serverless** — exceeds bundle size; 15+ second cold starts; ops burden.
- **Reuse Sitha's `clinicgrow-renderer` over the network** — works but couples Docsile to Sitha's deployment, tenancy model, and quota system.

---

## 2. Data Model

### Schema changes to existing tables

```sql
-- HospitalProfile: social/IG config columns
ALTER TABLE "HospitalProfile" ADD COLUMN "tone" TEXT;                    -- 'friendly' | 'professional' | 'luxe'
ALTER TABLE "HospitalProfile" ADD COLUMN "departments" TEXT NOT NULL DEFAULT '[]';  -- JSON string array
ALTER TABLE "HospitalProfile" ADD COLUMN "igAccessToken" TEXT;           -- AES-256-GCM-encrypted Meta page token
ALTER TABLE "HospitalProfile" ADD COLUMN "igUserId" TEXT;                -- instagram_business_account.id
ALTER TABLE "HospitalProfile" ADD COLUMN "igConnectedAt" TIMESTAMP(3);
ALTER TABLE "HospitalProfile" ADD COLUMN "socialDailyCap" INTEGER NOT NULL DEFAULT 5;

-- User: add doctor photo
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
```

The app is single-hospital (one row in `HospitalProfile`) — no tenancy column needed on `SocialPost`.

### New table: `SocialPost`

```sql
CREATE TABLE "SocialPost" (
  "id"               TEXT        NOT NULL,
  "caption"          TEXT        NOT NULL,
  "hashtags"         TEXT        NOT NULL DEFAULT '[]',   -- JSON string array
  "postType"         TEXT        NOT NULL,                -- doctor|educational|promo|engagement|trust
  "imageUrl"         TEXT        NOT NULL,                -- public Supabase URL (cover image)
  "slideUrls"        TEXT,                                -- JSON string array, NULL = single image
  "status"           TEXT        NOT NULL DEFAULT 'draft',-- draft|posted|failed
  "source"           TEXT        NOT NULL,                -- 'ai' | 'image'
  "doctorId"         TEXT,                                -- FK to User for doctor-type posts
  "errorMessage"     TEXT,                                -- last publish error if status=failed
  "igPostId"         TEXT,                                -- set when status=posted
  "postedAt"         TIMESTAMP(3),
  "createdById"      TEXT        NOT NULL,                -- FK to User who generated it
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialPost_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "SocialPost_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "SocialPost_status_idx"    ON "SocialPost"("status");
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt" DESC);
CREATE INDEX "SocialPost_postedAt_idx"  ON "SocialPost"("postedAt" DESC);
```

### New table: `OAuthState` (for IG OAuth CSRF protection)

```sql
CREATE TABLE "OAuthState" (
  "state"     TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "purpose"   TEXT        NOT NULL,           -- 'instagram_connect'
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("state")
);

CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");
```

Survives serverless instance restarts (vs Sitha's in-memory `Map`). Sweeper deletes expired rows opportunistically inside the callback.

### Quota enforcement (no separate table)

`COUNT(*) FROM "SocialPost" WHERE status='posted' AND "postedAt"::date = CURRENT_DATE` compared against `HospitalProfile.socialDailyCap`. No counter row to keep in sync.

### Permission keys (added to `src/lib/permissions.ts`)

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
    { key: "social:config",   label: "Edit Social Config (tone, departments, daily cap)" },
  ],
}
```

`MODULE_ROUTE_MAP.social = "/social"`. `DEFAULT_ROLE_PERMISSIONS.ADMIN` automatically gets all keys (uses `getAllPermissionKeys()`). All other system roles (DOCTOR, RECEPTIONIST, OPTOMETRIST, NURSE) get **none** by default — admins grant access per-staff via the existing roles & permissions UI on `/staff`.

A one-shot migration appends `social:*` to existing `Role` rows where `name='ADMIN'` to handle databases not seeded after this change.

### Supabase Storage

Bucket: `social-posts` (public-read).

```
social-posts/
  posts/
    {postId}/
      cover.jpg                ← always present
      slide-1.jpg              ← only for carousels
      slide-2.jpg
      ...
```

Public URL: `https://<project>.supabase.co/storage/v1/object/public/social-posts/posts/{postId}/cover.jpg`. IG's crawler fetches this directly. On row delete from `SocialPost`, server action deletes corresponding objects (best-effort).

### Token encryption

`HospitalProfile.igAccessToken` is encrypted at rest using AES-256-GCM with key from `SOCIAL_TOKEN_ENCRYPTION_KEY` env var (32-byte base64). Stored format: `base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)`. Implemented in `src/lib/social/tokens.ts`. Tampering is detected by GCM auth tag — decryption throws.

---

## 3. Module Layout

```
src/
├── app/
│   ├── (hospital)/
│   │   └── social/
│   │       ├── layout.tsx              ← perms guard: requires "social:view"
│   │       ├── page.tsx                ← redirects to /social/posts
│   │       ├── posts/
│   │       │   ├── page.tsx            ← gallery (server component)
│   │       │   ├── actions.ts          ← deletePost
│   │       │   └── components/
│   │       │       ├── PostsGallery.tsx
│   │       │       ├── PostCard.tsx
│   │       │       └── PostStatusBadge.tsx
│   │       ├── generate/
│   │       │   ├── page.tsx            ← tabs: AI-only | upload images
│   │       │   ├── actions.ts          ← generateAi, generateFromImages
│   │       │   └── components/
│   │       │       ├── GeneratePanel.tsx
│   │       │       ├── AiGenerateForm.tsx
│   │       │       └── ImageUploadForm.tsx
│   │       ├── [postId]/
│   │       │   ├── page.tsx            ← detail / edit / publish
│   │       │   ├── actions.ts          ← updatePost, publishPost
│   │       │   └── components/
│   │       │       ├── PostEditor.tsx
│   │       │       └── PublishButton.tsx
│   │       └── settings/
│   │           ├── page.tsx            ← IG connect/disconnect + tone/depts/daily cap
│   │           ├── actions.ts          ← updateSocialConfig, disconnectInstagram
│   │           └── components/
│   │               ├── InstagramConnectionCard.tsx
│   │               └── SocialConfigForm.tsx
│   └── api/
│       └── social/
│           └── instagram/
│               ├── connect/route.ts
│               └── callback/route.ts
│
└── lib/
    └── social/
        ├── env.ts                      ← validates META_*, SOCIAL_TOKEN_ENCRYPTION_KEY, GEMINI_*
        ├── instagram.ts                ← exchangeCodeForToken, publishPost, publishCarousel
        ├── tokens.ts                   ← encrypt/decrypt (AES-256-GCM)
        ├── quota.ts                    ← checkDailyCap, getTodayPostedCount
        ├── storage.ts                  ← uploadToSupabase, deleteFromSupabase
        ├── renderer.ts                 ← React element → Satori SVG → resvg PNG → sharp JPG → Buffer
        ├── generation/
        │   ├── ai-prompt.ts            ← buildPrompt + parseResponse for AI-only
        │   ├── vision-prompt.ts        ← buildPrompt + parseResponse for image-based
        │   └── types.ts                ← GeneratedContent, PostType, Slide
        └── templates/
            ├── DoctorTemplate.tsx
            ├── EducationalTemplate.tsx ← multi-slide
            ├── PromoTemplate.tsx
            ├── EngagementTemplate.tsx
            ├── TrustTemplate.tsx       ← multi-slide
            ├── PhotoOverlayTemplate.tsx← used for image-based generation
            ├── shared/
            │   ├── tokens.ts           ← department palettes + tone tokens
            │   └── primitives.tsx      ← Logo, DepartmentBadge, etc.
            └── index.ts                ← renderTemplate(content, hospital, doctor?) dispatcher
```

### Component boundaries

| Unit | Owns | Depends on | Tested via |
|---|---|---|---|
| `lib/social/instagram.ts` | Meta Graph HTTP calls only. No DB, no storage. | `fetch` | mock fetch; assert request shape |
| `lib/social/tokens.ts` | Encrypt/decrypt strings using env key. | `node:crypto` | round-trip unit test |
| `lib/social/quota.ts` | Today's post count + compare to cap. Returns `{allowed, used, limit}`. | Supabase | integration test |
| `lib/social/storage.ts` | Upload Buffer → public URL. Delete by key. | Supabase service-role client | integration test |
| `lib/social/renderer.ts` | React element → PNG/JPG Buffer. Knows nothing about DB or IG. | satori, @resvg/resvg-js, sharp | snapshot test |
| `lib/social/generation/*` | Build prompt → call Gemini → parse + validate JSON. | `src/lib/ai/gemini.ts` | mock Gemini; assert prompt + parsing |
| `lib/social/templates/*` | Pure React components, no I/O. | — | visual snapshot test |
| Server actions | Compose: auth → perm → quota → generation → render → storage → DB. | all `lib/social/*` | integration test |
| UI components | Render + dispatch server actions. | server actions | RTL where useful |

**Rule:** `lib/social/*` files are pure (no Next.js imports, no `headers()` / `cookies()`). All side-effecting orchestration happens in server actions and route handlers.

### Sidebar registration

Append entry to the existing permission-filtered sidebar component: `{ label: "Social", route: "/social", icon: Instagram, permission: "social:view" }`. The exact file is identified during planning; the existing sidebar already supports permission gating.

---

## 4. Data Flow Sequences

### A. Instagram OAuth (connect)

```
User clicks "Connect Instagram" in /social/settings
   │
   ▼
GET /api/social/instagram/connect
   │ - auth check, perm check (social:connect)
   │ - generate CSRF state (16 random bytes hex)
   │ - INSERT OAuthState { state, userId, purpose='instagram_connect', expiresAt=now+10min }
   ▼
302 → https://www.facebook.com/v18.0/dialog/oauth?...
   │   scope: instagram_basic, instagram_content_publish, pages_show_list,
   │          pages_read_engagement, pages_manage_posts, business_management,
   │          public_profile
   ▼
User approves on Facebook
   │
   ▼
GET /api/social/instagram/callback?code&state
   │ - SELECT OAuthState by state; DELETE row; verify userId + not expired
   │ - exchangeCodeForToken(code):
   │     1. short-lived user token from code
   │     2. /me/accounts?fields=id,name,access_token,instagram_business_account
   │     3. find first page with instagram_business_account → igUserId + pageToken
   │     4. exchange short user → long-lived user token (60d)
   │     5. GET /{pageId}?fields=access_token using long user token → never-expiring page token
   │ - encrypt page token via lib/social/tokens.ts
   │ - UPDATE HospitalProfile SET igAccessToken=<enc>, igUserId=..., igConnectedAt=now
   ▼
302 → /social/settings?ig_connected=1
```

Errors are 302-redirected to `/social/settings?ig_error=<message>`.

### B. AI-only generation

```
User clicks "Generate AI Post" in /social/generate
   │
   ▼
Server Action: generateAi()
   │ - perm check social:generate
   │ - load HospitalProfile (name, address, tone, departments, logoUrl)
   │ - load active doctors (User where role='DOCTOR' AND isActive=true)
   │ - call lib/social/generation/ai-prompt.ts → buildPrompt → callGemini
   │     returns: { post_type, caption, hashtags[], image_idea, slides?[], department? }
   │ - if post_type === 'doctor': pick random doctor (prefer one with avatarUrl)
   │ - dispatch template via lib/social/templates/index.ts → renderTemplate
   │     • educational, trust → returns Buffer[] (carousel slides)
   │     • doctor, promo, engagement → returns Buffer
   │ - upload to Supabase Storage under posts/{postId}/cover.jpg + slide-N.jpg
   │ - INSERT SocialPost { status='draft', source='ai', caption, hashtags,
   │       postType, imageUrl, slideUrls?, doctorId?, createdById }
   ▼
Redirect to /social/[postId]
```

### C. Image-based generation

```
User uploads 1–5 photos in /social/generate
   │ uploadType: 'patient' | 'infrastructure'
   │ optional text + language
   ▼
Server Action: generateFromImages(formData)
   │ - perm check social:generate
   │ - validate: file count 1–5, size ≤10MB each, MIME jpeg/png/webp
   │ - load HospitalProfile
   │ - for each image in parallel:
   │     lib/social/generation/vision-prompt.ts → callGemini with inlineData(image)
   │     returns: { post_type, caption, hashtags[], quote? }
   │ - render via PhotoOverlayTemplate
   │     • 1 image → Buffer
   │     • >1 image → Buffer[] (carousel; all slides share image 1's hashtags)
   │ - upload to Supabase Storage
   │ - INSERT SocialPost { status='draft', source='image' }
   ▼
Redirect to /social/[postId]
```

### D. Edit caption / hashtags

```
On /social/[postId], user edits caption + hashtags
   │
   ▼
Server Action: updatePost({ postId, caption, hashtags })
   │ - perm check social:edit
   │ - assert SocialPost.status === 'draft' (cannot edit posted or failed)
   │ - UPDATE SocialPost SET caption, hashtags, updatedAt=now
```

### E. Publish to Instagram

```
User clicks "Publish to Instagram" on /social/[postId]
   │
   ▼
Server Action: publishPost({ postId })
   │ - perm check social:publish
   │ - SELECT SocialPost; assert status === 'draft'
   │ - SELECT HospitalProfile; assert igAccessToken && igUserId present
   │ - quota check: lib/social/quota.ts → checkDailyCap()
   │     if !allowed → return { error:'quota_exceeded', used, limit, cap }
   │ - decrypt igAccessToken
   │ - fullCaption = `${caption}\n\n${hashtags.map(h=>'#'+h).join(' ')}`
   │ - if slideUrls && length > 1 → publishCarousel(igUserId, token, slideUrls, fullCaption)
   │   else                       → publishPost(igUserId, token, imageUrl, fullCaption)
   │ - success: UPDATE SocialPost SET status='posted', igPostId, postedAt=now
   │   failure: UPDATE SocialPost SET status='failed', errorMessage=err.message
   │     Meta error code 190 → token expired:
   │         also UPDATE HospitalProfile SET igAccessToken=NULL, igUserId=NULL
   ▼
Revalidate /social/posts; stay on detail page with status update
```

### F. Delete post

```
Server Action: deletePost({ postId })
   │ - perm check social:delete
   │ - SELECT imageUrl, slideUrls → extract storage keys
   │ - delete objects from Supabase Storage (best-effort; log failures)
   │ - DELETE SocialPost WHERE id=postId
```

### Cross-cutting error handling

- **Generation failures** (Gemini error, malformed JSON): server action throws; UI toast; no DB row.
- **Rendering failures** (Satori/resvg crash): server action throws; no DB row; full error logged.
- **Storage failures**: no DB row if cover failed. For carousels, if slide N>1 fails, clean up already-uploaded slides for that `postId` before throwing.
- **Publish failures**: row stays as `status='failed'` with `errorMessage`. User can re-edit or delete.
- **Token expired (Meta error code 190)**: clear IG credentials on `HospitalProfile`; UI shows reconnect banner on `/social/settings`.

---

## 5. Templates & Rendering

### Renderer constraints (Satori + resvg)

Satori is not a browser. It renders a constrained CSS subset to SVG; resvg rasterizes to PNG; sharp re-encodes to JPG.

| Supported | Not supported |
|---|---|
| Flexbox layout | CSS Grid (use nested flex) |
| Borders, border-radius, box-shadow | `filter`, `backdrop-filter`, `mask` |
| `linear-gradient` / `radial-gradient` backgrounds | Animations, transitions, transforms beyond translate/scale/rotate |
| `<img>` (URL or data URI) | `<canvas>`, inline `<svg>` children, `object-fit` quirks |
| Text via bundled TTF fonts | Variable fonts, system font references |
| Absolute positioning | `position: sticky/fixed` |

**Implication for Sitha's templates:** decorative SVG shapes from the original HTML must be redrawn as absolutely-positioned `<div>`s with gradients and border-radius. The five visual styles (`bold-split`, `geometric`, `editorial`, `minimal-card`, `gradient-full`) all port cleanly to Satori using flex + gradients + border-radius.

### Fonts

Bundled in `public/social/fonts/`:

- **Inter** — weights 400, 600, 800. Covers all template typography.

TTFs are loaded at server startup into a module-scoped cache and passed to Satori's `fonts` option per render.

### Department palettes (ported verbatim from Sitha)

```ts
// src/lib/social/templates/shared/tokens.ts
export const DEPARTMENT_PALETTES = {
  Dental:     { primary:'#1D4ED8', light:'#DBEAFE', dark:'#1E3A8A',
                gradientFrom:'#1E40AF', gradientTo:'#3B82F6' },
  Eye:        { primary:'#0891B2', light:'#CFFAFE', dark:'#0C4A6E',
                gradientFrom:'#164E63', gradientTo:'#0EA5E9' },
  Skin:       { primary:'#B45309', light:'#FDE68A', dark:'#78350F',
                gradientFrom:'#92400E', gradientTo:'#F59E0B' },
  Orthopedic: { primary:'#1E40AF', light:'#BFDBFE', dark:'#1E3A5F',
                gradientFrom:'#172554', gradientTo:'#2563EB' },
  Pediatric:  { primary:'#7C3AED', light:'#EDE9FE', dark:'#3B0764',
                gradientFrom:'#4C1D95', gradientTo:'#8B5CF6' },
  General:    { primary:'#059669', light:'#D1FAE5', dark:'#022C22',
                gradientFrom:'#064E3B', gradientTo:'#10B981' },
}
export const DEFAULT_PALETTE = {
  primary:'#4338CA', light:'#E0E7FF', dark:'#312E81',
  gradientFrom:'#3730A3', gradientTo:'#6366F1',
}
```

Since the initial deployment is an eye hospital, `Eye` is the practical default. All six palettes are retained so the module works for any department mix.

### The five templates (all 1080×1080)

| Template | Layout sketch | Carousel | Inputs |
|---|---|---|---|
| `DoctorTemplate` | Gradient background, doctor avatar circle top-center, name + qualification, hospital strip at bottom | No | hospital, doctor (avatarUrl, fullName, qualifications, department) |
| `EducationalTemplate` | Slide 1: "Did You Know?" title. Slides 2–N: numbered point on light bg. Final slide: CTA | Yes (3–5) | hospital, slides[] from Gemini |
| `PromoTemplate` | Bold-split: top half gradient with headline, bottom half light with details + CTA | No | hospital, caption |
| `EngagementTemplate` | Geometric bg with large center question, hospital handle bottom | No | hospital, caption |
| `TrustTemplate` | Each slide is a testimonial quote with hospital branding strip | Yes (2–5) | hospital, slides[] |
| `PhotoOverlayTemplate` | User-uploaded photo as full background, dark gradient overlay bottom, quote+caption + logo | Yes (1–5) | hospital, photoDataUri, quote, caption |

**Dispatcher**: `templates/index.ts → renderTemplate(content, hospital, doctor?) → Promise<Buffer | Buffer[]>`. Single Buffer for non-carousel, array for carousel.

### Gemini prompt strategy

**AI-only prompt** (`generation/ai-prompt.ts`):

- System: "You are a social media manager for a `{tone}` hospital named `{name}` in `{address}`. Departments: `{departments.join(', ')}`. Generate one Instagram post."
- Strict JSON output: `{ post_type, caption, hashtags[], image_idea, department?, slides?[] }`.
- `post_type ∈ ['doctor','educational','promo','engagement','trust']`.
- `slides` required iff `post_type ∈ ['educational','trust']`.
- Constraints: caption ≤ 2200 chars (IG limit), hashtags 5–15 items, no leading `#`.
- Doctor list included so Gemini can choose a `doctor` post only when at least one doctor exists.

**Vision prompt** (`generation/vision-prompt.ts`):

- Multimodal: image bytes (inlineData) + system prompt.
- Inputs: image, `uploadType ∈ ['patient','infrastructure']`, optional userText, optional language.
- Output JSON: `{ post_type, caption, hashtags[], quote? }`.
- `uploadType='patient'` → `post_type='trust'` (forced); `uploadType='infrastructure'` → `post_type='promo'` (forced).
- `quote` is the testimonial pull-quote used as overlay text.

**Validation**: each response is parsed and validated via a hand-rolled validator (no new dep). On malformed JSON or missing required field, throw `GenerationError` and surface to UI. No silent fallback.

### Rendering knobs

- Size: 1080×1080 hardcoded (IG square). No portrait/landscape in v1.
- Output format: JPG quality 90 (resvg → PNG → sharp → JPG).
- Concurrency: slides rendered in parallel via `Promise.all`. Serverless functions handle ≤5 slides fine.

---

## 6. Testing, Env Vars, and Rollout

### Environment variables

```
# Meta / Instagram
META_APP_ID=
META_APP_SECRET=
META_OAUTH_REDIRECT_BASE=     # e.g. https://hms.example.com  (no trailing slash)
                              # callback = ${BASE}/api/social/instagram/callback

# Gemini (already in repo; reused)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash # override default; vision needs flash or pro

# Token encryption
SOCIAL_TOKEN_ENCRYPTION_KEY=  # 32-byte base64. Generate: openssl rand -base64 32

# Supabase (already in repo; bucket must be created)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=    # required for server-side storage writes
```

Startup check in `src/lib/social/env.ts`: validates all required vars on first use; throws a clear error if missing. No silent fallback.

### Meta App configuration (one-time, manual)

1. Create Facebook App (type: Business).
2. Add **Instagram Graph API** + **Facebook Login for Business** products.
3. OAuth Redirect URI = `${META_OAUTH_REDIRECT_BASE}/api/social/instagram/callback`.
4. Required scopes (granted at OAuth time): `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`, `public_profile`.
5. Submit App Review for `instagram_content_publish` + `pages_manage_posts` before production (Dev Mode only allows test users).

### Supabase configuration

1. Create public bucket `social-posts`.
2. Policy: anonymous SELECT allowed; INSERT/UPDATE/DELETE only via service_role.
3. Run schema migration SQL from Section 2.

### Testing strategy

| Layer | Approach | Coverage |
|---|---|---|
| `lib/social/tokens.ts` | Unit — encrypt/decrypt round-trip; tamper assertion fails | 100% |
| `lib/social/instagram.ts` | Mock `fetch`; assert URLs, methods, bodies, headers for all calls (exchange, /me/accounts, long-lived exchange, page-token fetch, publishPost, publishCarousel) | All paths inc. error 190 |
| `lib/social/quota.ts` | Integration vs local Supabase; seed posts at various `postedAt` dates; boundary cases | All branches |
| `lib/social/storage.ts` | Integration vs local Supabase storage; upload + read + delete | Happy path + delete-missing |
| `lib/social/generation/*` | Mock `callGemini`; canned responses; assert prompt + JSON parse/validation | Both prompts, all post_types, malformed JSON |
| `lib/social/templates/*` | Visual snapshot — render with fixture data → PNG hash compare. CI only. | All 5 + photo overlay |
| `lib/social/renderer.ts` | Snapshot as above | — |
| Server actions | Integration — auth + perm + quota + gen + render + storage + DB; mock Gemini + Meta only | One success + one failure each |
| OAuth route handlers | Integration — connect → mock Meta → callback → HospitalProfile updated with encrypted token | Happy + CSRF state mismatch |
| Permissions | Unit — `social:*` in `ALL_PERMISSIONS`; ADMIN auto-gets all | — |

**Publish path is exercised end-to-end manually each release** against a test Meta App + test IG account. Mock-only IG testing has historically masked Meta API breakage.

### Manual QA checklist (per release)

1. Connect Instagram from `/social/settings` — succeeds; token encrypted in DB.
2. AI generate → produces a draft of each `post_type` at least once across several runs.
3. Image generate → upload 1, 3, 5 images → drafts produced.
4. Edit caption + hashtags → saved.
5. Publish single → appears on IG.
6. Publish carousel → appears on IG with correct slide order.
7. Quota — set `socialDailyCap=2`; publish 3 → third rejected with quota error.
8. Token expiry — manually corrupt `igAccessToken` → publish → fails with reconnect prompt; user re-connects.
9. Delete post → row gone, storage objects gone.
10. Non-admin staff without `social:view` → `/social` returns 403/redirect.

### Rollout checklist

1. Schema migration committed; ran on staging.
2. Meta App in test mode; redirect URI + scopes set; test IG account linked.
3. Supabase bucket created with policies.
4. Env vars set on Vercel.
5. Permissions added to `src/lib/permissions.ts`; one-shot migration appends `social:*` to existing ADMIN role rows.
6. Sidebar entry rendered; verified hidden for non-permitted roles.
7. Manual QA on staging.
8. Submit Meta App Review (~5–7 business days) for `instagram_content_publish` + `pages_manage_posts`.
9. After approval → flip Meta App to Live → production-ready.

### Out of scope explicitly (deferred to v2)

- Scheduled posts (cron, queue, retry).
- Post analytics (likes, reach, impressions).
- Multiple IG accounts per hospital.
- Auto-pilot (auto-generate + auto-publish on a cadence).
- WhatsApp inbound (per user instruction).
- Stories, Reels (only feed posts: single image + carousel).
- AI-only path translation (image-based path already supports a language param ported from Sitha).
