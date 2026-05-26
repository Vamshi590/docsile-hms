import { requireServerPermission } from "@/lib/auth"
import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const DuesFollowupsPage = dynamic(
  () => import("./components/DuesFollowupsPage").then((mod) => ({ default: mod.DuesFollowupsPage })),
  { loading: () => <PageSkeleton /> }
)

export default async function Page() {
  await requireServerPermission("dues:view")
  return <DuesFollowupsPage />
}
