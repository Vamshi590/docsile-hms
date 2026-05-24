"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { EditableCombobox } from "@/components/ui/combobox"
import { Loader2, Search } from "lucide-react"
import { calculateAge } from "@/lib/utils"
import { searchExistingPatients } from "@/app/(hospital)/patients/actions"
import type { StepProps } from "./_wizard-types"

type SearchResult = Awaited<ReturnType<typeof searchExistingPatients>>[0]

// Small reusable presentation helpers — kept inline so each step file is self-contained.
function SectionHeader({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1 mb-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] font-medium text-muted-foreground">{children}</Label>
}

export function Step1Patient({ state, setState, data, isEditMode }: StepProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const data = await searchExistingPatients(trimmed)
      setResults(data.slice(0, 8))
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 200)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function pickResult(r: SearchResult) {
    const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ")
    setState(prev => ({
      ...prev,
      opPatientId: r.patientId,
      name: fullName,
      age: r.age != null ? String(r.age) : prev.age,
      gender: r.gender ?? prev.gender,
      phone: r.phone ?? prev.phone,
      address: r.address ?? prev.address,
      guardianName: r.guardianName ?? prev.guardianName,
      dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().slice(0, 10) : prev.dateOfBirth,
    }))
    setQuery(`${fullName} · ${r.patientId}`)
    setOpenDropdown(false)
  }

  return (
    <div className="space-y-5">
      {/* ───────── Existing-patient search (admit only) ───────── */}
      {!isEditMode && (
        <section>
          <SectionHeader hint="optional">Existing patient lookup</SectionHeader>
          <div className="rounded-xl border border-border bg-white shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setOpenDropdown(true) }}
                onFocus={() => setOpenDropdown(true)}
                onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
                placeholder="Search by name, phone, or patient ID…"
                className="pl-9 pr-9 h-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {openDropdown && results.length > 0 && (
                <div
                  onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
                  className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto"
                >
                  {results.map(r => (
                    <button
                      key={r.patientId}
                      type="button"
                      onClick={() => pickResult(r)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                    >
                      <div className="text-sm font-medium text-foreground">
                        {[r.firstName, r.lastName].filter(Boolean).join(" ")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{r.patientId}</span>
                        <span className="mx-1.5">·</span>
                        {r.phone ?? "—"}
                        {r.age != null && (<><span className="mx-1.5">·</span>{r.age}y</>)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Pick an existing OPD patient to auto-fill their details, or skip this and enter manually below.
            </p>
          </div>
        </section>
      )}

      {/* ───────── Visit Information ───────── */}
      <section>
        <SectionHeader>Visit information</SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4">
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <FieldLabel>IP Number</FieldLabel>
              <Input value={state.ipNumber} readOnly className="bg-muted/40 font-mono h-9 mt-1" />
            </div>
            <div>
              <FieldLabel>Admission date *</FieldLabel>
              <Input
                type="datetime-local"
                value={state.admissionDate}
                onChange={e => setState(p => ({ ...p, admissionDate: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <FieldLabel>Discharge date</FieldLabel>
              <Input
                type="date"
                value={state.dischargeDate}
                onChange={e => setState(p => ({ ...p, dischargeDate: e.target.value }))}
                className="h-9 mt-1"
                min={state.admissionDate ? state.admissionDate.slice(0, 10) : undefined}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Patient Demographics ───────── */}
      <section>
        <SectionHeader>Patient demographics</SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <FieldLabel>Full name *</FieldLabel>
              <Input
                value={state.name}
                onChange={e => setState(p => ({ ...p, name: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>

            <div>
              <FieldLabel>Phone *</FieldLabel>
              <Input
                value={state.phone}
                onChange={e => setState(p => ({ ...p, phone: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <FieldLabel>Gender *</FieldLabel>
              <RadioGroup
                value={state.gender}
                onValueChange={v => setState(p => ({ ...p, gender: v }))}
                className="flex gap-4 h-9 items-center mt-1"
              >
                {["MALE", "FEMALE", "OTHER"].map(g => (
                  <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value={g} />
                    {g.charAt(0) + g.slice(1).toLowerCase()}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <FieldLabel>Age *</FieldLabel>
              <Input
                type="number"
                value={state.age}
                onChange={e => setState(p => ({ ...p, age: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <FieldLabel>Date of birth</FieldLabel>
              <Input
                type="date"
                value={state.dateOfBirth}
                onChange={e => {
                  const dob = e.target.value
                  setState(p => ({ ...p, dateOfBirth: dob, age: dob ? String(calculateAge(dob) ?? p.age) : p.age }))
                }}
                className="h-9 mt-1"
              />
            </div>

            <div className="col-span-2">
              <FieldLabel>Address</FieldLabel>
              <Textarea
                value={state.address}
                onChange={e => setState(p => ({ ...p, address: e.target.value }))}
                rows={2}
                className="mt-1 resize-none"
              />
            </div>

            <div>
              <FieldLabel>Guardian name</FieldLabel>
              <Input
                value={state.guardianName}
                onChange={e => setState(p => ({ ...p, guardianName: e.target.value }))}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <FieldLabel>Referred by</FieldLabel>
              <div className="mt-1">
                <EditableCombobox
                  options={data.referralOptions}
                  value={state.referredBy}
                  onValueChange={v => setState(p => ({ ...p, referredBy: v }))}
                  placeholder="Self, Dr. X, …"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Notes ───────── */}
      <section>
        <SectionHeader hint="optional">Admission notes</SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4">
          <Textarea
            value={state.admissionNotes}
            onChange={e => setState(p => ({ ...p, admissionNotes: e.target.value }))}
            rows={3}
            placeholder="Any additional notes about this admission…"
            className="resize-none"
          />
        </div>
      </section>
    </div>
  )
}
