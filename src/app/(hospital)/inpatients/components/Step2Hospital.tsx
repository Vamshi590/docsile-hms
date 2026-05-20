"use client"

import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { EditableCombobox } from "@/components/ui/combobox"
import { Search, RotateCcw } from "lucide-react"
import type { StepProps } from "./_wizard-types"

type Surgery = StepProps["data"]["predefinedSurgeries"][number]

export function Step2Hospital({ state, setState, data }: StepProps) {
  const [query, setQuery] = useState("")
  const [openDropdown, setOpenDropdown] = useState(false)
  const [applied, setApplied] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered: Surgery[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.predefinedSurgeries.slice(0, 8)
    return data.predefinedSurgeries
      .filter(s => s.name.toLowerCase().includes(q) || (s.department?.toLowerCase().includes(q) ?? false))
      .slice(0, 8)
  }, [query, data.predefinedSurgeries])

  function applyTemplate(t: Surgery) {
    let docs: string[] = []
    let onDuty: string[] = []
    try { docs = JSON.parse(t.doctorNames) } catch {}
    try { onDuty = JSON.parse(t.onDutyDoctors) } catch {}
    setState(prev => ({
      ...prev,
      operationName: t.name,
      department: t.department ?? prev.department,
      doctorNames: docs.length ? docs : [""],
      onDutyDoctors: onDuty.length ? onDuty : [""],
      provisionDiagnosis: t.provisionDiagnosis ?? "",
      operationProcedure: t.operationProcedure ?? "",
      operationDetails: t.operationDetails ?? "",
    }))
    setQuery(t.name)
    setOpenDropdown(false)
    setApplied(true)
  }

  function resetOperationFields() {
    setState(prev => ({
      ...prev,
      operationName: "",
      department: "Ophthalmology",
      doctorNames: [""],
      onDutyDoctors: [""],
      provisionDiagnosis: "",
      operationProcedure: "",
      operationDetails: "",
    }))
    setQuery("")
    setApplied(false)
  }

  function updateDoctorRow(i: number, v: string) {
    setState(p => ({ ...p, doctorNames: p.doctorNames.map((x, j) => j === i ? v : x) }))
  }
  function addDoctorRow() { setState(p => ({ ...p, doctorNames: [...p.doctorNames, ""] })) }
  function removeDoctorRow(i: number) {
    setState(p => p.doctorNames.length > 1 ? { ...p, doctorNames: p.doctorNames.filter((_, j) => j !== i) } : p)
  }
  function updateOnDutyRow(i: number, v: string) {
    setState(p => ({ ...p, onDutyDoctors: p.onDutyDoctors.map((x, j) => j === i ? v : x) }))
  }
  function addOnDutyRow() { setState(p => ({ ...p, onDutyDoctors: [...p.onDutyDoctors, ""] })) }
  function removeOnDutyRow(i: number) {
    setState(p => p.onDutyDoctors.length > 1 ? { ...p, onDutyDoctors: p.onDutyDoctors.filter((_, j) => j !== i) } : p)
  }

  return (
    <div className="space-y-5">
      {/* Predefined surgery search */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Predefined surgery (optional)
          </Label>
          {applied && (
            <Button size="sm" variant="ghost" onClick={resetOperationFields} className="h-7 gap-1 text-xs">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpenDropdown(true); setApplied(false) }}
            onFocus={() => setOpenDropdown(true)}
            onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
            placeholder="Search predefined operations..."
            className="pl-9"
          />
          {openDropdown && filtered.length > 0 && (
            <div
              onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
              className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
            >
              {filtered.map(t => {
                let docCount = 0
                try { docCount = (JSON.parse(t.doctorNames) as string[]).length } catch {}
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.department ?? "—"} · {docCount} doctor{docCount !== 1 ? "s" : ""}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Operation fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Operation name *</Label>
          <EditableCombobox
            options={[]}
            value={state.operationName}
            onValueChange={v => setState(p => ({ ...p, operationName: v }))}
            placeholder="e.g. Phaco + IOL"
          />
        </div>
        <div>
          <Label>Operation date</Label>
          <Input
            type="datetime-local"
            value={state.operationDate}
            onChange={e => setState(p => ({ ...p, operationDate: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <Label>Department</Label>
          <EditableCombobox
            options={data.departmentOptions}
            value={state.department}
            onValueChange={v => setState(p => ({ ...p, department: v }))}
            placeholder="e.g. Ophthalmology"
          />
        </div>
      </div>

      {/* Doctor names */}
      <div>
        <Label>Doctor names *</Label>
        <div className="space-y-2 mt-1">
          {state.doctorNames.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <EditableCombobox
                options={data.doctorOptions}
                value={d}
                onValueChange={v => updateDoctorRow(i, v)}
                placeholder={`Doctor ${i + 1}`}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeDoctorRow(i)} disabled={state.doctorNames.length === 1}>−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addDoctorRow}>+ Add doctor</Button>
        </div>
      </div>

      {/* On-duty doctors */}
      <div>
        <Label>On-duty doctors</Label>
        <div className="space-y-2 mt-1">
          {state.onDutyDoctors.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <EditableCombobox
                options={data.doctorOptions}
                value={d}
                onValueChange={v => updateOnDutyRow(i, v)}
                placeholder={`On-duty doctor ${i + 1}`}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeOnDutyRow(i)} disabled={state.onDutyDoctors.length === 1}>−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addOnDutyRow}>+ Add on-duty doctor</Button>
        </div>
      </div>

      <div>
        <Label>Provision diagnosis</Label>
        <Input value={state.provisionDiagnosis} onChange={e => setState(p => ({ ...p, provisionDiagnosis: e.target.value }))} />
      </div>
      <div>
        <Label>Operation procedure</Label>
        <Textarea value={state.operationProcedure} onChange={e => setState(p => ({ ...p, operationProcedure: e.target.value }))} rows={3} />
      </div>
      <div>
        <Label>Operation details</Label>
        <Textarea value={state.operationDetails} onChange={e => setState(p => ({ ...p, operationDetails: e.target.value }))} rows={3} />
      </div>
    </div>
  )
}
