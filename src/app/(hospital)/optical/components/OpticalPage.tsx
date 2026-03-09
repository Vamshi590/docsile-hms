"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/header"
import { BillingTab } from "./BillingTab"
import { InventoryTab } from "./InventoryTab"
import { getStockSummary } from "../actions"

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"

export default function OpticalPage({ hospitalName }: { hospitalName: string }) {
  const [summary, setSummary] = useState({ totalItems: 0, lowStock: 0 })

  useEffect(() => {
    getStockSummary().then(setSummary)
  }, [])

  return (
    <div className="space-y-0">
      <PageHeader title="Optical" description={hospitalName}>
        <div className="flex items-center gap-2">
          {summary.lowStock > 0 && (
            <Badge variant="destructive" className="px-2.5 py-1 gap-1 text-xs">
              {summary.lowStock} Low Stock
            </Badge>
          )}
          <Badge variant="info" className="px-3 py-1.5 gap-1.5 text-sm">
            <span className="font-bold">{summary.totalItems}</span>
            <span className="font-normal">Items in Stock</span>
          </Badge>
        </div>
      </PageHeader>

      <Tabs defaultValue="billing" className="w-full">
        <div className="bg-card border-b border-border px-6 -mx-6 sticky top-18 z-10">
          <TabsList className="bg-transparent h-auto p-0 rounded-none gap-1 -mb-px">
            <TabsTrigger value="billing" className={TAB_CLASS}>
              Billing
            </TabsTrigger>
            <TabsTrigger value="inventory" className={TAB_CLASS}>
              Inventory
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="billing" className="mt-0 pt-5 space-y-5">
          <BillingTab />
        </TabsContent>
        <TabsContent value="inventory" className="mt-0 pt-5 space-y-5">
          <InventoryTab onStockChanged={() => getStockSummary().then(setSummary)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
