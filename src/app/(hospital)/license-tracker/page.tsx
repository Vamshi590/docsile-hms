import { db } from "@/lib/db"
import LicenseTrackerPage from "./components/LicenseTrackerPage"

export default async function LicenseTrackerRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <LicenseTrackerPage hospitalName={hospitalName} />
}
