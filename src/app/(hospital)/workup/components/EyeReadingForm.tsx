"use client"

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GridCombobox } from "@/components/ui/combobox"
import { cn, todayISO } from "@/lib/utils"
import {
  SPH_OPTIONS, CYL_OPTIONS, AXIS_OPTIONS, VA_OPTIONS, NEAR_SPH_OPTIONS, SIGHT_TYPE_OPTIONS,
  IOP_METHOD_OPTIONS, LIDS_OPTIONS, CONJUNCTIVA_OPTIONS, CORNEA_OPTIONS,
  AC_OPTIONS, IRIS_OPTIONS, PUPIL_OPTIONS, LENS_OPTIONS, VITREOUS_OPTIONS,
  FUNDUS_OPTIONS, CDR_OPTIONS,
} from "@/lib/workup-options"
import { saveEyeReading } from "../actions"

// ─── Data types ───────────────────────────────────────────────────────────────

type ARRow = { sph: string; cyl: string; axis: string; va: string; vacph: string }
type ARSection = { re: ARRow; le: ARRow; pd: string }
type EyeRow = { sph: string; cyl: string; axis: string; va: string }
type EyeDN  = { d: EyeRow; n: EyeRow }
type DNSection = { re: EyeDN; le: EyeDN }
type CFEye = {
  lids: string; sac: string; conjunctiva: string; cornea: string
  ac: string; iris: string; pupil: string; lens: string; vitreous: string
  iop: string; iopMethod: string; fundus: string; cdr: string
}
type CFSection = { re: CFEye; le: CFEye }

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseAR(raw: unknown): ARSection {
  const d = raw as { re?: Partial<ARRow>; le?: Partial<ARRow>; pd?: string } | null
  return {
    re: { sph: d?.re?.sph ?? "", cyl: d?.re?.cyl ?? "", axis: d?.re?.axis ?? "", va: d?.re?.va ?? "", vacph: d?.re?.vacph ?? "" },
    le: { sph: d?.le?.sph ?? "", cyl: d?.le?.cyl ?? "", axis: d?.le?.axis ?? "", va: d?.le?.va ?? "", vacph: d?.le?.vacph ?? "" },
    pd: d?.pd ?? "",
  }
}

function parseDN(raw: unknown): DNSection {
  const d = raw as { re?: { d?: Partial<EyeRow>; n?: Partial<EyeRow> }; le?: { d?: Partial<EyeRow>; n?: Partial<EyeRow> } } | null
  const row = (r: Partial<EyeRow> | undefined): EyeRow =>
    ({ sph: r?.sph ?? "", cyl: r?.cyl ?? "", axis: r?.axis ?? "", va: r?.va ?? "" })
  return {
    re: { d: row(d?.re?.d), n: row(d?.re?.n) },
    le: { d: row(d?.le?.d), n: row(d?.le?.n) },
  }
}

function parseCF(raw: unknown): CFSection {
  const d = raw as { re?: Partial<CFEye>; le?: Partial<CFEye> } | null
  const eye = (e: Partial<CFEye> | undefined): CFEye => ({
    lids: e?.lids ?? "", sac: e?.sac ?? "", conjunctiva: e?.conjunctiva ?? "",
    cornea: e?.cornea ?? "", ac: e?.ac ?? "", iris: e?.iris ?? "",
    pupil: e?.pupil ?? "", lens: e?.lens ?? "", vitreous: e?.vitreous ?? "",
    iop: e?.iop ?? "", iopMethod: e?.iopMethod ?? "", fundus: e?.fundus ?? "", cdr: e?.cdr ?? "",
  })
  return { re: eye(d?.re), le: eye(d?.le) }
}

// ─── Section nav ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "ar",  label: "AR",  title: "Auto Refractometer (AR)" },
  { id: "sr",  label: "SR",  title: "Present Glass Prescription (SR)" },
  { id: "pgp", label: "PGP", title: "Previous Glass Prescription (PGP)" },
  { id: "cf",  label: "CF",  title: "Clinical Findings (CF)" },
] as const

type SectionId = typeof SECTIONS[number]["id"]

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">{title}</h3>
      {children}
    </div>
  )
}

const EYE_ROW_FIELDS = [
  { key: "sph" as const, label: "SPH", options: SPH_OPTIONS },
  { key: "cyl" as const, label: "CYL", options: CYL_OPTIONS },
  { key: "axis" as const, label: "AXIS", options: AXIS_OPTIONS },
  { key: "va" as const, label: "VA", options: VA_OPTIONS },
]

function EyeRow4({
  row, onChange, showLabels = false,
}: {
  row: EyeRow
  onChange: (f: keyof EyeRow, v: string) => void
  showLabels?: boolean
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {EYE_ROW_FIELDS.map(({ key, label, options }) => (
        <div key={key}>
          {showLabels && <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>}
          <GridCombobox options={options} value={row[key]} onValueChange={v => onChange(key, v)} />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  patientId: string
  onSaved?: () => void
  existingReading?: string | null
  compact?: boolean
  // Controlled-mode props. When both are provided, sight type state is
  // owned by the parent (e.g. WorkupPage renders SightTypePicker beside
  // the form). When `hideSightType` is true, the inline block at the bottom
  // of Present Prescription is omitted so it isn't shown twice.
  sightTypeValue?: string
  onSightTypeChange?: (next: string) => void
  hideSightType?: boolean
}

export interface EyeReadingFormHandle {
  save: () => Promise<void>
}

export const EyeReadingForm = forwardRef<EyeReadingFormHandle, Props>(
function EyeReadingForm({
  patientId, onSaved, existingReading, compact = false,
  sightTypeValue, onSightTypeChange, hideSightType = false,
}, ref) {
  const raw = existingReading
    ? (() => { try { return JSON.parse(existingReading) } catch { return null } })()
    : null

  const [ar,  setAr]  = useState<ARSection>(() => parseAR(raw?.autoRefractometer))
  const [pgp, setPgp] = useState<DNSection>(() => parseDN(raw?.previousPrescription))
  const [sr,  setSr]  = useState<DNSection>(() => parseDN(raw?.presentPrescription))
  const [localSightType, setLocalSightType] = useState<string>(() => (raw?.presentPrescription?.sightType as string) ?? "")
  const sightTypeControlled = sightTypeValue !== undefined && onSightTypeChange !== undefined
  const sightType = sightTypeControlled ? sightTypeValue! : localSightType
  const setSightType = sightTypeControlled ? onSightTypeChange! : setLocalSightType
  const [cf,  setCf]  = useState<CFSection>(() => parseCF(raw?.clinicalFindings))
  const [submitting,  setSubmitting]  = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>("ar")
  const [cfOpen, setCfOpen] = useState(false)

  // Scroll container ref + section refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const arRef  = useRef<HTMLDivElement>(null)
  const pgpRef = useRef<HTMLDivElement>(null)
  const srRef  = useRef<HTMLDivElement>(null)
  const cfRef  = useRef<HTMLDivElement>(null)
  const sectionRefs = { ar: arRef, pgp: pgpRef, sr: srRef, cf: cfRef }

  // Highlight active nav pill as user scrolls
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.section as SectionId
            if (id) setActiveSection(id)
          }
        })
      },
      { root, rootMargin: "-10% 0px -70% 0px" }
    )
    ;[arRef, pgpRef, srRef, cfRef].forEach(ref => {
      if (ref.current) observer.observe(ref.current)
    })
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scrollToSection(id: SectionId) {
    const el = sectionRefs[id].current
    const container = scrollRef.current
    if (el && container) {
      const top = el.offsetTop - container.offsetTop
      container.scrollTo({ top, behavior: "smooth" })
    }
    setActiveSection(id)
    if (id === "cf") setCfOpen(true)
  }

  // ── Setters ────────────────────────────────────────────────────────────────

  function setARRow(eye: "re" | "le", f: keyof ARRow, v: string) {
    setAr(p => ({ ...p, [eye]: { ...p[eye], [f]: v } }))
  }

  function setDN(
    setter: Dispatch<SetStateAction<DNSection>>,
    eye: "re" | "le", dn: "d" | "n", f: keyof EyeRow, v: string
  ) {
    setter(p => ({ ...p, [eye]: { ...p[eye], [dn]: { ...p[eye][dn], [f]: v } } }))
  }

  function setCFRow(eye: "re" | "le", f: keyof CFEye, v: string) {
    setCf(p => ({ ...p, [eye]: { ...p[eye], [f]: v } }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSubmitting(true)
    const result = await saveEyeReading({
      patientId,
      autoRefractometer:    ar  as unknown as Record<string, unknown>,
      previousPrescription: pgp as unknown as Record<string, unknown>,
      presentPrescription:  { ...sr, sightType } as unknown as Record<string, unknown>,
      clinicalFindings:     cf  as unknown as Record<string, unknown>,
      readingDate: todayISO(),
    })
    setSubmitting(false)
    if (result.success) {
      toast.success("Reading saved — patient moved to Workup Done")
      onSaved?.()
    } else {
      toast.error(result.error)
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }))

  // ── Section renderers ──────────────────────────────────────────────────────

  function renderAR() {
    return (
      <SectionCard title="Auto Refractometer (AR)">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Right Eye :</h4>
          <div className="grid grid-cols-5 gap-2">
            {(["sph", "cyl", "axis", "va"] as const).map((f, i) => (
              <div key={f}>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {["SPH", "CYL", "AXIS", "VA"][i]}
                </p>
                <GridCombobox
                  options={f === "sph" ? SPH_OPTIONS : f === "cyl" ? CYL_OPTIONS : f === "axis" ? AXIS_OPTIONS : VA_OPTIONS}
                  value={ar.re[f]}
                  onValueChange={v => setARRow("re", f, v)}
                />
              </div>
            ))}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">VAC.P.H</p>
              <Input value={ar.re.vacph} onChange={e => setARRow("re", "vacph", e.target.value)} placeholder="—" className="h-9 text-sm bg-white font-semibold" />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Left Eye :</h4>
          <div className="grid grid-cols-5 gap-2">
            {(["sph", "cyl", "axis", "va"] as const).map(f => (
              <GridCombobox
                key={f}
                options={f === "sph" ? SPH_OPTIONS : f === "cyl" ? CYL_OPTIONS : f === "axis" ? AXIS_OPTIONS : VA_OPTIONS}
                value={ar.le[f]}
                onValueChange={v => setARRow("le", f, v)}
              />
            ))}
            <Input value={ar.le.vacph} onChange={e => setARRow("le", "vacph", e.target.value)} placeholder="—" className="h-9 text-sm font-semibold bg-white" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground w-8">PD</p>
          <Input value={ar.pd} onChange={e => setAr(p => ({ ...p, pd: e.target.value }))} placeholder="PD value" className="h-9 text-sm w-32 bg-white" />
        </div>
      </SectionCard>
    )
  }

  function renderDN(section: DNSection, setter: Dispatch<SetStateAction<DNSection>>, title: string) {
    const s = (eye: "re" | "le", dn: "d" | "n") =>
      (f: keyof EyeRow, v: string) => setDN(setter, eye, dn, f, v)
    return (
      <SectionCard title={title}>
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Right Eye - Distance :</h4>
          <EyeRow4 row={section.re.d} onChange={s("re", "d")} showLabels />
        </div>
        <div className="mb-5">
          <h4 className="text-sm font-medium text-foreground mb-2">Near :</h4>
          <EyeRow4 row={section.re.n} onChange={s("re", "n")} />
        </div>
        <div className="mb-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">Left Eye - Distance :</h4>
          <EyeRow4 row={section.le.d} onChange={s("le", "d")} showLabels />
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Near :</h4>
          <EyeRow4 row={section.le.n} onChange={s("le", "n")} />
        </div>
      </SectionCard>
    )
  }

  function computeNearSph(distanceSph: string, addValue: string): string {
    // addValue is like "add 1", "add 1.25", etc.
    const addMatch = addValue.match(/^add\s+([\d.]+)$/i)
    if (!addMatch) return addValue // not an add value, return as-is
    const addNum = parseFloat(addMatch[1])
    if (isNaN(addNum)) return addValue

    // Parse distance SPH: "PL" = 0, "+2.00" = 2, "-1.50" = -1.5
    let distNum = 0
    if (distanceSph && distanceSph !== "PL") {
      distNum = parseFloat(distanceSph)
      if (isNaN(distNum)) distNum = 0
    }

    const result = distNum + addNum
    const sign = result >= 0 ? "+" : ""
    // Format to 2 decimal places, but show clean values
    const formatted = result % 1 === 0 ? `${sign}${result}.00` : result % 0.5 === 0 && result % 0.25 !== 0 ? `${sign}${result.toFixed(1)}0` : `${sign}${result.toFixed(2)}`
    return formatted
  }

  function NearEyeRow({ row, onChange, distanceSph, showLabels = false }: { row: EyeRow; onChange: (f: keyof EyeRow, v: string) => void; distanceSph: string; showLabels?: boolean }) {
    const NEAR_FIELDS = [
      { key: "cyl" as const, label: "CYL", options: CYL_OPTIONS },
      { key: "axis" as const, label: "AXIS", options: AXIS_OPTIONS },
      { key: "va" as const, label: "VA", options: VA_OPTIONS },
    ]
    return (
      <div className="grid grid-cols-4 gap-2">
        <div>
          {showLabels && <p className="text-xs font-medium text-muted-foreground mb-1">SPH</p>}
          <GridCombobox
            options={NEAR_SPH_OPTIONS}
            value={row.sph}
            onValueChange={v => onChange("sph", computeNearSph(distanceSph, v))}
          />
        </div>
        {NEAR_FIELDS.map(({ key, label, options }) => (
          <div key={key}>
            {showLabels && <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>}
            <GridCombobox options={options} value={row[key]} onValueChange={v => onChange(key, v)} />
          </div>
        ))}
      </div>
    )
  }

  function renderSR() {
    const s = (eye: "re" | "le", dn: "d" | "n") =>
      (f: keyof EyeRow, v: string) => setDN(setSr, eye, dn, f, v)
    return (
      <SectionCard title="Present Glass Prescription (SR)">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Right Eye - Distance :</h4>
          <EyeRow4 row={sr.re.d} onChange={s("re", "d")} showLabels />
        </div>
        <div className="mb-5">
          <h4 className="text-sm font-medium text-foreground mb-2">Near :</h4>
          <NearEyeRow row={sr.re.n} onChange={s("re", "n")} distanceSph={sr.re.d.sph} />
        </div>
        <div className="mb-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">Left Eye - Distance :</h4>
          <EyeRow4 row={sr.le.d} onChange={s("le", "d")} showLabels />
        </div>
        <div className="mb-5">
          <h4 className="text-sm font-medium text-foreground mb-2">Near :</h4>
          <NearEyeRow row={sr.le.n} onChange={s("le", "n")} distanceSph={sr.le.d.sph} />
        </div>

        {/* Sight Type (omitted when the parent lifts it into its own panel) */}
        {!hideSightType && (
          <div className="pt-3 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-2">Sight Type:</h4>
            <div className="flex flex-wrap gap-4">
              {SIGHT_TYPE_OPTIONS.map((option) => {
                const currentValues = sightType ? sightType.split("/").filter(Boolean) : []
                const checked = currentValues.includes(option.label)
                return (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        let newValues: string[]
                        if (e.target.checked) {
                          newValues = checked ? currentValues : [...currentValues, option.label]
                        } else {
                          newValues = currentValues.filter(v => v !== option.label)
                        }
                        setSightType(newValues.join("/"))
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">{option.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </SectionCard>
    )
  }

  const CF_FIELDS: { key: keyof CFEye; label: string; options: string[] }[] = [
    { key: "lids",        label: "Lids",        options: LIDS_OPTIONS },
    { key: "sac",         label: "SAC",          options: [] },
    { key: "conjunctiva", label: "Conjunctiva",  options: CONJUNCTIVA_OPTIONS },
    { key: "cornea",      label: "Cornea",       options: CORNEA_OPTIONS },
    { key: "ac",          label: "A.C.",         options: AC_OPTIONS },
    { key: "iris",        label: "Iris",         options: IRIS_OPTIONS },
    { key: "pupil",       label: "Pupil",        options: PUPIL_OPTIONS },
    { key: "lens",        label: "Lens",         options: LENS_OPTIONS },
    { key: "vitreous",    label: "Vitreous",     options: VITREOUS_OPTIONS },
    { key: "iop",         label: "IOP",          options: [] },
    { key: "iopMethod",   label: "Method",       options: IOP_METHOD_OPTIONS },
    { key: "fundus",      label: "Fundus",       options: FUNDUS_OPTIONS },
    { key: "cdr",         label: "CDR",          options: CDR_OPTIONS },
  ]

  function renderCF() {
    return (
      <div className="bg-gray-50 border border-border rounded-lg overflow-hidden">
        {/* Accordion header */}
        <button
          onClick={() => setCfOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground">Clinical Findings (CF)</h3>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            cfOpen && "rotate-180"
          )} />
        </button>

        {/* Accordion body */}
        {cfOpen && (
          <div className="px-4 pb-4 border-t border-border">
            <div className="grid grid-cols-[110px_1fr_1fr] gap-3 mb-3 mt-3">
              <div />
              <p className="text-xs font-semibold text-foreground text-center">Right Eye (RE)</p>
              <p className="text-xs font-semibold text-foreground text-center">Left Eye (LE)</p>
            </div>
            <div className="space-y-2">
              {CF_FIELDS.map(f => (
                <div key={f.key} className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  {f.options.length > 0 ? (
                    <>
                      <GridCombobox options={f.options} value={cf.re[f.key]} onValueChange={v => setCFRow("re", f.key, v)} placeholder="RE" />
                      <GridCombobox options={f.options} value={cf.le[f.key]} onValueChange={v => setCFRow("le", f.key, v)} placeholder="LE" />
                    </>
                  ) : (
                    <>
                      <Input value={cf.re[f.key]} onChange={e => setCFRow("re", f.key, e.target.value)} placeholder="RE" className="h-9 text-sm" />
                      <Input value={cf.le[f.key]} onChange={e => setCFRow("le", f.key, e.target.value)} placeholder="LE" className="h-9 text-sm" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col", !compact && "h-screen")}>

      {/* Top nav bar — section pills (left) + Save button (right, hidden in compact/doctor-console mode) */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 bg-white shrink-0">
        <div className="flex items-center gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors",
                activeSection === s.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {!compact && (
          <Button onClick={handleSave} disabled={submitting} size="sm">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save Reading
          </Button>
        )}
      </div>

      {/* Scrollable form content */}
      <div ref={scrollRef} className={cn("overflow-y-auto", compact ? "max-h-[65vh]" : "max-h-[90vh]")}>
        <div className="p-5 space-y-5">

          <div ref={arRef} data-section="ar">
            {renderAR()}
          </div>

          <div ref={srRef} data-section="sr">
            {renderSR()}
          </div>

          <div ref={pgpRef} data-section="pgp">
            {renderDN(pgp, setPgp, "Previous Glass Prescription (PGP)")}
          </div>

          <div ref={cfRef} data-section="cf">
            {renderCF()}
          </div>

        </div>
      </div>

    </div>
  )
})
EyeReadingForm.displayName = "EyeReadingForm"
