"use client"

import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { EditableCombobox } from "@/components/ui/combobox"
import { Search, RotateCcw, X, Plus } from "lucide-react"
import type { StepProps } from "./_wizard-types"

type Surgery = StepProps["data"]["predefinedSurgeries"][number]

// Same pattern as Step 1 — inline so each step file is self-contained.
function SectionHeader({ children, hint, right }: { children: React.ReactNode; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1 mb-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      <div className="flex items-center gap-2">
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
        {right}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] font-medium text-muted-foreground">{children}</Label>
}

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
      {/* ───────── Predefined surgery search ───────── */}
      <section>
        <SectionHeader
          hint="optional"
          right={applied && (
            <Button size="sm" variant="ghost" onClick={resetOperationFields} className="h-6 gap-1 px-2 text-[11px]">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        >
          Predefined surgery
        </SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setOpenDropdown(true); setApplied(false) }}
              onFocus={() => setOpenDropdown(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
              placeholder="Search predefined operations…"
              className="pl-9 h-9"
            />
            {openDropdown && filtered.length > 0 && (
              <div
                onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
                className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto"
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
                      <div className="text-sm font-medium text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.department ?? "—"}
                        <span className="mx-1.5">·</span>
                        {docCount} doctor{docCount !== 1 ? "s" : ""}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Pick a saved template to auto-fill the fields below, or enter them manually.
          </p>
        </div>
      </section>

      {/* ───────── Operation ───────── */}
      <section>
        <SectionHeader>Operation</SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <FieldLabel>Operation name *</FieldLabel>
              <div className="mt-1">
                <EditableCombobox
                  options={[]}
                  value={state.operationName}
                  onValueChange={v => setState(p => ({ ...p, operationName: v }))}
                  placeholder="e.g. Phaco + IOL"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Operation date</FieldLabel>
              <Input
                type="datetime-local"
                value={state.operationDate}
                onChange={e => setState(p => ({ ...p, operationDate: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>

            <div>
              <FieldLabel>Department</FieldLabel>
              <div className="mt-1">
                <EditableCombobox
                  options={data.departmentOptions}
                  value={state.department}
                  onValueChange={v => setState(p => ({ ...p, department: v }))}
                  placeholder="e.g. Ophthalmology"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Provision diagnosis</FieldLabel>
              <Input
                value={state.provisionDiagnosis}
                onChange={e => setState(p => ({ ...p, provisionDiagnosis: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Surgical team ───────── */}
      <section>
        <SectionHeader>Surgical team</SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 space-y-4">
          <RowListField
            label="Doctors *"
            rows={state.doctorNames}
            onUpdate={updateDoctorRow}
            onAdd={addDoctorRow}
            onRemove={removeDoctorRow}
            options={data.doctorOptions}
            placeholderFn={i => `Doctor ${i + 1}`}
          />
          <RowListField
            label="On-duty doctors"
            rows={state.onDutyDoctors}
            onUpdate={updateOnDutyRow}
            onAdd={addOnDutyRow}
            onRemove={removeOnDutyRow}
            options={data.doctorOptions}
            placeholderFn={i => `On-duty doctor ${i + 1}`}
          />
        </div>
      </section>

      {/* ───────── Procedure & details ───────── */}
      <section>
        <SectionHeader hint="optional">Procedure & details</SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 space-y-3">
          <div>
            <FieldLabel>Operation procedure</FieldLabel>
            <Textarea
              value={state.operationProcedure}
              onChange={e => setState(p => ({ ...p, operationProcedure: e.target.value }))}
              rows={3}
              placeholder="Steps performed…"
              className="mt-1 resize-none"
            />
          </div>
          <div>
            <FieldLabel>Operation details</FieldLabel>
            <Textarea
              value={state.operationDetails}
              onChange={e => setState(p => ({ ...p, operationDetails: e.target.value }))}
              rows={3}
              placeholder="Implants, anaesthesia, complications…"
              className="mt-1 resize-none"
            />
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Multi-row sub-component (doctors / on-duty) ──────────────────────────────

function RowListField({
  label, rows, onUpdate, onAdd, onRemove, options, placeholderFn,
}: {
  label: string
  rows: string[]
  onUpdate: (i: number, v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
  options: string[]
  placeholderFn: (i: number) => string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <FieldLabel>{label}</FieldLabel>
        <Button type="button" size="sm" variant="ghost" onClick={onAdd} className="h-6 gap-1 px-2 text-[11px]">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
        {rows.map((d, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30">
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground w-5 text-center shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <EditableCombobox
                options={options}
                value={d}
                onValueChange={v => onUpdate(i, v)}
                placeholder={placeholderFn(i)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRemove(i)}
              disabled={rows.length === 1}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
