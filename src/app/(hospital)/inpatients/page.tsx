import { requireServerPermission } from "@/lib/auth"
import InPatientsPage from "./components/InPatientsPage"
import { getInPatients } from "./actions"
import type { InPatient } from "@/lib/types"

export default async function InPatientsRoute({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  await requireServerPermission("inpatients:view")
  const params = await searchParams
  const search = params.search ?? ""
  const statusFilter = params.status ?? ""

  const result = await getInPatients({
    search: search.trim() || undefined,
    statuses: statusFilter ? [statusFilter] : undefined,
    showDischarged: statusFilter === "" || statusFilter === "DISCHARGED",
  })

  return (
    <InPatientsPage
      initialPatients={result.data as InPatient[]}
      initialStats={result.stats}
      initialSearch={search}
      initialStatusFilter={statusFilter}
    />
  )
}
