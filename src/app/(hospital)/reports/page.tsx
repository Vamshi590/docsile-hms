import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"
import { requireServerPermission } from "@/lib/auth"

const ReportsPage = dynamic(() => import("./components/ReportsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function ReportsRoute() {
  await requireServerPermission("reports:view")
  return <ReportsPage />
}
