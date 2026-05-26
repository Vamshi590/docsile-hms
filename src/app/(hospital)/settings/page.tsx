import { requireServerPermission } from "@/lib/auth"
import SettingsPage from "./components/SettingsPage"
import { getServiceTemplates } from "./actions"
import type { ServiceTemplate } from "@/lib/types"

export default async function SettingsRoute() {
  await requireServerPermission("settings:view")
  // Only SSR the default Services tab — other tabs render lazily on activation
  // and still client-fetch on mount (acceptable since they're hidden initially).
  const services = await getServiceTemplates(false)
  return <SettingsPage initialServices={services as ServiceTemplate[]} />
}
