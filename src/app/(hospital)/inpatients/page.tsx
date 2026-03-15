import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const InPatientsPage = dynamic(() => import("./components/InPatientsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function InPatientsRoute() {
  return <InPatientsPage />
}
