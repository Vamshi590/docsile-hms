import { getSession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getISTDayBounds } from "@/lib/utils"
import { DashboardClient } from "./DashboardClient"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const user = (await getSession())!

  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  const greeting = getGreeting(nowIST.getHours())
  const parts = user.fullName.split(" ")
  const firstName = parts[0].toLowerCase() === "dr." || parts[0].toLowerCase() === "dr"
    ? (parts[1] ?? parts[0])
    : parts[0]

  const { start: today, end: tomorrow } = getISTDayBounds()

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
      firstName={firstName}
      userRole={user.role}
      opdCount={opdResult.count ?? 0}
      ipdCount={ipdResult.count ?? 0}
      activeInpatients={activeIPResult.count ?? 0}
    />
  )
}
