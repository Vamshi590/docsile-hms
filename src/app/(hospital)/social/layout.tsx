import { requireServerPermission } from "@/lib/auth"

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  await requireServerPermission("social:view")
  return <>{children}</>
}
