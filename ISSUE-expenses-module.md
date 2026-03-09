# Feature: Expenses Module

## Overview

A comprehensive **Expenses** module that allows doctors/hospital administrators to track, categorize, and analyze all hospital expenses. The module includes **configurable expense categories**, expense entry with full CRUD operations, and **rich charts & analytics** for financial insights.

**Route:** `/(hospital)/expenses`

---

## Core Functionality

### 1. Expense Categories (Configurable)

Doctors/admins can create, edit, and delete their own expense categories to match their specific needs.

**Default Categories (pre-seeded, editable):**

| Category           | Description                                      |
| ------------------ | ------------------------------------------------ |
| Rent               | Clinic/hospital rent payments                    |
| Salaries           | Staff salaries and wages                         |
| Equipment          | Medical equipment purchases and maintenance      |
| Medicines & Supply | Medicine stock, consumables, surgical supplies    |
| Utilities          | Electricity, water, internet, phone bills        |
| Lab                | Lab reagents, equipment, outsourced test costs   |
| Marketing          | Advertising, website, social media               |
| Insurance          | Hospital/clinic insurance premiums               |
| Maintenance        | Building repairs, housekeeping, AMC contracts    |
| Miscellaneous      | Any uncategorized expenses                       |

**Category Management:**

- Add new category (name + optional color + optional icon)
- Edit existing category name/color/icon
- Delete category (only if no expenses are linked; otherwise prompt to reassign)
- Reorder categories via drag-and-drop
- Each category has a distinct color for use in charts
- Categories are scoped per hospital

---

### 2. Expense Entry

A simple, fast form to log an expense:

| Field         | Type            | Required | Description                                  |
| ------------- | --------------- | -------- | -------------------------------------------- |
| Date          | Date picker     | Yes      | Date of the expense                          |
| Category      | Dropdown        | Yes      | Select from configured categories            |
| Amount        | Number input    | Yes      | Expense amount in INR                        |
| Payment Mode  | Dropdown        | No       | Cash / UPI / Bank Transfer / Card / Cheque   |
| Description   | Text input      | No       | Brief note about the expense                 |
| Receipt/Bill  | File upload     | No       | Attach a photo/PDF of the bill               |
| Recurring     | Toggle          | No       | Mark as recurring (monthly/weekly/yearly)    |

**Expense List View:**

- Table/list of all expenses with columns: Date, Category, Description, Amount, Payment Mode
- Category shown as a colored badge
- Sortable by date, amount, category
- Filterable by: date range, category, payment mode
- Inline quick-edit and delete actions
- Bulk delete option with confirmation

**Recurring Expenses:**

- When marked as recurring, the system auto-creates expense entries on the configured schedule
- Recurring expenses show a recurring icon/badge in the list
- Option to stop/pause a recurring expense

---

### 3. Charts & Analytics Dashboard

The analytics section lives within the same module (as a tab or toggle view) and provides visual insights into spending patterns.

#### Summary Cards (Top Row)

| Card                    | Description                                  |
| ----------------------- | -------------------------------------------- |
| Total Expenses (Month)  | Sum of all expenses in the current month     |
| Total Expenses (Year)   | Sum of all expenses in the current year      |
| Highest Category        | Category with the most spending this month   |
| Month-over-Month Change | Percentage change from last month            |

#### Charts

1. **Category-wise Pie/Donut Chart**
   - Breakdown of expenses by category for the selected period
   - Clickable slices to drill down into that category's expenses
   - Shows percentage and absolute amount per category

2. **Monthly Trend Line Chart**
   - Line/bar chart showing total expenses per month (last 12 months)
   - Option to overlay multiple categories for comparison
   - Hover tooltips with exact amounts

3. **Category-wise Bar Chart**
   - Horizontal or vertical bar chart comparing spending across categories
   - For the selected time period (week / month / quarter / year)

4. **Daily Expenses Timeline**
   - Bar chart showing daily expense totals for the current month
   - Helps identify spending spikes

5. **Year-over-Year Comparison**
   - Compare current year vs previous year spending by month
   - Side-by-side or overlaid bar chart

#### Filters for Analytics

- Date range picker (preset: This Week, This Month, This Quarter, This Year, Custom Range)
- Category filter (multi-select)
- Payment mode filter

---

## UI / UX Requirements

### Layout

- Two main views toggled via tabs: **Expenses** (list/entry) | **Analytics** (charts/dashboard)
- Clean white background with subtle gray borders (consistent with existing modules)
- Use the existing `SectionHeader` component for section headers
- Responsive: works well on desktop and tablet

### Expenses Tab

- "Add Expense" button (prominent, top-right) opens a slide-over panel or modal form
- Expense list as a clean data table with pagination
- Quick filters bar above the table (date range, category, payment mode)
- Empty state with helpful message when no expenses exist
- Loading skeletons while fetching data

### Analytics Tab

- Summary cards at the top in a responsive grid (2x2 on mobile, 4 across on desktop)
- Charts arranged in a grid layout below the summary cards
- Each chart in its own card with a title and optional "View Details" link
- Date range picker at the top that applies to all charts simultaneously
- Smooth animations on chart load and filter changes

### Category Management

- Accessible via a "Manage Categories" button or settings icon in the Expenses tab
- Opens a modal/slide-over with the list of categories
- Inline editing with color picker
- Drag handle for reordering

### Data Presentation

- Currency formatting (INR with commas: 1,00,000)
- Consistent date formatting throughout
- Color-coded category badges matching the category colors
- Status badges for recurring expenses

### Export

- "Export" button to download expenses as CSV or Excel for the selected filters/date range
- "Print Report" for the analytics dashboard (charts + summary)

---

## Technical Notes

### File Structure

```
src/app/(hospital)/expenses/
  page.tsx                              # Main expenses page with tab navigation
  components/
    ExpenseForm.tsx                     # Add/edit expense form (modal or slide-over)
    ExpenseTable.tsx                    # Expense list table with sorting/filtering
    ExpenseFilters.tsx                  # Filter bar (date range, category, payment mode)
    CategoryManager.tsx                 # Category CRUD modal
    CategoryBadge.tsx                   # Colored badge for category display
    RecurringBadge.tsx                  # Badge/icon for recurring expenses
    analytics/
      AnalyticsDashboard.tsx           # Main analytics container
      SummaryCards.tsx                  # Top-row summary stat cards
      CategoryPieChart.tsx             # Pie/donut chart by category
      MonthlyTrendChart.tsx            # Monthly expense trend line/bar chart
      CategoryBarChart.tsx             # Category comparison bar chart
      DailyTimelineChart.tsx           # Daily expenses bar chart
      YearComparisonChart.tsx          # Year-over-year comparison chart
      AnalyticsFilters.tsx             # Date range and category filters for analytics
```

### Database Schema

```
expense_categories
  id              UUID        PK
  hospital_id     UUID        FK -> hospitals.id
  name            VARCHAR
  color           VARCHAR     (hex code)
  icon            VARCHAR     (optional icon identifier)
  sort_order      INTEGER
  created_at      TIMESTAMP
  updated_at      TIMESTAMP

expenses
  id              UUID        PK
  hospital_id     UUID        FK -> hospitals.id
  category_id     UUID        FK -> expense_categories.id
  amount          DECIMAL
  date            DATE
  description     TEXT
  payment_mode    VARCHAR     (cash, upi, bank_transfer, card, cheque)
  receipt_url     VARCHAR     (file storage URL, nullable)
  is_recurring    BOOLEAN     DEFAULT false
  recurrence      VARCHAR     (monthly, weekly, yearly - nullable)
  created_by      UUID        FK -> users.id
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
```

### API Endpoints Needed

**Categories:**

- `GET /api/expenses/categories` - List all categories for the hospital
- `POST /api/expenses/categories` - Create a new category
- `PUT /api/expenses/categories/{id}` - Update a category
- `DELETE /api/expenses/categories/{id}` - Delete a category (with reassign check)
- `PUT /api/expenses/categories/reorder` - Update sort order of categories

**Expenses:**

- `GET /api/expenses?dateFrom=&dateTo=&category=&paymentMode=&page=&limit=` - List expenses (paginated, filterable)
- `POST /api/expenses` - Create a new expense
- `PUT /api/expenses/{id}` - Update an expense
- `DELETE /api/expenses/{id}` - Delete an expense
- `DELETE /api/expenses/bulk` - Bulk delete expenses

**Analytics:**

- `GET /api/expenses/analytics/summary?dateFrom=&dateTo=` - Summary cards data (totals, highest category, MoM change)
- `GET /api/expenses/analytics/by-category?dateFrom=&dateTo=` - Category-wise breakdown for pie/bar charts
- `GET /api/expenses/analytics/monthly-trend?year=` - Monthly totals for trend chart
- `GET /api/expenses/analytics/daily?month=&year=` - Daily totals for timeline chart
- `GET /api/expenses/analytics/year-comparison?year1=&year2=` - Year-over-year data

**Export:**

- `GET /api/expenses/export?format=csv|xlsx&dateFrom=&dateTo=&category=` - Download expenses

### Dependencies

- Reuses existing UI components: `Button`, `Input`, `Select`, `Tabs`, `Card`, `Badge`, `Skeleton`, `Modal`
- Existing `SectionHeader` component for section titles
- **Charting library:** Recharts (already used or add as new dependency)
- **File upload:** Reuse existing file upload infrastructure for receipt attachments
- Follows the same data fetching patterns used in other modules

---

## Priority

**Medium-High** - Expense tracking is essential for financial management of the hospital/clinic. Combined with analytics, it provides actionable insights into spending patterns and helps doctors manage their practice finances effectively.

---

## Acceptance Criteria

- [ ] Default expense categories are pre-seeded on first load
- [ ] Admin can create, edit, delete, and reorder expense categories
- [ ] Deleting a category with linked expenses prompts reassignment
- [ ] Expense form validates all required fields before submission
- [ ] Expenses can be created, edited, and deleted
- [ ] Expense list supports sorting by date, amount, and category
- [ ] Expense list supports filtering by date range, category, and payment mode
- [ ] Recurring expenses are auto-created on schedule
- [ ] Receipt/bill file upload works and files are viewable
- [ ] Analytics summary cards show correct totals and month-over-month change
- [ ] Category-wise pie/donut chart renders correctly with clickable drill-down
- [ ] Monthly trend chart shows last 12 months of data
- [ ] Category bar chart compares spending across categories
- [ ] Daily timeline chart shows current month's daily totals
- [ ] Year-over-year comparison chart works for any two years
- [ ] Analytics filters (date range, category) apply to all charts
- [ ] Export to CSV/Excel works with applied filters
- [ ] All sections handle empty states gracefully
- [ ] UI is responsive and consistent with existing modules
- [ ] Currency is formatted in INR with proper comma placement
