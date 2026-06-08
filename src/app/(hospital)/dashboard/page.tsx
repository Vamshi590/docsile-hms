import { requireAuth } from "@/lib/auth"
import { getAdminConfig } from "@/lib/admin-client"
import { DashboardClient } from "./DashboardClient"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const session = await requireAuth()
  const config = await getAdminConfig()
  const greeting = getGreeting(new Date().getHours())
  const permissions = session.role === "ADMIN" ? null : session.permissions
  return <DashboardClient greeting={greeting} enabledModules={config.enabledModules} permissions={permissions} />
}
