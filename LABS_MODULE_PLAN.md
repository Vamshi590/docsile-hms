# Labs Module - Implementation Plan

## Overview

The Labs module enables hospitals to configure multiple laboratory facilities, assign investigations to specific labs with pricing, and automatically segregate patient investigations into per-lab bills when a patient arrives at the lab counter.

---

## Core Concepts

### 1. Lab Configuration
- A hospital can have **multiple labs** (e.g., "Pathology Lab", "Radiology", "Eye Diagnostics")
- Each lab has a name, description, and active/inactive status
- Labs can be managed from the Settings or a dedicated Labs admin page

### 2. Lab-Investigation Mapping
- Each lab is configured with a set of investigations it can perform
- Each mapping includes the **price** for that investigation at that lab
- The same investigation CAN exist in multiple labs (e.g., two labs both do CBC) - this allows flexibility
- If an investigation is mapped to only one lab, routing is automatic
- If mapped to multiple labs, the system picks based on a priority/default flag or lets the user choose

### 3. Doctor Prescription Flow (Enhancement)
- Doctor continues to select investigations from `InvestigationMaster` as today
- No change to the doctor's workflow - they don't need to know which lab handles what
- Investigations are stored in the prescription as they are today (JSON)

### 4. Lab Counter / Billing Flow (New)
- Lab technician/receptionist searches by **Patient ID**
- System fetches the patient's latest prescription and extracts investigations
- Investigations are **auto-segregated** by lab based on the lab-investigation mapping
- A **bill per lab** is generated showing:
  - Lab name
  - List of investigations with amounts
  - Subtotal, discount, total
- Technician can review, adjust (remove items if patient declines), and confirm billing
- On confirmation, lab bills are saved and linked to the patient/prescription

---

## Database Schema Changes

### New Models

```prisma
model Lab {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  location    String?           // e.g., "Ground Floor, Room 5"
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  investigations LabInvestigation[]
  labBills       LabBill[]
}

model LabInvestigation {
  id              String  @id @default(cuid())
  labId           String
  investigationId String
  amount          Float                   // Price for this investigation at this lab
  isDefault       Boolean @default(false) // If investigation exists in multiple labs, which is default
  isActive        Boolean @default(true)

  lab             Lab                @relation(fields: [labId], references: [id])
  investigation   InvestigationMaster @relation(fields: [investigationId], references: [id])

  @@unique([labId, investigationId])
}

model LabBill {
  id               String   @id @default(cuid())
  billNumber       String   @unique        // Auto-generated: LB-YYYYMMDD-XXXX
  labId            String
  patientId        String
  prescriptionId   String

  subtotal         Float    @default(0)
  discount         Float    @default(0)
  discountReason   String?
  total            Float    @default(0)
  amountPaid       Float    @default(0)
  balanceDue       Float    @default(0)

  paymentMode      String?                 // Cash, UPI, Card, etc.
  paymentDate      DateTime?
  status           String   @default("PENDING")  // PENDING, PAID, PARTIAL, CANCELLED

  notes            String?
  createdBy        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  lab              Lab      @relation(fields: [labId], references: [id])
  patient          Patient  @relation(fields: [patientId], references: [id])
  prescription     Prescription @relation(fields: [prescriptionId], references: [id])
  items            LabBillItem[]
  payments         LabPayment[]
}

model LabBillItem {
  id              String  @id @default(cuid())
  labBillId       String
  investigationId String
  name            String          // Investigation name (denormalized for history)
  amount          Float
  sortOrder       Int     @default(0)

  labBill         LabBill @relation(fields: [labBillId], references: [id])
}

model LabPayment {
  id          String   @id @default(cuid())
  labBillId   String
  amount      Float
  paymentMode String
  paymentRef  String?
  receivedBy  String?
  paymentDate DateTime @default(now())
  notes       String?

  labBill     LabBill  @relation(fields: [labBillId], references: [id])
}
```

### Changes to Existing Models

```prisma
// Add relation to InvestigationMaster
model InvestigationMaster {
  // ... existing fields ...
  labInvestigations LabInvestigation[]
}

// Add relation to Patient
model Patient {
  // ... existing fields ...
  labBills LabBill[]
}

// Add relation to Prescription
model Prescription {
  // ... existing fields ...
  labBills LabBill[]
}
```

---

## Module Structure (File System)

```
src/app/(hospital)/labs/
  page.tsx                          -- Labs module entry page
  actions.ts                        -- Server actions for labs
  components/
    LabsPage.tsx                    -- Main page with tabs

    -- Admin/Config Tab --
    LabConfigTab.tsx                -- Lab management tab
    LabForm.tsx                     -- Create/Edit lab dialog
    LabInvestigationConfig.tsx      -- Configure investigations per lab

    -- Lab Billing Tab --
    LabBillingTab.tsx               -- Patient search + billing
    PatientInvestigationSearch.tsx  -- Search by patient ID
    LabBillCard.tsx                 -- Per-lab bill card (shows items, total)
    LabBillConfirmDialog.tsx        -- Confirm & process payment

    -- Lab Bills History Tab --
    LabBillsHistory.tsx             -- View past lab bills
    LabBillDetail.tsx               -- Detail view of a bill
```

---

## UI Design

### Tab 1: Lab Configuration

#### Labs List
| Lab Name         | Location            | Investigations | Status | Actions      |
|------------------|---------------------|----------------|--------|--------------|
| Pathology Lab    | Ground Floor, Rm 5  | 8              | Active | Edit, Config |
| Radiology        | First Floor, Rm 12  | 5              | Active | Edit, Config |
| Eye Diagnostics  | Ground Floor, Rm 3  | 6              | Active | Edit, Config |

- **Add Lab** button opens a form dialog (name, description, location)
- **Config** button opens investigation mapping panel

#### Investigation Configuration (per lab)
- Shows all active investigations from `InvestigationMaster`
- Toggle which ones this lab handles
- Set price for each enabled investigation
- Mark one as "default" if same investigation exists in another lab

### Tab 2: Lab Billing (Main Workflow)

#### Step 1: Patient Search
- Search input for Patient ID (with autocomplete)
- On selection, show patient info card (name, age, gender, doctor)
- System fetches latest prescription with investigations

#### Step 2: Auto-Segregated Bills
- Investigations grouped by lab automatically
- Each lab shown as a separate card:

```
+------------------------------------------+
| Pathology Lab                            |
| Ground Floor, Room 5                     |
|------------------------------------------|
| Investigation          | Amount          |
|------------------------|-----------------|
| CBC                    | 500.00          |
| RBS                    | 200.00          |
| HbA1c                  | 800.00          |
|------------------------|-----------------|
| Subtotal               | 1,500.00        |
| Discount               | 0.00            |
| Total                  | 1,500.00        |
+------------------------------------------+
| [ Remove Items ] [ Process Payment ]     |
+------------------------------------------+

+------------------------------------------+
| Eye Diagnostics                          |
| Ground Floor, Room 3                     |
|------------------------------------------|
| Investigation          | Amount          |
|------------------------|-----------------|
| OCT Macula             | 1,200.00        |
| Visual Field           | 1,000.00        |
|------------------------|-----------------|
| Subtotal               | 2,200.00        |
| Discount               | 0.00            |
| Total                  | 2,200.00        |
+------------------------------------------+
| [ Remove Items ] [ Process Payment ]     |
+------------------------------------------+
```

- **Unmapped investigations** (not configured in any lab) shown in a separate "Unassigned" section with a warning
- Each card has: remove items toggle, discount field, payment mode selector
- "Process All" button to bill all labs at once, or process individually

#### Step 3: Payment
- Per-lab or combined payment
- Payment modes: Cash, UPI, Card, Cheque, Online, NEFT (same as existing)
- Print receipt per lab or combined

### Tab 3: Lab Bills History
- Searchable/filterable table of past lab bills
- Filters: date range, lab, patient, status (Pending/Paid/Partial/Cancelled)
- Click to view detail + reprint receipt

---

## Server Actions

```typescript
// === Lab Configuration ===
createLab(data: { name, description?, location? })
updateLab(id: string, data: { name?, description?, location?, isActive? })
getLabs()                    // Get all labs with investigation count
getLabById(id: string)       // Get single lab with investigations

// === Lab Investigation Mapping ===
updateLabInvestigations(labId: string, investigations: {
  investigationId: string
  amount: number
  isDefault: boolean
}[])
getLabInvestigations(labId: string)  // Get investigations for a lab

// === Lab Billing ===
getPatientInvestigations(patientId: string)
  // 1. Fetch patient's latest prescription
  // 2. Extract investigations from JSON
  // 3. Look up each investigation in LabInvestigation mapping
  // 4. Group by lab
  // 5. Return segregated data with amounts

createLabBills(data: {
  patientId: string
  prescriptionId: string
  bills: {
    labId: string
    items: { investigationId: string, name: string, amount: number }[]
    discount?: number
    discountReason?: string
    paymentMode: string
    amountPaid: number
  }[]
})

// === Lab Bills History ===
getLabBills(filters: { dateFrom?, dateTo?, labId?, patientId?, status? })
getLabBillById(id: string)
```

---

## Segregation Logic (Core Algorithm)

```
Input: List of investigation names from prescription JSON

For each investigation:
  1. Find matching InvestigationMaster record by name
  2. Find LabInvestigation mappings for that investigation
  3. If exactly one mapping -> assign to that lab
  4. If multiple mappings -> assign to the one marked isDefault=true
  5. If no default set -> assign to first active mapping
  6. If no mapping at all -> add to "Unassigned" group

Output: Map<labId, { lab: Lab, items: { investigation, amount }[] }>
  + unassigned: { investigation, amount: 0 }[]
```

---

## Navigation & Access

- Add "Labs" to the hospital sidebar navigation
- Accessible by roles: ADMIN, RECEPTIONIST (and optionally a new LAB_TECHNICIAN role)
- Route: `/labs`

---

## Edge Cases to Handle

1. **Investigation not mapped to any lab** - Show in "Unassigned" section with warning; allow manual lab assignment
2. **Investigation mapped to multiple labs with no default** - Pick first active; allow user override
3. **Patient has no investigations** - Show message "No investigations found for this patient"
4. **Patient has existing lab bills for same prescription** - Show warning; allow viewing existing bills or creating new ones
5. **Lab deactivated after mapping** - Skip inactive labs during segregation; show warning
6. **Price changed after bill created** - Bills store denormalized amounts; historical bills unaffected
7. **Partial payment** - Support partial payments with balance tracking (same pattern as existing billing)

---

## Implementation Order

### Phase 1: Database & Backend
1. Add new models to Prisma schema
2. Run migration
3. Seed sample labs and lab-investigation mappings
4. Implement server actions for lab CRUD and investigation mapping

### Phase 2: Lab Configuration UI
5. Create labs route and page structure
6. Build Lab Configuration tab (CRUD labs)
7. Build Investigation Configuration panel (map investigations to labs with pricing)

### Phase 3: Lab Billing UI
8. Build Patient Search component
9. Implement segregation logic (server action)
10. Build Lab Bill Cards with auto-segregation display
11. Build payment/confirmation flow
12. Print receipt support

### Phase 4: History & Polish
13. Build Lab Bills History tab
14. Add Labs to sidebar navigation
15. Handle edge cases and validation
16. Testing and refinement

---

## Questions / Decisions Needed

1. **Should we add a LAB_TECHNICIAN role?** Or reuse RECEPTIONIST for lab billing?
2. **Should labs have their own bill number sequence?** (Proposed: LB-YYYYMMDD-XXXX)
3. **Combined receipt or per-lab receipt?** (Proposed: support both)
4. **Should the doctor see lab prices?** Or keep pricing hidden from the prescription form?
5. **Lab results/reports** - Should this module also track test results, or is that a future phase?
6. **Should we allow editing investigation prices at billing time?** (Override the configured amount for a specific patient)
