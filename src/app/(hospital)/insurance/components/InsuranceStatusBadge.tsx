import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { InsuranceClaimStatus } from "@/lib/types"

export const INS_STATUS_CONFIG: Record<InsuranceClaimStatus, { label: string; variant: "info" | "warning" | "destructive" | "secondary" | "success" | "muted" | "default" }> = {
  PREAUTH_SUBMITTED:     { label: "Preauth Submitted",    variant: "info" },
  PREAUTH_QUERY:         { label: "Preauth Query",        variant: "warning" },
  PREAUTH_APPROVED:      { label: "Preauth Approved",     variant: "success" },
  PREAUTH_REJECTED:      { label: "Preauth Rejected",     variant: "destructive" },
  ENHANCEMENT_CLAIMED:   { label: "Enhancement Claimed",  variant: "info" },
  ENHANCEMENT_QUERY:     { label: "Enhancement Query",    variant: "warning" },
  ENHANCEMENT_APPROVED:  { label: "Enhancement Approved",  variant: "success" },
  ENHANCEMENT_REJECTED:  { label: "Enhancement Rejected",  variant: "destructive" },
  FINAL_BILL_SUBMITTED:  { label: "Final Bill Sent",      variant: "info" },
  SETTLED:               { label: "Settled",               variant: "success" },
  PARTIALLY_SETTLED:     { label: "Partially Settled",     variant: "warning" },
  CLAIM_REJECTED:        { label: "Claim Rejected",        variant: "destructive" },
  CLOSED:                { label: "Closed",                variant: "muted" },
}

export function InsuranceStatusBadge({
  status,
  className,
}: {
  status: InsuranceClaimStatus | string
  className?: string
}) {
  const config = INS_STATUS_CONFIG[status as InsuranceClaimStatus] ?? {
    label: status,
    variant: "secondary" as const,
  }

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  )
}

export const INS_STATUS_TRANSITIONS: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
  PREAUTH_SUBMITTED:    ["PREAUTH_QUERY", "PREAUTH_APPROVED", "PREAUTH_REJECTED"],
  PREAUTH_QUERY:        ["PREAUTH_APPROVED", "PREAUTH_REJECTED"],
  PREAUTH_APPROVED:     ["ENHANCEMENT_CLAIMED", "FINAL_BILL_SUBMITTED", "CLOSED"],
  PREAUTH_REJECTED:     ["CLOSED"],
  ENHANCEMENT_CLAIMED:  ["ENHANCEMENT_QUERY", "ENHANCEMENT_APPROVED", "ENHANCEMENT_REJECTED"],
  ENHANCEMENT_QUERY:    ["ENHANCEMENT_APPROVED", "ENHANCEMENT_REJECTED"],
  ENHANCEMENT_APPROVED: ["FINAL_BILL_SUBMITTED", "CLOSED"],
  ENHANCEMENT_REJECTED: ["FINAL_BILL_SUBMITTED", "CLOSED"],
  FINAL_BILL_SUBMITTED: ["SETTLED", "PARTIALLY_SETTLED", "CLAIM_REJECTED"],
  SETTLED:              ["CLOSED"],
  PARTIALLY_SETTLED:    ["SETTLED", "CLOSED"],
  CLAIM_REJECTED:       ["CLOSED"],
  CLOSED:               [],
}
