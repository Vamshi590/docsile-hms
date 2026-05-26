import { requireServerPermission } from "@/lib/auth"
import { DoctorPage } from "./components/DoctorPage"
import { getDoctorQueue, getPrescriptionReferenceData } from "./actions"
import { getUserPreferences } from "@/lib/user-preferences"
import { getDefaultPrintConfig } from "../settings/actions"
import { todayISO } from "@/lib/utils"
import { getAdminConfig } from "@/lib/admin-client"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await requireServerPermission("doctor:view")
  const params = await searchParams
  const date = params.date ?? todayISO()
  const [queue, referenceData, prefs, defaultPrintConfig, adminConfig] = await Promise.all([
    getDoctorQueue(date),
    getPrescriptionReferenceData(),
    getUserPreferences(),
    getDefaultPrintConfig(),
    getAdminConfig(),
  ])
  const workupEnabled = adminConfig.enabledModules.includes("workup")
  const vitalsExtended = adminConfig.enabledModules.includes("vitals-extended")
  return (
    <DoctorPage
      initialQueue={queue}
      initialDate={date}
      initialReferenceData={referenceData}
      initialColumns={prefs.doctorColumns ?? null}
      initialDefaultPrint={defaultPrintConfig}
      workupEnabled={workupEnabled}
      vitalsExtended={vitalsExtended}
    />
  )
}
