import { db } from "@/lib/db"
import SettingsPage from "./components/SettingsPage"

export default async function SettingsRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <SettingsPage hospitalName={hospitalName} />
}
