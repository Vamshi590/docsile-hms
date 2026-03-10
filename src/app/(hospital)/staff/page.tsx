import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import StaffPage from "./components/StaffPage"

export default async function StaffRoute() {
  await requireAdmin()
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <StaffPage hospitalName={hospitalName} />
}
