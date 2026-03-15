import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const LicenseTrackerPage = dynamic(() => import("./components/LicenseTrackerPage"), {
  loading: () => <PageSkeleton />,
})

export default async function LicenseTrackerRoute() {
  return <LicenseTrackerPage />
}
