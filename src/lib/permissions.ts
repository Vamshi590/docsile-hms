// ─── Centralized Permission Definitions for Docsile HMS ─────────────────────

export type Permission = string // format: "module:action"

// All available permissions grouped by module
export const ALL_PERMISSIONS = {
  dashboard: {
    label: "Dashboard",
    permissions: [
      { key: "dashboard:view", label: "View Dashboard" },
    ],
  },
  patients: {
    label: "Patients",
    permissions: [
      { key: "patients:view", label: "View Patients" },
      { key: "patients:create", label: "Register Patients" },
      { key: "patients:edit", label: "Edit Patients" },
      { key: "patients:delete", label: "Delete Patients" },
    ],
  },
  workup: {
    label: "Workup",
    permissions: [
      { key: "workup:view", label: "View Workup" },
      { key: "workup:create", label: "Create Workup" },
      { key: "workup:edit", label: "Edit Workup" },
    ],
  },
  doctor: {
    label: "Doctor",
    permissions: [
      { key: "doctor:view", label: "View Doctor Queue" },
      { key: "doctor:consult", label: "Consult & Prescribe" },
    ],
  },
  labs: {
    label: "Labs",
    permissions: [
      { key: "labs:view", label: "View Labs" },
      { key: "labs:create", label: "Create Lab Bills" },
      { key: "labs:edit", label: "Edit Labs" },
      { key: "labs:config", label: "Configure Labs" },
    ],
  },
  pharmacy: {
    label: "Pharmacy",
    permissions: [
      { key: "pharmacy:view", label: "View Pharmacy" },
      { key: "pharmacy:create", label: "Create Bills" },
      { key: "pharmacy:edit", label: "Edit Inventory" },
      { key: "pharmacy:manage_stock", label: "Manage Stock" },
      { key: "pharmacy:purchase_orders", label: "Purchase Orders" },
    ],
  },
  optical: {
    label: "Optical",
    permissions: [
      { key: "optical:view", label: "View Optical" },
      { key: "optical:create", label: "Create Bills" },
      { key: "optical:edit", label: "Edit Products" },
      { key: "optical:manage_stock", label: "Manage Stock" },
    ],
  },
  inpatients: {
    label: "In-Patients",
    permissions: [
      { key: "inpatients:view", label: "View In-Patients" },
      { key: "inpatients:create", label: "Admit Patients" },
      { key: "inpatients:edit", label: "Edit In-Patients" },
      { key: "inpatients:discharge", label: "Discharge Patients" },
      { key: "inpatients:delete", label: "Delete In-Patients" },
    ],
  },
  insurance: {
    label: "Insurance",
    permissions: [
      { key: "insurance:view", label: "View Insurance Claims" },
      { key: "insurance:create", label: "Create Claims" },
      { key: "insurance:edit", label: "Edit Claims" },
    ],
  },
  dues: {
    label: "Dues & Follow-Ups",
    permissions: [
      { key: "dues:view", label: "View Dues & Follow-Ups" },
      { key: "dues:edit", label: "Manage Dues" },
    ],
  },
  expenses: {
    label: "Expenses",
    permissions: [
      { key: "expenses:view", label: "View Expenses" },
      { key: "expenses:create", label: "Create Expenses" },
      { key: "expenses:edit", label: "Edit Expenses" },
      { key: "expenses:delete", label: "Delete Expenses" },
    ],
  },
  reports: {
    label: "Reports",
    permissions: [
      { key: "reports:view", label: "View Reports" },
    ],
  },
  licenses: {
    label: "Licenses",
    permissions: [
      { key: "licenses:view", label: "View Licenses" },
      { key: "licenses:create", label: "Create Licenses" },
      { key: "licenses:edit", label: "Edit Licenses" },
      { key: "licenses:delete", label: "Delete Licenses" },
    ],
  },
  settings: {
    label: "Configurations",
    permissions: [
      { key: "settings:view", label: "View Settings" },
      { key: "settings:edit", label: "Edit Settings" },
    ],
  },
  staff: {
    label: "Staff Management",
    permissions: [
      { key: "staff:view", label: "View Staff" },
      { key: "staff:create", label: "Add Staff" },
      { key: "staff:edit", label: "Edit Staff" },
      { key: "staff:deactivate", label: "Deactivate Staff" },
      { key: "staff:manage_roles", label: "Manage Roles & Permissions" },
    ],
  },
  data: {
    label: "Data Export",
    permissions: [
      { key: "data:export", label: "Export Data" },
    ],
  },
} as const

// Flat list of all permission keys
export function getAllPermissionKeys(): string[] {
  const keys: string[] = []
  for (const group of Object.values(ALL_PERMISSIONS)) {
    for (const p of group.permissions) {
      keys.push(p.key)
    }
  }
  return keys
}

// Default permissions for system roles
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: getAllPermissionKeys(), // Admin gets everything
  DOCTOR: [
    "dashboard:view",
    "patients:view", "patients:edit",
    "workup:view",
    "doctor:view", "doctor:consult",
    "labs:view",
    "pharmacy:view",
    "inpatients:view", "inpatients:edit",
    "insurance:view",
    "dues:view",
    "reports:view",
  ],
  RECEPTIONIST: [
    "dashboard:view",
    "patients:view", "patients:create", "patients:edit",
    "workup:view", "workup:create",
    "doctor:view",
    "labs:view", "labs:create",
    "pharmacy:view", "pharmacy:create",
    "optical:view", "optical:create",
    "inpatients:view", "inpatients:create",
    "insurance:view", "insurance:create",
    "dues:view", "dues:edit",
    "expenses:view", "expenses:create",
  ],
  OPTOMETRIST: [
    "dashboard:view",
    "patients:view",
    "workup:view", "workup:create", "workup:edit",
    "doctor:view",
    "optical:view", "optical:create", "optical:edit",
  ],
  NURSE: [
    "dashboard:view",
    "patients:view", "patients:edit",
    "workup:view", "workup:create",
    "doctor:view",
    "inpatients:view", "inpatients:edit",
    "dues:view",
  ],
}

// Check if a permission list includes a specific permission
export function hasPermission(userPermissions: string[], permission: string): boolean {
  return userPermissions.includes(permission)
}

// Check if a permission list includes any of the given permissions
export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  return permissions.some((p) => userPermissions.includes(p))
}

// Module to sidebar route mapping (for filtering sidebar based on permissions)
export const MODULE_ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  patients: "/patients",
  workup: "/workup",
  doctor: "/doctor",
  labs: "/labs",
  pharmacy: "/pharmacy",
  optical: "/optical",
  inpatients: "/inpatients",
  insurance: "/insurance",
  dues: "/dues-followups",
  expenses: "/expenses",
  reports: "/reports",
  licenses: "/license-tracker",
  data: "/data",
  settings: "/settings",
  staff: "/staff",
}
