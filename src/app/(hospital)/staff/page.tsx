import StaffPage from "./components/StaffPage"
import { requireAdmin } from "@/lib/auth"
import { getStaffMembers, getRoles } from "./actions"

export default async function StaffRoute() {
  await requireAdmin()
  const [staff, roles] = await Promise.all([getStaffMembers(), getRoles()])
  return <StaffPage initialStaff={staff} initialRoles={roles} />
}
