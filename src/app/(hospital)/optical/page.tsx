import { requireServerPermission } from "@/lib/auth"
import OpticalPage from "./components/OpticalPage"
import { getStockSummary } from "./actions"

export default async function OpticalRoute() {
  await requireServerPermission("optical:view")
  const summary = await getStockSummary()
  return <OpticalPage initialSummary={summary} />
}
