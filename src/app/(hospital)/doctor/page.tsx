import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const DoctorPage = dynamic(
  () => import("./components/DoctorPage").then((mod) => ({ default: mod.DoctorPage })),
  { loading: () => <PageSkeleton /> }
)

export default async function Page() {
  return <DoctorPage />
}
