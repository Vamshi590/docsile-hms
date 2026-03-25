"use client"

import { useState, useRef, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DuesTab } from "./DuesTab"
import { FollowUpsTab } from "./FollowUpsTab"

export function DuesFollowupsPage() {
  const [tab, setTab] = useState<"dues" | "followups">("dues")
  const [refreshing, setRefreshing] = useState(false)
  const duesRefreshRef = useRef<(() => void) | null>(null)
  const followUpsRefreshRef = useRef<(() => void) | null>(null)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      if (tab === "dues" && duesRefreshRef.current) {
        await duesRefreshRef.current()
      } else if (tab === "followups" && followUpsRefreshRef.current) {
        await followUpsRefreshRef.current()
      }
    } finally {
      setRefreshing(false)
    }
  }, [tab])

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "dues" | "followups")}>
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md border-b border-border/60 px-6 py-4 -mx-6 -mt-6 sticky top-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">
              Dues & Follow-Ups
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-none">Track payments & schedule reminders</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
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
        <DuesTab refreshRef={duesRefreshRef} />
      </TabsContent>
      <TabsContent value="followups" className="mt-0">
        <FollowUpsTab refreshRef={followUpsRefreshRef} />
      </TabsContent>
    </Tabs>
  )
}
