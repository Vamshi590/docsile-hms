import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const InsurancePage = dynamic(() => import("./components/InsurancePage"), {
  loading: () => <PageSkeleton />,
})

export default async function InsuranceRoute() {
  return <InsurancePage />
}
