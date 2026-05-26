import { requireServerPermission } from "@/lib/auth"
import LabsPage from "./components/LabsPage"
import { getLabs } from "./actions"
import type { LabWithCount } from "./components/LabsPage"

export default async function LabsRoute() {
  await requireServerPermission("labs:view")
  const labs = (await getLabs()) as LabWithCount[]
  return <LabsPage initialLabs={labs} />
}
