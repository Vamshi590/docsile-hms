"use client";

import { useState, useCallback, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLicenses, deleteLicense } from "../actions";
import { LicenseForm } from "./LicenseForm";

type License = {
  id: string;
  name: string;
  licenseNumber: string | null;
  issuingBody: string | null;
  category: string | null;
  issueDate: Date | string | null;
  expiryDate: Date | string;
  reminderDays: number;
  status: string;
  notes: string | null;
  documentUrl: string | null;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StatusFilter = "all" | "active" | "expiring" | "expired";

function getLicenseStatus(expiryDate: Date | string, reminderDays: number) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = differenceInDays(expiry, now);

  if (daysLeft < 0)
    return {
      label: "Expired",
      color: "bg-red-100 text-red-700",
      icon: XCircle,
      daysLeft,
    };
  if (daysLeft <= reminderDays)
    return {
      label: "Expiring Soon",
      color: "bg-amber-100 text-amber-700",
      icon: AlertTriangle,
      daysLeft,
    };
  return {
    label: "Active",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
    daysLeft,
  };
}

export default function LicenseTrackerPage({ initialLicenses }: { initialLicenses: License[] }) {
  const [licenses, setLicenses] = useState<License[]>(initialLicenses);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLicenses();
      setLicenses(data as License[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const lic of licenses) {
      if (lic.category) cats.add(lic.category);
    }
    return Array.from(cats).sort();
  }, [licenses]);

  // Filtered and sorted licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((lic) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = lic.name.toLowerCase().includes(q);
        const numMatch = lic.licenseNumber?.toLowerCase().includes(q) ?? false;
        const bodyMatch = lic.issuingBody?.toLowerCase().includes(q) ?? false;
        if (!nameMatch && !numMatch && !bodyMatch) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && lic.category !== categoryFilter)
        return false;

      // Status filter
      if (statusFilter !== "all") {
        const status = getLicenseStatus(lic.expiryDate, lic.reminderDays);
        if (statusFilter === "active" && status.label !== "Active")
          return false;
        if (statusFilter === "expiring" && status.label !== "Expiring Soon")
          return false;
        if (statusFilter === "expired" && status.label !== "Expired")
          return false;
      }

      return true;
    });
  }, [licenses, searchQuery, categoryFilter, statusFilter]);

  // Summary counts
  const summary = useMemo(() => {
    let active = 0,
      expiring = 0,
      expired = 0;
    for (const lic of licenses) {
      const s = getLicenseStatus(lic.expiryDate, lic.reminderDays);
      if (s.label === "Active") active++;
      else if (s.label === "Expiring Soon") expiring++;
      else expired++;
    }
    return { total: licenses.length, active, expiring, expired };
  }, [licenses]);

  const handleEdit = (license: License) => {
    setEditingLicense(license);
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteLicense(deleteId);
    if (result.success) {
      toast.success("License deleted successfully");
      fetchLicenses();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-0">
      <PageHeader title="License Tracker" onRefresh={fetchLicenses}>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add License
        </Button>
      </PageHeader>

     

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
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

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
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
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
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
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredLicenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            {licenses.length === 0
              ? 'No licenses added yet. Click "Add License" to get started.'
              : "No licenses match the current filters."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLicenses.map((lic) => {
            const status = getLicenseStatus(lic.expiryDate, lic.reminderDays);
            const StatusIcon = status.icon;
            const borderColor =
              status.label === "Expired"
                ? "border-l-red-400"
                : status.label === "Expiring Soon"
                ? "border-l-amber-400"
                : "border-l-green-400";
            const countdownColor =
              status.daysLeft < 0
                ? "text-red-600 bg-red-50"
                : status.daysLeft <= lic.reminderDays
                ? "text-amber-600 bg-amber-50"
                : "text-green-600 bg-green-50";
            return (
              <div
                key={lic.id}
                className={`bg-white rounded-xl border border-gray-100 border-l-4 ${borderColor} shadow-sm px-5 py-4 hover:shadow-md transition-shadow flex items-center gap-5`}
              >
                {/* Left: name + meta */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {lic.name}
                    </h3>
                    {lic.licenseNumber && (
                      <span className="text-xs text-gray-400 font-mono shrink-0">
                        #{lic.licenseNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                    {lic.category && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                        {lic.category}
                      </span>
                    )}
                    {lic.issuingBody && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                        {lic.issuingBody}
                      </span>
                    )}
                  </div>

                  {lic.notes && (
                    <p className="text-xs text-gray-400 line-clamp-1">{lic.notes}</p>
                  )}
                </div>

                {/* Right: dates + countdown + actions */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right text-xs text-gray-500 space-y-0.5 hidden sm:block">
                    {lic.issueDate && (
                      <p>Issued: <span className="text-gray-700 font-medium">{format(new Date(lic.issueDate), "dd MMM yyyy")}</span></p>
                    )}
                    <p>Expires: <span className="text-gray-700 font-medium">{format(new Date(lic.expiryDate), "dd MMM yyyy")}</span></p>
                  </div>

                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${countdownColor}`}>
                    {status.daysLeft < 0
                      ? `${Math.abs(status.daysLeft)}d ago`
                      : status.daysLeft === 0
                      ? "Today"
                      : `${status.daysLeft}d left`}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(lic)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(lic.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add License Modal */}
      {showAddModal && (
        <LicenseForm
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchLicenses();
          }}
        />
      )}

      {/* Edit License Modal */}
      {showEditModal && editingLicense && (
        <LicenseForm
          license={editingLicense}
          onClose={() => {
            setShowEditModal(false);
            setEditingLicense(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingLicense(null);
            fetchLicenses();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete License</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this license? This action cannot
              be undone.
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
    </div>
  );
}
