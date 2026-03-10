import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PatientStatus } from "@/lib/types"

const STATUS_CONFIG: Record<PatientStatus, { label: string; variant: "info" | "warning" | "default" | "success" | "destructive" | "secondary" | "muted" }> = {
  REGISTERED:   { label: "Optometrist",   variant: "destructive" },
  IN_WORKUP:    { label: "Optometrist",   variant: "destructive" },
  WORKUP_DONE:  { label: "Doctor",        variant: "warning" },
  WITH_DOCTOR:  { label: "Doctor",        variant: "warning" },
  VISITED:      { label: "Visited",       variant: "muted" },
  COMPLETED:    { label: "Completed",     variant: "success" },
  MEDICAL_ONLY: { label: "Medical Only",  variant: "info" },
  MOVED:        { label: "Moved",         variant: "warning" },
  CANCELLED:    { label: "Cancelled",     variant: "destructive" },
  NO_SHOW:      { label: "No Show",       variant: "destructive" },
}

export function PatientStatusBadge({
  status,
  className,
}: {
  status: PatientStatus | string
  className?: string
}) {
  const config = STATUS_CONFIG[status as PatientStatus] ?? {
    label: status,
    variant: "secondary" as const,
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
