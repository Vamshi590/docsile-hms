"use client"

import { X, MapPin, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Online", "NEFT"]

interface LabBillCardProps {
  lab: { id: string; name: string; location: string | null }
  items: { investigationId: string; name: string; amount: number }[]
  discount: number
  discountReason?: string
  paymentMode: string
  amountPaid: number
  onUpdateDiscount: (v: number) => void
  onUpdateDiscountReason: (v: string) => void
  onUpdatePaymentMode: (v: string) => void
  onUpdateAmountPaid: (v: number) => void
  onRemoveItem: (investigationId: string) => void
  onProcess: () => void
  submitting: boolean
}

export function LabBillCard({
  lab, items, discount, discountReason, paymentMode, amountPaid,
  onUpdateDiscount, onUpdateDiscountReason, onUpdatePaymentMode, onUpdateAmountPaid,
  onRemoveItem, onProcess, submitting,
}: LabBillCardProps) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const total = Math.max(0, subtotal - discount)
  const balance = total - amountPaid

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 border-b border-border">
        <h4 className="font-semibold text-sm">{lab.name}</h4>
        {lab.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3" />
            {lab.location}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="px-4 py-3">
        {items.map((item) => (
          <div key={item.investigationId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
            <span className="text-sm">{item.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">₹{item.amount.toLocaleString("en-IN")}</span>
              <button
                onClick={() => onRemoveItem(item.investigationId)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">All items removed</div>
        )}
      </div>

      {/* Totals & Payment */}
      {items.length > 0 && (
        <div className="border-t border-border px-4 py-3 space-y-2.5 bg-gray-50/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-16 shrink-0">Discount</Label>
            <Input
              type="number"
              min={0}
              max={subtotal}
              value={discount || ""}
              onChange={(e) => onUpdateDiscount(parseFloat(e.target.value) || 0)}
              className="h-8 w-24 bg-white text-sm"
              placeholder="0"
            />
            <Input
              value={discountReason ?? ""}
              onChange={(e) => onUpdateDiscountReason(e.target.value)}
              className="h-8 flex-1 bg-white text-sm"
              placeholder="Reason"
            />
          </div>

          <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
            <span>Total</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-16 shrink-0">Payment</Label>
            <Select value={paymentMode} onValueChange={onUpdatePaymentMode}>
              <SelectTrigger className="h-8 w-28 bg-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              max={total}
              value={amountPaid || ""}
              onChange={(e) => onUpdateAmountPaid(parseFloat(e.target.value) || 0)}
              className="h-8 flex-1 bg-white text-sm"
              placeholder="Amount paid"
            />
          </div>

          {balance > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Balance Due</span>
              <span className="font-medium">₹{balance.toLocaleString("en-IN")}</span>
            </div>
          )}

          <Button onClick={onProcess} disabled={submitting || items.length === 0} className="w-full" size="sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
            {submitting ? "Processing..." : `Process Payment — ₹${total.toLocaleString("en-IN")}`}
          </Button>
        </div>
      )}
    </div>
  )
}
