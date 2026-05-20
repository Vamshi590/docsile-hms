import { DoctorPage } from "./components/DoctorPage"
import { getDoctorQueue, getPrescriptionReferenceData } from "./actions"
import { getUserPreferences } from "@/lib/user-preferences"
import { todayISO } from "@/lib/utils"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const date = params.date ?? todayISO()
  const [queue, referenceData, prefs] = await Promise.all([
    getDoctorQueue(date),
    getPrescriptionReferenceData(),
    getUserPreferences(),
  ])
  return (
    <DoctorPage
      initialQueue={queue}
      initialDate={date}
      initialReferenceData={referenceData}
      initialColumns={prefs.doctorColumns ?? null}
    />
  )
}
