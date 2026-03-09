# Dues & Follow-Ups Module

## Overview

A dedicated module to centralize and manage all **outstanding dues** (unpaid balances) and **upcoming patient follow-ups** across the hospital system. The module provides a single dashboard with two tabs — **Dues** and **Follow-Ups** — enabling staff to track payments owed and patients due for return visits.

**Route:** `/dues-followups`
**Location:** `src/app/(hospital)/dues-followups/`

---

## Module Layout

### Header

- Module title: **"Dues & Follow-Ups"**
- Two tabs at the top to switch between views:
  - **Dues** (default active tab)
  - **Follow-Ups**
- Active tab is visually highlighted (underline/bold style consistent with existing app patterns)

---

## Tab 1: Dues

### Purpose

Display all patients (OPD and IPD) who have an outstanding balance/due amount from services rendered.

### Data Sources

1. **OPD Dues (Patients Module)**
   - Source: `Prescription` records where `balanceDue > 0`
   - Fields: `prescriptionNumber`, `total`, `amountPaid`, `balanceDue`, `status`, `prescriptionDate`
   - Linked patient: `Patient` → `name`, `phone`, `patientId`, `uhid`
   - Service items: `InvoiceItem[]` → `description`, `category`, `amount`

2. **IPD Dues (Inpatients Module)**
   - Source: `InPatient` records where `balanceAmount > 0`
   - Fields: `packageAmount`, `discount`, `netAmount`, `totalReceivedAmount`, `balanceAmount`
   - Linked patient: `Patient` → `name`, `phone`, `patientId`, `uhid`
   - Package info: `packageInclusions` (JSON)

### Display Columns

| Column | Description |
|--------|-------------|
| Patient Name | Full name of the patient |
| Patient ID / UHID | Unique identifier |
| Phone Number | Contact number |
| Type | Badge showing **OPD** or **IPD** |
| Services / Package | Summary of services (OPD) or package name (IPD) |
| Total Amount | Total billed amount |
| Amount Paid | Amount already received |
| Balance Due | Outstanding amount (highlighted in red) |
| Date | Date of service/admission |
| Actions | WhatsApp button, Mark as Paid, View Details |

### Filters

- **Search** — Search by patient name, phone number, or patient ID
- **Type** — Filter by `OPD`, `IPD`, or `All` (default: All)
- **Date Range** — Filter by service/billing date range
- **Sort** — Sort by due amount (high to low), date (newest/oldest)

### Actions

1. **WhatsApp Button**
   - Opens WhatsApp with a pre-filled message to the patient's phone number
   - Message template: `"Hello [Patient Name], this is a reminder from [Hospital Name]. You have an outstanding balance of Rs. [Balance Due] for services on [Date]. Please arrange for payment at your earliest convenience. Thank you."`
   - URL format: `https://wa.me/91[phone]?text=[encoded_message]`

2. **Mark as Paid**
   - Quick action to mark a due as fully paid
   - Sets `balanceDue = 0` and `amountPaid = total` (OPD)
   - Sets `balanceAmount = 0` and `totalReceivedAmount = netAmount` (IPD)
   - Records payment entry with current date

3. **View Details**
   - Navigates to the respective patient detail page (`/patients/[id]` or `/inpatients/[id]`)

### Summary Stats (Top of Dues Tab)

- **Total Outstanding** — Sum of all balance dues
- **OPD Dues** — Count and total amount
- **IPD Dues** — Count and total amount

---

## Tab 2: Follow-Ups

### Purpose

Display all patients who are due for a follow-up visit in the **next 5 days** (today + next 4 days), based on follow-up dates set in prescriptions.

### Data Sources

1. **Doctor Module Prescriptions**
   - Source: `Prescription` records where `followUpDate` falls within the next 5 days (from today to today + 4 days)
   - Fields: `followUpDate`, `diagnosis`, `doctorName`, `department`, `prescriptionDate`
   - Linked patient: `Patient` → `name`, `phone`, `patientId`, `uhid`

2. **Inpatient Module**
   - Source: `Prescription` records linked to inpatients where `followUpDate` falls within the next 5 days
   - Same fields as above, with additional context of the inpatient admission

### Display Columns

| Column | Description |
|--------|-------------|
| Patient Name | Full name of the patient |
| Patient ID / UHID | Unique identifier |
| Phone Number | Contact number |
| Follow-Up Date | Scheduled follow-up date (highlight if today or overdue) |
| Doctor | Doctor who prescribed the follow-up |
| Department | Department of consultation |
| Diagnosis / Reason | Brief diagnosis or reason for follow-up |
| Type | Badge showing **OPD** or **IPD** |
| Last Visit Date | Date of the prescription that set this follow-up |
| Actions | WhatsApp button, View Details |

### Filters

- **Search** — Search by patient name, phone number, or patient ID
- **Type** — Filter by `OPD`, `IPD`, or `All` (default: All)
- **Doctor** — Filter by doctor name (dropdown)
- **Date** — Filter by specific follow-up date or range within the 5-day window
- **Department** — Filter by department
- **Include Overdue** — Toggle to also show past follow-ups that were not attended (followUpDate < today and patient has no visit after that date)

### Actions

1. **WhatsApp Button**
   - Opens WhatsApp with a pre-filled reminder message
   - Message template: `"Hello [Patient Name], this is a reminder from [Hospital Name]. You have a follow-up appointment scheduled for [Follow-Up Date] with Dr. [Doctor Name]. Please visit at your convenience. Thank you."`
   - URL format: `https://wa.me/91[phone]?text=[encoded_message]`

2. **View Details**
   - Navigates to the respective patient detail page

### Summary Stats (Top of Follow-Ups Tab)

- **Today** — Count of patients due today
- **Tomorrow** — Count due tomorrow
- **Next 5 Days** — Total count in the window
- **Overdue** — Count of missed follow-ups (if toggle enabled)

---

## File Structure

```
src/app/(hospital)/dues-followups/
├── page.tsx                          # Route page (renders DuesFollowupsPage)
├── actions.ts                        # Server actions (data fetching & mutations)
└── components/
    ├── DuesFollowupsPage.tsx         # Main page component with tab switching
    ├── DuesTab.tsx                   # Dues tab content
    ├── FollowUpsTab.tsx              # Follow-ups tab content
    ├── DuesTable.tsx                 # Table component for dues list
    ├── FollowUpsTable.tsx            # Table component for follow-ups list
    ├── DuesSummaryStats.tsx          # Summary cards for dues
    ├── FollowUpsSummaryStats.tsx     # Summary cards for follow-ups
    └── WhatsAppButton.tsx            # Reusable WhatsApp action button
```

---

## Server Actions (`actions.ts`)

### `getDues(filters)`

Fetches all outstanding dues from both OPD and IPD sources.

**Parameters:**
```typescript
{
  search?: string          // Patient name, phone, or ID
  type?: "OPD" | "IPD" | "ALL"
  dateFrom?: Date
  dateTo?: Date
  sortBy?: "amount_desc" | "amount_asc" | "date_desc" | "date_asc"
}
```

**Returns:**
```typescript
{
  dues: DueRecord[]
  summary: {
    totalOutstanding: number
    opdCount: number
    opdTotal: number
    ipdCount: number
    ipdTotal: number
  }
}
```

**Logic:**
1. Query `Prescription` where `balanceDue > 0`, join with `Patient` for contact info
2. Query `InPatient` where `balanceAmount > 0`, join with `Patient` for contact info
3. Merge results into a unified `DueRecord[]` with a `type` discriminator ("OPD" | "IPD")
4. Apply filters (search, type, date range)
5. Sort by specified criteria
6. Calculate summary stats

### `getFollowUps(filters)`

Fetches all patients due for follow-up within the next 5 days.

**Parameters:**
```typescript
{
  search?: string
  type?: "OPD" | "IPD" | "ALL"
  doctor?: string
  department?: string
  dateFrom?: Date          // Default: today
  dateTo?: Date            // Default: today + 4 days
  includeOverdue?: boolean // Default: false
}
```

**Returns:**
```typescript
{
  followUps: FollowUpRecord[]
  summary: {
    todayCount: number
    tomorrowCount: number
    totalCount: number
    overdueCount: number
  }
}
```

**Logic:**
1. Query `Prescription` where `followUpDate` is between `dateFrom` and `dateTo`
2. If `includeOverdue` is true, also include records where `followUpDate < today` and the patient has no subsequent visit
3. Join with `Patient` for contact info
4. Determine type (OPD/IPD) based on whether the prescription is linked to an inpatient record
5. Apply filters
6. Calculate summary stats

### `markDueAsPaid(id, type)`

Marks a specific due as fully paid.

**Parameters:**
```typescript
{
  id: string               // Prescription ID or InPatient ID
  type: "OPD" | "IPD"
}
```

**Logic:**
- OPD: Update `Prescription` → set `amountPaid = total`, `balanceDue = 0`, create `Payment` record
- IPD: Update `InPatient` → set `totalReceivedAmount = netAmount`, `balanceAmount = 0`, append to `paymentRecords` JSON

---

## Types

```typescript
interface DueRecord {
  id: string
  type: "OPD" | "IPD"
  patientId: string
  patientName: string
  uhid: string
  phone: string
  services: string              // Comma-separated service names or package name
  totalAmount: number
  amountPaid: number
  balanceDue: number
  date: Date                    // Service date or admission date
  prescriptionNumber?: string   // For OPD
}

interface FollowUpRecord {
  id: string
  type: "OPD" | "IPD"
  patientId: string
  patientName: string
  uhid: string
  phone: string
  followUpDate: Date
  doctorName: string
  department: string
  diagnosis: string
  lastVisitDate: Date
  isOverdue: boolean
}
```

---

## Sidebar Navigation

Add a new entry in the sidebar navigation (`src/components/layout/Sidebar.tsx`):

- **Label:** "Dues & Follow-Ups"
- **Icon:** `IndianRupee` or `ClipboardList` (from lucide-react)
- **Route:** `/dues-followups`
- **Position:** After "Insurance" in the navigation order

---

## UI/UX Notes

- Follow the existing app patterns: use shadcn/ui components (`Tabs`, `Table`, `Badge`, `Button`, `Input`, `Select`)
- Use the same sticky header pattern as other modules
- Toast notifications (sonner) for actions like "Mark as Paid"
- Loading states with `Loader2` spinner
- Responsive table with horizontal scroll on smaller screens
- Color coding:
  - Due amounts in **red**
  - Follow-up today in **orange/amber**
  - Overdue follow-ups in **red**
  - Completed/paid in **green**
