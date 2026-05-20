"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { askSithaAI } from "../ai-actions"

type ChatMessage = {
  role: "user" | "assistant"
  text: string
}

interface Props {
  patientId: string
}

export function AskSithaAI({ patientId }: Props) {
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

  async function handleSend() {
    const question = input.trim()
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
      const result = await askSithaAI({ patientId, question, history })
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

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ask Sitha AI</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          AI-assisted suggestions — verify before acting.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="px-4 py-3 space-y-3 max-h-[360px] overflow-y-auto">
        {messages.length === 0 && !sending && (
          <p className="text-xs text-muted-foreground italic py-2">
            Ask anything about this patient or general ophthalmology.
          </p>
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
                "max-w-[88%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 text-foreground border border-border/40"
              )}
            >
              {m.text}
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
            placeholder="Ask Sitha…"
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
            onClick={handleSend}
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
