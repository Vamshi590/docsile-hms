import { Sidebar } from "@/components/layout/Sidebar"
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb"
import { getSession } from "@/lib/auth"
import { getHospitalProfile } from "@/lib/db"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"
import { redirect } from "next/navigation"

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

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <Sidebar
        user={user}
        hospitalName={hospitalName}
      />
      <main className="h-full overflow-y-auto">
        <AppBreadcrumb />
        <div className="min-h-full page-container">{children}</div>
      </main>
      <InstallPrompt />
    </div>
  )
}
