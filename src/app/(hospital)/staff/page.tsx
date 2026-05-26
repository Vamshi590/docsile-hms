import StaffPage from "./components/StaffPage"
import { requireAdmin, requireServerPermission } from "@/lib/auth"
import { getStaffMembers, getRoles } from "./actions"

export default async function StaffRoute() {
  await requireAdmin()
  await requireServerPermission("staff:view")
  const [staff, roles] = await Promise.all([getStaffMembers(), getRoles()])
  return <StaffPage initialStaff={staff} initialRoles={roles} />
}
