"use client"

import { SIGHT_TYPE_OPTIONS } from "@/lib/workup-options"

interface Props {
  value: string
  onChange: (next: string) => void
  className?: string
}

// Sight Type is stored as a "/"-joined string (e.g. "Distant/Near") so it
// matches the existing presentPrescription.sightType wire format.
export function SightTypePicker({ value, onChange }: Props) {
  const selected = value ? value.split("/").filter(Boolean) : []

  function toggle(label: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...selected, label]))
      : selected.filter(v => v !== label)
    onChange(next.join("/"))
  }

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Sight Type</h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          Pick one or more — saved with the present prescription.
        </p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-2">
        {SIGHT_TYPE_OPTIONS.map(option => {
          const checked = selected.includes(option.label)
          return (
            <label
              key={option.id}
              className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => toggle(option.label, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{option.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
