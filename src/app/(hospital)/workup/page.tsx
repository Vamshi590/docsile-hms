import { db } from "@/lib/db"
import { WorkupPage } from "./components/WorkupPage"

export default async function Page() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <WorkupPage hospitalName={hospitalName} />
}
