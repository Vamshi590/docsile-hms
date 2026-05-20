import OpticalPage from "./components/OpticalPage"
import { getStockSummary } from "./actions"

export default async function OpticalRoute() {
  const summary = await getStockSummary()
  return <OpticalPage initialSummary={summary} />
}
