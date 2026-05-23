"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { sendPatientEmail, getAvailableTemplates } from "../actions"
import type { FollowUpRecord } from "../actions"

type Template = { code: string; name: string }

interface Props {
  record: FollowUpRecord
  hospitalName: string
  open: boolean
  onClose: () => void
}

export function SendEmailModal({ record, hospitalName, open, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateCode, setTemplateCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getAvailableTemplates()
      .then((data) => { setTemplates(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [open])

  async function handleSend() {
    if (!templateCode) { toast.error("Select a template"); return }
    if (!record.email) { toast.error("Patient has no email address"); return }
    setSending(true)
    const result = await sendPatientEmail({
      toEmail: record.email,
      toName: record.patientName,
      templateCode,
      variables: {
        patientName: record.patientName,
        hospitalName,
        followUpDate: new Date(record.followUpDate).toLocaleDateString("en-IN", {
          day: "numeric", month: "long", year: "numeric",
        }),
        date: new Date().toLocaleDateString("en-IN", {
          day: "numeric", month: "long", year: "numeric",
        }),
      },
    })
    setSending(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success("Email sent successfully")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Email to {record.patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            <span>To: </span>
            {record.email
              ? <span>{record.email}</span>
              : <span className="text-destructive">No email on record</span>
            }
          </div>
          <div className="space-y-1.5">
            <Label>Template</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading templates…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active templates available.</p>
            ) : (
              <Select value={templateCode} onValueChange={setTemplateCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !record.email || !templateCode}
          >
            {sending ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
