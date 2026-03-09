import { db } from "@/lib/db"
import LabsPage from "./components/LabsPage"

export default async function LabsRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <LabsPage hospitalName={hospitalName} />
}
