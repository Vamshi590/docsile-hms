"use client"

import { useState, useRef, useCallback } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DuesTab } from "./DuesTab"
import { FollowUpsTab } from "./FollowUpsTab"
import { AskSithaAI } from "../../doctor/components/AskSithaAI"
import { cn } from "@/lib/utils"

export function DuesFollowupsPage() {
  const [tab, setTab] = useState<"dues" | "followups">("dues")
  const [refreshing, setRefreshing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
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
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 backdrop-blur-md border-b border-border/60 px-4 py-3 md:px-6 md:py-4 -mx-3 md:-mx-4 lg:-mx-6 -mt-4 md:-mt-6 sticky top-0 z-20">
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
        <div className="flex justify-center">
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
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={() => setChatOpen(o => !o)}
            title={chatOpen ? "Hide Sitha" : "Ask Sitha AI"}
            className={cn(
              "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
              chatOpen
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {chatOpen ? "Hide Sitha" : "Ask Sitha"}
          </button>
        </div>
      </div>

      <div className={cn(chatOpen && "flex gap-4 items-start")}>
      <div className={cn(chatOpen && "flex-1 min-w-0")}>
        <TabsContent value="dues" className="mt-0">
          <DuesTab refreshRef={duesRefreshRef} />
        </TabsContent>
        <TabsContent value="followups" className="mt-0">
          <FollowUpsTab refreshRef={followUpsRefreshRef} />
        </TabsContent>
      </div>
      {chatOpen && (
        <div className="w-80 shrink-0 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5 mt-5">
          <AskSithaAI patientId={null} module="duesFollowups" />
        </div>
      )}
      </div>
    </Tabs>
  )
}
