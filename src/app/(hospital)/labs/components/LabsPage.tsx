"use client"

import { useState, useCallback } from "react"
import { Sparkles } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader, StatBadge } from "@/components/layout/header"
import { AskSithaAI } from "../../doctor/components/AskSithaAI"
import { LabConfigTab } from "./LabConfigTab"
import { LabBillingTab } from "./LabBillingTab"
import { getLabs } from "../actions"
import { cn } from "@/lib/utils"

const TAB_CLASS =
  "rounded-none px-3 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"

export type LabWithCount = {
  id: string
  name: string
  description: string | null
  location: string | null
  printHeaderKey: string | null
  isActive: boolean
  sortOrder: number
  _count: { investigations: number }
}

export default function LabsPage({ initialLabs }: { initialLabs: LabWithCount[] }) {
  const [labs, setLabs] = useState<LabWithCount[]>(initialLabs)
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

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
      </PageHeader>

      <div className={cn(chatOpen && "flex gap-4 items-start")}>
      <div className={cn(chatOpen && "flex-1 min-w-0")}>
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
      {chatOpen && (
        <div className="w-80 shrink-0 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-0.5 mt-5">
          <AskSithaAI patientId={null} module="labs" />
        </div>
      )}
      </div>
    </div>
  )
}
