import { cn } from "@/lib/utils"
import type { PatientStatus } from "@/lib/types"

const STATUS_CONFIG: Record<PatientStatus, { label: string; color: string }> = {
  REGISTERED:   { label: "Optometrist",   color: "text-red-600" },
  IN_WORKUP:    { label: "Optometrist",   color: "text-red-600" },
  WORKUP_DONE:  { label: "Doctor",        color: "text-amber-600" },
  WITH_DOCTOR:  { label: "Doctor",        color: "text-amber-600" },
  VISITED:      { label: "Visited",       color: "text-muted-foreground" },
  COMPLETED:    { label: "Completed",     color: "text-green-600" },
  MEDICAL_ONLY: { label: "Medical Only",  color: "text-blue-600" },
  MOVED:        { label: "Moved",         color: "text-amber-600" },
  CANCELLED:    { label: "Cancelled",     color: "text-red-600" },
  NO_SHOW:      { label: "No Show",       color: "text-red-600" },
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
    color: "text-muted-foreground",
  }

  return (
    <span className={cn("text-xs font-semibold", config.color, className)}>
      {config.label}
    </span>
  )
}
