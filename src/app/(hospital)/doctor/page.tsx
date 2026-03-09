import { db } from "@/lib/db"
import { DoctorPage } from "./components/DoctorPage"

export default async function Page() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <DoctorPage hospitalName={hospitalName} />
}
