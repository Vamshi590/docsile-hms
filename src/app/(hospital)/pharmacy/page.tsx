import { requireServerPermission } from "@/lib/auth"
import PharmacyPage from "./components/PharmacyPage"
import { getStockSummary } from "./actions"

export default async function PharmacyRoute() {
  await requireServerPermission("pharmacy:view")
  const summary = await getStockSummary()
  return <PharmacyPage initialSummary={summary} />
}
