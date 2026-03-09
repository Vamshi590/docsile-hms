"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { InsuranceStatusBadge } from "./InsuranceStatusBadge"
import { InsuranceClaimDetail } from "./InsuranceClaimDetail"
import { InsuranceBillPreview } from "./InsuranceBillPreview"
import InsuranceClaimForm from "./InsuranceClaimForm"
import InsuranceCompanyManager from "./InsuranceCompanyManager"
import { getInsuranceClaims, getInsuranceCompanies } from "../actions"
import { formatCurrency } from "@/lib/utils"
import type { InsuranceClaim, InsuranceCompany } from "@/lib/types"

type Stats = {
  totalClaims: number
  preauthPending: number
  enhancementPending: number
  settlementPending: number
  totalApprovedAmount: number
  totalSettledAmount: number
  totalPatientPending: number
  claimsThisMonth: number
}

type SelectedClaim = { id: string; patientName: string; claimNumber: string }

const STATUS_FILTER_OPTIONS = [
  { label: "All Active", value: "" },
  { label: "Preauth Pending", value: "preauth" },
  { label: "Enhancement Pending", value: "enhancement" },
  { label: "Settlement Pending", value: "settlement" },
  { label: "Settled", value: "settled" },
  { label: "Closed", value: "closed" },
]

const STATUS_MAP: Record<string, string[]> = {
  "": [],
  preauth: ["PREAUTH_SUBMITTED", "PREAUTH_QUERY"],
  enhancement: ["ENHANCEMENT_CLAIMED", "ENHANCEMENT_QUERY"],
  settlement: ["FINAL_BILL_SUBMITTED"],
  settled: ["SETTLED", "PARTIALLY_SETTLED"],
  closed: ["CLOSED"],
}

export default function InsurancePage({ hospitalName }: { hospitalName: string }) {
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedClaim, setSelectedClaim] = useState<SelectedClaim | null>(null)
  const [billView, setBillView] = useState<{ type: "final" | "enhancement" | "cash" } | null>(null)
  const [claimFormOpen, setClaimFormOpen] = useState(false)
  const [companyManagerOpen, setCompanyManagerOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [result, comps] = await Promise.all([
      getInsuranceClaims({
        search: search.trim() || undefined,
        statuses: STATUS_MAP[statusFilter]?.length ? STATUS_MAP[statusFilter] : undefined,
        showClosed: statusFilter === "closed",
      }),
      getInsuranceCompanies(),
    ])
    setClaims(result.data as InsuranceClaim[])
    setStats(result.stats)
    setCompanies(comps as InsuranceCompany[])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-5">
      {/* Sticky Header with Breadcrumb */}
      <div className="bg-white border-b border-border shadow-sm px-6 py-4 -mx-6 -mt-6 mb-0 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            {selectedClaim ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { if (billView) { setBillView(null) } else { setSelectedClaim(null) } }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-[1.2rem] font-semibold">
                    {billView ? selectedClaim.patientName : "Insurance Claims"}
                  </span>
                </button>
                {!billView && (
                  <>
                    <span className="text-muted-foreground text-[1.2rem]">/</span>
                    <span className="text-[1.2rem] font-semibold text-foreground">
                      {selectedClaim.patientName}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground ml-1 mt-0.5">
                      · {selectedClaim.claimNumber}
                    </span>
                  </>
                )}
                {billView && (
                  <>
                    <span className="text-muted-foreground text-[1.2rem]">/</span>
                    <span className="text-[1.2rem] font-semibold text-foreground">
                      {billView.type === "final" ? "Final Bill" : billView.type === "enhancement" ? "Enhancement Bill" : "Cash Receipt"}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <>
                <h1 className="text-[1.2rem] font-semibold text-foreground tracking-tight leading-none">Insurance Claims</h1>
                <p className="text-xs text-muted-foreground mt-1">{hospitalName}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {!selectedClaim && stats && (
              <>
                <Badge variant="info" className="px-3 py-1.5 gap-1.5 text-sm">
                  <span className="font-bold">{stats.totalClaims}</span>
                  <span className="font-normal">Active</span>
                </Badge>
                <Badge variant="warning" className="px-3 py-1.5 gap-1.5 text-sm">
                  <span className="font-bold">{stats.preauthPending}</span>
                  <span className="font-normal">Preauth Pending</span>
                </Badge>
                <Badge variant="success" className="px-3 py-1.5 gap-1.5 text-sm">
                  <span className="font-bold">{stats.settlementPending}</span>
                  <span className="font-normal">Awaiting Settlement</span>
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedClaim && billView ? (
        /* Bill preview/edit page */
        <InsuranceBillPreview
          claimId={selectedClaim.id}
          billType={billView.type}
          onBack={() => setBillView(null)}
        />
      ) : selectedClaim ? (
        /* Full-page claim detail */
        <InsuranceClaimDetail
          claimId={selectedClaim.id}
          onBack={() => setSelectedClaim(null)}
          onUpdate={fetchData}
          onViewBill={(type: "final" | "enhancement" | "cash") => setBillView({ type })}
        />
      ) : (
        /* List view */
        <div className="py-3 space-y-5">
          {/* Stat Cards */}
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Approved", value: formatCurrency(stats.totalApprovedAmount), color: "text-blue-600" },
                { label: "Total Settled", value: formatCurrency(stats.totalSettledAmount), color: "text-green-600" },
                { label: "Patient Balance", value: formatCurrency(stats.totalPatientPending), color: "text-orange-600" },
                { label: "Claims This Month", value: String(stats.claimsThisMonth), color: "text-foreground" },
              ].map(card => (
                <Card key={card.label} className="p-4">
                  <CardContent className="p-0">
                    <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Filters + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Search claim, patient, IP, phone, company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-80"
            />
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTER_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={statusFilter === opt.value ? "default" : "ghost"}
                  className="rounded-full text-xs h-8 px-3"
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={fetchData} className="text-muted-foreground">
                ↻ Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCompanyManagerOpen(true)}>
                Companies
              </Button>
              <Button size="sm" onClick={() => setClaimFormOpen(true)}>
                + New Claim
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  <TableHead>Claim No</TableHead>
                  <TableHead>Patient / IP</TableHead>
                  <TableHead>Insurance Company</TableHead>
                  <TableHead className="text-right">Total Claimed</TableHead>
                  <TableHead className="text-right">Preauth</TableHead>
                  <TableHead className="text-right">Enhancement</TableHead>
                  <TableHead className="text-right">Total Approved</TableHead>
                  <TableHead className="text-right">Settled</TableHead>
                  <TableHead className="text-right">Patient Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : claims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                      <div className="font-medium">No insurance claims found</div>
                      <div className="text-xs mt-1">
                        {search ? "Try a different search term" : "Create a new claim or admit a patient with insurance"}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  claims.map(claim => (
                    <TableRow
                      key={claim.id}
                      onClick={() => setSelectedClaim({
                        id: claim.id,
                        patientName: claim.patientName,
                        claimNumber: claim.claimNumber,
                      })}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-medium">
                          {claim.claimNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{claim.patientName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{claim.ipNumber}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{claim.insuranceCompanyName}</span>
                        {claim.tpaName && (
                          <div className="text-xs text-muted-foreground">{claim.tpaName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-medium">
                          {claim.totalBillAmount > 0 ? `₹${claim.totalBillAmount.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-medium text-blue-600">
                          {claim.preauthAmount > 0 ? `₹${claim.preauthAmount.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-medium text-blue-600">
                          {claim.enhancementApproved > 0 ? `₹${claim.enhancementApproved.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-bold text-blue-600">
                          {claim.totalApprovedAmount > 0 ? `₹${claim.totalApprovedAmount.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-medium text-green-600">
                          {claim.finalSettledAmount > 0 ? `₹${claim.finalSettledAmount.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-medium ${claim.patientBalance > 0 ? "text-orange-600" : "text-green-600"}`}>
                          {claim.patientBalance > 0 ? `₹${claim.patientBalance.toLocaleString("en-IN")}` : "Nil"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <InsuranceStatusBadge status={claim.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {!loading && claims.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  {claims.length} claim{claims.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Claim Form */}
          <InsuranceClaimForm
            open={claimFormOpen}
            onClose={() => setClaimFormOpen(false)}
            onSuccess={() => {
              setClaimFormOpen(false)
              fetchData()
            }}
            companies={companies}
          />

          {/* Company Manager */}
          <InsuranceCompanyManager
            open={companyManagerOpen}
            onClose={() => setCompanyManagerOpen(false)}
            onUpdate={fetchData}
          />
        </div>
      )}
    </div>
  )
}
