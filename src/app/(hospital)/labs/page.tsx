import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const LabsPage = dynamic(() => import("./components/LabsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function LabsRoute() {
  return <LabsPage />
}
