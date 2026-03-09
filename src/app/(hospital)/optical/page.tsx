import { db } from "@/lib/db"
import OpticalPage from "./components/OpticalPage"

export default async function OpticalRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <OpticalPage hospitalName={hospitalName} />
}
