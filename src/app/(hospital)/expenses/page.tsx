import { db } from "@/lib/db"
import ExpensesPage from "./components/ExpensesPage"

export default async function ExpensesRoute() {
  const hospital = await db.hospitalProfile.findFirst()
  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  return <ExpensesPage hospitalName={hospitalName} />
}
