// src/lib/default-print.ts

export type DefaultPrintItemType = "cash" | "prescription" | "readings" | "report"
export type ReadingsSubMode = "readings" | "clinical" | "both"

export type DefaultPrintItem =
  | { type: "cash" }
  | { type: "prescription" }
  | { type: "readings"; subMode: ReadingsSubMode }
  | { type: "report" }

export type DefaultPrintConfig = {
  items: DefaultPrintItem[]
}

export const EMPTY_DEFAULT_PRINT_CONFIG: DefaultPrintConfig = { items: [] }

export const DEFAULT_PRINT_LABELS: Record<DefaultPrintItemType, string> = {
  cash: "Cash Receipt",
  prescription: "Prescription",
  readings: "Readings & Findings",
  report: "Full Report",
}

export const READINGS_SUBMODE_LABELS: Record<ReadingsSubMode, string> = {
  readings: "Readings only",
  clinical: "Clinical Findings only",
  both: "Both",
}

const VALID_TYPES: DefaultPrintItemType[] = ["cash", "prescription", "readings", "report"]
const VALID_SUBMODES: ReadingsSubMode[] = ["readings", "clinical", "both"]

/**
 * Parse the raw `settings` JSON string from HospitalProfile and extract the
 * defaultPrint config. Returns the empty config on any parse error or missing key.
 * Unknown item types are silently dropped (forward-compatibility).
 */
export function parseDefaultPrintConfig(settingsRaw: string | null | undefined): DefaultPrintConfig {
  if (!settingsRaw) return EMPTY_DEFAULT_PRINT_CONFIG
  try {
    const parsed = JSON.parse(settingsRaw) as { defaultPrint?: unknown }
    const dp = parsed?.defaultPrint
    if (!dp || typeof dp !== "object" || !Array.isArray((dp as { items?: unknown }).items)) {
      return EMPTY_DEFAULT_PRINT_CONFIG
    }
    const rawItems = (dp as { items: unknown[] }).items
    const seen = new Set<string>()
    const items: DefaultPrintItem[] = []
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") continue
      const t = (raw as { type?: unknown }).type
      if (typeof t !== "string" || !VALID_TYPES.includes(t as DefaultPrintItemType)) continue
      if (seen.has(t)) continue
      if (t === "readings") {
        const sm = (raw as { subMode?: unknown }).subMode
        if (typeof sm !== "string" || !VALID_SUBMODES.includes(sm as ReadingsSubMode)) continue
        items.push({ type: "readings", subMode: sm as ReadingsSubMode })
      } else {
        items.push({ type: t as Exclude<DefaultPrintItemType, "readings"> })
      }
      seen.add(t)
    }
    return { items }
  } catch {
    return EMPTY_DEFAULT_PRINT_CONFIG
  }
}

/**
 * Validate a config that came from the client. Throws a descriptive Error if invalid.
 * Returns the normalized config.
 */
export function validateDefaultPrintConfig(input: unknown): DefaultPrintConfig {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid config: expected an object")
  }
  const items = (input as { items?: unknown }).items
  if (!Array.isArray(items)) {
    throw new Error("Invalid config: items must be an array")
  }
  const seen = new Set<string>()
  const out: DefaultPrintItem[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid item: expected an object")
    }
    const t = (raw as { type?: unknown }).type
    if (typeof t !== "string" || !VALID_TYPES.includes(t as DefaultPrintItemType)) {
      throw new Error(`Invalid item type: ${String(t)}`)
    }
    if (seen.has(t)) {
      throw new Error(`Duplicate item type: ${t}`)
    }
    if (t === "readings") {
      const sm = (raw as { subMode?: unknown }).subMode
      if (typeof sm !== "string" || !VALID_SUBMODES.includes(sm as ReadingsSubMode)) {
        throw new Error("Readings & Findings requires a subMode (readings, clinical, or both)")
      }
      out.push({ type: "readings", subMode: sm as ReadingsSubMode })
    } else {
      out.push({ type: t as Exclude<DefaultPrintItemType, "readings"> })
    }
    seen.add(t)
  }
  return { items: out }
}

/**
 * Merge a defaultPrint config into the existing settings JSON string.
 * Preserves other top-level keys.
 */
export function mergeDefaultPrintIntoSettings(
  settingsRaw: string | null | undefined,
  config: DefaultPrintConfig,
): string {
  let base: Record<string, unknown> = {}
  if (settingsRaw) {
    try {
      const parsed = JSON.parse(settingsRaw)
      if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>
    } catch {
      // ignore — start fresh
    }
  }
  base.defaultPrint = config
  return JSON.stringify(base)
}
