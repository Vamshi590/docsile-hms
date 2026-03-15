import dynamic from "next/dynamic"
import { requireAdmin } from "@/lib/auth"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const StaffPage = dynamic(() => import("./components/StaffPage"), {
  loading: () => <PageSkeleton />,
})

export default async function StaffRoute() {
  await requireAdmin()
  return <StaffPage />
}
