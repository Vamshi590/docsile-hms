"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import {
  Search, Download, FileSpreadsheet, FileText,
  Loader2, X, Calendar, Filter, ChevronDown,
  CheckSquare, Square, Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/header"
import { formatDate, formatCurrency } from "@/lib/utils"
import {
  getExportPatients,
  getExportPrescriptions,
  getExportEyeReadings,
  getExportInPatients,
  getExportInsuranceClaims,
  getExportLabBills,
  getExportPharmacyBills,
  getExportOpticalBills,
  getExportExpenses,
} from "../actions"

// ─── Tab config ─────────────────────────────────────────────────

type DataTab =
  | "patients"
  | "prescriptions"
  | "eyeReadings"
  | "inPatients"
  | "insurance"
  | "labBills"
  | "pharmacyBills"
  | "opticalBills"
  | "expenses"

type ColumnDef = {
  key: string
  label: string
  format?: "date" | "currency" | "json" | "eyeAR" | "eyeDN" | "eyeCF"
}

const TAB_CONFIG: Record<DataTab, { label: string; columns: ColumnDef[] }> = {
  patients: {
    label: "Patients",
    columns: [
      { key: "patientId", label: "Patient ID" },
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "age", label: "Age" },
      { key: "gender", label: "Gender" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Address" },
      { key: "guardianName", label: "Guardian" },
      { key: "referredBy", label: "Referred By" },
      { key: "doctorName", label: "Doctor" },
      { key: "department", label: "Department" },
      { key: "patientType", label: "Type" },
      { key: "status", label: "Status" },
      { key: "appointmentDate", label: "Appointment Date", format: "date" },
      { key: "createdAt", label: "Created At", format: "date" },
    ],
  },
  prescriptions: {
    label: "Prescriptions",
    columns: [
      { key: "prescriptionNumber", label: "Rx No." },
      { key: "patientId", label: "Patient ID" },
      { key: "patientType", label: "Type" },
      { key: "doctorName", label: "Doctor" },
      { key: "department", label: "Department" },
      { key: "diagnosis", label: "Diagnosis" },
      { key: "presentComplaint", label: "Complaint" },
      { key: "medicines", label: "Medicines", format: "json" },
      { key: "investigations", label: "Investigations", format: "json" },
      { key: "subtotal", label: "Subtotal", format: "currency" },
      { key: "discount", label: "Discount", format: "currency" },
      { key: "total", label: "Total", format: "currency" },
      { key: "amountPaid", label: "Paid", format: "currency" },
      { key: "balanceDue", label: "Balance", format: "currency" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
      { key: "prescriptionDate", label: "Date", format: "date" },
      { key: "followUpDate", label: "Follow-Up", format: "date" },
    ],
  },
  eyeReadings: {
    label: "Eye Readings",
    columns: [
      { key: "patientId", label: "Patient ID" },
      { key: "autoRefractometer", label: "Auto Refractometer", format: "eyeAR" },
      { key: "glassesReading", label: "Glasses Reading", format: "eyeDN" },
      { key: "previousPrescription", label: "Previous Rx", format: "eyeDN" },
      { key: "presentPrescription", label: "Present Rx", format: "eyeDN" },
      { key: "clinicalFindings", label: "Clinical Findings", format: "eyeCF" },
      { key: "status", label: "Status" },
      { key: "readingDate", label: "Reading Date", format: "date" },
    ],
  },
  inPatients: {
    label: "In-Patients",
    columns: [
      { key: "ipNumber", label: "IP Number" },
      { key: "patientId", label: "Patient ID" },
      { key: "name", label: "Name" },
      { key: "age", label: "Age" },
      { key: "gender", label: "Gender" },
      { key: "phone", label: "Phone" },
      { key: "department", label: "Department" },
      { key: "doctorNames", label: "Doctors" },
      { key: "operationName", label: "Operation" },
      { key: "operationDate", label: "Op. Date", format: "date" },
      { key: "packageAmount", label: "Package", format: "currency" },
      { key: "discount", label: "Discount", format: "currency" },
      { key: "netAmount", label: "Net Amount", format: "currency" },
      { key: "totalReceivedAmount", label: "Received", format: "currency" },
      { key: "balanceAmount", label: "Balance", format: "currency" },
      { key: "status", label: "Status" },
      { key: "bedNumber", label: "Bed" },
      { key: "wardName", label: "Ward" },
      { key: "admissionDate", label: "Admission", format: "date" },
      { key: "dischargeDate", label: "Discharge", format: "date" },
    ],
  },
  insurance: {
    label: "Insurance",
    columns: [
      { key: "claimNumber", label: "Claim No." },
      { key: "patientName", label: "Patient" },
      { key: "ipNumber", label: "IP Number" },
      { key: "insuranceCompanyName", label: "Insurance Co." },
      { key: "tpaName", label: "TPA" },
      { key: "policyNumber", label: "Policy No." },
      { key: "packageAmount", label: "Package", format: "currency" },
      { key: "totalBillAmount", label: "Bill Amount", format: "currency" },
      { key: "preauthAmount", label: "Preauth", format: "currency" },
      { key: "totalApprovedAmount", label: "Approved", format: "currency" },
      { key: "finalSettledAmount", label: "Settled", format: "currency" },
      { key: "patientPayableAmount", label: "Patient Pay", format: "currency" },
      { key: "patientBalance", label: "Patient Bal.", format: "currency" },
      { key: "status", label: "Status" },
      { key: "admissionDate", label: "Admission", format: "date" },
      { key: "dischargeDate", label: "Discharge", format: "date" },
    ],
  },
  labBills: {
    label: "Lab Bills",
    columns: [
      { key: "billNumber", label: "Bill No." },
      { key: "labName", label: "Lab" },
      { key: "patientId", label: "Patient ID" },
      { key: "subtotal", label: "Subtotal", format: "currency" },
      { key: "discount", label: "Discount", format: "currency" },
      { key: "total", label: "Total", format: "currency" },
      { key: "amountPaid", label: "Paid", format: "currency" },
      { key: "balanceDue", label: "Balance", format: "currency" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Date", format: "date" },
    ],
  },
  pharmacyBills: {
    label: "Pharmacy Bills",
    columns: [
      { key: "billNumber", label: "Bill No." },
      { key: "patientName", label: "Patient" },
      { key: "patientPhone", label: "Phone" },
      { key: "referredDoctor", label: "Doctor" },
      { key: "subtotal", label: "Subtotal", format: "currency" },
      { key: "discountAmount", label: "Discount", format: "currency" },
      { key: "gstAmount", label: "GST", format: "currency" },
      { key: "billAmount", label: "Bill Amount", format: "currency" },
      { key: "paidAmount", label: "Paid", format: "currency" },
      { key: "balanceDue", label: "Balance", format: "currency" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
      { key: "billDate", label: "Date", format: "date" },
    ],
  },
  opticalBills: {
    label: "Optical Bills",
    columns: [
      { key: "billNumber", label: "Bill No." },
      { key: "patientName", label: "Patient" },
      { key: "patientPhone", label: "Phone" },
      { key: "referredDoctor", label: "Doctor" },
      { key: "subtotal", label: "Subtotal", format: "currency" },
      { key: "discountAmount", label: "Discount", format: "currency" },
      { key: "gstAmount", label: "GST", format: "currency" },
      { key: "billAmount", label: "Bill Amount", format: "currency" },
      { key: "paidAmount", label: "Paid", format: "currency" },
      { key: "balanceDue", label: "Balance", format: "currency" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
      { key: "billDate", label: "Date", format: "date" },
    ],
  },
  expenses: {
    label: "Expenses",
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "date", label: "Date", format: "date" },
      { key: "reason", label: "Reason" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "createdAt", label: "Created At", format: "date" },
    ],
  },
}

const ALL_TABS: DataTab[] = [
  "patients", "prescriptions", "eyeReadings", "inPatients", "insurance",
  "labBills", "pharmacyBills", "opticalBills", "expenses",
]

// ─── Helpers ────────────────────────────────────────────────────

// Eye row: SPH/CYL×AXIS VA:xx
function fmtEyeRow(r: Record<string, string> | null | undefined): string {
  if (!r) return "—"
  const parts: string[] = []
  if (r.sph) parts.push(r.sph)
  if (r.cyl) parts.push(r.cyl)
  if (r.axis) parts.push(`×${r.axis}`)
  if (r.va) parts.push(`VA:${r.va}`)
  if (r.vacph) parts.push(`(PH:${r.vacph})`)
  return parts.length ? parts.join(" ") : "—"
}

// Auto Refractometer: RE: +1.00 -0.50×90 VA:6/6 | LE: ... | PD: 64
function formatEyeAR(value: unknown): string {
  try {
    const d = typeof value === "string" ? JSON.parse(value) : value as Record<string, unknown>
    if (!d || typeof d !== "object") return ""
    const parts: string[] = []
    if (d.re) parts.push(`RE: ${fmtEyeRow(d.re as Record<string, string>)}`)
    if (d.le) parts.push(`LE: ${fmtEyeRow(d.le as Record<string, string>)}`)
    if (d.pd) parts.push(`PD: ${d.pd}`)
    return parts.join("  |  ") || "—"
  } catch { return String(value) }
}

// DN sections (GR / Previous Rx / Present Rx):
// RE: D: +1.00 -0.50×90 VA:6/6  N: +2.50 | LE: ...
function formatEyeDN(value: unknown): string {
  try {
    const d = typeof value === "string" ? JSON.parse(value) : value as Record<string, unknown>
    if (!d || typeof d !== "object") return ""
    const eye = (e: Record<string, Record<string, string>> | null, label: string) => {
      if (!e) return null
      const dist = fmtEyeRow(e.d)
      const near = fmtEyeRow(e.n)
      return `${label}: D: ${dist}  N: ${near}`
    }
    const parts = [
      eye(d.re as Record<string, Record<string, string>>, "RE"),
      eye(d.le as Record<string, Record<string, string>>, "LE"),
    ].filter(Boolean)
    return parts.join("  |  ") || "—"
  } catch { return String(value) }
}

// Clinical Findings: RE: Lids-Normal, Cornea-Clear | LE: ...
function formatEyeCF(value: unknown): string {
  try {
    const d = typeof value === "string" ? JSON.parse(value) : value as Record<string, unknown>
    if (!d || typeof d !== "object") return ""
    const eye = (e: Record<string, string> | null, label: string) => {
      if (!e) return null
      const fields = Object.entries(e)
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
        .join(", ")
      return fields ? `${label}: ${fields}` : null
    }
    const parts = [
      eye(d.re as Record<string, string>, "RE"),
      eye(d.le as Record<string, string>, "LE"),
    ].filter(Boolean)
    return parts.join("  |  ") || "—"
  } catch { return String(value) }
}

function formatCellValue(value: unknown, format?: "date" | "currency" | "json" | "eyeAR" | "eyeDN" | "eyeCF"): string {
  if (value === null || value === undefined || value === "") return ""
  if (format === "date") return formatDate(value as string)
  if (format === "currency") return formatCurrency(value as number)
  if (format === "eyeAR") return formatEyeAR(value)
  if (format === "eyeDN") return formatEyeDN(value)
  if (format === "eyeCF") return formatEyeCF(value)
  if (format === "json") {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value
      if (Array.isArray(parsed)) {
        return parsed.map((item: Record<string, unknown>) => item.name || JSON.stringify(item)).join("; ")
      }
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("; ")
      }
      return String(parsed)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function formatCellForExport(value: unknown, format?: "date" | "currency" | "json" | "eyeAR" | "eyeDN" | "eyeCF"): string {
  if (value === null || value === undefined || value === "") return ""
  if (format === "date") {
    const d = new Date(value as string)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString("en-IN")
  }
  if (format === "currency") return String(value)
  if (format === "eyeAR") return formatEyeAR(value)
  if (format === "eyeDN") return formatEyeDN(value)
  if (format === "eyeCF") return formatEyeCF(value)
  if (format === "json") {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value
      if (Array.isArray(parsed)) {
        return parsed.map((item: Record<string, unknown>) => item.name || JSON.stringify(item)).join("; ")
      }
      if (typeof parsed === "object" && parsed !== null) {
        return JSON.stringify(parsed)
      }
      return String(parsed)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ─── Component ──────────────────────────────────────────────────

export function DataExportPage() {
  const [activeTab, setActiveTab] = useState<DataTab>("patients")
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const config = TAB_CONFIG[activeTab]
  const allColumnKeys = config.columns.map((c) => c.key)

  // Init visible columns when tab changes
  useEffect(() => {
    setVisibleColumns(new Set(allColumnKeys))
    setSelectedIds(new Set())
    setSearch("")
    setDateFrom("")
    setDateTo("")
  }, [activeTab])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())
    try {
      const dateRange = (dateFrom || dateTo) ? { from: dateFrom || undefined, to: dateTo || undefined } : undefined
      const searchVal = search.trim() || undefined
      let result: Record<string, unknown>[] = []

      switch (activeTab) {
        case "patients":
          result = await getExportPatients({ search: searchVal, dateRange })
          break
        case "prescriptions":
          result = await getExportPrescriptions({ search: searchVal, dateRange })
          break
        case "eyeReadings":
          result = await getExportEyeReadings({ search: searchVal, dateRange })
          break
        case "inPatients":
          result = await getExportInPatients({ search: searchVal, dateRange })
          break
        case "insurance":
          result = await getExportInsuranceClaims({ search: searchVal, dateRange })
          break
        case "labBills":
          result = await getExportLabBills({ search: searchVal, dateRange })
          break
        case "pharmacyBills":
          result = await getExportPharmacyBills({ search: searchVal, dateRange })
          break
        case "opticalBills":
          result = await getExportOpticalBills({ search: searchVal, dateRange })
          break
        case "expenses":
          result = await getExportExpenses({ search: searchVal, dateRange })
          break
      }

      setData(result)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [activeTab, search, dateFrom, dateTo])

  // Load data on tab/filter change
  useEffect(() => {
    fetchData()
  }, [activeTab, dateFrom, dateTo])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      fetchData()
    }, 400)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [search])

  // ─── Selection ──────────────────────────────────────────────

  const allSelected = data.length > 0 && selectedIds.size === data.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < data.length

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map((row) => row.id as string)))
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Column visibility ─────────────────────────────────────

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function selectAllColumns() {
    setVisibleColumns(new Set(allColumnKeys))
  }

  function deselectAllColumns() {
    // Keep at least the first column
    setVisibleColumns(new Set([allColumnKeys[0]]))
  }

  const visibleCols = config.columns.filter((c) => visibleColumns.has(c.key))

  // ─── Export ─────────────────────────────────────────────────

  function getExportRows() {
    if (selectedIds.size > 0) {
      return data.filter((row) => selectedIds.has(row.id as string))
    }
    return data
  }

  function exportCSV() {
    const rows = getExportRows()
    if (rows.length === 0) {
      toast.error("No data to export")
      return
    }

    setExporting(true)
    try {
      const headers = visibleCols.map((c) => c.label)
      const csvRows = [
        headers.map(escapeCsvField).join(","),
        ...rows.map((row) =>
          visibleCols
            .map((col) => escapeCsvField(formatCellForExport(row[col.key], col.format)))
            .join(",")
        ),
      ]

      const csvContent = "\uFEFF" + csvRows.join("\n") // BOM for Excel UTF-8
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      downloadBlob(blob, `${config.label.toLowerCase().replace(/\s+/g, "-")}-export.csv`)
      toast.success(`Exported ${rows.length} rows as CSV`)
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  function exportExcel() {
    const rows = getExportRows()
    if (rows.length === 0) {
      toast.error("No data to export")
      return
    }

    setExporting(true)
    try {
      // Build HTML table for Excel (xls format - widely compatible)
      const headerCells = visibleCols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")
      const bodyRows = rows.map((row) => {
        const cells = visibleCols.map((col) => {
          const val = formatCellForExport(row[col.key], col.format)
          return `<td>${escapeHtml(val)}</td>`
        }).join("")
        return `<tr>${cells}</tr>`
      }).join("")

      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>${config.label}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>td,th{border:1px solid #ccc;padding:4px 8px;font-family:Calibri,sans-serif;font-size:11pt}th{background:#4472C4;color:white;font-weight:bold}</style>
        </head><body><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>
      `
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" })
      downloadBlob(blob, `${config.label.toLowerCase().replace(/\s+/g, "-")}-export.xls`)
      toast.success(`Exported ${rows.length} rows as Excel`)
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  // ─── Clear filters ─────────────────────────────────────────

  const hasFilters = search || dateFrom || dateTo
  function clearFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Data Export"
        description="Select, filter and export hospital data in CSV or Excel format"
      >
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedIds.size} selected
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {data.length} records
          </Badge>
        </div>
      </PageHeader>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DataTab)}
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto flex-wrap gap-1">
            {ALL_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs px-3 py-1.5">
                {TAB_CONFIG[tab].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${config.label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[140px] text-sm"
            placeholder="From"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[140px] text-sm"
            placeholder="To"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* Column picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Columns ({visibleCols.length}/{config.columns.length})
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex gap-1 px-2 pb-1">
              <button
                onClick={selectAllColumns}
                className="text-[0.7rem] text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground text-[0.7rem]">|</span>
              <button
                onClick={deselectAllColumns}
                className="text-[0.7rem] text-primary hover:underline"
              >
                None
              </button>
            </div>
            <DropdownMenuSeparator />
            {config.columns.map((col) => (
              <DropdownMenuItem
                key={col.key}
                onSelect={(e) => e.preventDefault()}
                onClick={() => toggleColumn(col.key)}
                className="text-xs gap-2"
              >
                <Checkbox
                  checked={visibleColumns.has(col.key)}
                  className="h-3.5 w-3.5"
                />
                {col.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 text-xs" disabled={data.length === 0 || exporting}>
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">
              {selectedIds.size > 0 ? `Export ${selectedIds.size} selected rows` : `Export all ${data.length} rows`}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportCSV} className="text-xs gap-2">
              <FileText className="h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportExcel} className="text-xs gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export as Excel (.xls)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Data table */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[44px] px-3">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center" title={allSelected ? "Deselect all" : "Select all"}>
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : someSelected ? (
                      <Minus className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[50px] px-3 text-xs">#</TableHead>
                {visibleCols.map((col) => (
                  <TableHead key={col.key} className="text-xs whitespace-nowrap">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-3"><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell className="px-3"><Skeleton className="h-4 w-6" /></TableCell>
                    {visibleCols.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleCols.length + 2} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm">No {config.label.toLowerCase()} found</p>
                      {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs mt-1">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, idx) => {
                  const id = row.id as string
                  const isSelected = selectedIds.has(id)
                  return (
                    <TableRow
                      key={id}
                      data-state={isSelected ? "selected" : undefined}
                      className={isSelected ? "bg-primary/5" : ""}
                    >
                      <TableCell className="px-3">
                        <button onClick={() => toggleSelectRow(id)} className="flex items-center justify-center">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="px-3 text-xs text-muted-foreground">{idx + 1}</TableCell>
                      {visibleCols.map((col) => (
                        <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-[250px] truncate" title={formatCellValue(row[col.key], col.format)}>
                          {formatCellValue(row[col.key], col.format)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer bar */}
        {data.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/30 text-xs text-muted-foreground">
            <span>
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${data.length} row(s) selected`
                : `${data.length} row(s) total`}
            </span>
            <span>
              Showing {visibleCols.length} of {config.columns.length} columns
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
