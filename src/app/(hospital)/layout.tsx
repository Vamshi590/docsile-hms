import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { BillingBanner } from "@/components/layout/BillingBanner"
import { getSession } from "@/lib/auth"
import { getHospitalProfile } from "@/lib/db"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"
import { getAdminConfig, type AdminConfig } from "@/lib/admin-client"
import { routeModule, isModuleEnabled } from "@/lib/module-gate"

export default async function HospitalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, { hospitalName }] = await Promise.all([
    getSession(),
    getHospitalProfile(),
  ])

  if (!user) redirect("/login")

  const h = await headers()
  const pathname =
    h.get("x-pathname") ?? h.get("x-invoke-path") ?? h.get("x-matched-path") ?? "/"

  let config: AdminConfig
  try {
    config = await getAdminConfig()
  } catch {
    // If admin is unreachable on cold boot, show an error page.
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Configuration unavailable</h1>
          <p className="text-sm text-slate-600">
            Could not reach the admin server. Try again in a moment, or contact support.
          </p>
        </div>
      </div>
    )
  }

  const mod = routeModule(pathname)
  if (mod && !isModuleEnabled(pathname, config.enabledModules)) {
    redirect(`/_module-disabled?module=${mod}`)
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <BillingBanner message={config.billing.bannerMessage} />
      <Sidebar
        user={user}
        hospitalName={hospitalName}
        enabledModules={config.enabledModules}
      />
      <main className="h-full overflow-y-auto flex-1">
        <div className="min-h-full px-4 pt-6 pb-8">{children}</div>
      </main>
      <InstallPrompt />
    </div>
  )
}
