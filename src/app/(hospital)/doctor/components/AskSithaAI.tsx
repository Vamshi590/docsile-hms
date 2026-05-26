"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { askSithaAI } from "../ai-actions"
import { MarkdownText } from "@/lib/ai/markdown"

// Module-keyed starter prompts. Each module has two lists:
//   - withPatient: prompts shown when a patient is locked in. Click sends.
//   - noPatient:   prompts shown in generic mode. Click FILLS the input so
//                  the user can type the patient UID before sending.
export type SithaModule =
  | "default"
  | "doctor"
  | "patients"
  | "inpatients"
  | "labs"
  | "workup"
  | "duesFollowups"
  | "analytics"

// A chip can be a plain string (label = prompt) or an object with a short
// display label and a more detailed prompt text sent to the AI.
type Chip = string | { label: string; prompt: string }
type ModulePrompts = { withPatient: Chip[]; noPatient?: Chip[] }

const SUGGESTED_PROMPTS: Record<SithaModule, ModulePrompts> = {
  default: {
    withPatient: [
      "Summarise this patient",
      "Outstanding dues?",
      "Last visit summary",
      "Recent medications",
      "Refraction trend",
      "Next follow-up",
    ],
  },
  doctor: {
    withPatient: [
      "Summarise this patient",
      "Last visit summary",
      "Recent medications",
      "Active diagnosis",
      "Investigations done",
      "Next follow-up",
    ],
    noPatient: [
      "Summarise patient ",
      "Last visit for patient ",
      "Active medications of patient ",
      "Investigations done for patient ",
    ],
  },
  patients: {
    withPatient: [
      "Outstanding dues?",
      "Lifetime spend so far",
      "Visit frequency",
      "Pending follow-ups",
      "Recent services",
      "Insurance status",
    ],
    noPatient: [
      "Dues for patient ",
      "Lifetime spend for patient ",
      "Visit history of patient ",
      "Insurance status of patient ",
    ],
  },
  inpatients: {
    withPatient: [
      "IPD admission summary",
      "Operation details",
      "Outstanding IPD balance",
      "Insurance claim status",
      "Days admitted",
      "Discharge readiness",
    ],
    noPatient: [
      "IPD admission summary for patient ",
      "Operation details of patient ",
      "Outstanding IPD balance for patient ",
      "Insurance claim status of patient ",
    ],
  },
  labs: {
    withPatient: [
      "Lab tests history",
      "Pending lab dues",
      "Latest investigations",
      "Tests this month",
    ],
    noPatient: [
      "Lab tests history of patient ",
      "Pending lab dues for patient ",
      "Latest investigations for patient ",
    ],
  },
  workup: {
    withPatient: [
      "Refraction trend",
      "Latest AR reading",
      "Sight type history",
      "Glasses prescribed before?",
      "Past clinical findings",
    ],
    noPatient: [
      "Refraction trend of patient ",
      "Latest AR reading for patient ",
      "Glasses prescribed before to patient ",
    ],
  },
  duesFollowups: {
    withPatient: [
      "Total outstanding dues",
      "Why is the balance still pending?",
      "Last payment received",
      "Payment mode breakdown",
      "Next follow-up date",
      "Has this patient missed any follow-up?",
      "Recommend a payment plan",
    ],
    noPatient: [
      "Outstanding dues for patient ",
      "Why is there a balance for patient ",
      "Last payment by patient ",
      "Next follow-up date for patient ",
      "Did patient ___ miss any follow-up?",
      "Pending balance breakdown for patient ",
      "Days overdue on follow-up for patient ",
    ],
  },
  analytics: {
    withPatient: [
      {
        label: "📊 Full financial health report",
        prompt:
          "Generate a comprehensive financial health report for this month. Structure your response with these sections:\n\n" +
          "## 1. Revenue & Collections Overview\n" +
          "Total billed, collected, collection rate %, net cash flow (surplus/deficit). Revenue breakdown by category (Consultations / Labs / Pharmacy / Optical / IPD) with ₹ amounts and % share of total.\n\n" +
          "## 2. Outstanding Dues Analysis\n" +
          "Dues by module (OPD, IPD, Lab, Optical, Pharmacy), grand total, and which module has the highest risk.\n\n" +
          "## 3. Expense Health\n" +
          "Total expenses, top expense categories, expense-to-revenue ratio, and whether expenses are in a healthy range.\n\n" +
          "## 4. Performance Highlights\n" +
          "Top earning doctor, top service by revenue, best and weakest revenue category.\n\n" +
          "## 5. Financial Health Score & Improvement Plan\n" +
          "Give an honest assessment of the hospital's financial health (Good / Needs Attention / Critical) with 4–6 specific, actionable improvement suggestions tied directly to the numbers you see — e.g. if collection rate is low, say exactly what it is and how to fix it; if one category has high dues, call it out.",
      },
      "How can we improve revenue?",
      "Which service earns the most?",
      "Top performing doctor",
      "Where are we losing money?",
      "Pending dues breakdown",
      "Payment mode breakdown",
      "How is our collection rate?",
      "Revenue vs expenses this month",
      "Patient volume trend this week",
    ],
    noPatient: [
      {
        label: "📊 Full financial health report",
        prompt:
          "Generate a comprehensive financial health report for this month. Structure your response with these sections:\n\n" +
          "## 1. Revenue & Collections Overview\n" +
          "Total billed, collected, collection rate %, net cash flow (surplus/deficit). Revenue breakdown by category (Consultations / Labs / Pharmacy / Optical / IPD) with ₹ amounts and % share of total.\n\n" +
          "## 2. Outstanding Dues Analysis\n" +
          "Dues by module (OPD, IPD, Lab, Optical, Pharmacy), grand total, and which module has the highest risk.\n\n" +
          "## 3. Expense Health\n" +
          "Total expenses, top expense categories, expense-to-revenue ratio, and whether expenses are in a healthy range.\n\n" +
          "## 4. Performance Highlights\n" +
          "Top earning doctor, top service by revenue, best and weakest revenue category.\n\n" +
          "## 5. Financial Health Score & Improvement Plan\n" +
          "Give an honest assessment of the hospital's financial health (Good / Needs Attention / Critical) with 4–6 specific, actionable improvement suggestions tied directly to the numbers you see — e.g. if collection rate is low, say exactly what it is and how to fix it; if one category has high dues, call it out.",
      },
      "How can we improve revenue?",
      "Which service earns the most?",
      "Top performing doctor",
      "Where are we losing money?",
      "Pending dues breakdown",
      "Payment mode breakdown",
      "How is our collection rate?",
      "Revenue vs expenses this month",
      "Patient volume trend this week",
    ],
  },
}

type ChatMessage = {
  role: "user" | "assistant"
  text: string
}

interface Props {
  /** When null, the panel renders an empty-state asking the user to pick a patient. */
  patientId: string | null
  /** When true, omits the outer card chrome + header so a Sheet/Dialog can supply them. */
  embedded?: boolean
  /** Tailors the suggestion chips shown on first open. */
  module?: SithaModule
}

function chipLabel(c: Chip): string { return typeof c === "string" ? c : c.label }
function chipPrompt(c: Chip): string { return typeof c === "string" ? c : c.prompt }

export function AskSithaAI({ patientId, embedded = false, module = "default" }: Props) {
  const moduleConfig = SUGGESTED_PROMPTS[module] ?? SUGGESTED_PROMPTS.default
  const activePrompts: Chip[] = patientId
    ? moduleConfig.withPatient
    : (moduleConfig.noPatient ?? [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset chat when patient changes — chats are session-only and patient-scoped.
  useEffect(() => {
    setMessages([])
    setInput("")
  }, [patientId])

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending])

  async function handleSend(override?: string) {
    const question = (override ?? input).trim()
    if (!question || sending) return

    const next: ChatMessage = { role: "user", text: question }
    setMessages(prev => [...prev, next])
    setInput("")
    setSending(true)

    // Map UI history -> Gemini-shaped history (excluding the just-added user
    // message; the server prepends it).
    const history = messages.map(m => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      text: m.text,
    }))

    try {
      const result = await askSithaAI({ patientId, question, history, module })
      if (result.ok) {
        setMessages(prev => [...prev, { role: "assistant", text: result.answer }])
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: `⚠ ${result.error}` }])
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "⚠ Something went wrong." }])
    } finally {
      setSending(false)
      // Refocus the textarea so the doctor can keep typing.
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const noPatient = !patientId

  return (
    <div className={cn(
      "flex flex-col",
      !embedded && "rounded-2xl border border-border bg-white overflow-hidden"
    )}>
      {/* Header — hidden in embedded mode (the host modal provides its own title) */}
      {!embedded && (
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Ask Sitha AI</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            AI-assisted suggestions — verify before acting.
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn(
          "px-4 py-3 space-y-3 overflow-y-auto",
          embedded ? "flex-1 min-h-0" : "max-h-[360px]"
        )}
      >
        {messages.length === 0 && !sending && (
          <div className="py-1">
            {noPatient && module !== "analytics" ? (
              <>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-sm font-medium text-foreground">Ask about any patient</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2.5">
                  Include the patient&apos;s UID (e.g. <span className="font-mono">0005</span>) or
                  10-digit phone in your question.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">
                {module === "analytics"
                  ? "Ask about hospital metrics, trends, and performance:"
                  : "Ask anything about this patient — try one of these:"}
              </p>
            )}
            {activePrompts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activePrompts.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const prompt = chipPrompt(chip)
                      if (noPatient && module !== "analytics") {
                        // Fill the input so the user can append the UID/phone
                        // before sending. Focus the textarea + place caret at end.
                        setInput(prompt)
                        requestAnimationFrame(() => {
                          const t = textareaRef.current
                          if (!t) return
                          t.focus()
                          const len = t.value.length
                          t.setSelectionRange(len, len)
                        })
                      } else {
                        handleSend(prompt)
                      }
                    }}
                    className="inline-flex items-center h-7 px-2.5 rounded-full bg-primary/5 border border-primary/15 text-[11.5px] font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    {chipLabel(chip)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-xl px-3 py-2 text-[12.5px] break-words",
                m.role === "user"
                  ? "bg-primary text-primary-foreground leading-relaxed whitespace-pre-wrap"
                  : "bg-muted/70 text-foreground border border-border/40"
              )}
            >
              {m.role === "user" ? m.text : <MarkdownText text={m.text} />}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted/70 border border-border/40 rounded-xl px-3 py-2 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noPatient ? "e.g. 'dues for patient 0005' or 'visits for 9876543210'" : "Ask Sitha…"}
            rows={2}
            disabled={sending}
            maxLength={4000}
            className={cn(
              "flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-[12.5px]",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
              "disabled:opacity-60"
            )}
          />
          <Button
            type="button"
            size="icon-sm"
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="h-9 w-9 shrink-0"
            title="Send (Enter)"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
