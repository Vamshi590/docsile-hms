// src/lib/social/templates/shared/tokens.ts
export type Palette = {
  primary: string
  light: string
  dark: string
  gradientFrom: string
  gradientTo: string
}

export const DEPARTMENT_PALETTES: Record<string, Palette> = {
  Dental:     { primary: "#1D4ED8", light: "#DBEAFE", dark: "#1E3A8A", gradientFrom: "#1E40AF", gradientTo: "#3B82F6" },
  Eye:        { primary: "#0891B2", light: "#CFFAFE", dark: "#0C4A6E", gradientFrom: "#164E63", gradientTo: "#0EA5E9" },
  Skin:       { primary: "#B45309", light: "#FDE68A", dark: "#78350F", gradientFrom: "#92400E", gradientTo: "#F59E0B" },
  Orthopedic: { primary: "#1E40AF", light: "#BFDBFE", dark: "#1E3A5F", gradientFrom: "#172554", gradientTo: "#2563EB" },
  Pediatric:  { primary: "#7C3AED", light: "#EDE9FE", dark: "#3B0764", gradientFrom: "#4C1D95", gradientTo: "#8B5CF6" },
  General:    { primary: "#059669", light: "#D1FAE5", dark: "#022C22", gradientFrom: "#064E3B", gradientTo: "#10B981" },
}

export const DEFAULT_PALETTE: Palette = {
  primary: "#4338CA", light: "#E0E7FF", dark: "#312E81",
  gradientFrom: "#3730A3", gradientTo: "#6366F1",
}

export function paletteFor(department: string | null | undefined): Palette {
  if (!department) return DEFAULT_PALETTE
  return DEPARTMENT_PALETTES[department] ?? DEFAULT_PALETTE
}

export const LABELS: Record<string, string> = {
  educational: "Did You Know?",
  promo: "Special Offer",
  doctor: "Meet Our Doctor",
  trust: "Our Promise",
  engagement: "Quick Poll",
}
