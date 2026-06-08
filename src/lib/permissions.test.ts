import { describe, it, expect } from "vitest"
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, MODULE_ROUTE_MAP, getAllPermissionKeys } from "./permissions"

describe("social permissions", () => {
  it("registers all 7 social permission keys", () => {
    const keys = ALL_PERMISSIONS.social.permissions.map((p) => p.key)
    expect(keys).toEqual([
      "social:view", "social:generate", "social:edit",
      "social:publish", "social:delete", "social:connect", "social:config",
    ])
  })

  it("includes social route in MODULE_ROUTE_MAP", () => {
    expect(MODULE_ROUTE_MAP.social).toBe("/social")
  })

  it("ADMIN role auto-receives social:* permissions", () => {
    const adminPerms = DEFAULT_ROLE_PERMISSIONS.ADMIN
    expect(adminPerms).toContain("social:view")
    expect(adminPerms).toContain("social:publish")
  })

  it("DOCTOR/RECEPTIONIST/NURSE/OPTOMETRIST do NOT get social by default", () => {
    for (const role of ["DOCTOR", "RECEPTIONIST", "NURSE", "OPTOMETRIST"]) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role]
      expect(perms.some((p) => p.startsWith("social:"))).toBe(false)
    }
  })

  it("getAllPermissionKeys includes social keys", () => {
    expect(getAllPermissionKeys()).toContain("social:connect")
  })
})
