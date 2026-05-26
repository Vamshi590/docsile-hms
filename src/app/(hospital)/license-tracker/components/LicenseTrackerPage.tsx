"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { format, differenceInDays } from "date-fns"
import {
  Plus, Search, Pencil, Trash2, AlertTriangle, CheckCircle2,
  XCircle, Clock, Upload, Download, Eye, X, Loader2, FileText,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { usePermissions } from "@/hooks/usePermissions"
import { getLicenses, deleteLicense, saveLicenseDocumentUrl, removeLicenseDocument } from "../actions"
import { LicenseForm } from "./LicenseForm"
import { createClient } from "@/lib/supabase/client"
import { STORAGE_BUCKET, getLicenseFilePath, getFilePathFromUrl } from "@/lib/storage"

type License = {
  id: string
  name: string
  licenseNumber: string | null
  issuingBody: string | null
  category: string | null
  issueDate: Date | string | null
  expiryDate: Date | string
  reminderDays: number
  status: string
  notes: string | null
  documentUrl: string | null
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
}

type StatusFilter = "all" | "active" | "expiring" | "expired"

function getLicenseStatus(expiryDate: Date | string, reminderDays: number) {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const daysLeft = differenceInDays(expiry, now)
  if (daysLeft < 0) return { label: "Expired", color: "bg-red-100 text-red-700", borderColor: "border-l-red-400", icon: XCircle, daysLeft }
  if (daysLeft <= reminderDays) return { label: "Expiring Soon", color: "bg-amber-100 text-amber-700", borderColor: "border-l-amber-400", icon: AlertTriangle, daysLeft }
  return { label: "Active", color: "bg-green-100 text-green-700", borderColor: "border-l-green-400", icon: CheckCircle2, daysLeft }
}

export default function LicenseTrackerPage({ initialLicenses }: { initialLicenses: License[] }) {
  const { can } = usePermissions()

  const [licenses, setLicenses] = useState<License[]>(initialLicenses)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingLicense, setEditingLicense] = useState<License | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [removeDocLicense, setRemoveDocLicense] = useState<License | null>(null)
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [uploadingForId, setUploadingForId] = useState<string | null>(null)
  const [docLoadingId, setDocLoadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchLicenses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLicenses()
      setLicenses(data as License[])
    } finally {
      setLoading(false)
    }
  }, [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const lic of licenses) {
      if (lic.category) cats.add(lic.category)
    }
    return Array.from(cats).sort()
  }, [licenses])

  const filteredLicenses = useMemo(() => {
    return licenses.filter((lic) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !lic.name.toLowerCase().includes(q) &&
          !(lic.licenseNumber?.toLowerCase().includes(q) ?? false) &&
          !(lic.issuingBody?.toLowerCase().includes(q) ?? false)
        ) return false
      }
      if (categoryFilter !== "all" && lic.category !== categoryFilter) return false
      if (statusFilter !== "all") {
        const s = getLicenseStatus(lic.expiryDate, lic.reminderDays)
        if (statusFilter === "active" && s.label !== "Active") return false
        if (statusFilter === "expiring" && s.label !== "Expiring Soon") return false
        if (statusFilter === "expired" && s.label !== "Expired") return false
      }
      return true
    })
  }, [licenses, searchQuery, categoryFilter, statusFilter])

  const summary = useMemo(() => {
    let active = 0, expiring = 0, expired = 0
    for (const lic of licenses) {
      const s = getLicenseStatus(lic.expiryDate, lic.reminderDays)
      if (s.label === "Active") active++
      else if (s.label === "Expiring Soon") expiring++
      else expired++
    }
    return { total: licenses.length, active, expiring, expired }
  }, [licenses])

  const handleEdit = (license: License) => {
    setEditingLicense(license)
    setShowEditModal(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const result = await deleteLicense(deleteId)
    if (result.success) {
      toast.success("License deleted")
      fetchLicenses()
    } else {
      toast.error(result.error)
    }
    setDeleteId(null)
  }

  const handleUploadClick = (licenseId: string) => {
    setUploadingForId(licenseId)
    fileInputRef.current?.click()
  }

  const handleView = async (licenseId: string, documentUrl: string) => {
    setDocLoadingId(licenseId)
    try {
      const res = await fetch(documentUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, "_blank")
    } catch {
      toast.error("Failed to open document")
    } finally {
      setDocLoadingId(null)
    }
  }

  const handleDownload = async (licenseId: string, documentUrl: string) => {
    setDocLoadingId(licenseId)
    try {
      const res = await fetch(documentUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const segments = documentUrl.split("/")
      const raw = segments[segments.length - 1] ?? "document"
      const filename = raw.replace(/^\d+-/, "") || "document"
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error("Failed to download document")
    } finally {
      setDocLoadingId(null)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingForId) return
    e.target.value = ""

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10 MB.")
      setUploadingForId(null)
      return
    }

    const licenseId = uploadingForId
    setUploadingForId(null)
    setUploadingIds((prev) => new Set(prev).add(licenseId))

    try {
      const supabase = createClient()
      const filePath = getLicenseFilePath(licenseId, file.name)
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
      const result = await saveLicenseDocumentUrl(licenseId, urlData.publicUrl)
      if (!result.success) throw new Error(result.error)

      setLicenses((prev) =>
        prev.map((l) => (l.id === licenseId ? { ...l, documentUrl: urlData.publicUrl } : l))
      )
      toast.success("Document uploaded successfully")
    } catch {
      toast.error("Upload failed. Please try again.")
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev)
        next.delete(licenseId)
        return next
      })
    }
  }

  const handleRemoveDoc = async () => {
    if (!removeDocLicense?.documentUrl) return
    const filePath = getFilePathFromUrl(removeDocLicense.documentUrl)
    const result = await removeLicenseDocument(removeDocLicense.id, filePath)
    if (result.success) {
      setLicenses((prev) =>
        prev.map((l) => (l.id === removeDocLicense.id ? { ...l, documentUrl: null } : l))
      )
      toast.success("Document removed")
    } else {
      toast.error(result.error)
    }
    setRemoveDocLicense(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="License Tracker" onRefresh={fetchLicenses}>
        {can("licenses:create") && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add License
          </Button>
        )}
      </PageHeader>

      {/* Hidden file input — shared across all cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-border/60 shadow-sm px-4 py-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 shadow-sm px-4 py-3">
          <p className="text-xs text-green-600">Active</p>
          <p className="text-2xl font-bold text-green-700">{summary.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm px-4 py-3">
          <p className="text-xs text-amber-600">Expiring Soon</p>
          <p className="text-2xl font-bold text-amber-700">{summary.expiring}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 shadow-sm px-4 py-3">
          <p className="text-xs text-red-600">Expired</p>
          <p className="text-2xl font-bold text-red-700">{summary.expired}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-border/60 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-2.5" />
            <Input
              type="text"
              placeholder="Search licenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 text-sm w-full sm:w-[170px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-sm w-full sm:w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* License Cards */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredLicenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-border/60 shadow-sm text-center py-16">
          <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            {licenses.length === 0
              ? 'No licenses added yet. Click "Add License" to get started.'
              : "No licenses match the current filters."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLicenses.map((lic) => {
            const status = getLicenseStatus(lic.expiryDate, lic.reminderDays)
            const StatusIcon = status.icon
            const countdownColor =
              status.daysLeft < 0
                ? "text-red-600 bg-red-50"
                : status.daysLeft <= lic.reminderDays
                ? "text-amber-600 bg-amber-50"
                : "text-green-600 bg-green-50"
            const expiryColor =
              status.daysLeft < 0
                ? "text-red-600"
                : status.daysLeft <= lic.reminderDays
                ? "text-amber-600"
                : "text-foreground"

            return (
              <div
                key={lic.id}
                className={`bg-white rounded-xl border border-gray-100 border-l-4 ${status.borderColor} shadow-sm px-5 py-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start gap-4">
                  {/* Left: name + meta */}
                  <div className="flex-1 min-w-0">
                    {lic.category && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {lic.category}
                      </p>
                    )}
                    <h3 className="font-semibold text-foreground text-sm truncate">{lic.name}</h3>
                    {(lic.licenseNumber || lic.issuingBody) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[lic.licenseNumber, lic.issuingBody].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {lic.notes && (
                      <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{lic.notes}</p>
                    )}
                  </div>

                  {/* Middle: date columns (hidden on small screens) */}
                  <div className="hidden md:flex items-center gap-6 shrink-0 self-center">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Issued</p>
                      <p className="text-xs font-medium text-foreground">
                        {lic.issueDate ? format(new Date(lic.issueDate), "dd MMM yy") : "—"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Expires</p>
                      <p className={`text-xs font-medium ${expiryColor}`}>
                        {format(new Date(lic.expiryDate), "dd MMM yy")}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Remind</p>
                      <p className="text-xs font-medium text-foreground">{lic.reminderDays}d</p>
                    </div>
                  </div>

                  {/* Right: status + countdown + doc + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Top row: status badge + countdown + edit/delete */}
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${countdownColor}`}>
                        {status.daysLeft < 0
                          ? `${Math.abs(status.daysLeft)}d ago`
                          : status.daysLeft === 0
                          ? "Today"
                          : `${status.daysLeft}d left`}
                      </span>
                      {can("licenses:create") && (
                        <button
                          onClick={() => handleEdit(lic)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {can("licenses:delete") && (
                        <button
                          onClick={() => setDeleteId(lic.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom row: document actions */}
                    <div className="flex items-center gap-1.5">
                      {uploadingIds.has(lic.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Uploading...
                        </span>
                      ) : lic.documentUrl ? (
                        <>
                          {docLoadingId === lic.id ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Loading...
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleView(lic.id, lic.documentUrl!)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                              <button
                                onClick={() => handleDownload(lic.id, lic.documentUrl!)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-cyan-600 bg-cyan-50 hover:bg-cyan-100 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </button>
                              <button
                                onClick={() => setRemoveDocLicense(lic)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Remove document"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        can("licenses:create") && (
                          <button
                            onClick={() => handleUploadClick(lic.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add License Modal */}
      {showAddModal && (
        <LicenseForm
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchLicenses() }}
        />
      )}

      {/* Edit License Modal */}
      {showEditModal && editingLicense && (
        <LicenseForm
          license={editingLicense}
          onClose={() => { setShowEditModal(false); setEditingLicense(null) }}
          onSuccess={() => { setShowEditModal(false); setEditingLicense(null); fetchLicenses() }}
        />
      )}

      {/* Delete License Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete License</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this license? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Document Confirmation */}
      <AlertDialog open={!!removeDocLicense} onOpenChange={() => setRemoveDocLicense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the attached document from &ldquo;{removeDocLicense?.name}&rdquo;? The file will be permanently deleted from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
