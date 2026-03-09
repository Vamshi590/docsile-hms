import { db } from "@/lib/db"
import ReportsPage from "./components/ReportsPage"

export default async function ReportsRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <ReportsPage hospitalName={hospitalName} />
}
