"use client"

import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { toast } from "sonner"
import { Plus, X, Loader2, Search, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditableCombobox, EditableComboboxWithAdd } from "@/components/ui/combobox"
import {
  savePrescription,
  getMedicineMaster,
  getInvestigationMaster,
  getDropdownOptions,
  addDropdownOption,
  getPredefinedTemplates,
  updatePatientToWithDoctor,
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
  } | null
  onSaved?: () => void
}

export interface PrescriptionFormHandle {
  save: () => Promise<void>
}

export const PrescriptionForm = forwardRef<PrescriptionFormHandle, Props>(
function PrescriptionForm({ patientId, patientName, existingPrescription, onSaved }, ref) {
  const [doctorName, setDoctorName] = useState(existingPrescription?.doctorName ?? "")
  const [temperature, setTemperature] = useState(existingPrescription?.temperature?.toString() ?? "")
  const [pulseRate, setPulseRate] = useState(existingPrescription?.pulseRate?.toString() ?? "")
  const [spo2, setSpo2] = useState(existingPrescription?.spo2?.toString() ?? "")

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

  type MedicineMasterEntry = { name: string; defaultTiming: string | null; defaultDays: string | null; note: string | null }

  const [medicineMasterFull, setMedicineMasterFull] = useState<MedicineMasterEntry[]>([])
  const [medicineOptions, setMedicineOptions] = useState<string[]>([])
  const [investigationOptions, setInvestigationOptions] = useState<string[]>([])
  const [complaintOptions, setComplaintOptions] = useState<string[]>([])
  const [previousHistoryOptions, setPreviousHistoryOptions] = useState<string[]>([])
  const [diagnosisOptions, setDiagnosisOptions] = useState<string[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateSearch, setTemplateSearch] = useState("")
  const [showTemplateList, setShowTemplateList] = useState(false)

  useEffect(() => {
    async function loadOptions() {
      const [meds, invs, complaints, histories, diags, tmplts] = await Promise.all([
        getMedicineMaster().then(m => m.map(x => x.name)),
        getInvestigationMaster().then(i => i.map(x => x.name)),
        getDropdownOptions("presentComplaint"),
        getDropdownOptions("previousHistory"),
        getDropdownOptions("diagnosis"),
        getPredefinedTemplates(),
      ])
      setMedicineMasterFull(meds)
      setMedicineOptions(meds.map(x => x.name))
      setInvestigationOptions(invs)
      setComplaintOptions(complaints)
      setPreviousHistoryOptions(histories)
      setDiagnosisOptions(diags)
      setTemplates(tmplts as unknown as Template[])
    }
    loadOptions()
  }, [])

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
        // Auto-fill timing, days, note from medicine master (only if the field is currently empty)
        const master = medicineMasterFull.find(x => x.name === value)
        return {
          ...m,
          name: value,
          timing: m.timing || (master?.defaultTiming ?? ""),
          days: m.days || (master?.defaultDays ?? ""),
          note: m.note || (master?.note ?? ""),
        }
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
    <div className="space-y-5 [&_input:not(:placeholder-shown)]:text-gray-900 [&_input:not(:placeholder-shown)]:font-semibold [&_input:not(:placeholder-shown)]:text-[0.9rem] [&_textarea:not(:placeholder-shown)]:text-gray-900 [&_textarea:not(:placeholder-shown)]:font-semibold [&_textarea:not(:placeholder-shown)]:text-[0.9rem]">

      {/* Quick Fill from Template */}
      <div className="rounded-lg border border-blue-200 bg-blue-50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">Quick Fill from Template</p>
          </div>
          <p className="text-xs text-blue-600 mb-3">Search and select a predefined template to auto-fill the form fields below.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={templateSearch}
              onChange={e => { setTemplateSearch(e.target.value); setShowTemplateList(true) }}
              onFocus={() => setShowTemplateList(true)}
              onBlur={() => setTimeout(() => setShowTemplateList(false), 150)}
              placeholder="Search templates by code or name..."
              className="pl-9 bg-white"
            />
            {showTemplateList && filteredTemplates.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Templates</p>
                  <p className="text-[11px] text-gray-400">{filteredTemplates.length} found</p>
                </div>

                {filteredTemplates.map((t) => {
                  let medCount = 0
                  try { medCount = JSON.parse(t.medicines).length } catch { /* ignore */ }
                  return (
                    <button
                      key={t.id}
                      onMouseDown={() => applyTemplate(t)}
                      className="group w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/60 text-left transition-colors duration-100 border-b border-gray-100 last:border-0"
                    >
                      {/* Code badge */}
                      <span className="h-8 w-8 flex items-center justify-center rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-[11px] font-bold shrink-0 leading-none">
                        {t.code}
                      </span>

                      {/* Name + diagnosis */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.82rem] font-semibold text-gray-800 leading-snug truncate group-hover:text-blue-700 transition-colors">
                          {t.name}
                        </p>
                        {t.provisionalDiagnosis && (
                          <p className="text-[11px] text-gray-400 leading-snug truncate mt-0.5">{t.provisionalDiagnosis}</p>
                        )}
                      </div>

                      {/* Medicine count pill */}
                      <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
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

    {/* Vitals & Clinical Notes — single section */}
      <div className="bg-gray-50 border border-border rounded-lg p-4 space-y-4 [&_input]:bg-white [&_textarea]:bg-white">

        {/* Vitals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Temperature (°F)</Label>
            <Input
              type="number"
              value={temperature}
              onChange={e => setTemperature(e.target.value)}
              placeholder="98.6"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pulse Rate</Label>
            <Input
              type="number"
              value={pulseRate}
              onChange={e => setPulseRate(e.target.value)}
              placeholder="72"
            />
          </div>
          <div className="space-y-1.5">
            <Label>SpO2 (%)</Label>
            <Input
              type="number"
              value={spo2}
              onChange={e => setSpo2(e.target.value)}
              placeholder="98"
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Clinical Notes */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Present Complaint</Label>
            <EditableComboboxWithAdd
              options={complaintOptions}
              value={presentComplaint}
              onValueChange={setPresentComplaint}
              onAddOption={async (v) => {
                await addDropdownOption("presentComplaint", v)
                setComplaintOptions(prev => [...prev, v])
                toast.success("Option added")
              }}
              placeholder="Chief complaint..."
              autoUpperCase
            />
          </div>
          <div className="space-y-1.5">
            <Label>Previous History</Label>
            <EditableComboboxWithAdd
              options={previousHistoryOptions}
              value={previousHistory}
              onValueChange={setPreviousHistory}
              onAddOption={async (v) => {
                await addDropdownOption("previousHistory", v)
                setPreviousHistoryOptions(prev => [...prev, v])
                toast.success("Option added")
              }}
              placeholder="Previous eye conditions, surgeries, medications..."
              autoUpperCase
            />
          </div>
          <div className="space-y-1.5">
            <Label>Diagnosis</Label>
            <EditableComboboxWithAdd
              options={diagnosisOptions}
              value={diagnosis}
              onValueChange={setDiagnosis}
              onAddOption={async (v) => {
                await addDropdownOption("diagnosis", v)
                setDiagnosisOptions(prev => [...prev, v])
                toast.success("Option added")
              }}
              placeholder="Provisional/Final diagnosis..."
              autoUpperCase
            />
          </div>
        </div>

      </div>

      {/* Medicines */}
      <div className="rounded-lg border border-border bg-gray-50 [&_input]:bg-white">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <Label className="text-sm font-medium">Medications</Label>
          <Button size="sm" variant="secondary" onClick={addMedicine}>
            <Plus className="h-3.5 w-3.5" /> Add Medicine
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {medicines.map((med, index) => (
            <div key={med.id} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Medicine {index + 1}</p>
              <div className="grid gap-2 items-center" style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr 32px" }}>
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
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Investigations */}
      <div className="rounded-lg border border-border bg-gray-50 [&_input]:bg-white">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <Label className="text-sm font-medium">Investigations / Advice</Label>
          <Button size="sm" variant="secondary" onClick={addInvestigation}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3">
          {investigations.map((inv, index) => (
            <div key={inv.id} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Investigation {index + 1}</p>
              <div className="flex items-center gap-1">
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
                  className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up & Notes */}
      <div className="rounded-lg border border-border bg-gray-50 [&_input]:bg-white">
        <div className="px-4 py-2.5 border-b border-border">
          <Label className="text-sm font-medium">Follow-up &amp; Notes</Label>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Follow-up Date</Label>
            <div className="flex items-center gap-2">
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
                className="w-20 shrink-0"
              />
              <span className="text-xs text-muted-foreground shrink-0">days</span>
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
            <Label>Additional Notes</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional instructions..."
            />
          </div>
        </div>
      </div>
    </div>
  )
})
PrescriptionForm.displayName = "PrescriptionForm"
