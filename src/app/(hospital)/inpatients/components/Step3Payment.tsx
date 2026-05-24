"use client"

import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RotateCcw, X, Plus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { StepProps } from "./_wizard-types"
import type { PackageInclusion, PaymentRecord } from "@/lib/types"

type Package = StepProps["data"]["predefinedPackages"][number]

const NOW = () => new Date().toISOString().slice(0, 10)

// Matches the convention in InPatientDetailPage so the rest of the app stays consistent.
const PAYMENT_AMOUNT_TYPES = ["Advance", "Partial", "Final", "Refund", "Insurance"] as const
const PAYMENT_MODES = ["Cash", "UPI", "Both", "Insurance"] as const

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
      paymentRecords: [...p.paymentRecords, { date: NOW(), amountType: "Advance", paymentMode: "Cash", amount: 0 }],
    }))
  }
  function removePayment(i: number) {
    setState(p => ({ ...p, paymentRecords: p.paymentRecords.filter((_, j) => j !== i) }))
  }

  return (
    <div className="space-y-5">
      {/* ───────── Predefined package search ───────── */}
      <section>
        <SectionHeader
          hint="optional"
          right={applied && (
            <Button size="sm" variant="ghost" onClick={resetPackage} className="h-6 gap-1 px-2 text-[11px]">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        >
          Predefined package
        </SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setOpenDropdown(true); setApplied(false) }}
              onFocus={() => setOpenDropdown(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setOpenDropdown(false), 150) }}
              placeholder="Search predefined packages…"
              className="pl-9 h-9"
            />
            {openDropdown && filtered.length > 0 && (
              <div
                onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }}
                className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto"
              >
                {filtered.map(t => {
                  let count = 0
                  try { count = (JSON.parse(t.inclusions) as unknown[]).length } catch {}
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyPackage(t)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                    >
                      <div className="text-sm font-medium text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(t.totalAmount)}
                        <span className="mx-1.5">·</span>
                        {count} item{count !== 1 ? "s" : ""}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───────── Package — inclusions + totals ───────── */}
      <section>
        <SectionHeader
          right={
            <Button type="button" size="sm" variant="ghost" onClick={addInclusion} className="h-6 gap-1 px-2 text-[11px]">
              <Plus className="h-3 w-3" /> Add inclusion
            </Button>
          }
        >
          Package inclusions
        </SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-border/60">
            {state.packageInclusions.map((inc, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground w-5 text-center shrink-0">
                  {i + 1}
                </span>
                <Input
                  value={inc.name}
                  onChange={e => updateInclusion(i, { name: e.target.value })}
                  placeholder="Item name"
                  className="flex-1 h-9"
                />
                <Input
                  type="number"
                  value={inc.amount || ""}
                  onChange={e => updateInclusion(i, { amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Amount"
                  className="w-28 h-9 text-right font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeInclusion(i)}
                  disabled={state.packageInclusions.length === 1}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          {/* Totals strip */}
          <div className="bg-muted/30 px-4 py-2.5 space-y-1.5 border-t border-border/60">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Package amount</span>
              <span className="font-mono font-medium tabular-nums">{formatCurrency(packageAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <Input
                type="number"
                value={state.discount || ""}
                onChange={e => setState(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
                className="w-28 h-7 text-right font-mono tabular-nums"
                placeholder="0"
              />
            </div>
            <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border/60">
              <span className="font-semibold text-foreground">Net amount</span>
              <span className="font-mono font-bold tabular-nums">{formatCurrency(netAmount)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Payments + balance ───────── */}
      <section>
        <SectionHeader
          hint="optional"
          right={
            <Button type="button" size="sm" variant="ghost" onClick={addPayment} className="h-6 gap-1 px-2 text-[11px]">
              <Plus className="h-3 w-3" /> Add payment
            </Button>
          }
        >
          Payments
        </SectionHeader>
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {state.paymentRecords.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {state.paymentRecords.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-muted/30">
                  <span className="col-span-1 text-[10px] font-medium tabular-nums text-muted-foreground text-center">
                    {i + 1}
                  </span>
                  <Input
                    type="date"
                    value={r.date}
                    onChange={e => updatePayment(i, { date: e.target.value })}
                    className="col-span-3 h-9"
                  />
                  <div className="col-span-3">
                    <Select
                      value={r.amountType}
                      onValueChange={v => updatePayment(i, { amountType: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_AMOUNT_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={r.paymentMode}
                      onValueChange={v => updatePayment(i, { paymentMode: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    value={r.amount || ""}
                    onChange={e => updatePayment(i, { amount: parseFloat(e.target.value) || 0 })}
                    placeholder="Amount"
                    className="col-span-2 h-9 text-right font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removePayment(i)}
                    className="col-span-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive justify-self-end"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {/* Balance strip */}
          <div className="bg-muted/30 px-4 py-2.5 space-y-1.5 border-t border-border/60">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total received</span>
              <span className="font-mono tabular-nums">{formatCurrency(totalReceived)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border/60">
              <span className="font-semibold text-foreground">Balance</span>
              <span className={`font-mono font-bold tabular-nums ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                {formatCurrency(balance)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
