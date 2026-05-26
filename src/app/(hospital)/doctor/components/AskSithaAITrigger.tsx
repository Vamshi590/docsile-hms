"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { AskSithaAI } from "./AskSithaAI"

interface Props {
  /** Patient currently in context (or null when on a list view). */
  patientId: string | null
  className?: string
}

/**
 * Sub-header button that opens a slide-out chat with Sitha. Works from list
 * views (shows an "open a patient first" empty state) and from any context
 * where a patient is selected.
 */
export function AskSithaAITrigger({ patientId, className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-sm font-medium text-primary " +
          (className ?? "")
        }
        title="Ask Sitha AI"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Ask Sitha
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border space-y-1">
            <SheetTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Ask Sitha AI
            </SheetTitle>
            <SheetDescription className="text-[11px]">
              AI-assisted suggestions — verify before acting.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <AskSithaAI patientId={patientId} embedded />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
