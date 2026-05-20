"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader, StatBadge } from "@/components/layout/header"
import { LabConfigTab } from "./LabConfigTab"
import { LabBillingTab } from "./LabBillingTab"
import { getLabs } from "../actions"

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"

export type LabWithCount = {
  id: string
  name: string
  description: string | null
  location: string | null
  isActive: boolean
  sortOrder: number
  _count: { investigations: number }
}

export default function LabsPage({ initialLabs }: { initialLabs: LabWithCount[] }) {
  const [labs, setLabs] = useState<LabWithCount[]>(initialLabs)
  const [loading, setLoading] = useState(false)

  const refreshLabs = useCallback(async () => {
    setLoading(true)
    const data = await getLabs()
    setLabs(data as LabWithCount[])
    setLoading(false)
  }, [])

  const activeCount = labs.filter((l) => l.isActive).length

  return (
    <div className="space-y-0">
      <PageHeader title="Labs" description="Billing, history & configuration" onRefresh={refreshLabs}>
        <StatBadge value={activeCount} label="Active Labs" variant="info" />
      </PageHeader>

      <Tabs defaultValue="billing" className="w-full">
        <div className="bg-white/60 backdrop-blur-sm border-b border-border/40 px-6 -mx-6 sticky top-16 z-10">
          <TabsList className="bg-transparent h-auto p-0 rounded-none gap-1 -mb-px">
            <TabsTrigger value="billing" className={TAB_CLASS}>
              Lab Billing & History
            </TabsTrigger>
            <TabsTrigger value="config" className={TAB_CLASS}>
              Lab Configuration
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="billing" className="mt-0 pt-5 space-y-5">
          <LabBillingTab labs={labs} />
        </TabsContent>
        <TabsContent value="config" className="mt-0 pt-5 space-y-5">
          <LabConfigTab initialLabs={labs} loading={loading} onLabsChanged={refreshLabs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
