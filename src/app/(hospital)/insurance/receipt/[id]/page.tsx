import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ReceiptRenderer from "./ReceiptRenderer"
import type { PackageInclusion } from "@/lib/types"

export default async function InsuranceReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { id } = await params
  const { type = "final" } = await searchParams

  const supabase = await createClient()
  const { data: claim, error } = await supabase
    .from("InsuranceClaim")
    .select("*")
    .eq("id", id)
    .single()
  if (error || !claim) notFound()

  const doctors: string[] = (() => {
    try { return JSON.parse(claim.doctorNames) } catch { return [] }
  })()

  const packageInclusions: PackageInclusion[] = (() => {
    try { return JSON.parse(claim.packageInclusions ?? "[]") } catch { return [] }
  })()

  // Build billing items from package inclusions
  const billingItems = packageInclusions.flatMap((item) => {
    const items = [{ particulars: item.name, amount: item.amount }]
    if (item.subItems) {
      item.subItems.forEach((sub) => {
        items.push({ particulars: `  - ${sub.itemName} x${sub.quantity}`, amount: sub.amount })
      })
    }
    return items
  })

  const receiptData = {
    type,
    claim: {
      ...claim,
      admissionDate: claim.admissionDate ?? "",
      dischargeDate: claim.dischargeDate ?? "",
      createdAt: claim.createdAt,
    },
    doctors,
    billingItems,
  }

  return <ReceiptRenderer data={receiptData} />
}
