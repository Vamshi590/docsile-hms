import { db } from "@/lib/db"
import { DuesFollowupsPage } from "./components/DuesFollowupsPage"

export default async function Page() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <DuesFollowupsPage hospitalName={hospitalName} />
}
