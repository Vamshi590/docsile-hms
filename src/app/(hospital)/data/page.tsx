import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const DataExportPage = dynamic(
  () => import("./components/DataExportPage").then((mod) => ({ default: mod.DataExportPage })),
  { loading: () => <PageSkeleton /> }
)

export default function Page() {
  return <DataExportPage />
}
