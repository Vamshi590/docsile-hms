import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopNavBar } from "@/components/layout/TopNavBar"
import { BillingBanner } from "@/components/layout/BillingBanner"
import { getSession } from "@/lib/auth"
import { getHospitalProfile } from "@/lib/db"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"
import { getAdminConfig, type AdminConfig } from "@/lib/admin-client"
import { routeModule, isModuleEnabled } from "@/lib/module-gate"
import { UserProvider } from "@/contexts/UserContext"

export default async function HospitalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, { hospitalName, hospital }] = await Promise.all([
    getSession(),
    getHospitalProfile(),
  ])

  // Use /api/logout (not /login) so any stale-but-cryptographically-valid JWT
  // gets cleared. Otherwise middleware sees the cookie and bounces back here.
  if (!user) redirect("/api/logout")

  const h = await headers()
  const pathname =
    h.get("x-pathname") ?? h.get("x-invoke-path") ?? h.get("x-matched-path") ?? "/"

  // Admin server dependency temporarily disabled — getAdminConfig() returns a
  // static fallback so this never throws. Restore the try/catch below when the
  // admin server is brought back online.
  const config: AdminConfig = await getAdminConfig()

  /*
  let config: AdminConfig
  try {
    config = await getAdminConfig()
  } catch {
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
  */

  const mod = routeModule(pathname)
  if (mod && !isModuleEnabled(pathname, config.enabledModules)) {
    redirect(`/_module-disabled?module=${mod}`)
  }

  let navStyle: "side" | "top" = "side"
  if (hospital?.settings) {
    try {
      const parsed = JSON.parse(hospital.settings) as { navStyle?: unknown }
      if (parsed?.navStyle === "top") navStyle = "top"
    } catch {
      // ignore malformed JSON — default to sidebar
    }
  }

  const navProps = {
    user,
    hospitalName,
    enabledModules: config.enabledModules,
  }

  return (
    <UserProvider user={user}>
      <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
        <BillingBanner message={config.billing.bannerMessage} />
        {navStyle === "top" ? (
          <TopNavBar {...navProps} />
        ) : (
          <Sidebar {...navProps} />
        )}
        <main className="h-full overflow-y-auto flex-1">
          <div className="min-h-full px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:pt-6 lg:pb-8">{children}</div>
        </main>
        <InstallPrompt />
      </div>
    </UserProvider>
  )
}
