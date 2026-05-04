"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditableComboboxWithAdd } from "@/components/ui/combobox"
import { createInPatient, getNextInPatientId, updateInPatient } from "../actions"
import { searchExistingPatients, getDropdownOptions, addDropdownOption } from "@/app/(hospital)/patients/actions"
import { getPredefinedPackages } from "@/app/(hospital)/settings/actions"
import type { InPatient, PackageInclusion, PaymentRecord } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (ip?: InPatient) => void
  editInpatient?: InPatient | null
}

const NOW = () => {
  const now = new Date()
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now)
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(now)
  return `${date}T${time}`
}
const TOMORROW = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d)
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return `${date}T${time}`
}

const INCLUSION_OPTIONS = [
  "Room Charges", "Medicine", "Consumables", "Surgery Charges",
  "Doctor Fee", "Nursing Care", "Food", "Lab Tests",
]
const AMOUNT_TYPE_OPTIONS = ["Advance", "Insurance", "Final Payment", "Additional Charges"]
const PAYMENT_MODE_OPTIONS = ["Cash", "UPI", "Card", "Insurance", "Cheque", "Bank Transfer", "Cash+UPI"]

export default function InPatientAdmissionForm({ open, onClose, onSuccess, editInpatient }: Props) {
  const isEditMode = !!editInpatient
  const [loading, setLoading] = useState(false)
  const [searchId, setSearchId] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [ipNumber, setIpNumber] = useState("")

  useEffect(() => {
    if (open && !isEditMode) getNextInPatientId().then(setIpNumber)
    if (open) {
      Promise.all([
        getDropdownOptions("doctorName"),
        getDropdownOptions("department"),
        getDropdownOptions("referredBy"),
      ]).then(([doctors, departments, referrals]) => {
        setDoctorOptions(doctors)
        setDepartmentOptions(departments)
        setReferredByOptions(referrals)
      })
      getPredefinedPackages().then(pkgs => setAvailablePackages(pkgs as typeof availablePackages))
    }
  }, [open, isEditMode])

  // Patient Info
  const [opPatientId, setOpPatientId] = useState("")
  const [admissionDate, setAdmissionDate] = useState(NOW())
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [guardianName, setGuardianName] = useState("")
  const [referredBy, setReferredBy] = useState("Self")
  const [admissionNotes, setAdmissionNotes] = useState("")

  // Dropdown options (shared with patient registration)
  const [doctorOptions, setDoctorOptions] = useState<string[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])
  const [referredByOptions, setReferredByOptions] = useState<string[]>([])

  // Operation Info
  const [operationDate, setOperationDate] = useState(NOW())
  const [dischargeDate, setDischargeDate] = useState(TOMORROW())
  const [operationName, setOperationName] = useState("")
  const [department, setDepartment] = useState("Ophthalmology")
  const [doctorNames, setDoctorNames] = useState<string[]>([""])
  const [onDutyDoctor, setOnDutyDoctor] = useState("")
  const [provisionDiagnosis, setProvisionDiagnosis] = useState("")
  const [operationProcedure, setOperationProcedure] = useState("")
  const [operationDetails, setOperationDetails] = useState("")

  // Predefined packages
  const [availablePackages, setAvailablePackages] = useState<{ id: string; name: string; inclusions: string; totalAmount: number; discount: number }[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState("")

  // Package
  const [packageInclusions, setPackageInclusions] = useState<PackageInclusion[]>([
    { name: "Surgery Charges", amount: 0, subItems: [] },
  ])
  const [discount, setDiscount] = useState(0)

  // Payments
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([
    { date: NOW(), amountType: "Advance", paymentMode: "Cash", amount: 0 },
  ])

  // Pre-fill form in edit mode
  useEffect(() => {
    if (!open || !editInpatient) return
    function toLocalDateString(d: Date | string): string {
      const date = typeof d === "string" ? new Date(d) : d
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    }
    function toLocalDateTimeString(d: Date | string): string {
      const date = typeof d === "string" ? new Date(d) : d
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    }

    setIpNumber(editInpatient.ipNumber)
    setOpPatientId(editInpatient.patientId ?? "")
    setAdmissionDate(toLocalDateTimeString(editInpatient.admissionDate))
    setName(editInpatient.name)
    setAge(String(editInpatient.age))
    setGender(editInpatient.gender)
    setPhone(editInpatient.phone)
    setAddress(editInpatient.address ?? "")
    setDateOfBirth(editInpatient.dateOfBirth ? toLocalDateString(editInpatient.dateOfBirth) : "")
    setGuardianName(editInpatient.guardianName ?? "")
    setReferredBy(editInpatient.referredBy ?? "Self")
    setAdmissionNotes(editInpatient.admissionNotes ?? "")
    setOperationDate(editInpatient.operationDate ? toLocalDateTimeString(editInpatient.operationDate) : NOW())
    setDischargeDate(editInpatient.dischargeDate ? toLocalDateTimeString(editInpatient.dischargeDate) : TOMORROW())
    setOperationName(editInpatient.operationName ?? "")
    setDepartment(editInpatient.department ?? "")
    setOnDutyDoctor(editInpatient.onDutyDoctor ?? "")
    setProvisionDiagnosis(editInpatient.provisionDiagnosis ?? "")
    setOperationProcedure(editInpatient.operationProcedure ?? "")
    setOperationDetails(editInpatient.operationDetails ?? "")

    try {
      const docs = JSON.parse(editInpatient.doctorNames) as string[]
      setDoctorNames(docs.length > 0 ? docs : [""])
    } catch { setDoctorNames([""]) }

    try {
      const inclusions = editInpatient.packageInclusions ? JSON.parse(editInpatient.packageInclusions) as PackageInclusion[] : null
      setPackageInclusions(inclusions && inclusions.length > 0 ? inclusions : [{ name: "Surgery Charges", amount: 0, subItems: [] }])
    } catch { setPackageInclusions([{ name: "Surgery Charges", amount: 0, subItems: [] }]) }

    setDiscount(editInpatient.discount ?? 0)

    try {
      const payments = editInpatient.paymentRecords ? JSON.parse(editInpatient.paymentRecords) as PaymentRecord[] : null
      setPaymentRecords(payments && payments.length > 0 ? payments : [{ date: NOW(), amountType: "Advance", paymentMode: "Cash", amount: 0 }])
    } catch { setPaymentRecords([{ date: NOW(), amountType: "Advance", paymentMode: "Cash", amount: 0 }]) }
  }, [open, editInpatient])

  // Computed
  const packageAmount = packageInclusions.reduce((s, i) => s + i.amount, 0)
  const netAmount = packageAmount - discount
  const totalReceived = paymentRecords.reduce((s, r) => s + r.amount, 0)
  const balanceAmount = netAmount - totalReceived

  // ─── Search ────────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!searchId.trim()) { toast.error("Enter a patient ID"); return }
    setIsSearching(true)
    try {
      const results = await searchExistingPatients(searchId.trim())
      if (results.length > 0) {
        const p = results[0]
        setOpPatientId(p.patientId)
        setName(p.fullName)
        const ageVal = p.age ? String(p.age) : ""
        setAge(ageVal)
        if (p.age) setDateOfBirth(`${new Date().getFullYear() - p.age}-01-01`)
        setGender(p.gender)
        setPhone(p.phone)
        toast.success("Patient found! Info auto-filled.")
      } else {
        toast.error("No patient found with this ID")
      }
    } catch {
      toast.error("Failed to search patient")
    } finally {
      setIsSearching(false)
    }
  }

  // ─── Doctors ───────────────────────────────────────────────────────────────

  function setDoctor(i: number, v: string) {
    setDoctorNames(prev => { const a = [...prev]; a[i] = v; return a })
  }
  function addDoctor() { setDoctorNames(prev => [...prev, ""]) }
  function removeDoctor(i: number) {
    if (doctorNames.length > 1) setDoctorNames(prev => prev.filter((_, j) => j !== i))
  }

  // ─── Inclusions ────────────────────────────────────────────────────────────

  function updateInclusion(i: number, field: "name" | "amount", val: string) {
    setPackageInclusions(prev => {
      const a = [...prev]
      a[i] = field === "amount" ? { ...a[i], amount: parseFloat(val) || 0 } : { ...a[i], name: val }
      return a
    })
  }
  function addInclusion() {
    setPackageInclusions(prev => [...prev, { name: "", amount: 0, subItems: [] }])
  }
  function removeInclusion(i: number) {
    if (packageInclusions.length > 1) setPackageInclusions(prev => prev.filter((_, j) => j !== i))
  }
  function addSubItem(inclIdx: number) {
    setPackageInclusions(prev => {
      const a = [...prev]
      a[inclIdx] = { ...a[inclIdx], subItems: [...(a[inclIdx].subItems ?? []), { itemName: "", quantity: 1, rate: 0, amount: 0 }] }
      return a
    })
  }
  function removeSubItem(inclIdx: number, subIdx: number) {
    setPackageInclusions(prev => {
      const a = [...prev]
      a[inclIdx] = { ...a[inclIdx], subItems: a[inclIdx].subItems?.filter((_, j) => j !== subIdx) }
      return a
    })
  }
  function updateSubItem(inclIdx: number, subIdx: number, field: string, val: string) {
    setPackageInclusions(prev => {
      const a = [...prev]
      const subs = [...(a[inclIdx].subItems ?? [])]
      const sub = { ...subs[subIdx] }
      if (field === "itemName") {
        sub.itemName = val
      } else {
        const n = parseFloat(val) || 0
        if (field === "quantity") { sub.quantity = n; sub.amount = n * sub.rate }
        else if (field === "rate") { sub.rate = n; sub.amount = n * sub.quantity }
        else { sub.amount = n }
      }
      subs[subIdx] = sub
      a[inclIdx] = { ...a[inclIdx], subItems: subs }
      return a
    })
  }

  // ─── Payments ──────────────────────────────────────────────────────────────

  function updatePayment(i: number, field: keyof PaymentRecord, val: string) {
    setPaymentRecords(prev => {
      const a = [...prev]
      a[i] = { ...a[i], [field]: field === "amount" ? parseFloat(val) || 0 : val }
      if (field === "amountType" && val === "Insurance") {
        a[i] = { ...a[i], paymentMode: "Insurance" }
      }
      return a
    })
  }
  function addPayment() {
    setPaymentRecords(prev => [...prev, { date: NOW(), amountType: "Advance", paymentMode: "Cash", amount: 0 }])
  }
  function removePayment(i: number) {
    if (paymentRecords.length > 1) setPaymentRecords(prev => prev.filter((_, j) => j !== i))
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error("Patient name is required"); return }
    if (!age || isNaN(parseInt(age))) { toast.error("Valid age is required"); return }
    if (!phone || phone.length < 10) { toast.error("Valid phone number is required"); return }
    if (!admissionDate) { toast.error("Admission date is required"); return }

    const payload = {
      name: name.trim(),
      age: parseInt(age),
      gender: gender as "MALE" | "FEMALE" | "OTHER",
      phone: phone.trim(),
      address: address.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined,
      guardianName: guardianName.trim() || undefined,
      admissionDate,
      admissionNotes: admissionNotes.trim() || undefined,
      referredBy: referredBy.trim() || undefined,
      department: department.trim() || undefined,
      doctorNames: doctorNames.filter(Boolean),
      onDutyDoctor: onDutyDoctor.trim() || undefined,
      patientId: opPatientId.trim() || undefined,
      operationName: operationName.trim() || undefined,
      operationDate: operationDate || undefined,
      dischargeDate: dischargeDate || undefined,
      operationProcedure: operationProcedure.trim() || undefined,
      operationDetails: operationDetails.trim() || undefined,
      provisionDiagnosis: provisionDiagnosis.trim() || undefined,
      packageAmount,
      discount,
      packageInclusions: packageInclusions.length > 0 ? packageInclusions : undefined,
      paymentRecords: paymentRecords.filter(r => r.amount > 0 || r.amountType.toLowerCase() === "insurance"),
    }

    setLoading(true)

    if (isEditMode) {
      const result = await updateInPatient(editInpatient.id, payload)
      setLoading(false)
      if (result.success) {
        toast.success("Inpatient updated successfully")
        onSuccess()
        handleClose()
      } else {
        toast.error(result.error ?? "Failed to update inpatient")
      }
      return
    }

    const result = await createInPatient(payload)
    setLoading(false)

    if (result.success && result.data) {
      toast.success(`Inpatient ${result.data.ipNumber} admitted successfully`)
      onSuccess(result.data as InPatient)
      handleClose()
    } else {
      toast.error(result.error ?? "Failed to admit patient")
    }
  }

  function resetForm() {
    setIpNumber(""); setSearchId(""); setOpPatientId(""); setName(""); setAge(""); setGender(""); setPhone("")
    setAddress(""); setDateOfBirth(""); setGuardianName(""); setReferredBy("Self")
    setAdmissionDate(NOW()); setAdmissionNotes("")
    setOperationDate(NOW()); setDischargeDate(TOMORROW()); setOperationName(""); setDepartment("Ophthalmology")
    setDoctorNames([""]); setOnDutyDoctor(""); setProvisionDiagnosis("")
    setOperationProcedure(""); setOperationDetails("")
    setPackageInclusions([{ name: "Surgery Charges", amount: 0, subItems: [] }])
    setDiscount(0); setSelectedPackageId("")
    setPaymentRecords([{ date: NOW(), amountType: "Advance", paymentMode: "Cash", amount: 0 }])
  }

  function handleClose() { resetForm(); onClose() }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Inpatient" : "Admit New Inpatient"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ─── Search Existing OP Patient ─── */}
          {!isEditMode && <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Search Existing OP Patient</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter OP Patient ID to search"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSearch() } }}
                className="bg-white text-base font-medium"
              />
              <Button type="button" onClick={handleSearch} disabled={isSearching} variant="outline" className="shrink-0">
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-1">Auto-fills patient info from existing OP records</p>
          </div>}

          {/* ─── Patient Information ─── */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Patient Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>IP Number</Label>
                <Input
                  value={ipNumber || "Loading..."}
                  readOnly
                  className="mt-1 bg-gray-100 text-base font-semibold text-primary"
                />
              </div>
              <div>
                <Label>Patient Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  className="mt-1 bg-white text-base font-medium"
                  required
                />
              </div>
              <div>
                <Label>Age *</Label>
                <Input
                  type="number"
                  value={age}
                  onChange={e => {
                    const val = e.target.value
                    setAge(val)
                    const n = parseInt(val)
                    if (!isNaN(n) && n > 0) setDateOfBirth(`${new Date().getFullYear() - n}-01-01`)
                    else if (val === "") setDateOfBirth("")
                  }}
                  placeholder="Years"
                  className="mt-1 bg-white text-base font-medium"
                  min={0}
                  required
                />
              </div>
              <div>
                <Label>Gender *</Label>
                <Select value={gender} onValueChange={setGender} required>
                  <SelectTrigger className="mt-1 bg-white text-base font-medium">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <DatePicker
                  value={dateOfBirth}
                  onChange={(d) => setDateOfBirth(d)}
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Guardian Name</Label>
                <Input
                  value={guardianName}
                  onChange={e => setGuardianName(e.target.value)}
                  placeholder="Guardian / attender name"
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Mobile Number *</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="10-digit number"
                  className="mt-1 bg-white text-base font-medium"
                  required
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Full address"
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
            </div>
          </div>

          {/* ─── Operation Information ─── */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Operation Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date of Admission *</Label>
                <Input
                  type="datetime-local"
                  value={admissionDate}
                  onChange={e => setAdmissionDate(e.target.value)}
                  className="mt-1 bg-white text-base font-medium"
                  required
                />
              </div>
              <div>
                <Label>Date of Discharge</Label>
                <Input
                  type="datetime-local"
                  value={dischargeDate}
                  onChange={e => setDischargeDate(e.target.value)}
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Date of Operation</Label>
                <Input
                  type="datetime-local"
                  value={operationDate}
                  onChange={e => setOperationDate(e.target.value)}
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Operation Name</Label>
                <Input
                  value={operationName}
                  onChange={e => setOperationName(e.target.value)}
                  placeholder="e.g. Cataract surgery - RE"
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Department</Label>
                <div className="mt-1">
                  <EditableComboboxWithAdd
                    options={departmentOptions}
                    value={department}
                    onValueChange={setDepartment}
                    placeholder="e.g. Ophthalmology"
                    onAddOption={async (val) => {
                      const res = await addDropdownOption("department", val)
                      if (res.success) setDepartmentOptions(prev => [...prev, val].sort())
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Referred By</Label>
                <div className="mt-1">
                  <EditableComboboxWithAdd
                    options={referredByOptions}
                    value={referredBy}
                    onValueChange={setReferredBy}
                    placeholder="Self / Doctor name"
                    onAddOption={async (val) => {
                      const res = await addDropdownOption("referredBy", val)
                      if (res.success) setReferredByOptions(prev => [...prev, val].sort())
                    }}
                  />
                </div>
              </div>

              {/* Doctor Names – dynamic array */}
              <div className="sm:col-span-2">
                <Label>Doctor(s) Name</Label>
                {doctorNames.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1">
                    <EditableComboboxWithAdd
                      options={doctorOptions}
                      value={doc}
                      onValueChange={v => setDoctor(i, v)}
                      placeholder="Doctor name"
                      onAddOption={async (val) => {
                        const res = await addDropdownOption("doctorName", val)
                        if (res.success) setDoctorOptions(prev => [...prev, val].sort())
                      }}
                    />
                    {i === doctorNames.length - 1 && (
                      <Button
                        type="button"
                        onClick={addDoctor}
                        size="icon"
                        variant="outline"
                        className="shrink-0 w-8 h-8 text-blue-600"
                      >
                        +
                      </Button>
                    )}
                    {doctorNames.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeDoctor(i)}
                        size="icon"
                        variant="outline"
                        className="shrink-0 w-8 h-8 text-red-500"
                      >
                        −
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <Label>On-Duty Call Doctor</Label>
                <div className="mt-1">
                  <EditableComboboxWithAdd
                    options={doctorOptions}
                    value={onDutyDoctor}
                    onValueChange={setOnDutyDoctor}
                    placeholder="On duty doctor"
                    onAddOption={async (val) => {
                      const res = await addDropdownOption("doctorName", val)
                      if (res.success) setDoctorOptions(prev => [...prev, val].sort())
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Provision Diagnosis</Label>
                <Input
                  value={provisionDiagnosis}
                  onChange={e => setProvisionDiagnosis(e.target.value)}
                  placeholder="e.g. Immature senile cataract"
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Procedure</Label>
                <Input
                  value={operationProcedure}
                  onChange={e => setOperationProcedure(e.target.value)}
                  placeholder="e.g. PHACO + IOL"
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div>
                <Label>Operation Details</Label>
                <Input
                  value={operationDetails}
                  onChange={e => setOperationDetails(e.target.value)}
                  placeholder="Additional operation details"
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Admission Notes</Label>
                <Textarea
                  value={admissionNotes}
                  onChange={e => setAdmissionNotes(e.target.value)}
                  placeholder="Notes on admission..."
                  rows={2}
                  className="mt-1 bg-white text-base font-medium"
                />
              </div>
            </div>
          </div>

          {/* ─── Package Details ─── */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Package Details</h3>

            {availablePackages.length > 0 && (
              <div className="mb-4">
                <Label className="mb-1 block">Select Predefined Package</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedPackageId}
                    onValueChange={v => {
                      setSelectedPackageId(v)
                      const pkg = availablePackages.find(p => p.id === v)
                      if (pkg) {
                        try {
                          const parsed = JSON.parse(pkg.inclusions) as PackageInclusion[]
                          if (parsed.length > 0) setPackageInclusions(parsed)
                        } catch {}
                        setDiscount(pkg.discount)
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-white text-base font-medium">
                      <SelectValue placeholder="Choose a package to auto-fill..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePackages.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — ₹{p.totalAmount.toLocaleString("en-IN")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPackageId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500"
                      onClick={() => {
                        setSelectedPackageId("")
                        setPackageInclusions([{ name: "Surgery Charges", amount: 0, subItems: [] }])
                        setDiscount(0)
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <Label>Package Amount (₹)</Label>
              <span className="text-sm font-semibold bg-gray-100 border border-gray-300 rounded px-3 py-1">
                ₹{packageAmount.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-gray-500">(auto-calculated from inclusions below)</span>
            </div>

            <Label className="mb-2 block">Package Inclusions</Label>
            {packageInclusions.map((incl, i) => (
              <div key={i} className="mb-3 border border-gray-200 rounded-md p-3 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Select value={incl.name} onValueChange={v => updateInclusion(i, "name", v)}>
                    <SelectTrigger className="flex-1 bg-white text-base font-medium">
                      <SelectValue placeholder="Select inclusion..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INCLUSION_OPTIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={incl.amount}
                    onChange={e => updateInclusion(i, "amount", e.target.value)}
                    placeholder="Amount"
                    className="w-28 bg-white text-base font-medium"
                    min={0}
                    onWheel={e => e.currentTarget.blur()}
                  />
                  <Button
                    type="button"
                    onClick={() => addSubItem(i)}
                    size="icon"
                    variant="outline"
                    className="shrink-0 w-8 h-8 text-green-600"
                    title="Add sub-item"
                  >
                    +
                  </Button>
                  {i === packageInclusions.length - 1 && (
                    <Button
                      type="button"
                      onClick={addInclusion}
                      size="icon"
                      variant="outline"
                      className="shrink-0 w-8 h-8 text-blue-600"
                      title="Add inclusion row"
                    >
                      +
                    </Button>
                  )}
                  {packageInclusions.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeInclusion(i)}
                      size="icon"
                      variant="outline"
                      className="shrink-0 w-8 h-8 text-red-500"
                    >
                      −
                    </Button>
                  )}
                </div>

                {/* Sub Items */}
                {incl.subItems && incl.subItems.length > 0 && (
                  <div className="ml-4 mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Sub Items</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Remaining: ₹{(incl.amount - (incl.subItems.reduce((s, x) => s + x.amount, 0))).toLocaleString("en-IN")}
                    </p>
                    <div className="grid grid-cols-12 gap-2 mb-1 text-xs font-medium text-gray-500">
                      <div className="col-span-5">Item Name</div>
                      <div className="col-span-2">Qty</div>
                      <div className="col-span-2">Rate</div>
                      <div className="col-span-2">Amount</div>
                      <div className="col-span-1"></div>
                    </div>
                    {incl.subItems.map((sub, si) => (
                      <div key={si} className="grid grid-cols-12 gap-2 mb-1 items-center">
                        <div className="col-span-5">
                          <Input
                            value={sub.itemName}
                            onChange={e => updateSubItem(i, si, "itemName", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Item name"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            value={sub.quantity}
                            onChange={e => updateSubItem(i, si, "quantity", e.target.value)}
                            className="h-7 text-xs"
                            min={1}
                            onWheel={e => e.currentTarget.blur()}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            value={sub.rate}
                            onChange={e => updateSubItem(i, si, "rate", e.target.value)}
                            className="h-7 text-xs"
                            min={0}
                            onWheel={e => e.currentTarget.blur()}
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="h-7 text-xs bg-gray-100 border border-gray-300 rounded px-2 flex items-center">
                            ₹{sub.amount.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            onClick={() => removeSubItem(i, si)}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500"
                          >
                            −
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ─── Payment Records ─── */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Records</h3>

            {/* Summary */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-600">Net Amount</p>
                <p className="text-base font-semibold text-blue-700">₹{netAmount.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-500">(Package − Discount)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600">Total Received</p>
                <p className="text-base font-semibold text-green-700">₹{totalReceived.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-500">(Sum of all payments)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600">Balance Amount</p>
                <p className="text-base font-semibold text-red-700">₹{balanceAmount.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-500">(Net − Received)</p>
              </div>
            </div>

            {paymentRecords.map((rec, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3 pb-3 border-b border-gray-200 last:border-b-0"
              >
                <div>
                  <Label className="text-xs">Date &amp; Time</Label>
                  <Input
                    type="datetime-local"
                    value={rec.date}
                    onChange={e => updatePayment(i, "date", e.target.value)}
                    className="mt-1 bg-white text-sm font-medium"
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount Type</Label>
                  <Select value={rec.amountType} onValueChange={v => updatePayment(i, "amountType", v)}>
                    <SelectTrigger className="mt-1 bg-white text-sm font-medium">
                      <SelectValue placeholder="Advance" />
                    </SelectTrigger>
                    <SelectContent>
                      {AMOUNT_TYPE_OPTIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Payment Mode</Label>
                  <Select value={rec.paymentMode} onValueChange={v => updatePayment(i, "paymentMode", v)}>
                    <SelectTrigger className="mt-1 bg-white text-sm font-medium">
                      <SelectValue placeholder="Cash" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODE_OPTIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input
                      type="number"
                      value={rec.amount}
                      onChange={e => updatePayment(i, "amount", e.target.value)}
                      placeholder="0"
                      className="mt-1 bg-white text-sm font-medium"
                      min={0}
                      onWheel={e => e.currentTarget.blur()}
                    />
                  </div>
                  <div className="flex gap-1 mb-1">
                    {i === paymentRecords.length - 1 && (
                      <Button type="button" onClick={addPayment} size="icon" variant="outline" className="w-8 h-8 text-blue-600">
                        +
                      </Button>
                    )}
                    {paymentRecords.length > 1 && (
                      <Button type="button" onClick={() => removePayment(i)} size="icon" variant="outline" className="w-8 h-8 text-red-500">
                        −
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Discount + Totals */}
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Package Amount:</span>
                  <span className="font-medium">₹{packageAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Discount:</span>
                  <div className="flex items-center gap-1">
                    <span>₹</span>
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                      onWheel={e => e.currentTarget.blur()}
                      className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                      placeholder="0"
                      min={0}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Net Amount:</span>
                  <span className="font-medium">₹{netAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Received:</span>
                  <span className="font-medium">₹{totalReceived.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Balance:</span>
                  <span className="font-medium text-red-600">₹{balanceAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Actions ─── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditMode ? "Saving..." : "Admitting...") : (isEditMode ? "Save Changes" : "Admit Patient")}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  )
}
