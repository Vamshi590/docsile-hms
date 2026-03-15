import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const WorkupPage = dynamic(
  () => import("./components/WorkupPage").then((mod) => ({ default: mod.WorkupPage })),
  { loading: () => <PageSkeleton /> }
)

export default async function Page() {
  return <WorkupPage />
}
