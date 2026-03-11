"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createLicense, updateLicense } from "../actions"
import { toast } from "sonner"
import { todayISO } from "@/lib/utils"

const LICENSE_CATEGORIES = [
  "Medical Registration",
  "Drug License",
  "Fire Safety",
  "Trade License",
  "NABH Accreditation",
  "Bio-Medical Waste",
  "Pollution Control",
  "AERB (Radiology)",
  "Lift License",
  "Building Compliance",
  "Other",
]

type LicenseData = {
  id: string
  name: string
  licenseNumber: string | null
  issuingBody: string | null
  category: string | null
  issueDate: Date | string | null
  expiryDate: Date | string
  reminderDays: number
  notes: string | null
}

export function LicenseForm({
  license,
  onClose,
  onSuccess,
}: {
  license?: LicenseData | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!license

  const [name, setName] = useState(license?.name ?? "")
  const [licenseNumber, setLicenseNumber] = useState(license?.licenseNumber ?? "")
  const [issuingBody, setIssuingBody] = useState(license?.issuingBody ?? "")
  const [category, setCategory] = useState(license?.category ?? "")
  const [issueDate, setIssueDate] = useState(
    license?.issueDate
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(license.issueDate))
      : ""
  )
  const [expiryDate, setExpiryDate] = useState(
    license?.expiryDate
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(license.expiryDate))
      : ""
  )
  const [reminderDays, setReminderDays] = useState(license?.reminderDays?.toString() ?? "30")
  const [notes, setNotes] = useState(license?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "License name is required"
    if (!expiryDate) errs.expiryDate = "Expiry date is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
        issuingBody: issuingBody.trim() || undefined,
        category: category || undefined,
        issueDate: issueDate || undefined,
        expiryDate,
        reminderDays: parseInt(reminderDays) || 30,
        notes: notes.trim() || undefined,
      }

      const result = isEdit
        ? await updateLicense(license!.id, data)
        : await createLicense(data)

      if (result.success) {
        toast.success(isEdit ? "License updated successfully" : "License added successfully")
        onSuccess()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit License" : "Add New License"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* License Name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              License Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })) }}
              placeholder="e.g. Drug License, Fire NOC"
              className={`h-10 bg-white ${errors.name ? "border-red-500" : ""}`}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* License Number */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">License Number</Label>
            <Input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Enter license/registration number"
              className="h-10 bg-white"
            />
          </div>

          {/* Issuing Body */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Issuing Authority</Label>
            <Input
              value={issuingBody}
              onChange={(e) => setIssuingBody(e.target.value)}
              placeholder="e.g. State Drug Controller, Fire Department"
              className="h-10 bg-white"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Issue Date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                max={todayISO()}
                className="h-10 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Expiry Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => { setExpiryDate(e.target.value); setErrors((p) => ({ ...p, expiryDate: "" })) }}
                className={`h-10 bg-white ${errors.expiryDate ? "border-red-500" : ""}`}
              />
              {errors.expiryDate && <p className="text-sm text-red-500">{errors.expiryDate}</p>}
            </div>
          </div>

          {/* Reminder Days */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Remind Before (days)</Label>
            <Input
              type="number"
              min="1"
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              placeholder="30"
              className="h-10 bg-white"
            />
            <p className="text-xs text-gray-500">You&apos;ll see a warning this many days before expiry</p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Notes</Label>
            <Textarea
              value={notes}
              className="bg-white"
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update License" : "Add License"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
