import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const AnalyticsPage = dynamic(() => import("./components/AnalyticsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function AnalyticsRoute() {
  return <AnalyticsPage />
}
