import PharmacyPage from "./components/PharmacyPage"
import { getStockSummary } from "./actions"

export default async function PharmacyRoute() {
  const summary = await getStockSummary()
  return <PharmacyPage initialSummary={summary} />
}
