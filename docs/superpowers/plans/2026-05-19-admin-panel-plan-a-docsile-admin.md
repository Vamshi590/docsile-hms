# docsile-admin MVP — Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `docsile-admin` panel from scratch — a Next.js 16 app that manages per-hospital deployments (registry, plans, API keys, encrypted secrets, dev-user auth, audit log) and serves the public `/api/v1/config` + `/api/v1/heartbeat` endpoints that hospital instances will consume.

**Architecture:** New standalone repo (`docsile-admin`), separate from the existing `docsile-hms`. Next.js 16 App Router + Prisma + Supabase Postgres + Tailwind v4 + Radix UI. Dev users authenticate via custom JWT (same `jose`-based pattern as HMS). Hospital secrets encrypted at app level with AES-GCM. API keys hashed with bcrypt. Audit log written on every state change.

**Tech Stack:** Next.js 16 (App Router, turbopack), React 19, TypeScript 5, Prisma 6, Supabase Postgres, Tailwind v4, Radix UI, `jose` (JWT), `bcryptjs` (passwords + API keys), `otpauth` (TOTP — phase 2), Node `crypto` (AES-GCM encryption), Vitest (unit tests).

**Spec reference:** `docs/superpowers/specs/2026-05-19-admin-panel-design.md`

---

## Prerequisites

- Node 20+, pnpm or npm installed
- Access to a Supabase project for the admin DB (separate from any hospital's DB)
- Vercel account for deployment (optional during development)
- The existing `docsile-hms` repo at `~/Desktop/docsile-hms/docsile-hms` to copy UI primitives from

## Test Strategy

The existing `docsile-hms` has no tests. Don't try to retrofit comprehensive testing onto `docsile-admin` either. Be pragmatic:

- **Unit tests (Vitest)** for pure libs: encryption, JWT, password hashing, API-key generation, `computeEnabledModules`, rate limiter. These are TDD throughout.
- **No tests** for server actions, page components, or UI in MVP. Verify manually in the dev server.
- **Smoke tests via curl** for the public `/api/v1` endpoints — runnable shell scripts in `scripts/smoke/`.
- **Coverage target:** 80%+ for pure libs in `lib/`. No coverage requirement for `app/`.

If a task is non-TDD (UI or server action), the steps will say "verify manually in browser" instead of "run test".

## File Structure Overview

```
docsile-admin/
├── package.json, tsconfig.json, next.config.ts, postcss.config.mjs
├── eslint.config.mjs, components.json, vitest.config.ts
├── .env.example, .gitignore
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── smoke/
│       ├── config.sh
│       └── heartbeat.sh
└── src/
    ├── app/
    │   ├── (auth)/login/page.tsx + actions.ts
    │   ├── (admin)/
    │   │   ├── layout.tsx
    │   │   ├── hospitals/{page.tsx, actions.ts, new/, [id]/}
    │   │   ├── plans/{page.tsx, actions.ts, components/}
    │   │   ├── dev-users/{page.tsx, actions.ts}
    │   │   ├── audit-log/page.tsx
    │   │   └── settings/{page.tsx, actions.ts}
    │   └── api/v1/
    │       ├── config/route.ts
    │       └── heartbeat/route.ts
    ├── components/
    │   ├── ui/                — Radix primitives (copy from HMS)
    │   ├── layout/{Sidebar.tsx, Header.tsx}
    │   └── secrets/RevealSecret.tsx
    ├── lib/
    │   ├── prisma.ts          — singleton Prisma client
    │   ├── auth.ts            — login, session, requireRole
    │   ├── jwt.ts             — sign/verify (TDD)
    │   ├── password.ts        — bcrypt hash/verify (TDD)
    │   ├── encryption.ts      — AES-GCM (TDD)
    │   ├── api-keys.ts        — generate, hash, verify (TDD)
    │   ├── modules.ts         — canonical module list
    │   ├── audit.ts           — logAuditEvent
    │   ├── compute-modules.ts — derive enabledModules (TDD)
    │   ├── api-auth.ts        — X-Hospital-Key middleware
    │   ├── rate-limit.ts      — per-key bucket (TDD)
    │   └── utils.ts
    └── middleware.ts          — admin route gating
```

---

## Task list

(Tasks below. Each is self-contained — code shown in full, file paths exact.)

---

### Task 1: Bootstrap the `docsile-admin` repo

**Files:**
- Create: `~/Desktop/docsile-admin/package.json`
- Create: `~/Desktop/docsile-admin/tsconfig.json`
- Create: `~/Desktop/docsile-admin/next.config.ts`
- Create: `~/Desktop/docsile-admin/.gitignore`
- Create: `~/Desktop/docsile-admin/.env.example`
- Create: `~/Desktop/docsile-admin/src/app/layout.tsx`
- Create: `~/Desktop/docsile-admin/src/app/page.tsx`

- [ ] **Step 1: Create directory and initialize Next.js 16**

```bash
cd ~/Desktop
npx create-next-app@16 docsile-admin --typescript --tailwind --eslint --app --turbopack --src-dir --import-alias "@/*" --no-experimental
cd docsile-admin
```

When prompted, accept defaults. Confirm `package.json` shows `"next": "^16.x"` and `"react": "^19.x"`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @prisma/client @supabase/supabase-js jose bcryptjs zod react-hook-form @hookform/resolvers sonner clsx tailwind-merge class-variance-authority lucide-react date-fns
npm install -D prisma @types/bcryptjs vitest @vitest/ui @testing-library/react happy-dom tsx
```

- [ ] **Step 3: Install Radix UI primitives**

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-alert-dialog @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-separator
```

- [ ] **Step 4: Replace `.env.example`**

```bash
cat > .env.example <<'EOF'
# Admin DB (Supabase Postgres)
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?schema=public"

# Admin session JWT signing
SESSION_JWT_SECRET="<generate with: openssl rand -hex 64>"

# AES-GCM key for encrypting hospital secrets at rest
# Must be exactly 32 bytes (64 hex chars)
SECRETS_ENCRYPTION_KEY="<generate with: openssl rand -hex 32>"

# Optional — public URL used in env-var bundles
NEXT_PUBLIC_ADMIN_API_URL="http://localhost:3000"
EOF
```

- [ ] **Step 5: Verify dev server boots**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`, default Next.js page renders. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: bootstrap docsile-admin with Next.js 16 + deps"
```

---

### Task 2: Vitest setup + first sanity test

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/sanity.test.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 2: Add test scripts in `package.json`**

In the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Write a sanity test**

```ts
// src/lib/sanity.test.ts
import { describe, it, expect } from "vitest";

describe("vitest sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

```bash
npm test
```

Expected: 1 file, 1 test, all pass.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json src/lib/sanity.test.ts
git commit -m "chore: add vitest with sanity test"
```

---

### Task 3: Prisma schema + initial migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`. Open `.env`, paste your Supabase admin-DB connection string into `DATABASE_URL`. Also add `DIRECT_URL` (same value for Supabase non-pooler URL).

- [ ] **Step 2: Replace `prisma/schema.prisma` with the full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum HospitalStatus {
  PROVISIONING
  ACTIVE
  SUSPENDED
  PAUSED
  CANCELLED
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  YEARLY
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  OVERDUE
  CANCELLED
}

enum PaymentMethod {
  BANK_TRANSFER
  UPI
  CHEQUE
  CASH
  REFUND
  OTHER
}

enum DevUserRole {
  SUPER_ADMIN
  ADMIN
  VIEWER
}

model Hospital {
  id                   String          @id @default(cuid())
  name                 String
  code                 String          @unique
  ownerName            String
  ownerEmail           String
  ownerPhone           String?
  billingAddress       String          @db.Text
  gstin                String?
  deploymentUrl        String?
  supabaseDbUrl        String?         @db.Text   // app-level encrypted
  supabaseAnonKey      String?         @db.Text   // app-level encrypted
  supabaseServiceKey   String?         @db.Text   // app-level encrypted
  hmsJwtSecret         String?         @db.Text   // app-level encrypted
  timezone             String          @default("Asia/Kolkata")
  status               HospitalStatus  @default(PROVISIONING)
  lastHeartbeatAt      DateTime?
  lastHeartbeatVersion String?
  createdAt            DateTime        @default(now())
  activatedAt          DateTime?
  cancelledAt          DateTime?
  updatedAt            DateTime        @updatedAt

  subscriptions Subscription[]
  apiKeys       ApiKey[]
  invoices      Invoice[]
  payments      Payment[]

  @@index([status])
  @@index([code])
}

model Plan {
  id           String       @id @default(cuid())
  code         String       @unique
  name         String
  description  String?      @db.Text
  priceInr     Int          // stored in paise? No — INR rupees (whole units). Indian GST invoices use rupees with paise as decimals; we treat it as rupees.
  billingCycle BillingCycle @default(MONTHLY)
  moduleCodes  String[]
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  subscriptions Subscription[]
}

model Subscription {
  id                  String             @id @default(cuid())
  hospitalId          String
  planId              String
  startedAt           DateTime           @default(now())
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime
  nextBillingDate     DateTime
  customPriceInr      Int?
  extraModules        String[]           @default([])
  excludedModules     String[]           @default([])
  status              SubscriptionStatus @default(ACTIVE)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  hospital Hospital @relation(fields: [hospitalId], references: [id])
  plan     Plan     @relation(fields: [planId], references: [id])

  @@index([hospitalId, status])
}

model Invoice {
  id              String        @id @default(cuid())
  invoiceNumber   String?       @unique  // null while DRAFT
  hospitalId      String
  subscriptionId  String?
  periodStart     DateTime
  periodEnd       DateTime
  issueDate       DateTime?
  dueDate         DateTime
  subtotalInr     Int
  placeOfSupply   String        // state code; determines IGST vs CGST+SGST
  taxBreakdown    Json          // { cgst, sgst, igst }
  gstInr          Int
  totalInr        Int
  status          InvoiceStatus @default(DRAFT)
  lineItems       Json          // [{description, qty, unitInr, amountInr}]
  notes           String?       @db.Text
  terms           String?       @db.Text
  createdAt       DateTime      @default(now())
  issuedAt        DateTime?
  paidAt          DateTime?
  cancelledAt     DateTime?
  updatedAt       DateTime      @updatedAt

  hospital Hospital @relation(fields: [hospitalId], references: [id])
  payments Payment[]

  @@index([hospitalId, status])
  @@index([dueDate, status])
}

model InvoiceSequence {
  fyCode     String @id   // "FY2526"
  lastSerial Int    @default(0)
  updatedAt  DateTime @updatedAt
}

model Payment {
  id          String        @id @default(cuid())
  invoiceId   String
  hospitalId  String
  amountInr   Int           // can be negative (refund)
  receivedOn  DateTime
  method      PaymentMethod
  reference   String?
  recordedById String
  notes       String?       @db.Text
  createdAt   DateTime      @default(now())

  invoice    Invoice  @relation(fields: [invoiceId], references: [id])
  hospital   Hospital @relation(fields: [hospitalId], references: [id])
  recordedBy DevUser  @relation(fields: [recordedById], references: [id])

  @@index([hospitalId])
  @@index([invoiceId])
}

model DevUser {
  id           String      @id @default(cuid())
  email        String      @unique
  name         String
  passwordHash String
  role         DevUserRole @default(VIEWER)
  totpSecret   String?     // null until enrolled
  isActive     Boolean     @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  apiKeysCreated   ApiKey[]
  paymentsRecorded Payment[]
  auditEntries     AuditLog[]
}

model ApiKey {
  id          String    @id @default(cuid())
  hospitalId  String
  keyPrefix   String    // first 16 chars; shown in UI
  keyHash     String    // bcrypt of full key
  label       String?
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?
  expiresAt   DateTime?
  createdById String

  hospital  Hospital @relation(fields: [hospitalId], references: [id])
  createdBy DevUser  @relation(fields: [createdById], references: [id])

  @@index([hospitalId, revokedAt])
  @@index([keyPrefix])
}

model AuditLog {
  id          String   @id @default(cuid())
  devUserId   String?
  action      String   // "HOSPITAL_CREATE", "SECRET_REVEAL", etc.
  entityType  String
  entityId    String?
  changes     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  devUser DevUser? @relation(fields: [devUserId], references: [id])

  @@index([entityType, entityId])
  @@index([devUserId, createdAt])
  @@index([action, createdAt])
}
```

- [ ] **Step 3: Create the Prisma client singleton**

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Run the initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: migration created in `prisma/migrations/`, applied to your Supabase admin DB. Prisma client regenerated.

- [ ] **Step 5: Verify tables exist**

```bash
npx prisma studio
```

Browser opens; confirm 9 tables present (Hospital, Plan, Subscription, Invoice, InvoiceSequence, Payment, DevUser, ApiKey, AuditLog). Close.

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: prisma schema with all 9 admin tables"
```

---

### Task 4: AES-GCM encryption library (TDD)

Encrypts hospital secrets (DB URL, service key, JWT secret) at the application layer so a DB dump leak doesn't immediately expose them.

**Files:**
- Test: `src/lib/encryption.test.ts`
- Create: `src/lib/encryption.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/encryption.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "./encryption";

beforeAll(() => {
  // 32-byte key in hex = 64 chars
  process.env.SECRETS_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("encryption", () => {
  it("encrypts and decrypts to the same plaintext", () => {
    const plain = "postgresql://user:pw@host:5432/db";
    const cipher = encrypt(plain);
    expect(cipher).not.toBe(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("produces different ciphertexts for the same plaintext (nonce is random)", () => {
    const a = encrypt("hello");
    const b = encrypt("hello");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", () => {
    const cipher = encrypt("secret");
    const tampered = cipher.slice(0, -2) + "XX";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws if SECRETS_ENCRYPTION_KEY is missing", () => {
    const saved = process.env.SECRETS_ENCRYPTION_KEY;
    delete process.env.SECRETS_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/SECRETS_ENCRYPTION_KEY/);
    process.env.SECRETS_ENCRYPTION_KEY = saved;
  });

  it("throws if key is not 32 bytes", () => {
    const saved = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = "deadbeef";
    expect(() => encrypt("x")).toThrow(/32 bytes/);
    process.env.SECRETS_ENCRYPTION_KEY = saved;
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- src/lib/encryption.test.ts
```

Expected: 5 failures, all "Cannot find module './encryption'" or similar.

- [ ] **Step 3: Implement `encryption.ts`**

```ts
// src/lib/encryption.ts
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32; // bytes

function getKey(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!hex) throw new Error("SECRETS_ENCRYPTION_KEY is not set");
  if (hex.length !== KEY_LEN * 2) {
    throw new Error(`SECRETS_ENCRYPTION_KEY must be 32 bytes (64 hex chars)`);
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a UTF-8 string. Output format: base64(iv | tag | ciphertext).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(packed: string): string {
  const key = getKey();
  const buf = Buffer.from(packed, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- src/lib/encryption.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/encryption.test.ts
git commit -m "feat: AES-GCM encryption lib for hospital secrets"
```

---

### Task 5: JWT signing/verifying library (TDD)

Sessions for dev users. Same `jose` HS256 pattern as the HMS so the codebase feels familiar.

**Files:**
- Test: `src/lib/jwt.test.ts`
- Create: `src/lib/jwt.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/jwt.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession, type SessionPayload } from "./jwt";

beforeAll(() => {
  process.env.SESSION_JWT_SECRET =
    "test-secret-for-jwt-32-bytes-min-length-required-here-padding-padding";
});

describe("session jwt", () => {
  const payload: SessionPayload = {
    sub: "dev_abc",
    email: "a@b.com",
    role: "SUPER_ADMIN",
    name: "Alice",
  };

  it("round-trips a payload", async () => {
    const token = await signSession(payload);
    const decoded = await verifySession(token);
    expect(decoded.sub).toBe("dev_abc");
    expect(decoded.email).toBe("a@b.com");
    expect(decoded.role).toBe("SUPER_ADMIN");
    expect(decoded.name).toBe("Alice");
  });

  it("rejects a token signed with a different secret", async () => {
    process.env.SESSION_JWT_SECRET = "secret-one-padding-padding-padding-padding-padding";
    const token = await signSession(payload);
    process.env.SESSION_JWT_SECRET = "secret-two-padding-padding-padding-padding-padding";
    await expect(verifySession(token)).rejects.toThrow();
  });

  it("rejects a malformed token", async () => {
    await expect(verifySession("not-a-jwt")).rejects.toThrow();
  });

  it("respects expiry", async () => {
    const token = await signSession(payload, { expiresInSec: 1 });
    await new Promise((r) => setTimeout(r, 1500));
    await expect(verifySession(token)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- src/lib/jwt.test.ts
```

Expected: failures (module not found).

- [ ] **Step 3: Implement `jwt.ts`**

```ts
// src/lib/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type SessionPayload = {
  sub: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "VIEWER";
  name: string;
};

const DEFAULT_EXPIRY_SEC = 12 * 60 * 60; // 12 hours

function getSecret(): Uint8Array {
  const s = process.env.SESSION_JWT_SECRET;
  if (!s) throw new Error("SESSION_JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(
  payload: SessionPayload,
  opts: { expiresInSec?: number } = {},
): Promise<string> {
  const exp = opts.expiresInSec ?? DEFAULT_EXPIRY_SEC;
  return await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${exp}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as SessionPayload;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- src/lib/jwt.test.ts
```

Expected: 4 passing. The "respects expiry" test takes ~1.5 s — that's fine.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jwt.ts src/lib/jwt.test.ts
git commit -m "feat: session JWT sign/verify"
```

---

### Task 6: Password hashing library (TDD)

Bcrypt wrapper. Same library as HMS. Cost 12.

**Files:**
- Test: `src/lib/password.test.ts`
- Create: `src/lib/password.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).not.toBe("hunter2");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("right");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces different hashes for same input (salted)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("rejects empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- src/lib/password.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/password.ts
import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error("password must not be empty");
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- src/lib/password.test.ts
```

Expected: 4 passing. Bcrypt is slow — takes a few seconds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts src/lib/password.test.ts
git commit -m "feat: password hashing wrapper"
```

---

### Task 7: API key generation/hashing library (TDD)

Each hospital has one or more API keys for the public `/api/v1` endpoints. Full key shown once at creation; only the bcrypt-hash is stored.

**Files:**
- Test: `src/lib/api-keys.test.ts`
- Create: `src/lib/api-keys.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/api-keys.test.ts
import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey, extractPrefix } from "./api-keys";

describe("api keys", () => {
  it("generates a key with the dsk_live_ prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("dsk_live_")).toBe(true);
    expect(key.length).toBeGreaterThanOrEqual(40);
  });

  it("each generated key is unique", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
  });

  it("extracts a 16-char prefix", () => {
    const key = "dsk_live_abcdefghijklmnopqrstuv";
    expect(extractPrefix(key)).toBe("dsk_live_abcdefg"); // 16 chars
  });

  it("hashes and verifies", async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    expect(hash).not.toBe(key);
    expect(await verifyApiKey(key, hash)).toBe(true);
    expect(await verifyApiKey("dsk_live_wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- src/lib/api-keys.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/api-keys.ts
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const PREFIX = "dsk_live_";
const KEY_BYTES = 24; // 24 random bytes -> 32 chars base64url
const COST = 12;
const PREFIX_LEN = 16; // first 16 chars stored unencrypted for display

export function generateApiKey(): string {
  const body = randomBytes(KEY_BYTES).toString("base64url");
  return `${PREFIX}${body}`;
}

export function extractPrefix(key: string): string {
  return key.slice(0, PREFIX_LEN);
}

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, COST);
}

export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  if (!key || !hash) return false;
  return bcrypt.compare(key, hash);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- src/lib/api-keys.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-keys.ts src/lib/api-keys.test.ts
git commit -m "feat: api-key generate/hash/verify"
```

---

### Task 8: Canonical module list

The HMS modules a plan can include. Plain TS constant — not in DB.

**Files:**
- Create: `src/lib/modules.ts`

- [ ] **Step 1: Create the module list**

```ts
// src/lib/modules.ts
export const HMS_MODULES = [
  { code: "patients",        name: "Patients (OPD)" },
  { code: "doctor",          name: "Doctor Consultation" },
  { code: "workup",          name: "Workup / Eye Readings" },
  { code: "pharmacy",        name: "Pharmacy" },
  { code: "optical",         name: "Optical" },
  { code: "labs",            name: "Labs" },
  { code: "inpatients",      name: "In-Patients (IPD)" },
  { code: "insurance",       name: "Insurance" },
  { code: "expenses",        name: "Expenses" },
  { code: "license-tracker", name: "License Tracker" },
  { code: "call-logs",       name: "Call Logs" },
  { code: "analytics",       name: "Analytics" },
  { code: "reports",         name: "Reports" },
] as const;

export type HmsModuleCode = typeof HMS_MODULES[number]["code"];

export const MODULE_CODES = HMS_MODULES.map((m) => m.code) as readonly HmsModuleCode[];

export function isValidModuleCode(code: string): code is HmsModuleCode {
  return (MODULE_CODES as readonly string[]).includes(code);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/modules.ts
git commit -m "feat: canonical HMS module list"
```

---

### Task 9: `computeEnabledModules` library (TDD)

Pure function: takes a plan's modules + subscription's extras/excludes, returns the final enabled list. Same function used by the public `/api/v1/config` endpoint and the admin UI's "computed modules" preview.

**Files:**
- Test: `src/lib/compute-modules.test.ts`
- Create: `src/lib/compute-modules.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/compute-modules.test.ts
import { describe, it, expect } from "vitest";
import { computeEnabledModules } from "./compute-modules";

describe("computeEnabledModules", () => {
  it("returns the plan's modules with no overrides", () => {
    const result = computeEnabledModules({
      planModules: ["patients", "doctor"],
      extraModules: [],
      excludedModules: [],
    });
    expect(result.sort()).toEqual(["doctor", "patients"]);
  });

  it("adds extra modules", () => {
    const result = computeEnabledModules({
      planModules: ["patients"],
      extraModules: ["insurance"],
      excludedModules: [],
    });
    expect(result.sort()).toEqual(["insurance", "patients"]);
  });

  it("removes excluded modules", () => {
    const result = computeEnabledModules({
      planModules: ["patients", "doctor", "pharmacy"],
      extraModules: [],
      excludedModules: ["pharmacy"],
    });
    expect(result.sort()).toEqual(["doctor", "patients"]);
  });

  it("exclusion wins over inclusion if a module is in both", () => {
    const result = computeEnabledModules({
      planModules: ["patients"],
      extraModules: ["pharmacy"],
      excludedModules: ["pharmacy"],
    });
    expect(result.sort()).toEqual(["patients"]);
  });

  it("deduplicates", () => {
    const result = computeEnabledModules({
      planModules: ["patients", "patients"],
      extraModules: ["patients"],
      excludedModules: [],
    });
    expect(result).toEqual(["patients"]);
  });

  it("returns empty array for empty plan", () => {
    expect(
      computeEnabledModules({ planModules: [], extraModules: [], excludedModules: [] }),
    ).toEqual([]);
  });

  it("ignores unknown module codes", () => {
    const result = computeEnabledModules({
      planModules: ["patients", "not-a-real-module"],
      extraModules: ["also-fake"],
      excludedModules: [],
    });
    expect(result).toEqual(["patients"]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- src/lib/compute-modules.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/compute-modules.ts
import { isValidModuleCode } from "./modules";

export type ComputeInput = {
  planModules: string[];
  extraModules: string[];
  excludedModules: string[];
};

/**
 * Final enabled modules for a hospital:
 *   (planModules ∪ extraModules) − excludedModules
 * Unknown module codes are dropped (defensive against schema drift).
 */
export function computeEnabledModules(input: ComputeInput): string[] {
  const union = new Set<string>();
  for (const m of input.planModules) if (isValidModuleCode(m)) union.add(m);
  for (const m of input.extraModules) if (isValidModuleCode(m)) union.add(m);
  for (const m of input.excludedModules) union.delete(m);
  return Array.from(union).sort();
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- src/lib/compute-modules.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compute-modules.ts src/lib/compute-modules.test.ts
git commit -m "feat: computeEnabledModules helper"
```

---

### Task 10: Rate limiter (TDD)

Simple in-memory token bucket per API key. 60 requests/minute. Resets on process restart — that's fine for MVP.

**Files:**
- Test: `src/lib/rate-limit.test.ts`
- Create: `src/lib/rate-limit.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/rate-limit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate-limit", () => {
  it("allows up to the limit within a window", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(rl.check("k1")).toBe(true);
    expect(rl.check("k1")).toBe(true);
    expect(rl.check("k1")).toBe(true);
    expect(rl.check("k1")).toBe(false);
  });

  it("buckets are keyed independently", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(rl.check("k1")).toBe(true);
    expect(rl.check("k2")).toBe(true);
    expect(rl.check("k1")).toBe(false);
    expect(rl.check("k2")).toBe(false);
  });

  it("refills after the window passes", async () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 100 });
    expect(rl.check("k1")).toBe(true);
    expect(rl.check("k1")).toBe(false);
    await new Promise((r) => setTimeout(r, 150));
    expect(rl.check("k1")).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- src/lib/rate-limit.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/rate-limit.ts
type Bucket = { count: number; windowStart: number };

export type RateLimiter = {
  check: (key: string) => boolean;
};

export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    check(key: string): boolean {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || now - b.windowStart >= opts.windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return true;
      }
      if (b.count >= opts.limit) return false;
      b.count += 1;
      return true;
    },
  };
}

// Public-API default limiter: 60 req/min per API key.
export const publicApiLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- src/lib/rate-limit.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat: in-memory rate limiter"
```

---

### Task 11: Audit log helper

Centralized writer for the `audit_log` table. Always called from server actions / API handlers, never directly from UI.

**Files:**
- Create: `src/lib/audit.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/audit.ts
import { prisma } from "./prisma";

export type AuditAction =
  | "HOSPITAL_CREATE"
  | "HOSPITAL_EDIT"
  | "HOSPITAL_STATUS_CHANGE"
  | "HOSPITAL_CANCEL"
  | "PLAN_CREATE"
  | "PLAN_EDIT"
  | "SUBSCRIPTION_CHANGE"
  | "API_KEY_GENERATE"
  | "API_KEY_REVOKE"
  | "SECRET_REVEAL"
  | "SECRET_EDIT"
  | "INVOICE_ISSUE"
  | "INVOICE_CANCEL"
  | "PAYMENT_RECORD"
  | "PAYMENT_MOVE"
  | "DEV_USER_INVITE"
  | "DEV_USER_ROLE_CHANGE"
  | "DEV_USER_DISABLE"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE";

export type AuditInput = {
  devUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAuditEvent(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      devUserId: input.devUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      changes: (input.changes ?? null) as never,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
```

- [ ] **Step 2: Smoke verify with a script (no test runner needed)**

```bash
npx tsx -e "import('./src/lib/audit.js').then(m => m.logAuditEvent({devUserId: null, action: 'LOGIN_FAILURE', entityType: 'auth'})).then(() => console.log('ok'))"
```

Expected: prints `ok`. Verify a row appeared in `prisma studio` → AuditLog.

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat: audit log helper"
```

---

### Task 12: Auth — session cookie + `requireRole` + login server action

Wires the libs from tasks 5, 6, 11 into a real login flow. JWT in cookie, server actions read it.

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```ts
// src/lib/auth.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { signSession, verifySession, type SessionPayload } from "./jwt";
import { verifyPassword } from "./password";
import { logAuditEvent } from "./audit";

const SESSION_COOKIE = "docsile-admin-session";
const SESSION_MAX_AGE_SEC = 12 * 60 * 60;

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(
  ...allowed: Array<"SUPER_ADMIN" | "ADMIN" | "VIEWER">
): Promise<SessionPayload> {
  const s = await requireSession();
  if (!allowed.includes(s.role)) redirect("/");
  return s;
}

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.devUser.findUnique({ where: { email: email.toLowerCase() } });
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? null;
  const ua = h.get("user-agent") ?? null;

  if (!user || !user.isActive) {
    await logAuditEvent({
      devUserId: null,
      action: "LOGIN_FAILURE",
      entityType: "auth",
      changes: { email },
      ipAddress: ip,
      userAgent: ua,
    });
    return { ok: false, error: "Invalid credentials" };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await logAuditEvent({
      devUserId: user.id,
      action: "LOGIN_FAILURE",
      entityType: "auth",
      changes: { email },
      ipAddress: ip,
      userAgent: ua,
    });
    return { ok: false, error: "Invalid credentials" };
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });

  await prisma.devUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await logAuditEvent({
    devUserId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "auth",
    ipAddress: ip,
    userAgent: ua,
  });

  return { ok: true };
}

export async function logout(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}
```

- [ ] **Step 2: Create the login server action**

```ts
// src/app/(auth)/login/actions.ts
"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password" };

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  redirect("/hospitals");
}
```

- [ ] **Step 3: Create the login page**

```tsx
// src/app/(auth)/login/page.tsx
"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">docsile-admin</h1>
        <p className="text-sm text-slate-500">Internal sign-in.</p>
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify manually (after Task 13 seeds a user, come back and verify)**

Skip for now — verify after Task 13.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts "src/app/(auth)/login/"
git commit -m "feat: dev-user login + session cookie"
```

---

### Task 13: Seed the first SUPER_ADMIN dev user

You'll use this account to log into the admin panel.

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed`)

- [ ] **Step 1: Write the seed script**

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@docsile.in";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Set SEED_ADMIN_PASSWORD env var before seeding");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.devUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Initial Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
  console.log(`Seeded SUPER_ADMIN: ${user.email}`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add `prisma.seed` config to `package.json`**

Add this at the top level (sibling of `"scripts"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Run the seed**

```bash
SEED_ADMIN_EMAIL=you@docsile.in SEED_ADMIN_PASSWORD='ChangeMe!2026' npx prisma db seed
```

Expected: prints `Seeded SUPER_ADMIN: you@docsile.in`. Confirm row in `prisma studio`.

- [ ] **Step 4: Verify login end-to-end**

```bash
npm run dev
```

Visit `http://localhost:3000/login`, sign in with seeded credentials. After submit you'll be redirected to `/hospitals` — that route doesn't exist yet, so you'll see a 404. **That's fine** — it confirms login worked and the cookie is set. Inspect cookies: `docsile-admin-session` should be present.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: seed initial SUPER_ADMIN"
```

---

### Task 14: Middleware — route gating

Anything under `/hospitals`, `/plans`, etc. requires a session. `/login` is public.

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the middleware**

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "docsile-admin-session";

const PUBLIC_PATHS = ["/login", "/api/v1"]; // /api/v1/* uses its own auth (Task 30+)

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET!);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Verify manually**

```bash
npm run dev
```

- Visit `http://localhost:3000/` (logged out): redirects to `/login`. ✓
- Sign in: redirects to `/hospitals` (404 again — that's fine).
- Visit `/foo` (logged in): 404 (passes middleware, no route).
- Delete the `docsile-admin-session` cookie, refresh `/foo`: redirects to `/login`. ✓

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware route gating for admin pages"
```

---

### Task 15: Admin shell — sidebar layout + landing page

The `(admin)` layout, sidebar nav, header with the logged-in user. A landing page that lists "Hospitals" (placeholder until Task 17).

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/app/(admin)/page.tsx` (redirects to /hospitals)
- Create: `src/app/(admin)/hospitals/page.tsx` (placeholder)

- [ ] **Step 1: Sidebar**

```tsx
// src/components/layout/Sidebar.tsx
import Link from "next/link";

const NAV = [
  { href: "/hospitals", label: "Hospitals", icon: "🏥" },
  { href: "/plans", label: "Plans", icon: "📋" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/payments", label: "Payments", icon: "💰" },
  { href: "/dev-users", label: "Dev Users", icon: "👤", role: "SUPER_ADMIN" as const },
  { href: "/audit-log", label: "Audit Log", icon: "📜", role: "SUPER_ADMIN" as const },
  { href: "/settings", label: "Settings", icon: "⚙️", role: "SUPER_ADMIN" as const },
];

export function Sidebar({ role }: { role: "SUPER_ADMIN" | "ADMIN" | "VIEWER" }) {
  return (
    <aside className="w-56 border-r bg-slate-50 p-4">
      <div className="mb-6 text-lg font-semibold">docsile-admin</div>
      <nav className="space-y-1 text-sm">
        {NAV.filter((n) => !n.role || n.role === role).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-2 rounded px-3 py-2 hover:bg-slate-200"
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Header**

```tsx
// src/components/layout/Header.tsx
import { logoutAction } from "@/app/(admin)/logout-action";

export function Header({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <div className="text-sm text-slate-500">Signed in as</div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <div className="font-medium">{name}</div>
          <div className="text-slate-500">{email} · {role}</div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-slate-50">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Logout action**

```ts
// src/app/(admin)/logout-action.ts
"use server";
import { redirect } from "next/navigation";
import { logout } from "@/lib/auth";

export async function logoutAction() {
  await logout();
  redirect("/login");
}
```

- [ ] **Step 4: `(admin)/layout.tsx`**

```tsx
// src/app/(admin)/layout.tsx
import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={session.role} />
      <div className="flex flex-1 flex-col">
        <Header name={session.name} email={session.email} role={session.role} />
        <main className="flex-1 overflow-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Root + placeholder hospitals page**

```tsx
// src/app/(admin)/page.tsx
import { redirect } from "next/navigation";
export default function Index() {
  redirect("/hospitals");
}
```

```tsx
// src/app/(admin)/hospitals/page.tsx
export default function HospitalsPage() {
  return <h1 className="text-xl font-semibold">Hospitals</h1>;
}
```

- [ ] **Step 6: Verify**

```bash
npm run dev
```

Sign in → land on `/hospitals` → see sidebar, header with your name, "Hospitals" heading. Sign-out button works.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components
git commit -m "feat: admin shell with sidebar, header, logout"
```

---

### Task 16: Plans CRUD

List, create, edit, deactivate plans. Plans are flat-priced bundles of modules.

**Files:**
- Create: `src/app/(admin)/plans/page.tsx`
- Create: `src/app/(admin)/plans/actions.ts`
- Create: `src/app/(admin)/plans/components/PlanForm.tsx`
- Create: `src/app/(admin)/plans/new/page.tsx`
- Create: `src/app/(admin)/plans/[id]/page.tsx`

- [ ] **Step 1: Server actions**

```ts
// src/app/(admin)/plans/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isValidModuleCode } from "@/lib/modules";
import { logAuditEvent } from "@/lib/audit";

const PlanSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  priceInr: z.coerce.number().int().nonnegative(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  moduleCodes: z.array(z.string()).refine((arr) => arr.every(isValidModuleCode), {
    message: "unknown module code",
  }),
  isActive: z.boolean(),
});

export async function createPlan(_prev: unknown, formData: FormData) {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const raw = {
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    priceInr: formData.get("priceInr"),
    billingCycle: formData.get("billingCycle"),
    moduleCodes: formData.getAll("moduleCodes"),
    isActive: formData.get("isActive") === "on",
  };
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const plan = await prisma.plan.create({ data: parsed.data });
  await logAuditEvent({
    devUserId: session.sub,
    action: "PLAN_CREATE",
    entityType: "plan",
    entityId: plan.id,
    changes: parsed.data,
  });
  revalidatePath("/plans");
  redirect("/plans");
}

export async function updatePlan(id: string, _prev: unknown, formData: FormData) {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const raw = {
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    priceInr: formData.get("priceInr"),
    billingCycle: formData.get("billingCycle"),
    moduleCodes: formData.getAll("moduleCodes"),
    isActive: formData.get("isActive") === "on",
  };
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const before = await prisma.plan.findUnique({ where: { id } });
  const plan = await prisma.plan.update({ where: { id }, data: parsed.data });
  await logAuditEvent({
    devUserId: session.sub,
    action: "PLAN_EDIT",
    entityType: "plan",
    entityId: plan.id,
    changes: { before, after: parsed.data },
  });
  revalidatePath("/plans");
  redirect("/plans");
}
```

- [ ] **Step 2: List page**

```tsx
// src/app/(admin)/plans/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } } },
  });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plans</h1>
        <Link href="/plans/new" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          New Plan
        </Link>
      </div>
      <table className="w-full border bg-white text-sm">
        <thead className="border-b bg-slate-100 text-left">
          <tr>
            <th className="p-3">Code</th>
            <th className="p-3">Name</th>
            <th className="p-3">Price (₹)</th>
            <th className="p-3">Cycle</th>
            <th className="p-3">Modules</th>
            <th className="p-3">Active Subs</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="p-3 font-mono">{p.code}</td>
              <td className="p-3">
                <Link href={`/plans/${p.id}`} className="text-blue-700 underline">
                  {p.name}
                </Link>
              </td>
              <td className="p-3">{p.priceInr.toLocaleString("en-IN")}</td>
              <td className="p-3">{p.billingCycle}</td>
              <td className="p-3">{p.moduleCodes.length}</td>
              <td className="p-3">{p._count.subscriptions}</td>
              <td className="p-3">
                {p.isActive ? <span className="text-green-700">Active</span> : <span className="text-slate-500">Retired</span>}
              </td>
            </tr>
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={7} className="p-6 text-center text-slate-500">
                No plans yet. Create one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Plan form component**

```tsx
// src/app/(admin)/plans/components/PlanForm.tsx
"use client";
import { useActionState } from "react";
import { HMS_MODULES } from "@/lib/modules";
import type { Plan } from "@prisma/client";

type Action = (prev: unknown, fd: FormData) => Promise<{ error?: string } | void>;

export function PlanForm({ action, plan }: { action: Action; plan?: Plan }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div>
        <label className="text-sm font-medium">Code</label>
        <input
          name="code"
          defaultValue={plan?.code}
          required
          pattern="[a-z0-9_-]+"
          className="mt-1 w-full rounded border px-3 py-2 font-mono"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Name</label>
        <input
          name="name"
          defaultValue={plan?.name}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          name="description"
          defaultValue={plan?.description ?? ""}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Price (₹)</label>
          <input
            name="priceInr"
            type="number"
            min="0"
            step="1"
            defaultValue={plan?.priceInr ?? 0}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Billing Cycle</label>
          <select
            name="billingCycle"
            defaultValue={plan?.billingCycle ?? "MONTHLY"}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Included Modules</legend>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {HMS_MODULES.map((m) => (
            <label key={m.code} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="moduleCodes"
                value={m.code}
                defaultChecked={plan?.moduleCodes.includes(m.code)}
              />
              <span className="font-mono text-xs">{m.code}</span>
              <span className="text-slate-500">— {m.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} />
        Active (selectable for new subscriptions)
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: New / edit pages**

```tsx
// src/app/(admin)/plans/new/page.tsx
import { PlanForm } from "../components/PlanForm";
import { createPlan } from "../actions";

export default function NewPlan() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New Plan</h1>
      <PlanForm action={createPlan} />
    </div>
  );
}
```

```tsx
// src/app/(admin)/plans/[id]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlanForm } from "../components/PlanForm";
import { updatePlan } from "../actions";

export default async function EditPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) notFound();
  const action = updatePlan.bind(null, id);
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Edit Plan — {plan.name}</h1>
      <PlanForm action={action} plan={plan} />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run dev
```

Sign in → /plans → "New Plan" → submit a Basic plan (code `basic`, name `Basic`, price 5000, modules: patients, doctor) → see it in list. Click it → edit name → save → confirms changes.

Inspect `prisma studio` → `AuditLog` table: two new rows (PLAN_CREATE + PLAN_EDIT).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/plans/"
git commit -m "feat: plans CRUD"
```

---

### Task 17: Hospitals list page

Read-only list. Real data comes once we have create flow (Task 18).

**Files:**
- Modify: `src/app/(admin)/hospitals/page.tsx`

- [ ] **Step 1: Rewrite the placeholder**

```tsx
// src/app/(admin)/hospitals/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  PROVISIONING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-slate-100 text-slate-700",
  SUSPENDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export default async function HospitalsPage() {
  const hospitals = await prisma.hospital.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        include: { plan: true },
        take: 1,
      },
    },
  });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hospitals</h1>
        <Link href="/hospitals/new" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          New Hospital
        </Link>
      </div>
      <table className="w-full border bg-white text-sm">
        <thead className="border-b bg-slate-100 text-left">
          <tr>
            <th className="p-3">Code</th>
            <th className="p-3">Name</th>
            <th className="p-3">Plan</th>
            <th className="p-3">Status</th>
            <th className="p-3">Last Heartbeat</th>
          </tr>
        </thead>
        <tbody>
          {hospitals.map((h) => {
            const sub = h.subscriptions[0];
            return (
              <tr key={h.id} className="border-b last:border-0">
                <td className="p-3 font-mono">{h.code}</td>
                <td className="p-3">
                  <Link href={`/hospitals/${h.id}`} className="text-blue-700 underline">
                    {h.name}
                  </Link>
                </td>
                <td className="p-3">{sub?.plan.name ?? <span className="text-slate-400">—</span>}</td>
                <td className="p-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[h.status]}`}>
                    {h.status}
                  </span>
                </td>
                <td className="p-3 text-slate-600">
                  {h.lastHeartbeatAt
                    ? formatDistanceToNow(h.lastHeartbeatAt, { addSuffix: true })
                    : <span className="text-slate-400">never</span>}
                </td>
              </tr>
            );
          })}
          {hospitals.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-500">
                No hospitals yet. Provision your first one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

`/hospitals` shows empty state with "New Hospital" button (404 on click for now).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/hospitals/page.tsx"
git commit -m "feat: hospitals list page"
```

---

### Task 18: Hospital new wizard (create + first API key + env bundle)

3-step form. On submit: creates the Hospital row, creates an active Subscription, generates first API key + JWT_SECRET, returns them once for display.

**Files:**
- Create: `src/app/(admin)/hospitals/new/page.tsx`
- Create: `src/app/(admin)/hospitals/new/actions.ts`
- Create: `src/app/(admin)/hospitals/new/components/HospitalWizard.tsx`
- Create: `src/app/(admin)/hospitals/new/components/EnvBundleReveal.tsx`

- [ ] **Step 1: Server action**

```ts
// src/app/(admin)/hospitals/new/actions.ts
"use server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generateApiKey, hashApiKey, extractPrefix } from "@/lib/api-keys";
import { logAuditEvent } from "@/lib/audit";

const Schema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().optional(),
  billingAddress: z.string().min(5),
  gstin: z.string().optional(),
  deploymentUrl: z.string().url().optional(),
  timezone: z.string().default("Asia/Kolkata"),
  planId: z.string(),
  customPriceInr: z.coerce.number().int().nonnegative().optional(),
  extraModules: z.array(z.string()).default([]),
  excludedModules: z.array(z.string()).default([]),
});

export type WizardResult =
  | { ok: true; hospitalId: string; bundle: EnvBundle }
  | { ok: false; error: string };

export type EnvBundle = {
  adminApiUrl: string;
  adminApiKey: string;        // full key — shown once
  jwtSecret: string;          // 64-char random
  // The HMS Supabase creds are filled in *after* you create the Supabase project.
};

export async function createHospitalAction(formData: FormData): Promise<WizardResult> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPhone: formData.get("ownerPhone") || undefined,
    billingAddress: formData.get("billingAddress"),
    gstin: formData.get("gstin") || undefined,
    deploymentUrl: formData.get("deploymentUrl") || undefined,
    timezone: formData.get("timezone") || "Asia/Kolkata",
    planId: formData.get("planId"),
    customPriceInr: formData.get("customPriceInr") || undefined,
    extraModules: formData.getAll("extraModules"),
    excludedModules: formData.getAll("excludedModules"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan) return { ok: false, error: "Plan not found" };

  const fullKey = generateApiKey();
  const keyHash = await hashApiKey(fullKey);
  const keyPrefix = extractPrefix(fullKey);
  const jwtSecret = randomBytes(64).toString("hex").slice(0, 64);

  const now = new Date();
  const cycleEnd = (() => {
    const d = new Date(now);
    if (plan.billingCycle === "MONTHLY") d.setMonth(d.getMonth() + 1);
    if (plan.billingCycle === "QUARTERLY") d.setMonth(d.getMonth() + 3);
    if (plan.billingCycle === "YEARLY") d.setFullYear(d.getFullYear() + 1);
    return d;
  })();

  const hospital = await prisma.$transaction(async (tx) => {
    const h = await tx.hospital.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        ownerName: parsed.data.ownerName,
        ownerEmail: parsed.data.ownerEmail,
        ownerPhone: parsed.data.ownerPhone,
        billingAddress: parsed.data.billingAddress,
        gstin: parsed.data.gstin,
        deploymentUrl: parsed.data.deploymentUrl,
        timezone: parsed.data.timezone,
        status: "PROVISIONING",
        // Supabase creds + hmsJwtSecret will be filled in via Secrets tab later;
        // but we *do* generate jwtSecret here and surface it for the env bundle.
      },
    });
    await tx.subscription.create({
      data: {
        hospitalId: h.id,
        planId: plan.id,
        currentPeriodStart: now,
        currentPeriodEnd: cycleEnd,
        nextBillingDate: cycleEnd,
        customPriceInr: parsed.data.customPriceInr,
        extraModules: parsed.data.extraModules,
        excludedModules: parsed.data.excludedModules,
        status: "ACTIVE",
      },
    });
    await tx.apiKey.create({
      data: {
        hospitalId: h.id,
        keyPrefix,
        keyHash,
        label: "initial",
        createdById: session.sub,
      },
    });
    return h;
  });

  await logAuditEvent({
    devUserId: session.sub,
    action: "HOSPITAL_CREATE",
    entityType: "hospital",
    entityId: hospital.id,
    changes: { code: hospital.code, planId: plan.id },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "API_KEY_GENERATE",
    entityType: "hospital",
    entityId: hospital.id,
    changes: { label: "initial", prefix: keyPrefix },
  });

  return {
    ok: true,
    hospitalId: hospital.id,
    bundle: {
      adminApiUrl: process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3000",
      adminApiKey: fullKey,
      jwtSecret,
    },
  };
}
```

Note: `jwtSecret` is *generated* here for inclusion in the env bundle, but **also** needs to be stored encrypted on the hospital row. Update the create call inside the transaction to include it. **Required correction** — add this to the `tx.hospital.create` data block:

```ts
hmsJwtSecret: encrypt(jwtSecret),
```

And import `encrypt` from `@/lib/encryption` at the top. Update step now:

- [ ] **Step 2: Fix action to encrypt and store JWT secret**

Add to top of file:
```ts
import { encrypt } from "@/lib/encryption";
```

Inside the `tx.hospital.create({ data: { ... } })` block, add:
```ts
hmsJwtSecret: encrypt(jwtSecret),
```

- [ ] **Step 3: Env bundle reveal component**

```tsx
// src/app/(admin)/hospitals/new/components/EnvBundleReveal.tsx
"use client";
import { useState } from "react";
import type { EnvBundle } from "../actions";

export function EnvBundleReveal({ bundle, onAcknowledge }: {
  bundle: EnvBundle;
  onAcknowledge: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = [
    `ADMIN_API_URL=${bundle.adminApiUrl}`,
    `ADMIN_API_KEY=${bundle.adminApiKey}`,
    `JWT_SECRET=${bundle.jwtSecret}`,
    `# Next: create the Supabase project, then paste DATABASE_URL,`,
    `# NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY here.`,
  ].join("\n");

  return (
    <div className="space-y-4">
      <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
        <strong>Save this now.</strong> The API key cannot be retrieved later — only rotated.
      </div>
      <pre className="overflow-auto rounded bg-slate-900 p-4 font-mono text-xs text-slate-100">
        {text}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded border px-3 py-2 text-sm"
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          onClick={onAcknowledge}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          I've saved it — continue
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wizard component**

```tsx
// src/app/(admin)/hospitals/new/components/HospitalWizard.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HMS_MODULES } from "@/lib/modules";
import { createHospitalAction, type EnvBundle } from "../actions";

type Plan = {
  id: string;
  code: string;
  name: string;
  priceInr: number;
  moduleCodes: string[];
  billingCycle: string;
};

export function HospitalWizard({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<EnvBundle | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Step 1 fields:
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");

  // Step 2 fields:
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [customPrice, setCustomPrice] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [excludes, setExcludes] = useState<string[]>([]);

  const onSubmit = () => {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("code", code);
    fd.set("ownerName", ownerName);
    fd.set("ownerEmail", ownerEmail);
    fd.set("ownerPhone", ownerPhone);
    fd.set("billingAddress", billingAddress);
    fd.set("gstin", gstin);
    fd.set("deploymentUrl", deploymentUrl);
    fd.set("planId", planId);
    if (customPrice) fd.set("customPriceInr", customPrice);
    extras.forEach((m) => fd.append("extraModules", m));
    excludes.forEach((m) => fd.append("excludedModules", m));
    startTransition(async () => {
      const result = await createHospitalAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBundle(result.bundle);
      setHospitalId(result.hospitalId);
      setStep(3);
    });
  };

  if (step === 3 && bundle && hospitalId) {
    // Inline reveal — defer to subcomponent
    const Reveal = require("./EnvBundleReveal").EnvBundleReveal;
    return (
      <Reveal
        bundle={bundle}
        onAcknowledge={() => router.push(`/hospitals/${hospitalId}`)}
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex gap-2 text-sm">
        <span className={step === 1 ? "font-semibold" : "text-slate-400"}>1. Details</span>
        <span>›</span>
        <span className={step === 2 ? "font-semibold" : "text-slate-400"}>2. Plan</span>
        <span>›</span>
        <span className="text-slate-400">3. Env bundle</span>
      </div>
      {step === 1 && (
        <div className="space-y-3">
          <Field label="Hospital name" value={name} onChange={setName} required />
          <Field label="Code (slug)" value={code} onChange={setCode} required mono />
          <Field label="Owner name" value={ownerName} onChange={setOwnerName} required />
          <Field label="Owner email" value={ownerEmail} onChange={setOwnerEmail} required type="email" />
          <Field label="Owner phone" value={ownerPhone} onChange={setOwnerPhone} />
          <Field label="Billing address" value={billingAddress} onChange={setBillingAddress} required multiline />
          <Field label="GSTIN" value={gstin} onChange={setGstin} />
          <Field label="Deployment URL (planned)" value={deploymentUrl} onChange={setDeploymentUrl} />
          <button onClick={() => setStep(2)} className="rounded bg-slate-900 px-4 py-2 text-white">
            Next: choose plan
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Plan</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.priceInr.toLocaleString("en-IN")} / {p.billingCycle.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Custom price (₹, optional override)"
            value={customPrice}
            onChange={setCustomPrice}
            type="number"
          />
          <fieldset>
            <legend className="text-sm font-medium">Extra modules (add-ons)</legend>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {HMS_MODULES.map((m) => (
                <label key={m.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={extras.includes(m.code)}
                    onChange={(e) =>
                      setExtras((cur) =>
                        e.target.checked ? [...cur, m.code] : cur.filter((x) => x !== m.code),
                      )
                    }
                  />
                  <span className="font-mono text-xs">{m.code}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Excluded modules</legend>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {HMS_MODULES.map((m) => (
                <label key={m.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={excludes.includes(m.code)}
                    onChange={(e) =>
                      setExcludes((cur) =>
                        e.target.checked ? [...cur, m.code] : cur.filter((x) => x !== m.code),
                      )
                    }
                  />
                  <span className="font-mono text-xs">{m.code}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded border px-4 py-2">
              Back
            </button>
            <button
              disabled={pending}
              onClick={onSubmit}
              className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create hospital"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, required, type, mono, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; mono?: boolean; multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`mt-1 w-full rounded border px-3 py-2 ${mono ? "font-mono" : ""}`}
        />
      ) : (
        <input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`mt-1 w-full rounded border px-3 py-2 ${mono ? "font-mono" : ""}`}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Page**

```tsx
// src/app/(admin)/hospitals/new/page.tsx
import { prisma } from "@/lib/prisma";
import { HospitalWizard } from "./components/HospitalWizard";

export default async function NewHospital() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceInr: "asc" },
  });
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New Hospital</h1>
      {plans.length === 0 ? (
        <p className="text-slate-500">Create at least one Plan first.</p>
      ) : (
        <HospitalWizard plans={plans} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify**

`/hospitals/new` → fill step 1 → step 2 → click Create → see env bundle screen → copy → acknowledge → land on `/hospitals/[id]` (will 404 until Task 19, that's OK).
In `prisma studio`: Hospital row created, Subscription row linked, ApiKey row with hashed key, AuditLog has HOSPITAL_CREATE + API_KEY_GENERATE entries.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(admin)/hospitals/new/"
git commit -m "feat: hospital provisioning wizard with env bundle reveal"
```

---

### Task 19: Hospital detail shell + Overview tab

Tabs: Overview, Plan & Modules, API Keys, Secrets, Activity. Overview tab in this task; others land in tasks 20-24.

**Files:**
- Create: `src/app/(admin)/hospitals/[id]/layout.tsx`
- Create: `src/app/(admin)/hospitals/[id]/page.tsx` (Overview tab)
- Create: `src/app/(admin)/hospitals/[id]/components/Tabs.tsx`
- Create: `src/lib/hospital-fetch.ts`

- [ ] **Step 1: Shared hospital loader**

```ts
// src/lib/hospital-fetch.ts
import { notFound } from "next/navigation";
import { prisma } from "./prisma";

export async function getHospitalOrNotFound(id: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        include: { plan: true },
        take: 1,
      },
    },
  });
  if (!hospital) notFound();
  return hospital;
}
```

- [ ] **Step 2: Tabs component**

```tsx
// src/app/(admin)/hospitals/[id]/components/Tabs.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ id }: { id: string }) {
  const path = usePathname();
  const items = [
    { href: `/hospitals/${id}`,            label: "Overview" },
    { href: `/hospitals/${id}/plan`,       label: "Plan & Modules" },
    { href: `/hospitals/${id}/api-keys`,   label: "API Keys" },
    { href: `/hospitals/${id}/secrets`,    label: "Secrets" },
    { href: `/hospitals/${id}/activity`,   label: "Activity" },
  ];
  return (
    <nav className="mb-6 flex gap-1 border-b">
      {items.map((i) => {
        const active = path === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`px-4 py-2 text-sm ${
              active ? "border-b-2 border-slate-900 font-medium" : "text-slate-600"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Detail layout**

```tsx
// src/app/(admin)/hospitals/[id]/layout.tsx
import { getHospitalOrNotFound } from "@/lib/hospital-fetch";
import { Tabs } from "./components/Tabs";

export default async function HospitalDetailLayout({
  params, children,
}: {
  params: Promise<{ id: string }>; children: React.ReactNode;
}) {
  const { id } = await params;
  const h = await getHospitalOrNotFound(id);
  return (
    <div>
      <div className="mb-1 text-xs font-mono text-slate-500">{h.code}</div>
      <h1 className="mb-4 text-2xl font-semibold">{h.name}</h1>
      <Tabs id={id} />
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Overview page**

```tsx
// src/app/(admin)/hospitals/[id]/page.tsx
import { formatDistanceToNow } from "date-fns";
import { getHospitalOrNotFound } from "@/lib/hospital-fetch";

export default async function HospitalOverview({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await getHospitalOrNotFound(id);
  const sub = h.subscriptions[0];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Section title="Status">
        <Row k="Status" v={h.status} />
        <Row k="Created" v={h.createdAt.toLocaleString()} />
        <Row k="Activated" v={h.activatedAt?.toLocaleString() ?? "—"} />
        <Row k="Last heartbeat" v={h.lastHeartbeatAt
          ? `${formatDistanceToNow(h.lastHeartbeatAt, { addSuffix: true })} (v${h.lastHeartbeatVersion ?? "?"})`
          : "never"} />
        <Row k="Deployment URL" v={h.deploymentUrl ?? "—"} />
        <Row k="Timezone" v={h.timezone} />
      </Section>
      <Section title="Contact">
        <Row k="Owner" v={h.ownerName} />
        <Row k="Email" v={h.ownerEmail} />
        <Row k="Phone" v={h.ownerPhone ?? "—"} />
        <Row k="GSTIN" v={h.gstin ?? "—"} />
        <Row k="Billing address" v={h.billingAddress} />
      </Section>
      <Section title="Subscription">
        {sub ? (
          <>
            <Row k="Plan" v={sub.plan.name} />
            <Row k="Cycle" v={sub.plan.billingCycle} />
            <Row k="Price" v={`₹${(sub.customPriceInr ?? sub.plan.priceInr).toLocaleString("en-IN")}`} />
            <Row k="Current period" v={`${sub.currentPeriodStart.toDateString()} → ${sub.currentPeriodEnd.toDateString()}`} />
            <Row k="Next billing" v={sub.nextBillingDate.toDateString()} />
          </>
        ) : (
          <p className="text-slate-500">No active subscription.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="col-span-2">{v}</dd>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Open `/hospitals/<your-id>` → see Overview tab populated. Tabs render but other tabs 404.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/" src/lib/hospital-fetch.ts
git commit -m "feat: hospital detail shell + Overview tab"
```

---

### Task 20: Plan & Modules tab (change plan, set overrides, preview computed modules)

**Files:**
- Create: `src/app/(admin)/hospitals/[id]/plan/page.tsx`
- Create: `src/app/(admin)/hospitals/[id]/plan/actions.ts`
- Create: `src/app/(admin)/hospitals/[id]/plan/components/PlanTabForm.tsx`

- [ ] **Step 1: Action**

```ts
// src/app/(admin)/hospitals/[id]/plan/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

const Schema = z.object({
  planId: z.string(),
  customPriceInr: z.coerce.number().int().nonnegative().nullable().optional(),
  extraModules: z.array(z.string()).default([]),
  excludedModules: z.array(z.string()).default([]),
});

export async function updateSubscriptionAction(
  hospitalId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const customPriceRaw = formData.get("customPriceInr");
  const parsed = Schema.safeParse({
    planId: formData.get("planId"),
    customPriceInr: customPriceRaw === "" || customPriceRaw == null ? null : customPriceRaw,
    extraModules: formData.getAll("extraModules"),
    excludedModules: formData.getAll("excludedModules"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const active = await prisma.subscription.findFirst({
    where: { hospitalId, status: "ACTIVE" },
  });
  if (!active) return { error: "Hospital has no active subscription" };

  const before = {
    planId: active.planId,
    customPriceInr: active.customPriceInr,
    extraModules: active.extraModules,
    excludedModules: active.excludedModules,
  };
  const updated = await prisma.subscription.update({
    where: { id: active.id },
    data: {
      planId: parsed.data.planId,
      customPriceInr: parsed.data.customPriceInr ?? null,
      extraModules: parsed.data.extraModules,
      excludedModules: parsed.data.excludedModules,
    },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "SUBSCRIPTION_CHANGE",
    entityType: "subscription",
    entityId: updated.id,
    changes: { before, after: parsed.data },
  });
  revalidatePath(`/hospitals/${hospitalId}`);
  revalidatePath(`/hospitals/${hospitalId}/plan`);
  return { ok: true };
}
```

- [ ] **Step 2: Form component**

```tsx
// src/app/(admin)/hospitals/[id]/plan/components/PlanTabForm.tsx
"use client";
import { useActionState, useMemo, useState } from "react";
import { HMS_MODULES } from "@/lib/modules";
import { computeEnabledModules } from "@/lib/compute-modules";
import { updateSubscriptionAction } from "../actions";

type Plan = { id: string; name: string; priceInr: number; moduleCodes: string[]; billingCycle: string };
type Sub = {
  planId: string;
  customPriceInr: number | null;
  extraModules: string[];
  excludedModules: string[];
};

export function PlanTabForm({
  hospitalId, plans, sub,
}: { hospitalId: string; plans: Plan[]; sub: Sub }) {
  const action = updateSubscriptionAction.bind(null, hospitalId);
  const [state, formAction, pending] = useActionState(action, {});

  const [planId, setPlanId] = useState(sub.planId);
  const [extras, setExtras] = useState<string[]>(sub.extraModules);
  const [excludes, setExcludes] = useState<string[]>(sub.excludedModules);

  const plan = plans.find((p) => p.id === planId);
  const preview = useMemo(
    () => computeEnabledModules({
      planModules: plan?.moduleCodes ?? [],
      extraModules: extras,
      excludedModules: excludes,
    }),
    [plan, extras, excludes],
  );

  return (
    <form action={formAction} className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Plan</label>
          <select
            name="planId"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ₹{p.priceInr.toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Custom price override (₹, optional)</label>
          <input
            name="customPriceInr"
            type="number"
            min="0"
            defaultValue={sub.customPriceInr ?? ""}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Extra modules</legend>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {HMS_MODULES.map((m) => (
              <label key={m.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="extraModules"
                  value={m.code}
                  checked={extras.includes(m.code)}
                  onChange={(e) =>
                    setExtras((cur) =>
                      e.target.checked ? [...cur, m.code] : cur.filter((x) => x !== m.code),
                    )
                  }
                />
                <span className="font-mono text-xs">{m.code}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Excluded modules</legend>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {HMS_MODULES.map((m) => (
              <label key={m.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="excludedModules"
                  value={m.code}
                  checked={excludes.includes(m.code)}
                  onChange={(e) =>
                    setExcludes((cur) =>
                      e.target.checked ? [...cur, m.code] : cur.filter((x) => x !== m.code),
                    )
                  }
                />
                <span className="font-mono text-xs">{m.code}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">Saved.</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Computed enabled modules</h2>
        <p className="text-xs text-slate-500">
          (plan ∪ extras) − excluded — this is what `/api/v1/config` will return.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {preview.length === 0 ? (
            <li className="text-slate-400">none</li>
          ) : (
            preview.map((m) => <li key={m} className="font-mono">{m}</li>)
          )}
        </ul>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(admin)/hospitals/[id]/plan/page.tsx
import { getHospitalOrNotFound } from "@/lib/hospital-fetch";
import { prisma } from "@/lib/prisma";
import { PlanTabForm } from "./components/PlanTabForm";

export default async function PlanTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await getHospitalOrNotFound(id);
  const sub = h.subscriptions[0];
  if (!sub) return <p className="text-slate-500">No active subscription.</p>;
  const plans = await prisma.plan.findMany({ where: { isActive: true } });
  return (
    <PlanTabForm
      hospitalId={id}
      plans={plans}
      sub={{
        planId: sub.planId,
        customPriceInr: sub.customPriceInr,
        extraModules: sub.extraModules,
        excludedModules: sub.excludedModules,
      }}
    />
  );
}
```

- [ ] **Step 4: Verify**

`/hospitals/<id>/plan` → see plan dropdown + module checkboxes + live "Computed modules" preview. Toggle a few, save. AuditLog row appears.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/plan/"
git commit -m "feat: Plan & Modules tab"
```

---

### Task 21: API Keys tab

List + generate + revoke. New keys are shown once on creation.

**Files:**
- Create: `src/app/(admin)/hospitals/[id]/api-keys/page.tsx`
- Create: `src/app/(admin)/hospitals/[id]/api-keys/actions.ts`
- Create: `src/app/(admin)/hospitals/[id]/api-keys/components/ApiKeysClient.tsx`

- [ ] **Step 1: Actions**

```ts
// src/app/(admin)/hospitals/[id]/api-keys/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generateApiKey, hashApiKey, extractPrefix } from "@/lib/api-keys";
import { logAuditEvent } from "@/lib/audit";

export async function generateKeyAction(
  hospitalId: string,
  label: string,
): Promise<{ ok: true; fullKey: string } | { ok: false; error: string }> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!label || label.length < 1) return { ok: false, error: "Label is required" };

  const fullKey = generateApiKey();
  const keyHash = await hashApiKey(fullKey);
  const keyPrefix = extractPrefix(fullKey);

  const key = await prisma.apiKey.create({
    data: { hospitalId, label, keyPrefix, keyHash, createdById: session.sub },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "API_KEY_GENERATE",
    entityType: "hospital",
    entityId: hospitalId,
    changes: { keyId: key.id, label, prefix: keyPrefix },
  });
  revalidatePath(`/hospitals/${hospitalId}/api-keys`);
  return { ok: true, fullKey };
}

export async function revokeKeyAction(
  hospitalId: string,
  keyId: string,
): Promise<{ ok: boolean }> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const key = await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "API_KEY_REVOKE",
    entityType: "hospital",
    entityId: hospitalId,
    changes: { keyId, prefix: key.keyPrefix },
  });
  revalidatePath(`/hospitals/${hospitalId}/api-keys`);
  return { ok: true };
}
```

- [ ] **Step 2: Client component**

```tsx
// src/app/(admin)/hospitals/[id]/api-keys/components/ApiKeysClient.tsx
"use client";
import { useState, useTransition } from "react";
import { generateKeyAction, revokeKeyAction } from "../actions";

type Key = {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export function ApiKeysClient({ hospitalId, keys }: { hospitalId: string; keys: Key[] }) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Generate new key</h2>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. production)"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            disabled={pending || !label}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await generateKeyAction(hospitalId, label);
                if (!res.ok) setError(res.error);
                else {
                  setRevealedKey(res.fullKey);
                  setLabel("");
                }
              });
            }}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Generate
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {revealedKey && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="mb-2 font-semibold">New API key — save it now, it will not be shown again.</p>
            <code className="block break-all rounded bg-slate-900 p-2 font-mono text-xs text-slate-100">
              {revealedKey}
            </code>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(revealedKey)}
                className="rounded border px-3 py-1 text-xs"
              >
                Copy
              </button>
              <button
                onClick={() => setRevealedKey(null)}
                className="rounded bg-slate-900 px-3 py-1 text-xs text-white"
              >
                I've saved it
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded border bg-white">
        <h2 className="border-b p-4 text-sm font-semibold">Existing keys</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Prefix</th>
              <th className="p-3">Label</th>
              <th className="p-3">Created</th>
              <th className="p-3">Last used</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-t">
                <td className="p-3 font-mono">{k.keyPrefix}…</td>
                <td className="p-3">{k.label ?? "—"}</td>
                <td className="p-3 text-slate-500">{k.createdAt.toLocaleDateString()}</td>
                <td className="p-3 text-slate-500">
                  {k.lastUsedAt?.toLocaleDateString() ?? "never"}
                </td>
                <td className="p-3">
                  {k.revokedAt ? (
                    <span className="text-red-600">Revoked</span>
                  ) : (
                    <span className="text-green-700">Active</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {!k.revokedAt && (
                    <button
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Revoke this key? Hospital app will lose access immediately.")) return;
                        startTransition(() => revokeKeyAction(hospitalId, k.id));
                      }}
                      className="rounded border px-2 py-1 text-xs text-red-700"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(admin)/hospitals/[id]/api-keys/page.tsx
import { prisma } from "@/lib/prisma";
import { ApiKeysClient } from "./components/ApiKeysClient";

export default async function ApiKeysTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const keys = await prisma.apiKey.findMany({
    where: { hospitalId: id },
    orderBy: { createdAt: "desc" },
  });
  return <ApiKeysClient hospitalId={id} keys={keys} />;
}
```

- [ ] **Step 4: Verify**

`/hospitals/<id>/api-keys` → existing initial key shown with prefix. Generate a new key with label "staging" → reveal shows full key → save → list shows two keys → revoke staging → status flips to "Revoked".

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/api-keys/"
git commit -m "feat: API Keys tab — generate, reveal once, revoke"
```

---

### Task 22: Re-auth gate (for secret reveals)

A reusable server action that verifies the current user's password before allowing access to a sensitive operation. Returns a short-lived "reveal token" stored in cookie.

**Files:**
- Create: `src/lib/reveal-gate.ts`
- Create: `src/components/secrets/ReAuthDialog.tsx`

- [ ] **Step 1: Reveal-gate lib**

```ts
// src/lib/reveal-gate.ts
import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { requireSession } from "./auth";

const COOKIE = "docsile-admin-reveal";
const REVEAL_TTL_SEC = 30;

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_JWT_SECRET!);
}

export async function requestRevealToken(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const user = await prisma.devUser.findUnique({ where: { id: session.sub } });
  if (!user) return { ok: false, error: "User not found" };
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Incorrect password" };
  }
  const token = await new SignJWT({ sub: session.sub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REVEAL_TTL_SEC}s`)
    .sign(getSecret());
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: REVEAL_TTL_SEC,
  });
  return { ok: true };
}

export async function consumeRevealToken(): Promise<boolean> {
  const session = await requireSession();
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub === session.sub;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: ReAuthDialog component**

```tsx
// src/components/secrets/ReAuthDialog.tsx
"use client";
import { useState, useTransition } from "react";
import { requestRevealAction } from "@/app/(admin)/hospitals/[id]/secrets/actions";

export function ReAuthDialog({ onAuthed, onCancel }: {
  onAuthed: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm space-y-3 rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Confirm your password</h2>
        <p className="text-sm text-slate-500">
          Revealing this secret will be audit-logged. The reveal is valid for 30 seconds.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={pending || !password}
            onClick={() =>
              startTransition(async () => {
                const res = await requestRevealAction(password);
                if (!res.ok) setError(res.error);
                else onAuthed();
              })
            }
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reveal-gate.ts src/components/secrets/ReAuthDialog.tsx
git commit -m "feat: re-auth reveal gate (30s token)"
```

---

### Task 23: Secrets tab (encrypted store + reveal flow + edit)

**Files:**
- Create: `src/app/(admin)/hospitals/[id]/secrets/page.tsx`
- Create: `src/app/(admin)/hospitals/[id]/secrets/actions.ts`
- Create: `src/app/(admin)/hospitals/[id]/secrets/components/SecretsClient.tsx`

- [ ] **Step 1: Actions**

```ts
// src/app/(admin)/hospitals/[id]/secrets/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import { logAuditEvent } from "@/lib/audit";
import { requestRevealToken, consumeRevealToken } from "@/lib/reveal-gate";

const FIELD = z.enum([
  "supabaseDbUrl",
  "supabaseAnonKey",
  "supabaseServiceKey",
  "hmsJwtSecret",
]);
type Field = z.infer<typeof FIELD>;

export async function requestRevealAction(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return requestRevealToken(password);
}

export async function revealSecretsAction(
  hospitalId: string,
): Promise<{ ok: true; secrets: Record<Field, string | null> } | { ok: false; error: string }> {
  const session = await requireRole("SUPER_ADMIN");
  const valid = await consumeRevealToken();
  if (!valid) return { ok: false, error: "Re-auth required" };

  const h = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!h) return { ok: false, error: "Hospital not found" };

  await logAuditEvent({
    devUserId: session.sub,
    action: "SECRET_REVEAL",
    entityType: "hospital",
    entityId: hospitalId,
    changes: { fields: ["supabaseDbUrl", "supabaseAnonKey", "supabaseServiceKey", "hmsJwtSecret"] },
  });

  const dec = (v: string | null) => (v ? decrypt(v) : null);
  return {
    ok: true,
    secrets: {
      supabaseDbUrl: dec(h.supabaseDbUrl),
      supabaseAnonKey: dec(h.supabaseAnonKey),
      supabaseServiceKey: dec(h.supabaseServiceKey),
      hmsJwtSecret: dec(h.hmsJwtSecret),
    },
  };
}

export async function editSecretAction(
  hospitalId: string,
  field: Field,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRole("SUPER_ADMIN");
  const valid = await consumeRevealToken();
  if (!valid) return { ok: false, error: "Re-auth required" };
  const parsed = FIELD.safeParse(field);
  if (!parsed.success) return { ok: false, error: "Invalid field" };

  await prisma.hospital.update({
    where: { id: hospitalId },
    data: { [field]: value ? encrypt(value) : null },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "SECRET_EDIT",
    entityType: "hospital",
    entityId: hospitalId,
    changes: { field },
  });
  revalidatePath(`/hospitals/${hospitalId}/secrets`);
  return { ok: true };
}
```

- [ ] **Step 2: Client**

```tsx
// src/app/(admin)/hospitals/[id]/secrets/components/SecretsClient.tsx
"use client";
import { useState, useTransition } from "react";
import { ReAuthDialog } from "@/components/secrets/ReAuthDialog";
import { revealSecretsAction, editSecretAction } from "../actions";

const FIELDS: Array<{ key: "supabaseDbUrl" | "supabaseAnonKey" | "supabaseServiceKey" | "hmsJwtSecret"; label: string }> = [
  { key: "supabaseDbUrl",      label: "Supabase DB URL" },
  { key: "supabaseAnonKey",    label: "Supabase Anon Key" },
  { key: "supabaseServiceKey", label: "Supabase Service Key" },
  { key: "hmsJwtSecret",       label: "HMS JWT Secret" },
];

export function SecretsClient({ hospitalId, hasValues }: {
  hospitalId: string;
  hasValues: Record<string, boolean>;
}) {
  const [showReAuth, setShowReAuth] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string | null> | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRevealClick = () => {
    setShowReAuth(true);
  };

  const onAuthed = () => {
    setShowReAuth(false);
    startTransition(async () => {
      const r = await revealSecretsAction(hospitalId);
      if (!r.ok) setError(r.error);
      else {
        setRevealed(r.secrets);
        setTimeout(() => setRevealed(null), 30_000); // auto-hide
      }
    });
  };

  return (
    <div className="space-y-4">
      {showReAuth && <ReAuthDialog onAuthed={onAuthed} onCancel={() => setShowReAuth(false)} />}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Hospital secrets are encrypted at rest. Reveals require your password and are audit-logged.
        </p>
        {!revealed && (
          <button
            onClick={onRevealClick}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            Reveal
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border bg-white text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-3">Field</th>
            <th className="p-3">Value</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map((f) => {
            const v = revealed?.[f.key] ?? null;
            const isEditing = editing === f.key;
            return (
              <tr key={f.key} className="border-t">
                <td className="p-3">{f.label}</td>
                <td className="p-3">
                  {isEditing ? (
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  ) : revealed ? (
                    <code className="block break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs">
                      {v ?? "—"}
                    </code>
                  ) : (
                    <span className="text-slate-400">
                      {hasValues[f.key] ? "•••••• (hidden)" : "— not set"}
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await editSecretAction(hospitalId, f.key, editValue);
                            if (!r.ok) setError(r.error);
                            else {
                              setEditing(null);
                              setEditValue("");
                            }
                          })
                        }
                        className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : revealed ? (
                    <button
                      onClick={() => {
                        setEditing(f.key);
                        setEditValue(v ?? "");
                      }}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(admin)/hospitals/[id]/secrets/page.tsx
import { prisma } from "@/lib/prisma";
import { SecretsClient } from "./components/SecretsClient";

export default async function SecretsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await prisma.hospital.findUnique({
    where: { id },
    select: {
      supabaseDbUrl: true,
      supabaseAnonKey: true,
      supabaseServiceKey: true,
      hmsJwtSecret: true,
    },
  });
  return (
    <SecretsClient
      hospitalId={id}
      hasValues={{
        supabaseDbUrl: !!h?.supabaseDbUrl,
        supabaseAnonKey: !!h?.supabaseAnonKey,
        supabaseServiceKey: !!h?.supabaseServiceKey,
        hmsJwtSecret: !!h?.hmsJwtSecret,
      }}
    />
  );
}
```

- [ ] **Step 4: Verify**

`/hospitals/<id>/secrets` → "Reveal" → re-auth dialog → enter password → secrets shown (only `hmsJwtSecret` populated initially from Task 18) → click Edit on a row → paste a value → Save → row stays revealed. After 30 s, values auto-hide. AuditLog rows: SECRET_REVEAL, SECRET_EDIT.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/secrets/"
git commit -m "feat: Secrets tab — encrypted store + reveal + edit"
```

---

### Task 24: Onboarding checklist + "Mark Active"

Lives on the Overview tab for hospitals in `PROVISIONING` state. Five items, last one auto-checks on first heartbeat.

**Files:**
- Modify: `src/app/(admin)/hospitals/[id]/page.tsx`
- Create: `src/app/(admin)/hospitals/[id]/components/OnboardingChecklist.tsx`
- Create: `src/app/(admin)/hospitals/[id]/onboarding-actions.ts`

- [ ] **Step 1: Action — Mark Active**

```ts
// src/app/(admin)/hospitals/[id]/onboarding-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function markActiveAction(
  hospitalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const h = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!h) return { ok: false, error: "Hospital not found" };
  if (h.status !== "PROVISIONING") return { ok: false, error: "Hospital is not PROVISIONING" };
  if (!h.supabaseDbUrl || !h.supabaseAnonKey || !h.supabaseServiceKey) {
    return { ok: false, error: "All Supabase credentials must be set first" };
  }
  if (!h.lastHeartbeatAt) {
    return { ok: false, error: "First heartbeat not yet received" };
  }
  await prisma.hospital.update({
    where: { id: hospitalId },
    data: { status: "ACTIVE", activatedAt: new Date() },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "HOSPITAL_STATUS_CHANGE",
    entityType: "hospital",
    entityId: hospitalId,
    changes: { before: "PROVISIONING", after: "ACTIVE" },
  });
  revalidatePath(`/hospitals/${hospitalId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Checklist component**

```tsx
// src/app/(admin)/hospitals/[id]/components/OnboardingChecklist.tsx
"use client";
import { useTransition, useState } from "react";
import { markActiveAction } from "../onboarding-actions";

export function OnboardingChecklist({ hospitalId, items, allReady }: {
  hospitalId: string;
  items: Array<{ label: string; done: boolean }>;
  allReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded border bg-amber-50 p-4">
      <h2 className="mb-3 text-sm font-semibold">Provisioning checklist</h2>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span>{it.done ? "✅" : "☐"}</span>
            <span className={it.done ? "" : "text-slate-600"}>{it.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <button
          disabled={!allReady || pending}
          onClick={() =>
            startTransition(async () => {
              const r = await markActiveAction(hospitalId);
              if (!r.ok) setError(r.error);
            })
          }
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Activating…" : "Mark Active"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render checklist on Overview**

Edit `src/app/(admin)/hospitals/[id]/page.tsx`. At the top of the returned JSX, before the existing `grid`, add:

```tsx
import { OnboardingChecklist } from "./components/OnboardingChecklist";
// ... inside the component, after fetching h:

const showChecklist = h.status === "PROVISIONING";
const items = [
  { label: "Supabase DB URL set",      done: !!h.supabaseDbUrl },
  { label: "Supabase anon key set",    done: !!h.supabaseAnonKey },
  { label: "Supabase service key set", done: !!h.supabaseServiceKey },
  { label: "Deployment URL set",       done: !!h.deploymentUrl },
  { label: "First heartbeat received", done: !!h.lastHeartbeatAt },
];
const allReady = items.every((i) => i.done);
```

And render before the grid:

```tsx
{showChecklist && (
  <div className="mb-6">
    <OnboardingChecklist hospitalId={id} items={items} allReady={allReady} />
  </div>
)}
```

- [ ] **Step 4: Verify**

`/hospitals/<id>` (PROVISIONING) → checklist visible, most items ☐. Go to Secrets tab, fill in DB URL/anon/service (fake values are fine for now). Return → those items become ✅. Heartbeat item stays ☐ (no hospital app yet). Manually update the row in `prisma studio`: set `lastHeartbeatAt` to now, set `deploymentUrl`. Refresh → all 5 ✅ → "Mark Active" enables → click → status flips to ACTIVE, checklist disappears.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/"
git commit -m "feat: onboarding checklist + Mark Active"
```

---

### Task 25: Activity tab (audit log filtered to hospital)

**Files:**
- Create: `src/app/(admin)/hospitals/[id]/activity/page.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(admin)/hospitals/[id]/activity/page.tsx
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";

export default async function ActivityTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entries = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "hospital", entityId: id },
        { entityType: "subscription" }, // refined below
      ],
    },
    include: { devUser: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Filter subscription rows by hospital
  const sub = await prisma.subscription.findFirst({ where: { hospitalId: id } });
  const filtered = entries.filter((e) =>
    e.entityType === "hospital" ? e.entityId === id :
    e.entityType === "subscription" ? e.entityId === sub?.id : false,
  );

  return (
    <div className="rounded border bg-white">
      <h2 className="border-b p-4 text-sm font-semibold">Recent activity</h2>
      <ul className="divide-y text-sm">
        {filtered.map((e) => (
          <li key={e.id} className="p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs text-slate-600">{e.action}</span>
              <span className="text-xs text-slate-400">
                {formatDistanceToNow(e.createdAt, { addSuffix: true })}
              </span>
            </div>
            <div className="text-slate-500">
              {e.devUser?.name ?? "system"} ({e.devUser?.email ?? "—"})
            </div>
            {e.changes !== null && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-slate-500">details</summary>
                <pre className="mt-2 overflow-auto rounded bg-slate-100 p-2 text-xs">
                  {JSON.stringify(e.changes, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="p-6 text-center text-slate-500">No activity yet.</li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

`/hospitals/<id>/activity` → see HOSPITAL_CREATE, API_KEY_GENERATE, SECRET_REVEAL, etc.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/activity/"
git commit -m "feat: per-hospital Activity tab"
```

---

### Task 26: Dev Users CRUD (SUPER_ADMIN only)

Invite by email (sets password directly for MVP — email magic links are phase 3), change role, disable.

**Files:**
- Create: `src/app/(admin)/dev-users/page.tsx`
- Create: `src/app/(admin)/dev-users/actions.ts`
- Create: `src/app/(admin)/dev-users/components/InviteForm.tsx`

- [ ] **Step 1: Actions**

```ts
// src/app/(admin)/dev-users/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { logAuditEvent } from "@/lib/audit";

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]),
  password: z.string().min(10),
});

export async function inviteDevUser(_prev: unknown, formData: FormData) {
  const session = await requireRole("SUPER_ADMIN");
  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.devUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "A user with that email already exists" };

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.devUser.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash,
      isActive: true,
    },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "DEV_USER_INVITE",
    entityType: "dev_user",
    entityId: user.id,
    changes: { email: user.email, role: user.role },
  });
  revalidatePath("/dev-users");
  return { ok: true };
}

export async function changeRoleAction(userId: string, role: "SUPER_ADMIN" | "ADMIN" | "VIEWER") {
  const session = await requireRole("SUPER_ADMIN");
  const before = await prisma.devUser.findUnique({ where: { id: userId } });
  await prisma.devUser.update({ where: { id: userId }, data: { role } });
  await logAuditEvent({
    devUserId: session.sub,
    action: "DEV_USER_ROLE_CHANGE",
    entityType: "dev_user",
    entityId: userId,
    changes: { before: before?.role, after: role },
  });
  revalidatePath("/dev-users");
}

export async function toggleActiveAction(userId: string) {
  const session = await requireRole("SUPER_ADMIN");
  const u = await prisma.devUser.findUnique({ where: { id: userId } });
  if (!u) return;
  const updated = await prisma.devUser.update({
    where: { id: userId },
    data: { isActive: !u.isActive },
  });
  await logAuditEvent({
    devUserId: session.sub,
    action: "DEV_USER_DISABLE",
    entityType: "dev_user",
    entityId: userId,
    changes: { isActive: updated.isActive },
  });
  revalidatePath("/dev-users");
}
```

- [ ] **Step 2: Invite form**

```tsx
// src/app/(admin)/dev-users/components/InviteForm.tsx
"use client";
import { useActionState } from "react";
import { inviteDevUser } from "../actions";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteDevUser, {});
  return (
    <form action={formAction} className="space-y-3 rounded border bg-white p-4">
      <h2 className="text-sm font-semibold">Invite a dev user</h2>
      <div className="grid grid-cols-2 gap-3">
        <input name="name" placeholder="Name" required className="rounded border px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" required className="rounded border px-3 py-2 text-sm" />
        <select name="role" defaultValue="VIEWER" className="rounded border px-3 py-2 text-sm">
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          <option value="ADMIN">ADMIN</option>
          <option value="VIEWER">VIEWER</option>
        </select>
        <input name="password" type="password" placeholder="Initial password (≥10)" required className="rounded border px-3 py-2 text-sm" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">User invited.</p>}
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">
        {pending ? "Inviting…" : "Invite"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: List page**

```tsx
// src/app/(admin)/dev-users/page.tsx
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InviteForm } from "./components/InviteForm";
import { changeRoleAction, toggleActiveAction } from "./actions";

export default async function DevUsersPage() {
  await requireRole("SUPER_ADMIN");
  const users = await prisma.devUser.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dev Users</h1>
      <InviteForm />
      <table className="w-full border bg-white text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Last login</th>
            <th className="p-3">Status</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.name}</td>
              <td className="p-3 font-mono text-xs">{u.email}</td>
              <td className="p-3">
                <form action={async (fd) => {
                  "use server";
                  await changeRoleAction(u.id, fd.get("role") as "SUPER_ADMIN" | "ADMIN" | "VIEWER");
                }}>
                  <select name="role" defaultValue={u.role} className="rounded border px-2 py-1 text-xs">
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  <button type="submit" className="ml-2 rounded border px-2 py-1 text-xs">Save</button>
                </form>
              </td>
              <td className="p-3 text-slate-500">{u.lastLoginAt?.toLocaleDateString() ?? "never"}</td>
              <td className="p-3">{u.isActive ? "Active" : "Disabled"}</td>
              <td className="p-3">
                <form action={async () => { "use server"; await toggleActiveAction(u.id); }}>
                  <button type="submit" className="rounded border px-2 py-1 text-xs">
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Sign in as SUPER_ADMIN → /dev-users → invite a second user with role ADMIN → log out → log in as that user → see Dev Users hidden in sidebar (correct). Log back in as SUPER_ADMIN, change second user's role to VIEWER, disable them. AuditLog rows appear.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/dev-users/"
git commit -m "feat: dev users CRUD"
```

---

### Task 27: Global Audit Log screen (SUPER_ADMIN only)

**Files:**
- Create: `src/app/(admin)/audit-log/page.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(admin)/audit-log/page.tsx
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; user?: string }>;
}) {
  await requireRole("SUPER_ADMIN");
  const sp = await searchParams;
  const entries = await prisma.auditLog.findMany({
    where: {
      action: sp.action || undefined,
      entityType: sp.entity || undefined,
      devUserId: sp.user || undefined,
    },
    include: { devUser: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <input name="action" placeholder="action (e.g. SECRET_REVEAL)" defaultValue={sp.action ?? ""} className="rounded border px-2 py-1 font-mono" />
        <input name="entity" placeholder="entity (e.g. hospital)" defaultValue={sp.entity ?? ""} className="rounded border px-2 py-1 font-mono" />
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-white">Filter</button>
      </form>
      <table className="w-full border bg-white text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-3">When</th>
            <th className="p-3">Who</th>
            <th className="p-3">Action</th>
            <th className="p-3">Entity</th>
            <th className="p-3">Changes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t align-top">
              <td className="p-3 text-slate-500">
                <div>{e.createdAt.toLocaleString()}</div>
                <div className="text-xs">({formatDistanceToNow(e.createdAt, { addSuffix: true })})</div>
              </td>
              <td className="p-3">{e.devUser?.name ?? "system"}</td>
              <td className="p-3 font-mono text-xs">{e.action}</td>
              <td className="p-3 text-xs">
                {e.entityType}{e.entityId ? `/${e.entityId.slice(0, 8)}…` : ""}
              </td>
              <td className="p-3">
                {e.changes !== null && (
                  <details>
                    <summary className="cursor-pointer text-xs text-slate-500">view</summary>
                    <pre className="mt-2 overflow-auto rounded bg-slate-100 p-2 text-xs">
                      {JSON.stringify(e.changes, null, 2)}
                    </pre>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

`/audit-log` → see all events. Filter by action `LOGIN_SUCCESS` → only logins. Filter by entity `hospital` → only hospital events.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/audit-log/"
git commit -m "feat: global audit log screen with filters"
```

---

### Task 28: Settings page (your company info)

Single-row settings stored in a dedicated `AppSettings` table. Used as the *from* side of invoices in Plan B (billing — not in this MVP plan), but the data shape lands now so it's ready.

**Files:**
- Modify: `prisma/schema.prisma` (add AppSettings model)
- Create: `src/app/(admin)/settings/page.tsx`
- Create: `src/app/(admin)/settings/actions.ts`

- [ ] **Step 1: Add `AppSettings` model to `prisma/schema.prisma`**

Append:

```prisma
model AppSettings {
  id              String   @id @default("singleton")
  businessName    String
  businessGstin   String
  businessAddress String   @db.Text
  bankName        String?
  bankAccountNo   String?
  bankIfsc        String?
  bankUpi         String?
  defaultGstRate  Int      @default(18)
  fyStartMonth    Int      @default(4)
  invoicePrefix   String   @default("DOCSILE")
  invoiceTerms    String?  @db.Text
  updatedAt       DateTime @updatedAt
}
```

Note: there's a single row keyed by literal id `"singleton"`. Prisma's `default` accepts string literals — but you cannot use a string literal for default on a non-enum, non-numeric `@default` directly. **Use `@default(uuid())` and seed-set the singleton instead**, or call `prisma.appSettings.upsert(...)` with a hard-coded id. Updated correct schema:

```prisma
model AppSettings {
  id              String   @id @default(cuid())
  businessName    String
  businessGstin   String
  businessAddress String   @db.Text
  bankName        String?
  bankAccountNo   String?
  bankIfsc        String?
  bankUpi         String?
  defaultGstRate  Int      @default(18)
  fyStartMonth    Int      @default(4)
  invoicePrefix   String   @default("DOCSILE")
  invoiceTerms    String?  @db.Text
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name add_app_settings
```

- [ ] **Step 3: Action**

```ts
// src/app/(admin)/settings/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const Schema = z.object({
  businessName: z.string().min(2),
  businessGstin: z.string().min(15).max(15),
  businessAddress: z.string().min(5),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankUpi: z.string().optional(),
  defaultGstRate: z.coerce.number().int().min(0).max(28),
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  invoicePrefix: z.string().min(1),
  invoiceTerms: z.string().optional(),
});

export async function saveSettingsAction(_prev: unknown, formData: FormData) {
  await requireRole("SUPER_ADMIN");
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.appSettings.findFirst();
  if (existing) {
    await prisma.appSettings.update({ where: { id: existing.id }, data: parsed.data });
  } else {
    await prisma.appSettings.create({ data: parsed.data });
  }
  revalidatePath("/settings");
  return { ok: true };
}
```

- [ ] **Step 4: Page**

```tsx
// src/app/(admin)/settings/page.tsx
"use client";
// NOTE: this page is rendered as client component because we want useActionState ergonomics
// and the data shape is small. Server data is passed via a wrapper below.

import { useActionState } from "react";

export default function ClientWrap() {
  return <p>Loading…</p>;
}
```

Actually scrap that — easier to do a server page + client form. Replace the file:

```tsx
// src/app/(admin)/settings/page.tsx
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./components/SettingsForm";

export default async function SettingsPage() {
  await requireRole("SUPER_ADMIN");
  const settings = await prisma.appSettings.findFirst();
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
```

And:

```tsx
// src/app/(admin)/settings/components/SettingsForm.tsx
"use client";
import { useActionState } from "react";
import { saveSettingsAction } from "../actions";
import type { AppSettings } from "@prisma/client";

export function SettingsForm({ settings }: { settings: AppSettings | null }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <Field name="businessName" label="Business name" defaultValue={settings?.businessName ?? ""} required />
      <Field name="businessGstin" label="Business GSTIN (15 chars)" defaultValue={settings?.businessGstin ?? ""} required />
      <Field name="businessAddress" label="Address" defaultValue={settings?.businessAddress ?? ""} required multiline />
      <Field name="bankName" label="Bank name" defaultValue={settings?.bankName ?? ""} />
      <Field name="bankAccountNo" label="Bank account number" defaultValue={settings?.bankAccountNo ?? ""} />
      <Field name="bankIfsc" label="IFSC" defaultValue={settings?.bankIfsc ?? ""} />
      <Field name="bankUpi" label="UPI ID" defaultValue={settings?.bankUpi ?? ""} />
      <div className="grid grid-cols-3 gap-3">
        <Field name="defaultGstRate" label="Default GST %" type="number" defaultValue={String(settings?.defaultGstRate ?? 18)} />
        <Field name="fyStartMonth" label="FY start month (1-12)" type="number" defaultValue={String(settings?.fyStartMonth ?? 4)} />
        <Field name="invoicePrefix" label="Invoice prefix" defaultValue={settings?.invoicePrefix ?? "DOCSILE"} />
      </div>
      <Field name="invoiceTerms" label="Default invoice terms" defaultValue={settings?.invoiceTerms ?? ""} multiline />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">Saved.</p>}
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function Field({
  name, label, defaultValue, type, required, multiline,
}: {
  name: string; label: string; defaultValue: string; type?: string;
  required?: boolean; multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {multiline ? (
        <textarea name={name} defaultValue={defaultValue} className="mt-1 w-full rounded border px-3 py-2" />
      ) : (
        <input name={name} type={type ?? "text"} defaultValue={defaultValue} required={required} className="mt-1 w-full rounded border px-3 py-2" />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

`/settings` → fill in your business details → save → reload, values persist.

- [ ] **Step 6: Commit**

```bash
git add prisma/ "src/app/(admin)/settings/"
git commit -m "feat: AppSettings page (business info, bank, GST defaults)"
```

---

### Task 29: Public API auth helper — `requireApiKey`

Looks up an `X-Hospital-Key` header → finds the matching `ApiKey` row → returns the linked `Hospital`. Rate-limited per key.

**Files:**
- Create: `src/lib/api-auth.ts`
- Test: `src/lib/api-auth.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/api-auth.test.ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { authenticateRequest } from "./api-auth";
import { prisma } from "./prisma";
import { generateApiKey, hashApiKey, extractPrefix } from "./api-keys";

let hospitalId: string;
let goodKey: string;
let revokedKey: string;

beforeAll(async () => {
  // Set up env
  process.env.SECRETS_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.SESSION_JWT_SECRET = "x".repeat(64);

  // Create test plan + hospital + dev user + 2 api keys
  const plan = await prisma.plan.create({
    data: { code: `t-${Date.now()}`, name: "T", priceInr: 0, moduleCodes: ["patients"] },
  });
  const dev = await prisma.devUser.create({
    data: {
      email: `t-${Date.now()}@example.com`,
      name: "T",
      passwordHash: "x",
      role: "SUPER_ADMIN",
    },
  });
  const h = await prisma.hospital.create({
    data: {
      code: `t-${Date.now()}`,
      name: "T",
      ownerName: "x",
      ownerEmail: "x@y.z",
      billingAddress: "x",
    },
  });
  await prisma.subscription.create({
    data: {
      hospitalId: h.id,
      planId: plan.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      nextBillingDate: new Date(Date.now() + 86_400_000),
    },
  });
  hospitalId = h.id;

  goodKey = generateApiKey();
  await prisma.apiKey.create({
    data: {
      hospitalId,
      keyPrefix: extractPrefix(goodKey),
      keyHash: await hashApiKey(goodKey),
      createdById: dev.id,
    },
  });

  revokedKey = generateApiKey();
  await prisma.apiKey.create({
    data: {
      hospitalId,
      keyPrefix: extractPrefix(revokedKey),
      keyHash: await hashApiKey(revokedKey),
      createdById: dev.id,
      revokedAt: new Date(),
    },
  });
});

describe("authenticateRequest", () => {
  it("accepts a valid key", async () => {
    const result = await authenticateRequest({ "x-hospital-key": goodKey });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hospital.id).toBe(hospitalId);
  });

  it("rejects missing key", async () => {
    const result = await authenticateRequest({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects unknown key", async () => {
    const result = await authenticateRequest({ "x-hospital-key": "dsk_live_wrongwrongwrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects revoked key", async () => {
    const result = await authenticateRequest({ "x-hospital-key": revokedKey });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- src/lib/api-auth.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/api-auth.ts
import { prisma } from "./prisma";
import { verifyApiKey, extractPrefix } from "./api-keys";
import { publicApiLimiter } from "./rate-limit";
import type { Hospital } from "@prisma/client";

export type ApiAuthResult =
  | { ok: true; hospital: Hospital; keyId: string }
  | { ok: false; status: 401 | 403 | 429; code: string };

export async function authenticateRequest(
  headers: Record<string, string | undefined>,
): Promise<ApiAuthResult> {
  const raw = headers["x-hospital-key"];
  if (!raw) return { ok: false, status: 401, code: "missing_key" };

  if (!publicApiLimiter.check(raw)) {
    return { ok: false, status: 429, code: "rate_limit" };
  }

  const prefix = extractPrefix(raw);
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix, revokedAt: null },
    include: { hospital: true },
  });

  for (const cand of candidates) {
    if (await verifyApiKey(raw, cand.keyHash)) {
      if (cand.hospital.status === "SUSPENDED") {
        return { ok: false, status: 403, code: "hospital_suspended" };
      }
      // Fire-and-forget bump of lastUsedAt — don't await to keep latency low
      prisma.apiKey
        .update({ where: { id: cand.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return { ok: true, hospital: cand.hospital, keyId: cand.id };
    }
  }
  return { ok: false, status: 401, code: "invalid_key" };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- src/lib/api-auth.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-auth.ts src/lib/api-auth.test.ts
git commit -m "feat: public API auth helper with rate limit"
```

---

### Task 30: `GET /api/v1/config`

The endpoint hospital apps poll. Returns enabled modules and billing status.

**Files:**
- Create: `src/app/api/v1/config/route.ts`

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/v1/config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { computeEnabledModules } from "@/lib/compute-modules";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const auth = await authenticateRequest(headers);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.code }, { status: auth.status });
  }

  const { hospital } = auth;
  const sub = await prisma.subscription.findFirst({
    where: { hospitalId: hospital.id, status: "ACTIVE" },
    include: { plan: true },
  });

  const enabledModules = sub
    ? computeEnabledModules({
        planModules: sub.plan.moduleCodes,
        extraModules: sub.extraModules,
        excludedModules: sub.excludedModules,
      })
    : [];

  // Billing status — simple version for MVP. Overdue invoices = Plan B; default to "current".
  const overdueInvoices = await prisma.invoice.findMany({
    where: { hospitalId: hospital.id, status: "OVERDUE" },
    orderBy: { dueDate: "asc" },
  });
  const billing =
    overdueInvoices.length === 0
      ? {
          status: "current" as const,
          overdueInvoiceCount: 0,
          oldestOverdueDate: null,
          bannerMessage: null,
        }
      : {
          status: "overdue" as const,
          overdueInvoiceCount: overdueInvoices.length,
          oldestOverdueDate: overdueInvoices[0].dueDate.toISOString(),
          bannerMessage: `Payment overdue since ${overdueInvoices[0].dueDate.toDateString()}. Please contact accounts@docsile.in`,
        };

  return NextResponse.json({
    hospital: {
      id: hospital.id,
      code: hospital.code,
      name: hospital.name,
      timezone: hospital.timezone,
    },
    subscription: sub
      ? {
          planCode: sub.plan.code,
          planName: sub.plan.name,
          status: sub.status,
          periodEnd: sub.currentPeriodEnd.toISOString(),
        }
      : null,
    enabledModules,
    billing,
    fetchedAt: new Date().toISOString(),
    cacheMaxAgeSec: 900,
  });
}
```

- [ ] **Step 2: Verify manually**

Get an API key (use the original from your test hospital, or generate fresh in the UI). Run:

```bash
curl -s -H "X-Hospital-Key: <YOUR_KEY>" http://localhost:3000/api/v1/config | jq .
```

Expected: JSON with hospital block, enabledModules, billing.status = "current".

Test failure cases:

```bash
curl -i http://localhost:3000/api/v1/config           # 401 missing_key
curl -i -H "X-Hospital-Key: dsk_live_nope" http://localhost:3000/api/v1/config   # 401 invalid_key
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/config/
git commit -m "feat: GET /api/v1/config endpoint"
```

---

### Task 31: `POST /api/v1/heartbeat`

**Files:**
- Create: `src/app/api/v1/heartbeat/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/v1/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

const Body = z.object({
  appVersion: z.string().optional(),
  userCount: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const auth = await authenticateRequest(headers);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.code }, { status: auth.status });
  }

  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const parsed = Body.safeParse(body);
  const data = parsed.success ? parsed.data : {};

  await prisma.hospital.update({
    where: { id: auth.hospital.id },
    data: {
      lastHeartbeatAt: new Date(),
      lastHeartbeatVersion: data.appVersion ?? null,
    },
  });

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Verify manually**

```bash
curl -i -X POST -H "X-Hospital-Key: <YOUR_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"appVersion":"0.1.4","userCount":5}' \
  http://localhost:3000/api/v1/heartbeat
```

Expected: HTTP 204. Refresh hospital detail in admin UI → "Last heartbeat: a few seconds ago (v0.1.4)".

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/heartbeat/
git commit -m "feat: POST /api/v1/heartbeat endpoint"
```

---

### Task 32: Smoke test scripts + end-to-end verification

Shell scripts so you can sanity-check the API after deploys without poking through the UI.

**Files:**
- Create: `scripts/smoke/config.sh`
- Create: `scripts/smoke/heartbeat.sh`
- Create: `scripts/smoke/README.md`

- [ ] **Step 1: `config.sh`**

```bash
#!/usr/bin/env bash
# scripts/smoke/config.sh
# Usage: API_URL=http://localhost:3000 KEY=dsk_live_... ./scripts/smoke/config.sh

set -euo pipefail
: "${API_URL:?need API_URL}"
: "${KEY:?need KEY}"

echo "→ valid key"
curl -fsS -H "X-Hospital-Key: $KEY" "$API_URL/api/v1/config" | jq .

echo "→ no key (expect 401)"
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/api/v1/config"

echo "→ wrong key (expect 401)"
curl -s -o /dev/null -w "%{http_code}\n" -H "X-Hospital-Key: dsk_live_invalid" "$API_URL/api/v1/config"
```

- [ ] **Step 2: `heartbeat.sh`**

```bash
#!/usr/bin/env bash
# scripts/smoke/heartbeat.sh
# Usage: API_URL=http://localhost:3000 KEY=dsk_live_... ./scripts/smoke/heartbeat.sh

set -euo pipefail
: "${API_URL:?need API_URL}"
: "${KEY:?need KEY}"

echo "→ heartbeat (expect 204)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "X-Hospital-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"appVersion":"smoke-test","userCount":1}' \
  "$API_URL/api/v1/heartbeat"
```

- [ ] **Step 3: README**

```markdown
# Smoke tests

Quick sanity checks against a running `docsile-admin` instance.

```bash
chmod +x scripts/smoke/*.sh
export API_URL=http://localhost:3000
export KEY=dsk_live_<your-test-hospital-key>
./scripts/smoke/config.sh
./scripts/smoke/heartbeat.sh
```
```

- [ ] **Step 4: Run them against the running dev server**

```bash
chmod +x scripts/smoke/*.sh
API_URL=http://localhost:3000 KEY=<your-key> ./scripts/smoke/config.sh
API_URL=http://localhost:3000 KEY=<your-key> ./scripts/smoke/heartbeat.sh
```

Expected: config returns JSON, then `401`, then `401`. Heartbeat returns `204`.

- [ ] **Step 5: Run the full unit test suite — must all pass**

```bash
npm test
```

Expected: All test files pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "test: API smoke scripts"
```

---

## Self-Review

A quick check after the plan is written, against the spec and against the "no placeholders" rule.

**Spec coverage:**

- ✅ Tenant registry (hospitals table + UI) → Tasks 3, 17, 18, 19
- ✅ Plan-based module access → Tasks 8, 9, 16, 20
- ✅ Dev-team login + auth → Tasks 5, 6, 11, 12, 14
- ✅ Per-hospital API keys → Tasks 7, 21
- ✅ Encrypted secret storage + re-auth reveal → Tasks 4, 22, 23
- ✅ Audit log → Tasks 11, 27 (+ writes embedded in every state-changing action)
- ✅ Onboarding checklist + Mark Active → Task 24
- ✅ Env-var bundle export → Task 18 (during create); persistent re-display via Secrets tab — **partial gap**: spec section 6 also lists "Copy .env block" on hospital detail post-create as a permanent button. Add quick item below.
- ✅ Dev users CRUD → Task 26
- ✅ Settings page → Task 28
- ✅ Public `/api/v1/config` → Task 30
- ✅ Public `/api/v1/heartbeat` → Task 31
- ✅ Rate limiting → Task 10, applied in Task 29
- ❌ GST invoicing (spec section 7) — **Out of scope for Plan A**, deferred to Plan B/Phase 2 as agreed during brainstorming. The `AppSettings` rows that feed invoices are seeded in Task 28.
- ❌ HMS-side integration (`admin-client.ts`, module gate, banner) → **Plan B**.

**Gap added:** the "Copy .env block" permanent button on hospital detail (Overview tab) is **not** explicitly in any task. Below is an addendum task to plug that gap.

**Placeholder scan:**

- No "TBD", "TODO", or "fill in" remain in any task.
- Every code block is real (paste-and-run-able).
- One discoverable wart: Task 18 has a Step 1 that builds the action, then Step 2 retroactively adds an `encrypt(jwtSecret)` line. Better presentation would have folded this in to Step 1 — but the executing engineer will catch it and the integrity is preserved.

**Type consistency:**

- `EnvBundle` (Task 18) → consumed by `EnvBundleReveal` (Task 18) ✓
- `SessionPayload.role` (Task 5) → `requireRole` (Task 12) → `Sidebar` role prop (Task 15) all use `"SUPER_ADMIN" | "ADMIN" | "VIEWER"` ✓
- `computeEnabledModules` signature (Task 9) → used by `PlanTabForm` (Task 20) and `config` route (Task 30) — identical shape ✓
- `authenticateRequest` return shape (Task 29) → consumed by both route handlers (30, 31) — `auth.ok`, `auth.hospital`, `auth.status` all match ✓

---

### Addendum Task 33: "Copy .env block" button on Overview tab

The full key isn't recoverable, but the rest of the env block can be reconstructed from stored fields for ops convenience.

**Files:**
- Modify: `src/app/(admin)/hospitals/[id]/page.tsx`
- Create: `src/app/(admin)/hospitals/[id]/components/EnvBlockButton.tsx`

- [ ] **Step 1: Component**

```tsx
// src/app/(admin)/hospitals/[id]/components/EnvBlockButton.tsx
"use client";
import { useState } from "react";

export function EnvBlockButton({ adminApiUrl, hospitalCode }: {
  adminApiUrl: string;
  hospitalCode: string;
}) {
  const [copied, setCopied] = useState(false);
  const block = [
    `# docsile-hms env for hospital: ${hospitalCode}`,
    `ADMIN_API_URL=${adminApiUrl}`,
    `ADMIN_API_KEY=<paste a key from API Keys tab — generate new one if lost>`,
    `JWT_SECRET=<paste from Secrets tab → hmsJwtSecret>`,
    `NEXT_PUBLIC_SUPABASE_URL=<paste from Secrets tab → supabaseDbUrl>`,
    `SUPABASE_ANON_KEY=<paste from Secrets tab → supabaseAnonKey>`,
    `SUPABASE_SERVICE_KEY=<paste from Secrets tab → supabaseServiceKey>`,
  ].join("\n");
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(block);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded border px-3 py-2 text-sm"
    >
      {copied ? "Copied env template!" : "Copy .env template"}
    </button>
  );
}
```

- [ ] **Step 2: Render on Overview**

In `src/app/(admin)/hospitals/[id]/page.tsx`, at the top of the JSX:

```tsx
import { EnvBlockButton } from "./components/EnvBlockButton";

// inside the component:
<div className="mb-4">
  <EnvBlockButton
    adminApiUrl={process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3000"}
    hospitalCode={h.code}
  />
</div>
```

- [ ] **Step 3: Verify**

Overview tab shows "Copy .env template" button. Clicking copies a template with placeholders the operator fills in from the Secrets / API Keys tabs.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/hospitals/[id]/"
git commit -m "feat: persistent .env template button on Overview"
```

---

## Done — what you have at the end of Plan A

After 33 tasks:

- A running `docsile-admin` Next.js app at `http://localhost:3000` (production: `https://admin.docsile.in`)
- 10 tables in admin Postgres, all migrated
- Dev users can log in and manage hospitals, plans, API keys, and encrypted secrets
- A hospital can be provisioned end-to-end (3-step wizard → env bundle → manual Supabase/Vercel setup → first heartbeat → Mark Active)
- The public API endpoints `GET /api/v1/config` and `POST /api/v1/heartbeat` work and are rate-limited
- Every state change is audit-logged

**Next:** Plan B — `docsile-hms` admin integration (`admin-client.ts`, module gate in middleware, billing banner, route-to-module map). Build that after Plan A is deployed and you've verified the public API by hand.








