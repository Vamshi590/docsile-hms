import InsurancePage from "./components/InsurancePage"
import { getInsuranceClaims, getInsuranceCompanies } from "./actions"
import { INSURANCE_STATUS_MAP } from "./_status-map"
import type { InsuranceClaim, InsuranceCompany } from "@/lib/types"

export default async function InsuranceRoute({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const statusFilter = params.status ?? ""

  const [result, companies] = await Promise.all([
    getInsuranceClaims({
      search: search.trim() || undefined,
      statuses: INSURANCE_STATUS_MAP[statusFilter]?.length
        ? INSURANCE_STATUS_MAP[statusFilter]
        : undefined,
      showClosed: statusFilter === "closed",
    }),
    getInsuranceCompanies(),
  ])

  return (
    <InsurancePage
      initialClaims={result.data as InsuranceClaim[]}
      initialStats={result.stats}
      initialCompanies={companies as InsuranceCompany[]}
      initialSearch={search}
      initialStatusFilter={statusFilter}
    />
  )
}
