import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const OpticalPage = dynamic(() => import("./components/OpticalPage"), {
  loading: () => <PageSkeleton />,
})

export default async function OpticalRoute() {
  return <OpticalPage />
}
