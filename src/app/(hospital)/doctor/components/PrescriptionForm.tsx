"use client"

import { useState, forwardRef, useImperativeHandle, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Plus, X, Loader2, Search, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditableCombobox, EditableComboboxWithAdd } from "@/components/ui/combobox"
import {
  savePrescription,
  addDropdownOption,
  updatePatientToWithDoctor,
  getMedicineMaster,
} from "../actions"
import { formatDate } from "@/lib/utils"

const MEDICINE_TIMINGS = [
  "1-1-1", "1-1-1-1", "1-0-1", "1-0-0", "0-0-1", "0-1-0",
  "1-1-0", "0-1-1", "SOS", "BD", "TDS", "QID", "OD",
  "Tapering", "Weekly", "Monthly",
]

const MEDICINE_DAYS = [
  "1", "3", "5", "7", "10", "14", "21", "28", "30", "45", "60",
  "90", "Continuous",
]

const MEDICINE_CATEGORIES = [
  "Eye Drop", "Tablet", "Ointment", "Capsule", "Injection", "Syrup", "Other",
]

interface Medicine {
  id: string
  name: string
  days: string
  timing: string
  note: string
}

interface Investigation {
  id: string
  name: string
  note: string
}

interface Template {
  id: string
  code: string
  name: string
  presentComplaint: string | null
  previousHistory: string | null
  provisionalDiagnosis: string | null
  medicines: string
  investigations: string
  followUpDays: number | null
  additionalNotes: string | null
}

export type PrescriptionReferenceData = {
  medicines: { name: string; defaultTiming: string | null; defaultDays: string | null; note: string | null }[]
  investigations: string[]
  complaintOptions: string[]
  previousHistoryOptions: string[]
  diagnosisOptions: string[]
  additionalNotesOptions: string[]
  templates: Template[]
}

interface Props {
  patientId: string
  patientName: string
  existingPrescription?: {
    doctorName: string | null
    presentComplaint: string | null
    previousHistory: string | null
    diagnosis: string | null
    medicines: string
    investigations: string
    followUpDate: Date | null
    notes: string | null
    temperature: number | null
    pulseRate: number | null
    spo2: number | null
    heightCm?: number | null
    weightKg?: number | null
  } | null
  referenceData: PrescriptionReferenceData
  onReferenceDataChange: (next: PrescriptionReferenceData) => void
  onSaved?: () => void
  /** When true, show Height / Weight / BMI inputs in the vitals row. */
  vitalsExtended?: boolean
}

export interface PrescriptionFormHandle {
  save: () => Promise<void>
}

export const PrescriptionForm = forwardRef<PrescriptionFormHandle, Props>(
function PrescriptionForm({ patientId, patientName, existingPrescription, referenceData, onReferenceDataChange, onSaved, vitalsExtended = false }, ref) {
  const [doctorName, setDoctorName] = useState(existingPrescription?.doctorName ?? "")
  const [temperature, setTemperature] = useState(existingPrescription?.temperature?.toString() ?? "")
  const [pulseRate, setPulseRate] = useState(existingPrescription?.pulseRate?.toString() ?? "")
  const [spo2, setSpo2] = useState(existingPrescription?.spo2?.toString() ?? "")
  const [heightCm, setHeightCm] = useState(existingPrescription?.heightCm?.toString() ?? "")
  const [weightKg, setWeightKg] = useState(existingPrescription?.weightKg?.toString() ?? "")

  // BMI = weight(kg) / height(m)^2. Computed on the fly, not stored.
  const bmi = (() => {
    const h = parseFloat(heightCm)
    const w = parseFloat(weightKg)
    if (!h || !w || h <= 0 || w <= 0) return ""
    const heightM = h / 100
    return (w / (heightM * heightM)).toFixed(1)
  })()

  const [presentComplaint, setPresentComplaint] = useState(existingPrescription?.presentComplaint ?? "")
  const [previousHistory, setPreviousHistory] = useState(existingPrescription?.previousHistory ?? "")
  const [diagnosis, setDiagnosis] = useState(existingPrescription?.diagnosis ?? "")
  const [additionalNotes, setAdditionalNotes] = useState("")

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    if (existingPrescription?.medicines) {
      try {
        const m = JSON.parse(existingPrescription.medicines)
        if (m.length > 0) return m.map((x: Medicine) => ({ ...x, id: x.id ?? Math.random().toString() }))
      } catch { /* fall through */ }
    }
    return [{ id: Math.random().toString(), name: "", days: "", timing: "", note: "" }]
  })

  const [investigations, setInvestigations] = useState<Investigation[]>(() => {
    if (existingPrescription?.investigations) {
      try {
        const i = JSON.parse(existingPrescription.investigations)
        if (i.length > 0) return i.map((x: Investigation) => ({ ...x, id: x.id ?? Math.random().toString() }))
      } catch { /* fall through */ }
    }
    return [
      { id: Math.random().toString(), name: "", note: "" },
      { id: Math.random().toString(), name: "", note: "" },
    ]
  })

  const [followUpDate, setFollowUpDate] = useState(() => {
    if (!existingPrescription?.followUpDate) return ""
    const d = new Date(existingPrescription.followUpDate)
    return isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d)
  })
  const [followUpDays, setFollowUpDays] = useState("")
  const [notes, setNotes] = useState(existingPrescription?.notes ?? "")
  const [submitting, setSubmitting] = useState(false)

  // Reference data is provided by the parent (loaded once at page level).
  const { investigations: investigationOptions, complaintOptions, previousHistoryOptions, diagnosisOptions, additionalNotesOptions, templates } = referenceData

  // Load medicines from DB on mount to ensure the dropdown always has data
  // even if the server-side pre-load returned empty (e.g. query error).
  const [medicineMasterFull, setMedicineMasterFull] = useState(referenceData.medicines)
  const medicinesFetched = useRef(false)
  useEffect(() => {
    if (medicinesFetched.current) return
    medicinesFetched.current = true
    getMedicineMaster().then(data => {
      if (data.length > 0) setMedicineMasterFull(data)
    }).catch(() => {})
  }, [])

  const medicineOptions = medicineMasterFull.map(x => x.name)
  const [templateSearch, setTemplateSearch] = useState("")
  const [showTemplateList, setShowTemplateList] = useState(false)

  function addMedicine() {
    setMedicines(prev => [...prev, { id: Math.random().toString(), name: "", days: "", timing: "", note: "" }])
  }

  function removeMedicine(id: string) {
    setMedicines(prev => prev.filter(m => m.id !== id))
  }

  function updateMedicine(id: string, field: keyof Medicine, value: string) {
    setMedicines(prev => prev.map(m => {
      if (m.id !== id) return m
      if (field === "name") {
        const master = medicineMasterFull.find(x => x.name === value)
        if (master) {
          // Exact match — always apply master defaults so selecting from dropdown always fills
          return {
            ...m,
            name: value,
            timing: master.defaultTiming ?? m.timing,
            days: master.defaultDays ?? m.days,
            note: master.note ?? m.note,
          }
        }
        // Partial / custom name — just update name, keep existing timing/days/note
        return { ...m, name: value }
      }
      return { ...m, [field]: value }
    }))
  }

  function addInvestigation() {
    setInvestigations(prev => [...prev, { id: Math.random().toString(), name: "", note: "" }])
  }

  function removeInvestigation(id: string) {
    setInvestigations(prev => prev.filter(i => i.id !== id))
  }

  function updateInvestigation(id: string, field: keyof Investigation, value: string) {
    setInvestigations(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function applyTemplate(t: Template) {
    if (t.presentComplaint) setPresentComplaint(t.presentComplaint)
    if (t.previousHistory) setPreviousHistory(t.previousHistory)
    if (t.provisionalDiagnosis) setDiagnosis(t.provisionalDiagnosis)
    if (t.additionalNotes) setNotes(t.additionalNotes)
    try {
      const meds = JSON.parse(t.medicines)
      if (meds.length > 0) setMedicines(meds.map((m: Medicine) => ({ ...m, id: Math.random().toString() })))
    } catch { /* ignore */ }
    try {
      const invs = JSON.parse(t.investigations)
      if (invs.length > 0) setInvestigations(invs.map((i: string | Investigation) => ({
        id: Math.random().toString(),
        name: typeof i === "string" ? i : i.name,
        note: typeof i === "string" ? "" : (i.note ?? ""),
      })))
    } catch { /* ignore */ }
    if (t.followUpDays) {
      const d = new Date()
      d.setDate(d.getDate() + t.followUpDays)
      setFollowUpDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d))
    }
    setTemplateSearch("")
    setShowTemplateList(false)
    toast.success(`Template "${t.name}" applied`)
  }

  async function handleStartConsultation() {
    await updatePatientToWithDoctor(patientId)
  }

  async function handleSave() {
    setSubmitting(true)
    try {
      const result = await savePrescription({
        patientId,
        temperature: temperature ? parseFloat(temperature) : null,
        pulseRate: pulseRate ? parseInt(pulseRate) : null,
        spo2: spo2 ? parseInt(spo2) : null,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        presentComplaint: presentComplaint.trim() || undefined,
        previousHistory: previousHistory.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        medicines: medicines.filter(m => m.name.trim()),
        investigations: investigations.filter(i => i.name.trim()),
        followUpDate: followUpDate || undefined,
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        toast.success("Prescription saved — patient marked as Visited")
        onSaved?.()
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error("Failed to save prescription")
      console.error("Save prescription error:", err)
    } finally {
      setSubmitting(false)
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }))

  const filteredTemplates = templateSearch.trim()
    ? templates.filter(t =>
        t.code.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.name.toLowerCase().includes(templateSearch.toLowerCase())
      )
    : templates

  return (
    <div className="space-y-4 [&_input]:text-gray-900 [&_input]:font-semibold [&_input]:placeholder:text-gray-300 [&_input]:placeholder:font-normal [&_textarea]:text-gray-900 [&_textarea]:font-semibold [&_textarea]:placeholder:text-gray-300 [&_textarea]:placeholder:font-normal [&_[role=combobox]]:text-gray-900 [&_[role=combobox]]:font-semibold">

      {/* Quick Fill from Template — compact single row */}
      <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 shrink-0 text-primary">
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Quick Fill</span>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={templateSearch}
              onChange={e => { setTemplateSearch(e.target.value); setShowTemplateList(true) }}
              onFocus={() => setShowTemplateList(true)}
              onBlur={() => setTimeout(() => setShowTemplateList(false), 150)}
              placeholder="Search templates by code or name…"
              className="pl-8 h-8 bg-white border-primary/15 focus-visible:ring-primary/30"
            />
            {showTemplateList && filteredTemplates.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{filteredTemplates.length} found</p>
                </div>
                {filteredTemplates.map((t) => {
                  let medCount = 0
                  try { medCount = JSON.parse(t.medicines).length } catch { /* ignore */ }
                  return (
                    <button
                      key={t.id}
                      onMouseDown={() => applyTemplate(t)}
                      className="group w-full flex items-center gap-3 px-3 py-2 hover:bg-primary/[0.06] text-left transition-colors border-b border-border/40 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-mono font-semibold text-primary/70 tracking-wider shrink-0">
                            {t.code}
                          </span>
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {t.name}
                          </p>
                        </div>
                        {t.provisionalDiagnosis && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.provisionalDiagnosis}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground tabular-nums">
                        {medCount} med{medCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vitals — inline row with unit-suffixes, no heavy card */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vitals</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <Input
              type="number"
              value={temperature}
              onChange={e => setTemperature(e.target.value)}
              placeholder="98.6"
              className="pr-14 h-9 bg-white"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none">°F · Temp</span>
          </div>
          <div className="relative">
            <Input
              type="number"
              value={pulseRate}
              onChange={e => setPulseRate(e.target.value)}
              placeholder="72"
              className="pr-16 h-9 bg-white"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none">bpm · Pulse</span>
          </div>
          <div className="relative">
            <Input
              type="number"
              value={spo2}
              onChange={e => setSpo2(e.target.value)}
              placeholder="98"
              className="pr-16 h-9 bg-white"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none">% · SpO₂</span>
          </div>
        </div>
        {vitalsExtended && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="relative">
              <Input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                placeholder="170"
                className="pr-16 h-9 bg-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none">cm · Height</span>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                placeholder="65"
                className="pr-16 h-9 bg-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none">kg · Weight</span>
            </div>
            <div className="relative">
              <Input
                type="text"
                value={bmi}
                readOnly
                placeholder="—"
                className="pr-16 h-9 bg-slate-50 cursor-default"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none">BMI</span>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Notes — single white card */}
      <div className="rounded-xl border border-border/60 bg-white">
        <div className="px-4 py-2.5 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground">Clinical Notes</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Present Complaint</Label>
            <EditableComboboxWithAdd
              options={complaintOptions}
              value={presentComplaint}
              onValueChange={setPresentComplaint}
              onAddOption={async (v) => {
                await addDropdownOption("presentComplaint", v)
                onReferenceDataChange({ ...referenceData, complaintOptions: [...complaintOptions, v] })
                toast.success("Option added")
              }}
              placeholder="Chief complaint…"
              autoUpperCase
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Previous History</Label>
            <EditableComboboxWithAdd
              options={previousHistoryOptions}
              value={previousHistory}
              onValueChange={setPreviousHistory}
              onAddOption={async (v) => {
                await addDropdownOption("previousHistory", v)
                onReferenceDataChange({ ...referenceData, previousHistoryOptions: [...previousHistoryOptions, v] })
                toast.success("Option added")
              }}
              placeholder="Previous eye conditions, surgeries, medications…"
              autoUpperCase
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Diagnosis</Label>
            <EditableComboboxWithAdd
              options={diagnosisOptions}
              value={diagnosis}
              onValueChange={setDiagnosis}
              onAddOption={async (v) => {
                await addDropdownOption("diagnosis", v)
                onReferenceDataChange({ ...referenceData, diagnosisOptions: [...diagnosisOptions, v] })
                toast.success("Option added")
              }}
              placeholder="Provisional/Final diagnosis…"
              autoUpperCase
            />
          </div>
        </div>
      </div>

      {/* Medicines */}
      <div className="rounded-xl border border-border/60 bg-white">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Medications</h3>
            {medicineOptions.length === 0 && (
              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                No predefined medicines — add in Settings → Medicines
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={addMedicine}
            className="h-7 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/5"
          >
            <Plus className="h-3.5 w-3.5" /> Add medicine
          </Button>
        </div>
        {medicines.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground italic">No medicines added.</p>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {medicines.map((med, index) => (
              <div
                key={med.id}
                className="grid gap-2 items-center"
                style={{ gridTemplateColumns: "20px 2fr 1fr 1fr 2fr 28px" }}
              >
                <span className="text-[11px] font-mono text-muted-foreground/70 tabular-nums text-right">{index + 1}</span>
                <EditableCombobox
                  options={medicineOptions}
                  value={med.name}
                  onValueChange={v => updateMedicine(med.id, "name", v)}
                  placeholder="Medicine name"
                />
                <EditableCombobox
                  options={MEDICINE_DAYS}
                  value={med.days}
                  onValueChange={v => updateMedicine(med.id, "days", v)}
                  placeholder="Days"
                />
                <EditableCombobox
                  options={MEDICINE_TIMINGS}
                  value={med.timing}
                  onValueChange={v => updateMedicine(med.id, "timing", v)}
                  placeholder="Timing"
                />
                <Input
                  value={med.note}
                  onChange={e => updateMedicine(med.id, "note", e.target.value)}
                  placeholder="Note (optional)"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeMedicine(med.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Investigations */}
      <div className="rounded-xl border border-border/60 bg-white">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground">Investigations / Advice</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={addInvestigation}
            className="h-7 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/5"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {investigations.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground italic">No investigations added.</p>
        ) : (
          <div className="px-4 py-3 grid grid-cols-2 gap-2">
            {investigations.map((inv, index) => (
              <div key={inv.id} className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-muted-foreground/70 tabular-nums w-4 text-right">{index + 1}</span>
                <EditableCombobox
                  options={investigationOptions}
                  value={inv.name}
                  onValueChange={v => updateInvestigation(inv.id, "name", v)}
                  placeholder="Investigation name"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeInvestigation(inv.id)}
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-up & Notes — compact card */}
      <div className="rounded-xl border border-border/60 bg-white p-4 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Follow-up</Label>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <Input
                type="number"
                min="1"
                value={followUpDays}
                onChange={e => {
                  const days = e.target.value
                  setFollowUpDays(days)
                  if (days && parseInt(days) > 0) {
                    const d = new Date()
                    d.setDate(d.getDate() + parseInt(days))
                    setFollowUpDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d))
                  }
                }}
                placeholder="Days"
                className="w-20 pr-7"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">d</span>
            </div>
            <Input
              type="date"
              value={followUpDate}
              onChange={e => {
                setFollowUpDate(e.target.value)
                setFollowUpDays("")
              }}
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Additional Notes</Label>
          <EditableComboboxWithAdd
            options={additionalNotesOptions}
            value={notes}
            onValueChange={setNotes}
            onAddOption={async (v) => {
              await addDropdownOption("additionalNotes", v)
              onReferenceDataChange({ ...referenceData, additionalNotesOptions: [...additionalNotesOptions, v] })
              toast.success("Option added")
            }}
            placeholder="Any additional instructions…"
          />
        </div>
      </div>
    </div>
  )
})
PrescriptionForm.displayName = "PrescriptionForm"
