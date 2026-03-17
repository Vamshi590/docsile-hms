import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const CallLogsPage = dynamic(() => import("./components/CallLogsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function CallLogsRoute() {
  return <CallLogsPage />
}
