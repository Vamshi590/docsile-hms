"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { BreadcrumbHeader, StatBadge, SearchInput } from "@/components/layout/header"
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
import { INSURANCE_STATUS_FILTER_OPTIONS, INSURANCE_STATUS_MAP } from "../_status-map"
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

const STATUS_FILTER_OPTIONS = INSURANCE_STATUS_FILTER_OPTIONS

export default function InsurancePage({
  initialClaims,
  initialStats,
  initialCompanies,
  initialSearch,
  initialStatusFilter,
}: {
  initialClaims: InsuranceClaim[]
  initialStats: Stats | null
  initialCompanies: InsuranceCompany[]
  initialSearch: string
  initialStatusFilter: string
}) {
  const [claims, setClaims] = useState<InsuranceClaim[]>(initialClaims)
  const [companies, setCompanies] = useState<InsuranceCompany[]>(initialCompanies)
  const [stats, setStats] = useState<Stats | null>(initialStats)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [selectedClaim, setSelectedClaim] = useState<SelectedClaim | null>(null)
  const [billView, setBillView] = useState<{ type: "final" | "enhancement" | "cash" } | null>(null)
  const [claimFormOpen, setClaimFormOpen] = useState(false)
  const [companyManagerOpen, setCompanyManagerOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [result, comps] = await Promise.all([
      getInsuranceClaims({
        search: search.trim() || undefined,
        statuses: INSURANCE_STATUS_MAP[statusFilter]?.length ? INSURANCE_STATUS_MAP[statusFilter] : undefined,
        showClosed: statusFilter === "closed",
      }),
      getInsuranceCompanies(),
    ])
    setClaims(result.data as InsuranceClaim[])
    setStats(result.stats)
    setCompanies(comps as InsuranceCompany[])
    setLoading(false)
  }, [search, statusFilter])

  const skipFirstLoad = useRef(true)
  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false
      return
    }
    fetchData()
  }, [fetchData])

  return (
    <div>
      {/* Sticky Header with Breadcrumb */}
      {selectedClaim ? (
        billView ? (
          <BreadcrumbHeader
            onBack={() => setBillView(null)}
            backLabel={selectedClaim.patientName}
            currentLabel={billView.type === "final" ? "Final Bill" : billView.type === "enhancement" ? "Enhancement Bill" : "Cash Receipt"}
          />
        ) : (
          <BreadcrumbHeader
            onBack={() => setSelectedClaim(null)}
            backLabel="Insurance Claims"
            currentLabel={selectedClaim.patientName}
          />
        )
      ) : (
        <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Insurance Claims</h1>
              <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Preauth, billing & settlement</p>
            </div>
            <button
              onClick={fetchData}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            {stats && (
              <>
                <StatBadge value={stats.totalClaims} label="Active" variant="info" />
                <StatBadge value={stats.preauthPending} label="Preauth Pending" variant="warning" />
                <StatBadge value={stats.settlementPending} label="Awaiting Settlement" variant="success" />
              </>
            )}
          </div>
        </div>
      )}

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
          {/* Filters + Actions */}
          <div className="flex items-center gap-3 flex-wrap rounded-xl border border-border/60 bg-white/80 backdrop-blur-sm p-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              onSubmit={fetchData}
              placeholder="Search claim, patient, IP, phone, company..."
              className="w-72"
            />
            <div className="filter-divider" />
            <div className="flex gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/30 flex-wrap">
              {STATUS_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`rounded-md text-xs font-medium h-7 px-3 transition-all ${
                    statusFilter === opt.value
                      ? "bg-white text-foreground shadow-sm border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={fetchData}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                ↻ Refresh
              </button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setCompanyManagerOpen(true)}>
                Companies
              </Button>
              <Button size="sm" className="h-8" onClick={() => setClaimFormOpen(true)}>
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
