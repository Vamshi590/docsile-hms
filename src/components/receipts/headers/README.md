# Hospital Receipt Headers

Each hospital can have its own custom receipt header. If no custom header exists, the `DefaultHeader` is used automatically.

## How to Add a New Hospital Header

### 1. Create the header file

Create a new `.tsx` file in this folder (`src/components/receipts/headers/`).
Name it after the hospital (e.g., `CityEyeClinic.tsx`).

```tsx
"use client"

import type { HospitalHeaderProps } from "../ReceiptHeader"

export default function CityEyeClinicHeader({ hospital }: HospitalHeaderProps) {
  return (
    <div className="pb-2 mb-2 border-b-2 border-black">
      {/* Your custom header layout here */}
      <h1 className="text-lg font-bold text-center">CITY EYE CLINIC</h1>
      <p className="text-[10px] text-center">123 Main Street, Hyderabad</p>
    </div>
  )
}
```

**Rules:**
- Must be a `"use client"` component
- Must accept `{ hospital }: HospitalHeaderProps` as props
- Must `export default` the component
- The `hospital` prop gives you access to DB fields (`name`, `displayName`, `address`, `phone`, `email`, `website`, `registrationNo`, `logoUrl`) — use them or hardcode values as needed

### 2. Register it in `registry.ts`

Open `registry.ts` and:

1. Import your component at the top:
   ```ts
   import CityEyeClinicHeader from "./CityEyeClinic"
   ```

2. Add an entry to `headerRegistry` — the key must match the hospital's `name` field in the DB (lowercase):
   ```ts
   const headerRegistry: Record<string, ComponentType<HospitalHeaderProps>> = {
     "sri harsha eye hospital": SriHarshaEyeHospitalHeader,
     "city eye clinic": CityEyeClinicHeader,  // <-- add this
   }
   ```

That's it. All receipts (Cash, Prescription, Readings, etc.) will automatically use your custom header.

## Available `hospital` Props

| Field            | Type               | Description                  |
|------------------|--------------------|------------------------------|
| `name`           | `string`           | Hospital name (from DB)      |
| `displayName`    | `string \| null`   | Display name override        |
| `address`        | `string \| null`   | Full address                 |
| `phone`          | `string \| null`   | Phone number(s)              |
| `email`          | `string \| null`   | Email address                |
| `website`        | `string \| null`   | Website URL                  |
| `registrationNo` | `string \| null`  | Registration number          |
| `logoUrl`        | `string \| null`   | Logo image URL               |

## What Happens if No Custom Header Exists?

The `DefaultHeader` renders automatically using the hospital's DB fields (logo, name, address, phone, etc.). No code changes needed — it just works.

## File Structure

```
headers/
├── README.md                    ← This file
├── registry.ts                  ← Maps hospital names → components
├── DefaultHeader.tsx            ← Generic fallback header
└── SriHarshaEyeHospital.tsx     ← Example custom header
```
