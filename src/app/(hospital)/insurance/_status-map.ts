// Shared status-filter mapping for the Insurance module.
// Used by both the server page (page.tsx) to compute initial data and by the
// client InsurancePage to compute data on filter changes — keep them in sync.

export const INSURANCE_STATUS_FILTER_OPTIONS = [
  { label: "All Active", value: "" },
  { label: "Preauth Pending", value: "preauth" },
  { label: "Enhancement Pending", value: "enhancement" },
  { label: "Settlement Pending", value: "settlement" },
  { label: "Settled", value: "settled" },
  { label: "Closed", value: "closed" },
]

export const INSURANCE_STATUS_MAP: Record<string, string[]> = {
  "": [],
  preauth: ["PREAUTH_SUBMITTED", "PREAUTH_QUERY"],
  enhancement: ["ENHANCEMENT_CLAIMED", "ENHANCEMENT_QUERY"],
  settlement: ["FINAL_BILL_SUBMITTED"],
  settled: ["SETTLED", "PARTIALLY_SETTLED"],
  closed: ["CLOSED"],
}
