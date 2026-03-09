# Feature: Patient Reports Module

## Overview

A unified **Reports** module that serves as a comprehensive patient history dashboard. Search for any patient by **Patient ID** or **Mobile Number** and instantly view their complete medical and financial history across the hospital system.

**Route:** `/(hospital)/reports`

---

## Core Functionality

### 1. Patient Search

- Single search bar at the top of the page (prominent, centered, with a clean minimal design)
- Search by **Patient ID** or **Mobile Number**
- Debounced search with typeahead suggestions showing matching patients (name, ID, phone)
- On selection, the full patient report loads below

### 2. Patient Summary Card

Once a patient is selected, display a summary card at the top:

| Field             | Description                              |
| ----------------- | ---------------------------------------- |
| Patient Name      | Full name                                |
| Patient ID        | Unique hospital ID                       |
| Mobile Number     | Primary contact                          |
| Age / Gender      | Demographics                             |
| Total Visits      | Count of all OPD + IPD visits            |
| Total Dues        | Outstanding balance across all bills     |
| Last Visit Date   | Most recent visit timestamp              |
| Registration Date | When the patient was first registered    |

---

## Report Sections (Tabs or Collapsible Sections)

### 3. Visit History

- Chronological list of **all OPD visits**
- Each entry shows: date, doctor name, department, chief complaint
- Expandable to view visit details

### 4. Prescriptions

- All **outpatient prescriptions** across every visit
- Grouped by visit date
- Each prescription shows: date, doctor, medications list (drug name, dosage, frequency, duration)
- Option to view/download prescription as PDF

### 5. Inpatient Records

- List of all **inpatient admissions**
- Each record shows: admission date, discharge date, ward/bed, admitting doctor, diagnosis
- Sub-sections per admission:
  - **Inpatient Prescriptions** - all medications prescribed during the stay
  - **Discharge Summary** - full discharge summary with diagnosis, treatment given, instructions, follow-up

### 6. Lab Records

- All **lab bills and test results** for the patient
- Each entry shows: date, lab name, tests ordered, status (completed/pending), amount
- Expandable to view individual test results/values if available

### 7. Billing & Dues

- Consolidated financial overview:
  - **Total Billed** - sum of all OPD, IPD, and lab bills
  - **Total Paid** - sum of all payments received
  - **Total Dues** - outstanding amount
  - **Payment History** - chronological list of all payments
- Breakdown by category (OPD / IPD / Lab)
- Status indicators: Paid, Partial, Pending, Cancelled
- Highlight overdue amounts

---

## UI / UX Requirements

### Layout

- Clean white background with subtle gray borders (consistent with existing modules)
- Use the existing `SectionHeader` component for each section header
- Responsive: works well on both desktop and tablet screens

### Search Bar

- Large, centered search input with a search icon
- Placeholder: "Search by Patient ID or Mobile Number..."
- Show a subtle empty state illustration/message before any search
- Loading skeleton while fetching results

### Patient Report View

- Tab-based navigation for the sections (Visits | Prescriptions | Inpatient | Labs | Billing)
- Each tab loads data lazily (only fetch when the tab is activated)
- Use cards for individual records, with expand/collapse for details
- Consistent date formatting throughout
- Color-coded status badges (green for paid/completed, yellow for partial/pending, red for overdue, gray for cancelled)

### Data Presentation

- Empty states with helpful messages when a section has no data (e.g., "No inpatient records found for this patient")
- Pagination or infinite scroll for sections with many records
- Sort options (newest first / oldest first) on each section

### Print / Export

- "Print Report" button to generate a printable summary of the full patient report
- Individual section export (e.g., download all prescriptions, download billing summary)

---

## Technical Notes

### File Structure

```
src/app/(hospital)/reports/
  page.tsx                          # Main reports page
  components/
    PatientSearch.tsx               # Search bar with typeahead
    PatientSummaryCard.tsx          # Summary card after selection
    VisitHistoryTab.tsx             # OPD visit history
    PrescriptionsTab.tsx            # All prescriptions
    InpatientRecordsTab.tsx         # IPD records + discharge summaries
    LabRecordsTab.tsx               # Lab bills and results
    BillingTab.tsx                  # Financial overview and dues
```

### API Endpoints Needed

- `GET /api/reports/patient/search?q={query}` - Search patients by ID or mobile
- `GET /api/reports/patient/{patientId}/summary` - Patient summary stats
- `GET /api/reports/patient/{patientId}/visits` - Visit history (paginated)
- `GET /api/reports/patient/{patientId}/prescriptions` - All prescriptions (paginated)
- `GET /api/reports/patient/{patientId}/inpatient` - Inpatient records with discharge summaries
- `GET /api/reports/patient/{patientId}/labs` - Lab records (paginated)
- `GET /api/reports/patient/{patientId}/billing` - Billing summary and payment history

### Dependencies

- Reuses existing UI components: `Button`, `Input`, `Select`, `Tabs`, `Card`, `Badge`, `Skeleton`
- Existing `SectionHeader` component for section titles
- Follows the same data fetching patterns used in `labs/`, `patients/`, `inpatients/` modules

---

## Priority

**High** - This module consolidates scattered patient data into a single view, improving clinical workflow and reducing time spent navigating between modules.

---

## Acceptance Criteria

- [ ] Search by Patient ID returns correct patient
- [ ] Search by Mobile Number returns correct patient
- [ ] Patient summary card displays accurate visit count and dues
- [ ] Visit history shows all OPD visits chronologically
- [ ] Prescriptions tab shows all outpatient prescriptions grouped by visit
- [ ] Inpatient tab shows all admissions with prescriptions and discharge summaries
- [ ] Lab records tab shows all lab bills and test details
- [ ] Billing tab shows correct totals and payment history
- [ ] All sections handle empty states gracefully
- [ ] Print/export functionality works for full report and individual sections
- [ ] UI is responsive and consistent with existing modules
