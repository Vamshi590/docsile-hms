import { getSession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "./DashboardClient"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const user = (await getSession())!
  const now = new Date()
  const greeting = getGreeting(now.getHours())

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  const supabase = await createClient()
  const [opdResult, ipdResult, activeIPResult] = await Promise.all([
    supabase
      .from("Patient")
      .select("*", { count: "exact", head: true })
      .eq("patientType", "OPD")
      .gte("appointmentDate", today.toISOString())
      .lt("appointmentDate", tomorrow.toISOString()),
    supabase
      .from("Patient")
      .select("*", { count: "exact", head: true })
      .eq("patientType", "IPD")
      .gte("appointmentDate", today.toISOString())
      .lt("appointmentDate", tomorrow.toISOString()),
    supabase
      .from("InPatient")
      .select("*", { count: "exact", head: true })
      .neq("status", "DISCHARGED"),
  ])

  return (
    <DashboardClient
      greeting={greeting}
    />
  )
}
