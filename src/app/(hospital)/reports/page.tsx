import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const ReportsPage = dynamic(() => import("./components/ReportsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function ReportsRoute() {
  return <ReportsPage />
}
