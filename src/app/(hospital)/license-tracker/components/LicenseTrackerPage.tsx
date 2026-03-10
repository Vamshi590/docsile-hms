"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, differenceInDays } from "date-fns"
import { Plus, Search, Pencil, Trash2, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getLicenses, deleteLicense } from "../actions"
import { LicenseForm } from "./LicenseForm"

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

  if (daysLeft < 0) return { label: "Expired", color: "bg-red-100 text-red-700", icon: XCircle, daysLeft }
  if (daysLeft <= reminderDays) return { label: "Expiring Soon", color: "bg-amber-100 text-amber-700", icon: AlertTriangle, daysLeft }
  return { label: "Active", color: "bg-green-100 text-green-700", icon: CheckCircle2, daysLeft }
}

export default function LicenseTrackerPage({ hospitalName }: { hospitalName: string }) {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingLicense, setEditingLicense] = useState<License | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchLicenses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLicenses()
      setLicenses(data as License[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLicenses() }, [fetchLicenses])

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const lic of licenses) {
      if (lic.category) cats.add(lic.category)
    }
    return Array.from(cats).sort()
  }, [licenses])

  // Filtered and sorted licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((lic) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const nameMatch = lic.name.toLowerCase().includes(q)
        const numMatch = lic.licenseNumber?.toLowerCase().includes(q) ?? false
        const bodyMatch = lic.issuingBody?.toLowerCase().includes(q) ?? false
        if (!nameMatch && !numMatch && !bodyMatch) return false
      }

      // Category filter
      if (categoryFilter !== "all" && lic.category !== categoryFilter) return false

      // Status filter
      if (statusFilter !== "all") {
        const status = getLicenseStatus(lic.expiryDate, lic.reminderDays)
        if (statusFilter === "active" && status.label !== "Active") return false
        if (statusFilter === "expiring" && status.label !== "Expiring Soon") return false
        if (statusFilter === "expired" && status.label !== "Expired") return false
      }

      return true
    })
  }, [licenses, searchQuery, categoryFilter, statusFilter])

  // Summary counts
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
      toast.success("License deleted successfully")
      fetchLicenses()
    } else {
      toast.error(result.error)
    }
    setDeleteId(null)
  }

  return (
    <div className="space-y-0">
      <PageHeader title="License Tracker" description={hospitalName}>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add License
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mt-4 mb-6">
        {[
          { label: "Total Licenses", value: summary.total, color: "text-gray-800", bg: "bg-white" },
          { label: "Active", value: summary.active, color: "text-green-700", bg: "bg-green-50" },
          { label: "Expiring Soon", value: summary.expiring, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Expired", value: summary.expired, color: "text-red-700", bg: "bg-red-50" },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl shadow-sm border border-gray-100 p-5`}>
            <p className="text-sm text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{loading ? "—" : card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
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

      {/* License List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="w-3/4 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLicenses.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">
              {licenses.length === 0 ? "No licenses added yet. Click \"Add License\" to get started." : "No licenses match the current filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLicenses.map((lic) => {
              const status = getLicenseStatus(lic.expiryDate, lic.reminderDays)
              const StatusIcon = status.icon
              return (
                <div key={lic.id} className="p-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">{lic.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                        {lic.licenseNumber && (
                          <span>No: <span className="text-gray-700 font-medium">{lic.licenseNumber}</span></span>
                        )}
                        {lic.issuingBody && (
                          <span>Issued by: {lic.issuingBody}</span>
                        )}
                        {lic.category && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{lic.category}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm mt-2">
                        {lic.issueDate && (
                          <span className="text-gray-500">
                            Issued: {format(new Date(lic.issueDate), "dd MMM yyyy")}
                          </span>
                        )}
                        <span className="text-gray-500">
                          Expires: <span className="font-medium text-gray-700">{format(new Date(lic.expiryDate), "dd MMM yyyy")}</span>
                        </span>
                        <span className={`text-sm font-medium ${status.daysLeft < 0 ? "text-red-600" : status.daysLeft <= lic.reminderDays ? "text-amber-600" : "text-green-600"}`}>
                          {status.daysLeft < 0
                            ? `Expired ${Math.abs(status.daysLeft)} days ago`
                            : status.daysLeft === 0
                              ? "Expires today"
                              : `${status.daysLeft} days left`}
                        </span>
                      </div>

                      {lic.notes && (
                        <p className="text-sm text-gray-500 mt-1.5 line-clamp-1">{lic.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(lic)}
                        className="p-1.5 text-blue-500 hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit license"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(lic.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete license"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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

      {/* Delete Confirmation */}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
