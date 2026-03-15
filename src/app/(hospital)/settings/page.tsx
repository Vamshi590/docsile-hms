import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const SettingsPage = dynamic(() => import("./components/SettingsPage"), {
  loading: () => <PageSkeleton />,
})

export default async function SettingsRoute() {
  return <SettingsPage />
}
