"use client"

import { useState, useEffect } from "react"
import {
  IndianRupee,
  Stethoscope,
  FlaskConical,
  BedDouble,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Receipt,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateLong, formatCurrency } from "@/lib/utils"
import { getBillingOverview } from "../actions"

type BillingData = Awaited<ReturnType<typeof getBillingOverview>>

export function BillingTab({ patientId, patientInternalId }: { patientId: string; patientInternalId: string }) {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openSection, setOpenSection] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getBillingOverview(patientId, patientInternalId).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [patientId, patientInternalId])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const { summary } = data

  return (
    <div className="space-y-5">
      {/* Grand Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label="Total Billed"
          value={formatCurrency(summary.grandTotal)}
          color="text-foreground"
          bg="bg-gray-50"
          iconBg="bg-gray-100"
        />
        <SummaryCard
          icon={IndianRupee}
          label="Total Paid"
          value={formatCurrency(summary.grandPaid)}
          color="text-emerald-600"
          bg="bg-emerald-50/50"
          iconBg="bg-emerald-100"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Outstanding Dues"
          value={formatCurrency(summary.grandDue)}
          color={summary.grandDue > 0 ? "text-red-600" : "text-emerald-600"}
          bg={summary.grandDue > 0 ? "bg-red-50/50" : "bg-emerald-50/50"}
          iconBg={summary.grandDue > 0 ? "bg-red-100" : "bg-emerald-100"}
          highlight={summary.grandDue > 0}
        />
      </div>

      {/* Category Breakdown */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-foreground">Breakdown by Category</h3>
        </div>
        <div className="divide-y divide-gray-50">
          <CategoryRow
            icon={Stethoscope}
            label="OPD Consultations"
            total={summary.opdTotal}
            paid={summary.opdPaid}
            due={summary.opdDue}
            color="text-blue-600"
            bg="bg-blue-50"
            count={data.prescriptions.length}
          />
          <CategoryRow
            icon={FlaskConical}
            label="Lab Bills"
            total={summary.labTotal}
            paid={summary.labPaid}
            due={summary.labDue}
            color="text-orange-600"
            bg="bg-orange-50"
            count={data.labBills.length}
          />
          <CategoryRow
            icon={BedDouble}
            label="Inpatient"
            total={summary.ipdTotal}
            paid={summary.ipdPaid}
            due={summary.ipdDue}
            color="text-violet-600"
            bg="bg-violet-50"
            count={data.inpatient ? 1 : 0}
          />
        </div>
      </div>

      {/* OPD Payment History */}
      {data.prescriptions.length > 0 && (
        <CollapsiblePaymentSection
          title="OPD Payment History"
          icon={Stethoscope}
          iconColor="text-blue-600"
          isOpen={openSection === "opd"}
          onToggle={() => setOpenSection(openSection === "opd" ? null : "opd")}
          count={data.prescriptions.length}
        >
          <div className="divide-y divide-gray-50">
            {data.prescriptions.map((rx) => (
              <div key={rx.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {formatDateLong(rx.prescriptionDate)}
                    </span>
                    {rx.prescriptionNumber && (
                      <span className="text-xs font-mono text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                        {rx.prescriptionNumber}
                      </span>
                    )}
                  </div>
                  {rx.payments.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      {rx.payments.map((p) => (
                        <span key={p.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="h-3 w-3" />
                          {formatCurrency(p.amount)} ({p.paymentMode})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(rx.total)}</p>
                    {rx.balanceDue > 0 && (
                      <p className="text-[10px] text-red-600">Due: {formatCurrency(rx.balanceDue)}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      rx.status === "PAID" ? "default" :
                      rx.status === "PARTIAL" ? "outline" :
                      rx.status === "CANCELLED" ? "destructive" : "secondary"
                    }
                    className="text-xs"
                  >
                    {rx.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CollapsiblePaymentSection>
      )}

      {/* Lab Payment History */}
      {data.labBills.length > 0 && (
        <CollapsiblePaymentSection
          title="Lab Payment History"
          icon={FlaskConical}
          iconColor="text-orange-600"
          isOpen={openSection === "lab"}
          onToggle={() => setOpenSection(openSection === "lab" ? null : "lab")}
          count={data.labBills.length}
        >
          <div className="divide-y divide-gray-50">
            {data.labBills.map((bill) => (
              <div key={bill.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {bill.lab.name}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                      {bill.billNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateLong(bill.createdAt)}
                    </span>
                  </div>
                  {bill.payments.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      {bill.payments.map((p) => (
                        <span key={p.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="h-3 w-3" />
                          {formatCurrency(p.amount)} ({p.paymentMode})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(bill.total)}</p>
                    {bill.balanceDue > 0 && (
                      <p className="text-[10px] text-red-600">Due: {formatCurrency(bill.balanceDue)}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      bill.status === "PAID" ? "default" :
                      bill.status === "PARTIAL" ? "outline" :
                      bill.status === "CANCELLED" ? "destructive" : "secondary"
                    }
                    className="text-xs"
                  >
                    {bill.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CollapsiblePaymentSection>
      )}

      {/* IPD Payment Records */}
      {data.inpatient && (
        <CollapsiblePaymentSection
          title="Inpatient Payment Records"
          icon={BedDouble}
          iconColor="text-violet-600"
          isOpen={openSection === "ipd"}
          onToggle={() => setOpenSection(openSection === "ipd" ? null : "ipd")}
          count={1}
        >
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <span className="text-xs text-muted-foreground">Package</span>
                <p className="text-sm font-semibold">{formatCurrency(data.inpatient.packageAmount)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Discount</span>
                <p className="text-sm font-semibold">{formatCurrency(data.inpatient.discount)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Net Amount</span>
                <p className="text-sm font-semibold">{formatCurrency(data.inpatient.netAmount)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Received</span>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(data.inpatient.totalReceivedAmount)}</p>
              </div>
            </div>

            {data.inpatient.balanceAmount > 0 && (
              <div className="bg-red-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-red-700 font-medium">Outstanding Balance</span>
                <span className="text-sm font-bold text-red-700">{formatCurrency(data.inpatient.balanceAmount)}</span>
              </div>
            )}

            {(() => {
              let records: { date?: string; amount?: number; mode?: string; notes?: string }[] = []
              try { records = JSON.parse(data.inpatient?.paymentRecords || "[]") } catch { /* ignore */ }
              if (records.length === 0) return null
              return (
                <div className="mt-4 space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Records</h4>
                  {records.map((rec, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{rec.date ? formatDateLong(rec.date) : `Payment ${i + 1}`}</span>
                        {rec.mode && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-muted-foreground">{rec.mode}</span>}
                      </div>
                      <span className="font-medium text-emerald-600">{formatCurrency(rec.amount ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </CollapsiblePaymentSection>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  iconBg,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  bg: string
  iconBg: string
  highlight?: boolean
}) {
  return (
    <div className={`${bg} border ${highlight ? "border-red-200" : "border-gray-100"} rounded-xl px-5 py-4`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function CategoryRow({
  icon: Icon,
  label,
  total,
  paid,
  due,
  color,
  bg,
  count,
}: {
  icon: React.ElementType
  label: string
  total: number
  paid: number
  due: number
  color: string
  bg: string
  count: number
}) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg} shrink-0`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">({count})</span>
        </div>
      </div>
      <div className="flex items-center gap-6 text-sm shrink-0">
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Billed</span>
          <p className="font-semibold">{formatCurrency(total)}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Paid</span>
          <p className="font-semibold text-emerald-600">{formatCurrency(paid)}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Due</span>
          <p className={`font-semibold ${due > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatCurrency(due)}
          </p>
        </div>
      </div>
    </div>
  )
}

function CollapsiblePaymentSection({
  title,
  icon: Icon,
  iconColor,
  isOpen,
  onToggle,
  count,
  children,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  isOpen: boolean
  onToggle: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}
