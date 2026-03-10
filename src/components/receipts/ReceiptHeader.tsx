"use client"

import { getHeaderComponent } from "./headers/registry"

export type HospitalInfo = {
  name: string
  displayName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  registrationNo?: string | null
  logoUrl?: string | null
}

export interface HospitalHeaderProps {
  hospital: HospitalInfo
}

/**
 * Dispatches to a hospital-specific header component if one is registered,
 * otherwise falls back to the DefaultHeader.
 *
 * To add a custom header for a new hospital:
 *   1. Create a file in src/components/receipts/headers/YourHospital.tsx
 *   2. Register it in src/components/receipts/headers/registry.ts
 */
export function ReceiptHeader({ hospital }: HospitalHeaderProps) {
  const HeaderComponent = getHeaderComponent(hospital.name)
  return <HeaderComponent hospital={hospital} />
}
