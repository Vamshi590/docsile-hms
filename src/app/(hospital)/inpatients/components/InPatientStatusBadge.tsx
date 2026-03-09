import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { InPatientStatus } from "@/lib/types"

export const IP_STATUS_CONFIG: Record<InPatientStatus, { label: string; variant: "info" | "warning" | "destructive" | "secondary" | "success" | "muted" | "default" }> = {
  ADMITTED:            { label: "Admitted",      variant: "info" },
  PRE_OP:              { label: "Pre-Op",         variant: "warning" },
  IN_SURGERY:          { label: "In Surgery",     variant: "destructive" },
  POST_OP:             { label: "Post-Op",        variant: "secondary" },
  READY_FOR_DISCHARGE: { label: "Ready to D/C",  variant: "success" },
  DISCHARGED:          { label: "Discharged",     variant: "muted" },
}

export function InPatientStatusBadge({
  status,
  className,
}: {
  status: InPatientStatus | string
  className?: string
}) {
  const config = IP_STATUS_CONFIG[status as InPatientStatus] ?? {
    label: status,
    variant: "secondary" as const,
  }

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  )
}

export const IP_STATUS_TRANSITIONS: Record<InPatientStatus, InPatientStatus[]> = {
  ADMITTED:            ["PRE_OP", "IN_SURGERY", "POST_OP", "READY_FOR_DISCHARGE", "DISCHARGED"],
  PRE_OP:              ["IN_SURGERY", "POST_OP", "READY_FOR_DISCHARGE"],
  IN_SURGERY:          ["POST_OP", "READY_FOR_DISCHARGE"],
  POST_OP:             ["READY_FOR_DISCHARGE", "DISCHARGED"],
  READY_FOR_DISCHARGE: ["DISCHARGED"],
  DISCHARGED:          [],
}
