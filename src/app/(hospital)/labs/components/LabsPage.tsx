"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/header"
import { LabConfigTab } from "./LabConfigTab"
import { LabBillingTab } from "./LabBillingTab"
import { getLabs } from "../actions"

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"

export default function LabsPage({ hospitalName }: { hospitalName: string }) {
  const [labCount, setLabCount] = useState(0)

  const refreshCount = useCallback(async () => {
    const labs = await getLabs()
    setLabCount(labs.filter((l) => l.isActive).length)
  }, [])

  useEffect(() => { refreshCount() }, [refreshCount])

  return (
    <div className="space-y-0">
      <PageHeader title="Labs" description={hospitalName}>
        <Badge variant="info" className="px-3 py-1.5 gap-1.5 text-sm">
          <span className="font-bold">{labCount}</span>
          <span className="font-normal">Labs</span>
        </Badge>
      </PageHeader>

      <Tabs defaultValue="billing" className="w-full">
        <div className="bg-card border-b border-border px-6 -mx-6 sticky top-18 z-10">
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
          <LabBillingTab />
        </TabsContent>
        <TabsContent value="config" className="mt-0 pt-5 space-y-5">
          <LabConfigTab onLabsChanged={refreshCount} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
