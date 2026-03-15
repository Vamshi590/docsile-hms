import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const DuesFollowupsPage = dynamic(
  () => import("./components/DuesFollowupsPage").then((mod) => ({ default: mod.DuesFollowupsPage })),
  { loading: () => <PageSkeleton /> }
)

export default async function Page() {
  return <DuesFollowupsPage />
}
