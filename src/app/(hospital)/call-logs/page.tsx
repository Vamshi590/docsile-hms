import CallLogsPage from "./components/CallLogsPage"
import { getCallLogs } from "./actions"
import { format } from "date-fns"

export default async function CallLogsRoute({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
    status?: string
    direction?: string
    search?: string
  }>
}) {
  const params = await searchParams
  const today = format(new Date(), "yyyy-MM-dd")
  const startDate = params.startDate ?? today
  const endDate = params.endDate ?? today
  const statusFilter = params.status ?? "all"
  const directionFilter = params.direction ?? "all"
  const searchQuery = params.search ?? ""

  const calls = await getCallLogs({
    startDate,
    endDate,
    status: statusFilter,
    direction: directionFilter,
    search: searchQuery,
  })

  return (
    <CallLogsPage
      initialCalls={calls}
      initialStartDate={startDate}
      initialEndDate={endDate}
      initialStatusFilter={statusFilter}
      initialDirectionFilter={directionFilter}
      initialSearchQuery={searchQuery}
    />
  )
}
