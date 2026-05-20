"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  getInPatientAdmissionFormData,
  createInPatient,
  updateInPatient,
} from "../actions"
import { Step1Patient } from "./Step1Patient"
import { Step2Hospital } from "./Step2Hospital"
import { Step3Payment } from "./Step3Payment"
import type { WizardState, WizardBundledData } from "./_wizard-types"
import type { InPatient, PackageInclusion, PaymentRecord } from "@/lib/types"

const NOW = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
const TOMORROW = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const EMPTY_STATE: WizardState = {
  opPatientId: "",
  ipNumber: "",
  admissionDate: NOW(),
  name: "", age: "", gender: "", dateOfBirth: "", phone: "",
  address: "", guardianName: "", referredBy: "Self", admissionNotes: "",
  operationDate: TOMORROW(),
  operationName: "", department: "Ophthalmology",
  doctorNames: [""], onDutyDoctors: [""],
  provisionDiagnosis: "", operationProcedure: "", operationDetails: "",
  packageInclusions: [{ name: "", amount: 0 }],
  discount: 0,
  paymentRecords: [],
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editInpatient?: InPatient | null
  initialData?: WizardBundledData | null
}

export default function InPatientAdmissionForm({ open, onClose, onSuccess, editInpatient, initialData }: Props) {
  const isEditMode = !!editInpatient
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [state, setState] = useState<WizardState>(EMPTY_STATE)
  const [data, setData] = useState<WizardBundledData | null>(initialData ?? null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load data when the modal opens. If parent already prefetched (admit flow),
  // skip the fetch — no in-dialog loader flicker.
  useEffect(() => {
    if (!open) return
    setStep(1)
    if (initialData) {
      setData(initialData)
      return
    }
    let cancelled = false
    setLoading(true)
    getInPatientAdmissionFormData()
      .then(d => { if (!cancelled) setData(d) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, initialData])

  // Seed state when data + editInpatient are known.
  useEffect(() => {
    if (!open || !data) return
    if (editInpatient) {
      setState(stateFromInpatient(editInpatient))
    } else {
      setState({ ...EMPTY_STATE, ipNumber: data.nextIpNumber })
    }
  }, [open, data, editInpatient])

  // Net amount memo (used in step 3 + submit)
  const packageAmount = useMemo(
    () => state.packageInclusions.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [state.packageInclusions],
  )
  const netAmount = packageAmount - (Number(state.discount) || 0)
  const totalReceived = useMemo(
    () => state.paymentRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [state.paymentRecords],
  )

  function validStep1(): boolean {
    return (
      state.name.trim() !== "" &&
      state.age.trim() !== "" &&
      state.gender !== "" &&
      state.phone.trim() !== "" &&
      state.admissionDate !== ""
    )
  }
  function validStep2(): boolean {
    return state.operationName.trim() !== "" && state.doctorNames.some(d => d.trim() !== "")
  }
  function validStep3(): boolean {
    return state.packageInclusions.length > 0 && state.packageInclusions.some(i => i.name.trim() !== "")
  }

  async function handleSubmit() {
    if (!validStep1()) { toast.error("Please complete Step 1"); setStep(1); return }
    if (!validStep2()) { toast.error("Please complete Step 2"); setStep(2); return }
    if (!validStep3()) { toast.error("Please add at least one package inclusion"); setStep(3); return }
    setSubmitting(true)
    const payload = {
      patientId: state.opPatientId || undefined,
      ipNumber: state.ipNumber,
      admissionDate: state.admissionDate,
      admissionNotes: state.admissionNotes.trim() || undefined,
      name: state.name.trim(),
      age: parseInt(state.age, 10),
      gender: state.gender as "MALE" | "FEMALE" | "OTHER",
      phone: state.phone.trim(),
      dateOfBirth: state.dateOfBirth || undefined,
      address: state.address.trim() || undefined,
      guardianName: state.guardianName.trim() || undefined,
      referredBy: state.referredBy.trim() || undefined,
      department: state.department.trim() || undefined,
      doctorNames: state.doctorNames.map(d => d.trim()).filter(Boolean),
      onDutyDoctors: state.onDutyDoctors.map(d => d.trim()).filter(Boolean),
      operationName: state.operationName.trim() || undefined,
      operationDate: state.operationDate || undefined,
      operationProcedure: state.operationProcedure.trim() || undefined,
      operationDetails: state.operationDetails.trim() || undefined,
      provisionDiagnosis: state.provisionDiagnosis.trim() || undefined,
      packageInclusions: state.packageInclusions.filter(i => i.name.trim()),
      packageAmount,
      discount: Number(state.discount) || 0,
      netAmount,
      paymentRecords: state.paymentRecords,
      totalReceivedAmount: totalReceived,
      balanceAmount: netAmount - totalReceived,
    }
    const result = isEditMode
      ? await updateInPatient(editInpatient!.id, payload)
      : await createInPatient(payload)
    setSubmitting(false)
    if (result.success) {
      toast.success(isEditMode ? "In-patient updated" : "Patient admitted")
      onSuccess()
      onClose()
    } else {
      toast.error(result.error)
    }
  }

  const stepLabels: { n: 1 | 2 | 3; label: string; valid: () => boolean }[] = [
    { n: 1, label: "Patient Details", valid: validStep1 },
    { n: 2, label: "Hospital Information", valid: validStep2 },
    { n: 3, label: "Payment & Package", valid: validStep3 },
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? `Edit In-Patient: ${editInpatient?.name ?? ""}` : "Admit In-Patient"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-3 border-b border-border/60">
          {stepLabels.map((s, idx) => {
            const active = step === s.n
            const complete = s.n < step || (isEditMode && s.valid())
            const clickable = isEditMode
            return (
              <div key={s.n} className="flex items-center">
                <button
                  type="button"
                  onClick={() => clickable && setStep(s.n)}
                  disabled={!clickable && !active}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                    active && "bg-primary/10 text-primary font-medium",
                    !active && complete && "text-foreground",
                    !active && !complete && "text-muted-foreground",
                    clickable && "cursor-pointer hover:bg-muted/60",
                  )}
                >
                  <span className={cn(
                    "h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center",
                    active && "bg-primary text-white",
                    !active && complete && "bg-primary/20 text-primary",
                    !active && !complete && "bg-muted text-muted-foreground",
                  )}>
                    {complete && !active ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                </button>
                {idx < stepLabels.length - 1 && (
                  <span className={cn("w-8 h-px mx-1", step > s.n ? "bg-primary/40" : "bg-border")} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading || !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {step === 1 && <Step1Patient state={state} setState={setState} data={data} isEditMode={isEditMode} />}
              {step === 2 && <Step2Hospital state={state} setState={setState} data={data} isEditMode={isEditMode} />}
              {step === 3 && <Step3Payment  state={state} setState={setState} data={data} isEditMode={isEditMode} />}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border/60 px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <div className="flex-1" />
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={submitting}>
              Back
            </Button>
          )}
          {step < 3 && !isEditMode && (
            <Button onClick={() => setStep((step + 1) as 1 | 2 | 3)} disabled={submitting}>
              Next
            </Button>
          )}
          {(step === 3 || isEditMode) && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditMode ? "Save" : "Admit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateTimeString(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 16)
}

function stateFromInpatient(ip: InPatient): WizardState {
  const doctorNames = (() => {
    try { const v = JSON.parse(ip.doctorNames) as string[]; return v.length ? v : [""] }
    catch { return [""] }
  })()
  const onDutyDoctors = (() => {
    try { const v = JSON.parse(ip.onDutyDoctors) as string[]; return v.length ? v : [""] }
    catch { return [""] }
  })()
  const packageInclusions = (() => {
    try { return JSON.parse(ip.packageInclusions ?? "[]") as PackageInclusion[] }
    catch { return [{ name: "", amount: 0 }] }
  })()
  const paymentRecords = (() => {
    try { return JSON.parse(ip.paymentRecords ?? "[]") as PaymentRecord[] }
    catch { return [] }
  })()
  return {
    opPatientId: "",
    ipNumber: ip.ipNumber,
    admissionDate: toLocalDateTimeString(ip.admissionDate),
    name: ip.name,
    age: String(ip.age ?? ""),
    gender: ip.gender ?? "",
    dateOfBirth: ip.dateOfBirth ? toLocalDateTimeString(ip.dateOfBirth).slice(0, 10) : "",
    phone: ip.phone ?? "",
    address: ip.address ?? "",
    guardianName: ip.guardianName ?? "",
    referredBy: ip.referredBy ?? "Self",
    admissionNotes: ip.admissionNotes ?? "",
    operationDate: ip.operationDate ? toLocalDateTimeString(ip.operationDate) : "",
    operationName: ip.operationName ?? "",
    department: ip.department ?? "Ophthalmology",
    doctorNames,
    onDutyDoctors,
    provisionDiagnosis: ip.provisionDiagnosis ?? "",
    operationProcedure: ip.operationProcedure ?? "",
    operationDetails: ip.operationDetails ?? "",
    packageInclusions: packageInclusions.length ? packageInclusions : [{ name: "", amount: 0 }],
    discount: ip.discount ?? 0,
    paymentRecords,
  }
}
