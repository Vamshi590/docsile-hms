import LabsPage from "./components/LabsPage"
import { getLabs } from "./actions"
import type { LabWithCount } from "./components/LabsPage"

export default async function LabsRoute() {
  const labs = (await getLabs()) as LabWithCount[]
  return <LabsPage initialLabs={labs} />
}
