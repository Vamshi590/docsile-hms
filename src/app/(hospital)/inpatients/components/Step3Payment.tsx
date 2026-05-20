"use client"

import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Search, RotateCcw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { StepProps } from "./_wizard-types"
import type { PackageInclusion, PaymentRecord } from "@/lib/types"

type Package = StepProps["data"]["predefinedPackages"][number]

const NOW = () => new Date().toISOString().slice(0, 10)

export function Step3Payment({ state, setState, data }: StepProps) {
  const [query, setQuery] = useState("")
  const [openDropdown, setOpenDropdown] = useState(false)
  const [applied, setApplied] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered: Package[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.predefinedPackages.slice(0, 8)
    return data.predefinedPackages
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, data.predefinedPackages])

  function applyPackage(t: Package) {
    let inclusions: PackageInclusion[] = []
    try { inclusions = JSON.parse(t.inclusions) as PackageInclusion[] } catch {}
    setState(prev => ({
      ...prev,
      packageInclusions: inclusions.length ? inclusions : [{ name: "", amount: 0 }],
      discount: t.discount ?? 0,
    }))
    setQuery(t.name)
    setOpenDropdown(false)
    setApplied(true)
  }

  function resetPackage() {
    setState(prev => ({
      ...prev,
      packageInclusions: [{ name: "", amount: 0 }],
      discount: 0,
    }))
    setQuery("")
    setApplied(false)
  }

  const packageAmount = state.packageInclusions.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const netAmount = packageAmount - (Number(state.discount) || 0)
  const totalReceived = state.paymentRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const balance = netAmount - totalReceived

  function updateInclusion(i: number, patch: Partial<PackageInclusion>) {
    setState(p => ({
      ...p,
      packageInclusions: p.packageInclusions.map((x, j) => j === i ? { ...x, ...patch } : x),
    }))
  }
  function addInclusion() {
    setState(p => ({ ...p, packageInclusions: [...p.packageInclusions, { name: "", amount: 0 }] }))
  }
  function removeInclusion(i: number) {
    setState(p => p.packageInclusions.length > 1
      ? { ...p, packageInclusions: p.packageInclusions.filter((_, j) => j !== i) }
      : p)
  }

  function updatePayment(i: number, patch: Partial<PaymentRecord>) {
    setState(p => ({
      ...p,
      paymentRecords: p.paymentRecords.map((r, j) => j === i ? { ...r, ...patch } : r),
    }))
  }
  function addPayment() {
    setState(p => ({
      ...p,
      paymentRecords: [...p.paymentRecords, { date: NOW(), amountType: "advance", paymentMode: "Cash", amount: 0 }],
    }))
  }
  function removePayment(i: number) {
    setState(p => ({ ...p, paymentRecords: p.paymentRecords.filter((_, j) => j !== i) }))
  }

  return (
    <div className="space-y-5">
      {/* Predefined package search */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Predefined package (optional)
          </Label>
          {applied && (
            <Button size="sm" variant="ghost" onClick={resetPackage} className="h-7 gap-1 text-xs">
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
            placeholder="Search predefined packages..."
            className="pl-9"
          />
          {openDropdown && filtered.length > 0 && (
            <div
              onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
              className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
            >
              {filtered.map(t => {
                let count = 0; try { count = (JSON.parse(t.inclusions) as unknown[]).length } catch {}
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyPackage(t)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(t.totalAmount)} · {count} item{count !== 1 ? "s" : ""}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inclusions */}
      <div>
        <Label>Package inclusions</Label>
        <div className="space-y-2 mt-1">
          {state.packageInclusions.map((inc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={inc.name}
                onChange={e => updateInclusion(i, { name: e.target.value })}
                placeholder="Item name"
                className="flex-1"
              />
              <Input
                type="number"
                value={inc.amount}
                onChange={e => updateInclusion(i, { amount: parseFloat(e.target.value) || 0 })}
                placeholder="Amount"
                className="w-32"
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeInclusion(i)} disabled={state.packageInclusions.length === 1}>−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addInclusion}>+ Add inclusion</Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 px-4 py-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Package amount</span>
          <span className="font-mono font-medium">{formatCurrency(packageAmount)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Discount</span>
          <Input
            type="number"
            value={state.discount}
            onChange={e => setState(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
            className="w-32 h-7 text-right font-mono"
          />
        </div>
        <div className="flex justify-between text-sm mt-1 border-t border-border/60 pt-1.5">
          <span className="font-medium">Net amount</span>
          <span className="font-mono font-semibold">{formatCurrency(netAmount)}</span>
        </div>
      </div>

      {/* Payments */}
      <div>
        <Label>Payments</Label>
        <div className="space-y-2 mt-1">
          {state.paymentRecords.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                type="date"
                value={r.date}
                onChange={e => updatePayment(i, { date: e.target.value })}
                className="col-span-3"
              />
              <Input
                value={r.amountType}
                onChange={e => updatePayment(i, { amountType: e.target.value })}
                placeholder="Type"
                className="col-span-3"
              />
              <Input
                value={r.paymentMode}
                onChange={e => updatePayment(i, { paymentMode: e.target.value })}
                placeholder="Mode"
                className="col-span-2"
              />
              <Input
                type="number"
                value={r.amount}
                onChange={e => updatePayment(i, { amount: parseFloat(e.target.value) || 0 })}
                placeholder="Amount"
                className="col-span-3 text-right"
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removePayment(i)} className="col-span-1">−</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addPayment}>+ Add payment</Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 px-4 py-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total received</span>
          <span className="font-mono">{formatCurrency(totalReceived)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1 border-t border-border/60 pt-1.5">
          <span className="font-medium">Balance</span>
          <span className={`font-mono font-semibold ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
            {formatCurrency(balance)}
          </span>
        </div>
      </div>
    </div>
  )
}
