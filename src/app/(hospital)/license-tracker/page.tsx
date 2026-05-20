import LicenseTrackerPage from "./components/LicenseTrackerPage"
import { getLicenses } from "./actions"

export default async function LicenseTrackerRoute() {
  const licenses = await getLicenses()
  return <LicenseTrackerPage initialLicenses={licenses} />
}
