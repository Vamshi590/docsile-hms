import type { ComponentType } from "react";
import type { HospitalHeaderProps } from "../ReceiptHeader";

import DefaultHeader from "./DefaultHeader";
import SriHarshaEyeHospitalHeader from "./SriHarshaEyeHospital";

/**
 * Registry mapping hospital names to their custom header components.
 *
 * To add a new hospital header:
 *   1. Create a new file in src/components/receipts/headers/YourHospital.tsx
 *   2. Export default a component that accepts HospitalHeaderProps
 *   3. Import it here and add an entry to the map below
 *
 * The key should match the hospital's `name` field in the DB (case-insensitive).
 */
const headerRegistry: Record<string, ComponentType<HospitalHeaderProps>> = {
  "sri harsha eye hospital": SriHarshaEyeHospitalHeader,
};

/**
 * Looks up a custom header component for the given hospital name.
 * Returns DefaultHeader if no custom header is registered.
 */
export function getHeaderComponent(
  hospitalName: string
): ComponentType<HospitalHeaderProps> {
  const key = hospitalName.trim().toLowerCase();
  return headerRegistry[key] ?? DefaultHeader;
}

export { DefaultHeader };
