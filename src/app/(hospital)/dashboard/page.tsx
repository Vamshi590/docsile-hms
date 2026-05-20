import { getSession } from "@/lib/auth"
import { getAdminConfig } from "@/lib/admin-client"
import { DashboardClient } from "./DashboardClient"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  await getSession()
  const config = await getAdminConfig()
  const greeting = getGreeting(new Date().getHours())
  return <DashboardClient greeting={greeting} enabledModules={config.enabledModules} />
}
