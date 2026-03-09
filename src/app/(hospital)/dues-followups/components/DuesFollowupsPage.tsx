"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DuesTab } from "./DuesTab"
import { FollowUpsTab } from "./FollowUpsTab"

export function DuesFollowupsPage({ hospitalName }: { hospitalName: string }) {
  const [tab, setTab] = useState<"dues" | "followups">("dues")

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "dues" | "followups")}>
      {/* Page Header */}
      <div className="bg-white border-b border-border px-6 py-4 -mx-6 -mt-6 mb-0 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.2rem] font-semibold text-foreground tracking-tight leading-none">
              Dues & Follow-Ups
            </h1>
            <p className="text-xs text-muted-foreground mt-1">{hospitalName}</p>
          </div>
          <TabsList>
            <TabsTrigger
              value="dues"
              className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Dues
            </TabsTrigger>
            <TabsTrigger
              value="followups"
              className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Follow-Ups
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="dues" className="mt-0">
        <DuesTab />
      </TabsContent>
      <TabsContent value="followups" className="mt-0">
        <FollowUpsTab />
      </TabsContent>
    </Tabs>
  )
}
