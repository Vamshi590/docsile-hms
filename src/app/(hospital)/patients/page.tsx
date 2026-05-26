import { requireServerPermission } from "@/lib/auth"
import { PatientsPage } from "./components/PatientsPage"
import { getPatients, getCurrentUserRole } from "./actions"
import { getDefaultPrintConfig } from "../settings/actions"
import { todayISO } from "@/lib/utils"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; search?: string }>
}) {
  await requireServerPermission("patients:view")
  const params = await searchParams
  const date = params.date ?? todayISO()
  const search = params.search ?? ""

  const [patients, userRoleResult, defaultPrintConfig] = await Promise.all([
    getPatients({ date, search: search || undefined, type: "OPD" }),
    getCurrentUserRole(),
    getDefaultPrintConfig(),
  ])

  return (
    <PatientsPage
      initialPatients={patients}
      initialUserRole={userRoleResult.role}
      initialDate={date}
      initialSearch={search}
      initialDefaultPrint={defaultPrintConfig}
    />
  )
}
