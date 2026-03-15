import { cn } from "@/lib/utils"
import type { PatientStatus } from "@/lib/types"

const STATUS_CONFIG: Record<PatientStatus, { label: string; bg: string; text: string; dot: string }> = {
  REGISTERED:   { label: "Optometrist",   bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  IN_WORKUP:    { label: "Optometrist",   bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  WORKUP_DONE:  { label: "Doctor",        bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
  WITH_DOCTOR:  { label: "Doctor",        bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
  VISITED:      { label: "Visited",       bg: "bg-slate-50",  text: "text-slate-600",  dot: "bg-slate-400" },
  COMPLETED:    { label: "Completed",     bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  MEDICAL_ONLY: { label: "Medical Only",  bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  MOVED:        { label: "Moved",         bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
  CANCELLED:    { label: "Cancelled",     bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  NO_SHOW:      { label: "No Show",       bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
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
    bg: "bg-slate-50",
    text: "text-slate-600",
    dot: "bg-slate-400",
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
      config.bg, config.text,
      className,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  )
}
