import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import AnalyticsPage from "./components/AnalyticsPage"

export default async function AnalyticsRoute() {
  await requireAuth()
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"

  return <AnalyticsPage hospitalName={hospitalName} />
}
