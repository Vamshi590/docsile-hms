import { db } from "@/lib/db"
import InPatientsPage from "./components/InPatientsPage"

export default async function InPatientsRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <InPatientsPage hospitalName={hospitalName} />
}
