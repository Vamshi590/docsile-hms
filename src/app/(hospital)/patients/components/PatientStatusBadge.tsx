import { cn } from "@/lib/utils"
import type { PatientStatus } from "@/lib/types"

const STATUS_CONFIG: Record<PatientStatus, { label: string; bg: string; text: string; dot: string }> = {
  REGISTERED:   { label: "Registered",     bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  IN_WORKUP:    { label: "In Workup",      bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  WORKUP_DONE:  { label: "Ready for Dr.",  bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" },
  WITH_DOCTOR:  { label: "With Doctor",    bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" },
  VISITED:      { label: "Visited",        bg: "bg-slate-50",   text: "text-slate-600",   dot: "bg-slate-400" },
  COMPLETED:    { label: "Completed",      bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" },
  MEDICAL_ONLY: { label: "Medical",        bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  MOVED:        { label: "Rescheduled",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  CANCELLED:    { label: "Cancelled",      bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-400" },
  NO_SHOW:      { label: "No Show",        bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-400" },
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
