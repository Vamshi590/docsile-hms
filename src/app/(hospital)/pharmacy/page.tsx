import { db } from "@/lib/db"
import PharmacyPage from "./components/PharmacyPage"

export default async function PharmacyRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <PharmacyPage hospitalName={hospitalName} />
}
