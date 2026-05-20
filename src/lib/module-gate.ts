// Maps URL path prefixes to module codes. If a path doesn't appear here, it's
// "always on" (dashboard, staff, settings, etc.).
export const ROUTE_MODULES: Record<string, string> = {
  "/patients": "patients",
  "/doctor": "doctor",
  "/workup": "workup",
  "/pharmacy": "pharmacy",
  "/optical": "optical",
  "/labs": "labs",
  "/inpatients": "inpatients",
  "/insurance": "insurance",
  "/expenses": "expenses",
  "/license-tracker": "license-tracker",
  "/call-logs": "call-logs",
  "/analytics": "analytics",
  "/reports": "reports",
};

/**
 * If the path falls under a gated module, returns the module code.
 * Returns null for always-on routes (dashboard, staff, settings, login, api, ...).
 */
export function routeModule(pathname: string): string | null {
  for (const prefix of Object.keys(ROUTE_MODULES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return ROUTE_MODULES[prefix];
    }
  }
  return null;
}

export function isModuleEnabled(
  pathname: string,
  enabledModules: string[],
): boolean {
  const module = routeModule(pathname);
  if (module === null) return true; // always-on
  return enabledModules.includes(module);
}
