# Sitha AI — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Sitha AI is a standalone Next.js marketing/communication platform that provides email delivery services to HMS deployments. V1 delivers one feature: staff-initiated transactional emails to patients using predefined templates, sent via AWS SES.

---

## Architecture

**Project:** New Next.js 15 App Router project at `~/Desktop/sitha-ai`  
**Pattern:** Monolith — admin UI + public API in one deployment  
**Database:** Supabase (same direct-client pattern as docsile-admin, PascalCase quoted table names)  
**Auth:** HS256 JWT for admin UI sessions; prefix+bcrypt API keys for HMS-facing API  
**Email provider:** AWS SES (single Sitha-owned account, shared across all hospitals)

### Two surfaces

1. **Admin UI** `/(admin)/...` — Sitha team manages hospitals, API keys, templates, send logs
2. **Public API** `/api/v1/...` — HMS deployments call this with an API key

---

## Database Schema

```sql
-- Hospitals registered in Sitha
"Hospital" (id, code, name, createdAt, updatedAt)

-- Per-hospital API keys
"ApiKey" (id, hospitalId, keyPrefix, keyHash, label, lastUsedAt, revokedAt, createdAt)

-- Shared template library (Handlebars)
"EmailTemplate" (id, code, name, subjectTemplate, bodyTemplate, isActive, createdAt, updatedAt)

-- Immutable send audit log
"EmailLog" (id, hospitalId, templateCode, toEmail, toName, status, sesMessageId, errorMessage, sentAt)
```

`status` enum: `SENT | FAILED`

---

## Public API

### Authentication

All `/api/v1/*` routes require:
```
Authorization: Bearer <sitha-api-key>
```
API key format: `prefix_secret`. Lookup by prefix, bcrypt.compare on hash.

### Endpoints

#### `POST /api/v1/email/send`

Send a templated email to a patient.

**Request:**
```json
{
  "templateCode": "payment-reminder",
  "to": { "email": "patient@example.com", "name": "Ravi Kumar" },
  "variables": {
    "patientName": "Ravi Kumar",
    "amount": "₹1,200",
    "hospitalName": "Lakshmi Eye Hospital"
  }
}
```

**Flow:**
1. Authenticate API key → resolve hospital
2. Look up `EmailTemplate` by `templateCode` (must be `isActive = true`)
3. Render subject + body via Handlebars (`{{variable}}` substitution)
4. Send via `@aws-sdk/client-ses`
5. Insert `EmailLog` row with result
6. Return `{ success: true, messageId }` or `{ success: false, error }`

**Responses:** `200 OK`, `400` (missing fields), `401` (bad key), `404` (template not found), `500` (SES failure)

#### `GET /api/v1/templates`

Returns list of active templates (used by HMS to populate template picker).

**Response:**
```json
{
  "templates": [
    { "code": "payment-reminder", "name": "Payment Reminder" },
    { "code": "appointment-confirmed", "name": "Appointment Confirmed" }
  ]
}
```

---

## Admin UI

| Route | Purpose |
|---|---|
| `/login` | Dev-user login (JWT session cookie) |
| `/hospitals` | List hospitals; create hospital; issue/revoke API keys |
| `/templates` | CRUD for email templates; live Handlebars preview with sample variables |
| `/logs` | Email send log filtered by hospital, template, status, date range |

Design system: same globals.css token set as docsile-admin (Inter, custom color palette, shadcn-compatible).

---

## Environment Variables

**Sitha AI `.env.local`:**
```
NEXT_PUBLIC_APP_URL=
JWT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
SES_FROM_EMAIL=noreply@notifications.sithaai.com
```

**HMS `.env.local` additions:**
```
SITHA_API_URL=https://sithaai.com
SITHA_API_KEY=prefix_secret
```

---

## HMS Integration

Module: `dues-followups`  
Trigger: Manual — staff clicks "Send Email" on a patient row in the Follow-ups tab

**UI flow:**
1. Staff clicks "Send Email" on a patient row
2. Modal opens — fetches active templates from `GET /api/v1/templates`
3. Staff picks a template; preview renders with patient data auto-filled
4. Staff confirms → HMS server action calls `POST /api/v1/email/send`
5. Toast notification on success/failure

**HMS server action** (`src/app/(hospital)/dues-followups/actions.ts`):
- Reads `SITHA_API_URL` + `SITHA_API_KEY` from env
- Builds variables from patient record (name, amount owed, hospital name)
- Calls Sitha API, returns result to client

If `SITHA_API_URL` is not set, the "Send Email" button is hidden (graceful degradation — hospitals without Sitha AI are unaffected).

---

## AWS SES Setup Steps

1. **Create/log in to AWS account** → navigate to SES console (region: `ap-south-1` for India)
2. **Verify sending domain** — add `notifications.sithaai.com` as an identity; AWS provides DNS records (TXT for domain ownership, CNAME for DKIM); add to your domain DNS provider
3. **Create IAM user** — attach inline policy with only `ses:SendEmail` on `arn:aws:ses:<region>:<account>:identity/*`; generate Access Key ID + Secret
4. **Request production access** — by default SES is in sandbox (can only send to verified emails); submit "Request production access" in SES console explaining use case (transactional hospital notifications)
5. **Set env vars** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `SES_FROM_EMAIL` in Sitha AI's `.env.local`

---

## Template Variable Contract

HMS passes these variables when calling `email/send`:

| Variable | Source |
|---|---|
| `patientName` | `Patient.name` |
| `patientPhone` | `Patient.phone` |
| `amount` | Outstanding balance (formatted with ₹) |
| `hospitalName` | `Hospital.name` from HMS settings |
| `date` | Today's date (formatted) |

Template authors use `{{variableName}}` syntax (Handlebars). Unknown variables render as empty string.

---

## Out of Scope (V1)

- Automatic/scheduled email triggers
- SMS or WhatsApp
- Per-hospital template customization
- Email open/click tracking
- Unsubscribe management
- Email from domains other than Sitha's own verified domain
