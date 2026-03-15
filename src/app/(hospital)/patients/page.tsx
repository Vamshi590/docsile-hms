import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const PatientsPage = dynamic(
  () => import("./components/PatientsPage").then((mod) => ({ default: mod.PatientsPage })),
  { loading: () => <PageSkeleton /> }
)

export default async function Page() {
  return <PatientsPage />
}
