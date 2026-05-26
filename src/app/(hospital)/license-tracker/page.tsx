import { requireServerPermission } from "@/lib/auth"
import LicenseTrackerPage from "./components/LicenseTrackerPage"
import { getLicenses } from "./actions"

export default async function LicenseTrackerRoute() {
  await requireServerPermission("licenses:view")
  const licenses = await getLicenses()
  return <LicenseTrackerPage initialLicenses={licenses} />
}
