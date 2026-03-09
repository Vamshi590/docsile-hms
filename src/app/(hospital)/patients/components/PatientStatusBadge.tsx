import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PatientStatus } from "@/lib/types"

const STATUS_CONFIG: Record<PatientStatus, { label: string; variant: "info" | "warning" | "default" | "success" | "destructive" | "secondary" | "muted" }> = {
  REGISTERED:  { label: "Registered",   variant: "info" },
  IN_WORKUP:   { label: "In Workup",    variant: "warning" },
  WORKUP_DONE: { label: "Workup Done",  variant: "default" },
  WITH_DOCTOR: { label: "With Doctor",  variant: "success" },
  VISITED:     { label: "Visited",      variant: "muted" },
  MOVED:       { label: "Moved",        variant: "warning" },
  CANCELLED:   { label: "Cancelled",    variant: "destructive" },
  NO_SHOW:     { label: "No Show",      variant: "destructive" },
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
