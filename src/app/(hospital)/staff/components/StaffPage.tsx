"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/header"
import {
  Search, Plus, UserCog, Shield, MoreHorizontal, KeyRound,
  UserX, UserCheck, Pencil, Trash2,
  LayoutDashboard, Users, Eye, Stethoscope, FlaskConical,
  Pill, Glasses, BedDouble, ClipboardList, Wallet,
  FileBarChart, ScrollText, DatabaseZap, Settings, Lock,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  getStaffMembers,
  createStaffMember,
  updateStaffMember,
  toggleStaffActive,
  resetStaffPassword,
  getRoles,
  createRole,
  updateRolePermissions,
  updateRole,
  deleteRole,
  seedSystemRoles,
} from "../actions"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { formatDate, formatCurrency } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffMember = {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: string
  department: string | null
  designation: string | null
  employeeId: string | null
  qualifications: string | null
  joiningDate: Date | null
  address: string | null
  emergencyContact: string | null
  bloodGroup: string | null
  salary: number | null
  salaryType: string | null
  isActive: boolean
  lastLogin: Date | null
  createdAt: Date
}

type RoleType = {
  id: string
  name: string
  displayName: string
  description: string | null
  permissions: string
  isSystem: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const DEPARTMENTS = ["General", "Ophthalmology", "Optometry", "Pharmacy", "Lab", "Nursing", "Administration", "Front Desk", "Accounts"]

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#2563eb",
  DOCTOR: "#8b5cf6",
  RECEPTIONIST: "#f59e0b",
  OPTOMETRIST: "#06b6d4",
  NURSE: "#ec4899",
}

function getRoleColor(name: string) {
  return ROLE_COLORS[name] || "#6b7280"
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  patients: Users,
  workup: Eye,
  doctor: Stethoscope,
  labs: FlaskConical,
  pharmacy: Pill,
  optical: Glasses,
  inpatients: BedDouble,
  insurance: Shield,
  dues: ClipboardList,
  expenses: Wallet,
  reports: FileBarChart,
  licenses: ScrollText,
  settings: Settings,
  staff: UserCog,
  data: DatabaseZap,
}

const MODULE_COLORS: Record<string, string> = {
  dashboard: "#2563eb",
  patients: "#8b5cf6",
  workup: "#06b6d4",
  doctor: "#059669",
  labs: "#d97706",
  pharmacy: "#dc2626",
  optical: "#7c3aed",
  inpatients: "#0891b2",
  insurance: "#4f46e5",
  dues: "#ca8a04",
  expenses: "#e11d48",
  reports: "#2563eb",
  licenses: "#0d9488",
  settings: "#64748b",
  staff: "#7c3aed",
  data: "#0ea5e9",
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState("staff")
  const [loading, setLoading] = useState(true)

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [showStaffDialog, setShowStaffDialog] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [showResetPassword, setShowResetPassword] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [showStaffDetail, setShowStaffDetail] = useState<StaffMember | null>(null)

  const [roles, setRoles] = useState<RoleType[]>([])
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleType | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const [form, setForm] = useState({
    email: "", password: "", fullName: "", phone: "", role: "RECEPTIONIST",
    department: "", designation: "", employeeId: "", qualifications: "",
    joiningDate: "", address: "", emergencyContact: "", bloodGroup: "", salary: "", salaryType: "",
  })

  const [roleForm, setRoleForm] = useState({
    name: "", displayName: "", description: "",
  })

  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [staffData, rolesData] = await Promise.all([getStaffMembers(), getRoles()])
      setStaff(staffData)
      setRoles(rolesData)
      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id)
      }
    } catch {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredStaff = staff.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone?.includes(search)) ||
      (s.employeeId?.toLowerCase().includes(search.toLowerCase()))
    const matchesRole = roleFilter === "ALL" || s.role === roleFilter
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? s.isActive : !s.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  const availableRoles = Array.from(new Set([
    ...staff.map((s) => s.role),
    ...roles.map((r) => r.name),
  ])).sort()

  const selectedRole = roles.find((r) => r.id === selectedRoleId)
  const selectedRolePerms: string[] = selectedRole ? JSON.parse(selectedRole.permissions) : []
  const totalPerms = Object.values(ALL_PERMISSIONS).reduce((sum, m) => sum + m.permissions.length, 0)

  // ─── Staff Handlers ──────────────────────────────────────────────────────

  function openAddStaff() {
    setEditingStaff(null)
    setForm({
      email: "", password: "", fullName: "", phone: "", role: "RECEPTIONIST",
      department: "", designation: "", employeeId: "", qualifications: "",
      joiningDate: "", address: "", emergencyContact: "", bloodGroup: "", salary: "", salaryType: "",
    })
    setShowStaffDialog(true)
  }

  function openEditStaff(s: StaffMember) {
    setEditingStaff(s)
    setForm({
      email: s.email, password: "", fullName: s.fullName, phone: s.phone ?? "",
      role: s.role, department: s.department ?? "", designation: s.designation ?? "",
      employeeId: s.employeeId ?? "", qualifications: s.qualifications ?? "",
      joiningDate: s.joiningDate ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(s.joiningDate)) : "",
      address: s.address ?? "", emergencyContact: s.emergencyContact ?? "", bloodGroup: s.bloodGroup ?? "",
      salary: s.salary != null ? String(s.salary) : "", salaryType: s.salaryType ?? "",
    })
    setShowStaffDialog(true)
  }

  async function handleSaveStaff() {
    setSaving(true)
    const payload = {
      ...form,
      salary: form.salary ? parseFloat(form.salary) : undefined,
      password: form.password || undefined,
    }
    try {
      if (editingStaff) {
        const res = await updateStaffMember(editingStaff.id, payload)
        if (!res.success) { toast.error(res.error); return }
        toast.success("Staff member updated")
      } else {
        if (!form.password) { toast.error("Password is required"); return }
        const res = await createStaffMember(payload)
        if (!res.success) { toast.error(res.error); return }
        toast.success("Staff member added")
      }
      setShowStaffDialog(false)
      loadData()
    } catch { toast.error("Operation failed") } finally { setSaving(false) }
  }

  async function handleToggleActive(id: string) {
    const res = await toggleStaffActive(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success("Status updated")
    loadData()
  }

  async function handleResetPassword() {
    if (!showResetPassword || !newPassword) return
    setSaving(true)
    try {
      const res = await resetStaffPassword(showResetPassword, newPassword)
      if (!res.success) { toast.error(res.error); return }
      toast.success("Password reset successfully")
      setShowResetPassword(null)
      setNewPassword("")
    } catch { toast.error("Failed to reset password") } finally { setSaving(false) }
  }

  // ─── Role Handlers ───────────────────────────────────────────────────────

  function openAddRole() {
    setEditingRole(null)
    setRoleForm({ name: "", displayName: "", description: "" })
    setShowRoleDialog(true)
  }

  async function handleSaveRole() {
    setSaving(true)
    try {
      if (editingRole) {
        const res = await updateRole(editingRole.id, { displayName: roleForm.displayName, description: roleForm.description })
        if (!res.success) { toast.error(res.error); return }
        toast.success("Role updated")
      } else {
        const res = await createRole({ name: roleForm.name, displayName: roleForm.displayName, description: roleForm.description, permissions: [] })
        if (!res.success) { toast.error(res.error); return }
        toast.success("Role created")
      }
      setShowRoleDialog(false)
      loadData()
    } catch { toast.error("Operation failed") } finally { setSaving(false) }
  }

  async function handleDeleteRole(id: string) {
    const res = await deleteRole(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success("Role deleted")
    if (selectedRoleId === id) setSelectedRoleId(roles.find((r) => r.id !== id)?.id ?? null)
    loadData()
  }

  async function handleTogglePermission(permKey: string) {
    if (!selectedRole) return
    const current: string[] = JSON.parse(selectedRole.permissions)
    const updated = current.includes(permKey)
      ? current.filter((p) => p !== permKey)
      : [...current, permKey]
    const res = await updateRolePermissions(selectedRole.id, updated)
    if (!res.success) { toast.error(res.error); return }
    setRoles((prev) => prev.map((r) => r.id === selectedRole.id ? { ...r, permissions: JSON.stringify(updated) } : r))
  }

  async function handleToggleModulePermissions(moduleKey: string) {
    if (!selectedRole) return
    const modulePerms: string[] = ALL_PERMISSIONS[moduleKey as keyof typeof ALL_PERMISSIONS].permissions.map((p) => p.key)
    const current: string[] = JSON.parse(selectedRole.permissions)
    const allEnabled = modulePerms.every((p) => current.includes(p))
    const updated = allEnabled
      ? current.filter((p) => !(modulePerms as string[]).includes(p))
      : [...new Set([...current, ...modulePerms])]
    const res = await updateRolePermissions(selectedRole.id, updated)
    if (!res.success) { toast.error(res.error); return }
    setRoles((prev) => prev.map((r) => r.id === selectedRole.id ? { ...r, permissions: JSON.stringify(updated) } : r))
  }

  async function handleSeedRoles() {
    setSaving(true)
    try {
      const res = await seedSystemRoles()
      if (!res.success) { toast.error(res.error); return }
      toast.success("System roles initialized")
      loadData()
    } catch { toast.error("Failed to seed roles") } finally { setSaving(false) }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Staff Management" onRefresh={loadData} />
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="space-y-5">
        <PageHeader title="Staff Management" onRefresh={loadData}>
          <TabsList>
            <TabsTrigger value="staff" className="gap-2">
              <UserCog className="h-4 w-4" /> Staff Members
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" /> Roles & Permissions
            </TabsTrigger>
          </TabsList>
        </PageHeader>

        {/* ═══ STAFF MEMBERS TAB ═══ */}
        <TabsContent value="staff" className="space-y-4 mt-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, email, phone, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  {availableRoles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openAddStaff} className="gap-2"><Plus className="h-4 w-4" /> Add Staff</Button>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold">Department</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold">Employee ID</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No staff members found</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredStaff.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setShowStaffDetail(s)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: getRoleColor(s.role) }}>
                            {s.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{s.fullName}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold" style={{ backgroundColor: getRoleColor(s.role) + "14", color: getRoleColor(s.role) }}>
                          {s.role}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.department || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.phone || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-mono text-muted-foreground">{s.employeeId || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.isActive ? "success" : "destructive"} className="text-[0.65rem]">{s.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditStaff(s) }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowResetPassword(s.id); setNewPassword("") }}><KeyRound className="h-4 w-4 mr-2" /> Reset Password</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(s.id) }} className={s.isActive ? "text-destructive" : "text-green-600"}>
                              {s.isActive ? <><UserX className="h-4 w-4 mr-2" /> Deactivate</> : <><UserCheck className="h-4 w-4 mr-2" /> Activate</>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══ ROLES & PERMISSIONS TAB ═══ */}
          <TabsContent value="roles" className="mt-4">
            {roles.length === 0 ? (
              <div className="rounded-2xl border bg-card p-12 text-center shadow-xs">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No roles configured</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Initialize the default system roles to get started with permission management. You can customize permissions for each role after setup.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={handleSeedRoles} disabled={saving} className="gap-2">
                    <Shield className="h-4 w-4" /> {saving ? "Setting up..." : "Initialize Default Roles"}
                  </Button>
                  <Button variant="outline" onClick={openAddRole} className="gap-2">
                    <Plus className="h-4 w-4" /> Create Custom Role
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-5 min-h-[500px]">
                {/* Left: Role Sidebar */}
                <div className="w-72 shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Roles</h3>
                    <Button size="sm" variant="outline" onClick={openAddRole} className="h-7 text-xs gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> New
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {roles.map((role) => {
                      const perms: string[] = JSON.parse(role.permissions)
                      const pct = totalPerms > 0 ? Math.round((perms.length / totalPerms) * 100) : 0
                      const isSelected = selectedRoleId === role.id
                      const userCount = staff.filter((s) => s.role === role.name).length
                      const color = getRoleColor(role.name)

                      return (
                        <button
                          key={role.id}
                          onClick={() => setSelectedRoleId(role.id)}
                          className={`w-full text-left rounded-xl border p-3 transition-all duration-150 ${
                            isSelected ? "border-primary/30 bg-accent shadow-sm" : "border-border bg-card hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ backgroundColor: color }}>
                              {role.displayName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-foreground truncate">{role.displayName}</span>
                                {role.isSystem && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[0.65rem] text-muted-foreground">{userCount} {userCount === 1 ? "member" : "members"}</span>
                                <span className="text-[0.65rem] text-muted-foreground">·</span>
                                <span className="text-[0.65rem] text-muted-foreground">{perms.length} perms</span>
                              </div>
                              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Right: Permissions Panel */}
                <div className="flex-1 min-w-0">
                  {selectedRole ? (
                    <div className="space-y-4">
                      {/* Role Header Card */}
                      <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold" style={{ backgroundColor: getRoleColor(selectedRole.name) }}>
                              {selectedRole.displayName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-[0.95rem] font-semibold">{selectedRole.displayName}</h3>
                                <Badge variant="outline" className="text-[0.6rem] font-mono">{selectedRole.name}</Badge>
                                {selectedRole.isSystem && <Badge variant="muted" className="text-[0.6rem]">System</Badge>}
                              </div>
                              {selectedRole.description && <p className="text-xs text-muted-foreground mt-0.5">{selectedRole.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-lg font-bold" style={{ color: getRoleColor(selectedRole.name) }}>{selectedRolePerms.length}</p>
                              <p className="text-[0.65rem] text-muted-foreground -mt-0.5">of {totalPerms}</p>
                            </div>
                            {!selectedRole.isSystem && (
                              <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRole(selectedRole.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Permission Module Cards */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {Object.entries(ALL_PERMISSIONS).map(([moduleKey, module]) => {
                          const ModuleIcon = MODULE_ICONS[moduleKey] || Shield
                          const moduleColor = MODULE_COLORS[moduleKey] || "#6b7280"
                          const modulePermKeys = module.permissions.map((p) => p.key)
                          const enabledCount = modulePermKeys.filter((k) => selectedRolePerms.includes(k)).length
                          const allEnabled = enabledCount === modulePermKeys.length
                          const someEnabled = enabledCount > 0

                          return (
                            <div key={moduleKey} className="rounded-xl border bg-card overflow-hidden shadow-xs transition-all hover:shadow-sm">
                              {/* Module Header */}
                              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: moduleColor + "14" }}>
                                    <ModuleIcon className="h-3.5 w-3.5" style={{ color: moduleColor }} />
                                  </div>
                                  <span className="text-[0.8rem] font-semibold text-foreground">{module.label}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[0.65rem] tabular-nums text-muted-foreground font-medium">{enabledCount}/{modulePermKeys.length}</span>
                                  <Switch checked={allEnabled} onCheckedChange={() => handleToggleModulePermissions(moduleKey)} className="scale-[0.8]" />
                                </div>
                              </div>

                              {/* Individual Permission Toggles */}
                              <div className="px-4 py-2.5 space-y-0.5">
                                {module.permissions.map((perm) => {
                                  const isEnabled = selectedRolePerms.includes(perm.key)
                                  return (
                                    <label key={perm.key} className={`flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg cursor-pointer transition-colors ${isEnabled ? "hover:bg-accent/50" : "hover:bg-muted/60"}`}>
                                      <span className={`text-[0.78rem] ${isEnabled ? "text-foreground font-medium" : "text-muted-foreground"}`}>{perm.label}</span>
                                      <Switch checked={isEnabled} onCheckedChange={() => handleTogglePermission(perm.key)} className="scale-[0.7]" />
                                    </label>
                                  )
                                })}
                              </div>

                              {/* Bottom progress accent */}
                              {someEnabled && (
                                <div className="h-0.5" style={{ backgroundColor: moduleColor + "20" }}>
                                  <div className="h-full transition-all duration-300" style={{ width: `${(enabledCount / modulePermKeys.length) * 100}%`, backgroundColor: moduleColor }} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-80 text-muted-foreground">
                      <div className="text-center">
                        <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Select a role to manage permissions</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

      {/* ═══ ADD/EDIT STAFF DIALOG ═══ */}
      <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {!editingStaff && (
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(roles.length > 0 ? roles.map((r) => r.name) : ["ADMIN", "DOCTOR", "RECEPTIONIST", "OPTOMETRIST", "NURSE"]).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Senior Consultant" />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} placeholder="e.g. EMP-001" />
            </div>
            <div className="space-y-2">
              <Label>Qualifications</Label>
              <Input value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} placeholder="e.g. MBBS, MS Ophthalmology" />
            </div>
            <div className="space-y-2">
              <Label>Date of Joining</Label>
              <DatePicker value={form.joiningDate} onChange={(d) => setForm({ ...form, joiningDate: d })} />
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => setForm({ ...form, bloodGroup: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Salary</Label>
              <Input type="number" min="0" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. 25000" />
            </div>
            <div className="space-y-2">
              <Label>Salary Type</Label>
              <Select value={form.salaryType} onValueChange={(v) => setForm({ ...form, salaryType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="PER_VISIT">Per Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStaffDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveStaff} disabled={saving}>{saving ? "Saving..." : editingStaff ? "Update" : "Add Staff"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ RESET PASSWORD DIALOG ═══ */}
      <Dialog open={!!showResetPassword} onOpenChange={() => setShowResetPassword(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassword(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={saving || newPassword.length < 6}>{saving ? "Resetting..." : "Reset Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ ADD ROLE DIALOG ═══ */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {!editingRole && (
              <div className="space-y-2">
                <Label>Role Name *</Label>
                <Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value.toUpperCase().replace(/\s+/g, "_") })} placeholder="e.g. LAB_TECHNICIAN" />
                <p className="text-xs text-muted-foreground">Uppercase, no spaces. This is the internal identifier.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input value={roleForm.displayName} onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })} placeholder="e.g. Lab Technician" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Brief description of this role" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={saving}>{saving ? "Saving..." : editingRole ? "Update" : "Create Role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ STAFF DETAIL DIALOG ═══ */}
      <Dialog open={!!showStaffDetail} onOpenChange={() => setShowStaffDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Staff Details</DialogTitle></DialogHeader>
          {showStaffDetail && (
            <div className="space-y-5 py-2">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-white text-lg font-bold shadow-sm" style={{ backgroundColor: getRoleColor(showStaffDetail.role) }}>
                  {showStaffDetail.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold">{showStaffDetail.fullName}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold" style={{ backgroundColor: getRoleColor(showStaffDetail.role) + "14", color: getRoleColor(showStaffDetail.role) }}>
                      {showStaffDetail.role}
                    </span>
                    <Badge variant={showStaffDetail.isActive ? "success" : "destructive"} className="text-[0.65rem]">{showStaffDetail.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm rounded-xl border bg-muted/30 p-4">
                <DetailItem label="Email" value={showStaffDetail.email} />
                <DetailItem label="Phone" value={showStaffDetail.phone} />
                <DetailItem label="Employee ID" value={showStaffDetail.employeeId} />
                <DetailItem label="Department" value={showStaffDetail.department} />
                <DetailItem label="Designation" value={showStaffDetail.designation} />
                <DetailItem label="Qualifications" value={showStaffDetail.qualifications} />
                <DetailItem label="Blood Group" value={showStaffDetail.bloodGroup} />
                <DetailItem label="Emergency Contact" value={showStaffDetail.emergencyContact} />
                <DetailItem label="Salary" value={showStaffDetail.salary != null ? formatCurrency(showStaffDetail.salary) : null} />
                <DetailItem label="Salary Type" value={showStaffDetail.salaryType} />
                <DetailItem label="Date of Joining" value={showStaffDetail.joiningDate ? formatDate(new Date(showStaffDetail.joiningDate)) : null} />
                <DetailItem label="Last Login" value={showStaffDetail.lastLogin ? formatDate(new Date(showStaffDetail.lastLogin)) : "Never"} />
                {showStaffDetail.address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-[0.7rem] font-medium uppercase tracking-wider">Address</p>
                    <p className="mt-0.5">{showStaffDetail.address}</p>
                  </div>
                )}
              </div>

              {(() => {
                const role = roles.find((r) => r.name === showStaffDetail.role)
                if (!role) return null
                const perms: string[] = JSON.parse(role.permissions)
                const grouped: Record<string, string[]> = {}
                for (const p of perms) {
                  const mod = p.split(":")[0]
                  if (!grouped[mod]) grouped[mod] = []
                  grouped[mod].push(p.split(":")[1])
                }
                return (
                  <div>
                    <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider mb-2">Permissions · {perms.length} total</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(grouped).map(([mod, actions]) => {
                        const moduleColor = MODULE_COLORS[mod] || "#6b7280"
                        const moduleMeta = ALL_PERMISSIONS[mod as keyof typeof ALL_PERMISSIONS]
                        return (
                          <span key={mod} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.65rem] font-medium" style={{ backgroundColor: moduleColor + "10", color: moduleColor }}>
                            {moduleMeta?.label || mod} <span className="opacity-60">({actions.length})</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStaffDetail(null)}>Close</Button>
            <Button onClick={() => { if (showStaffDetail) { openEditStaff(showStaffDetail); setShowStaffDetail(null) } }}>Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Tabs>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-xs">
      <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color || "text-foreground"}`}>{value}</p>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground text-[0.7rem] font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 font-medium">{value || "—"}</p>
    </div>
  )
}
