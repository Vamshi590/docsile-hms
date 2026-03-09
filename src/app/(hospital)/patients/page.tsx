import { db } from "@/lib/db"
import { PatientsPage } from "./components/PatientsPage"

export default async function Page() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <PatientsPage hospitalName={hospitalName} />
}
