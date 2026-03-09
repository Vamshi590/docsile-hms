"use client"

import { useState, useEffect } from "react"
import { Download, X, Monitor, Hospital } from "lucide-react"
import { Button } from "@/components/ui/button"

// Browser-native type not included in TypeScript's lib
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Already running as installed PWA — no prompt needed
    if (window.matchMedia("(display-mode: standalone)").matches) return
    // User dismissed this session
    if (sessionStorage.getItem("pwa-install-dismissed")) return

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    sessionStorage.setItem("pwa-install-dismissed", "true")
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="rounded-2xl border border-border bg-white shadow-xl overflow-hidden">
        {/* Accent top bar */}
        <div className="h-1 bg-primary w-full" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shrink-0">
              <Hospital className="h-5 w-5 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight">
                Install Docsile HMS
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Install the app to use it full-screen without browser bars — like a native desktop app.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install App
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="h-8 px-3 text-xs text-muted-foreground"
                >
                  Not now
                </Button>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground rounded-md p-0.5 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* How it works hint */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-t border-border">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Opens without browser bars — just your app, full screen
          </p>
        </div>
      </div>
    </div>
  )
}
