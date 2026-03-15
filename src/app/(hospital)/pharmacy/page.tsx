import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const PharmacyPage = dynamic(() => import("./components/PharmacyPage"), {
  loading: () => <PageSkeleton />,
})

export default async function PharmacyRoute() {
  return <PharmacyPage />
}
