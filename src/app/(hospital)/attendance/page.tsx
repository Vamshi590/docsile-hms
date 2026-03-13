import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { AttendancePage } from "./components/AttendancePage"

export default async function AttendanceRoute() {
  await requireAdmin()
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <AttendancePage hospitalName={hospitalName} />
}
