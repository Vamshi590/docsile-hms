import { WorkupPage } from "./components/WorkupPage"
import { getWorkupQueue } from "./actions"
import { todayISO } from "@/lib/utils"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const date = params.date ?? todayISO()
  const queue = await getWorkupQueue(date)
  return <WorkupPage initialQueue={queue} initialDate={date} />
}
