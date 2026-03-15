"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DuesTab } from "./DuesTab"
import { FollowUpsTab } from "./FollowUpsTab"

export function DuesFollowupsPage() {
  const [tab, setTab] = useState<"dues" | "followups">("dues")

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "dues" | "followups")}>
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">
            Dues & Follow-Ups
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Track payments & schedule reminders</p>
        </div>
        <TabsList className="bg-muted/50 border border-border/40">
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

      <TabsContent value="dues" className="mt-0">
        <DuesTab />
      </TabsContent>
      <TabsContent value="followups" className="mt-0">
        <FollowUpsTab />
      </TabsContent>
    </Tabs>
  )
}
