import { db } from "@/lib/db"
import InsurancePage from "./components/InsurancePage"

export default async function InsuranceRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <InsurancePage hospitalName={hospitalName} />
}
