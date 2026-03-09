import { requireAuth } from "@/lib/auth"
import { Sidebar } from "@/components/layout/Sidebar"
import { db } from "@/lib/db"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"

export default async function HospitalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const hospital = await db.hospitalProfile.findFirst()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        user={user}
        hospitalName={hospital?.displayName ?? hospital?.name ?? "Docsile HMS"}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full px-4 pt-6 pb-8">{children}</div>
      </main>
      <InstallPrompt />
    </div>
  )
}
