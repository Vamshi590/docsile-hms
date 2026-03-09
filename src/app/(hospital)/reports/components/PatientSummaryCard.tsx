"use client"

import {
  User,
  Phone,
  Mail,
  CalendarDays,
  Activity,
  BedDouble,
  IndianRupee,
  Clock,
  MapPin,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDateLong, formatCurrency, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface PatientSummary {
  id: string
  patientId: string
  firstName: string
  lastName: string | null
  fullName: string
  phone: string
  email: string | null
  age: number | null
  gender: string
  dateOfBirth: Date | null
  address: string | null
  registeredOn: Date
  lastVisit: Date
  opdVisits: number
  hasInpatient: boolean
  inpatientStatus: string | null
  totalBilled: number
  totalPaid: number
  totalDues: number
}

interface Props {
  patient: PatientSummary
}

export function PatientSummaryCard({ patient }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      {/* Top band */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent px-6 py-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <Avatar className="h-16 w-16 shrink-0 border-2 border-white shadow-sm">
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
              {getInitials(patient.fullName)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{patient.fullName}</h2>
              <span className="text-xs font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-md font-semibold">
                {patient.patientId}
              </span>
              <Badge variant="outline" className="text-xs">
                {patient.gender} {patient.age ? `• ${patient.age}Y` : ""}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {patient.phone}
              </span>
              {patient.email && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {patient.email}
                </span>
              )}
              {patient.address && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {patient.address.length > 40 ? patient.address.slice(0, 40) + "…" : patient.address}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Registered {formatDateLong(patient.registeredOn)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-100 border-t border-gray-100">
        <StatItem
          icon={Activity}
          label="OPD Visits"
          value={String(patient.opdVisits)}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatItem
          icon={BedDouble}
          label="Inpatient"
          value={patient.hasInpatient ? (patient.inpatientStatus === "DISCHARGED" ? "Discharged" : patient.inpatientStatus ?? "Yes") : "None"}
          color={patient.hasInpatient ? "text-violet-600" : "text-gray-400"}
          bg={patient.hasInpatient ? "bg-violet-50" : "bg-gray-50"}
        />
        <StatItem
          icon={IndianRupee}
          label="Total Billed"
          value={formatCurrency(patient.totalBilled)}
          color="text-foreground"
          bg="bg-gray-50"
        />
        <StatItem
          icon={IndianRupee}
          label="Total Paid"
          value={formatCurrency(patient.totalPaid)}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatItem
          icon={Clock}
          label="Outstanding Dues"
          value={formatCurrency(patient.totalDues)}
          color={patient.totalDues > 0 ? "text-red-600" : "text-emerald-600"}
          bg={patient.totalDues > 0 ? "bg-red-50" : "bg-emerald-50"}
          highlight={patient.totalDues > 0}
        />
      </div>
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
  color,
  bg,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  bg: string
  highlight?: boolean
}) {
  return (
    <div className={`px-5 py-4 ${highlight ? "bg-red-50/50" : ""}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-[0.95rem] font-bold ${color}`}>{value}</p>
    </div>
  )
}
