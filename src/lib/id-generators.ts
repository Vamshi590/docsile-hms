import { db } from "./db"

export async function getNextInsClaimNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INS-${year}`
  const last = await db.insuranceClaim.findFirst({
    where: { claimNumber: { startsWith: prefix } },
    orderBy: { claimNumber: "desc" },
    select: { claimNumber: true },
  })
  if (!last) return `${prefix}-0001`
  const num = parseInt(last.claimNumber.split("-").pop() ?? "0", 10)
  return `${prefix}-${String(num + 1).padStart(4, "0")}`
}
