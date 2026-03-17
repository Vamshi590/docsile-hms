import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Exotel Webhook — handles both Passthru and Status Callback.
 *
 * Exotel Passthru sends (call START):
 *   CallSid, CallFrom, CallTo, CurrentTime, CallType (call-attempt)
 *
 * Exotel Status Callback sends (call END):
 *   CallSid, Status (completed/no-answer/busy/failed),
 *   ConversationDuration, Duration, RecordingUrl, StartTime, EndTime, etc.
 *
 * Key insight: Exotel's top-level "Status" = "completed" means the call flow
 * finished, NOT that someone answered. We use "ConversationDuration" to detect
 * if the agent actually picked up (0 = nobody answered).
 */
export async function POST(request: NextRequest) {
  try {
    const webhookToken = request.headers.get("x-exotel-token") ||
      new URL(request.url).searchParams.get("token")

    if (process.env.EXOTEL_WEBHOOK_TOKEN && webhookToken !== process.env.EXOTEL_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body — Exotel sends form-urlencoded
    const contentType = request.headers.get("content-type") || ""
    let data: Record<string, string> = {}

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        data[key] = value.toString()
      })
    } else {
      try {
        data = await request.json()
      } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 })
      }
    }

    // Log raw webhook data for debugging
    console.log("[Exotel Webhook] Raw data:", JSON.stringify(data))

    const callSid = data.CallSid || data.callSid || data.sid
    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 })
    }

    const callFrom = data.CallFrom || data.callFrom || data.From || data.from || ""
    const callTo = data.CallTo || data.callTo || data.To || data.to || ""
    const direction = (data.Direction || data.direction || data.CallType || "inbound").toLowerCase().includes("out") ? "outbound" : "inbound"
    const startTime = data.StartTime || data.startTime || data.CurrentTime || null
    const endTime = data.EndTime || data.endTime || null
    const recordingUrl = data.RecordingUrl || data.recordingUrl || null

    // Duration fields: Exotel sends both "Duration" (total) and "ConversationDuration" (talk time)
    const totalDuration = parseInt(data.Duration || data.duration || "0", 10)
    const conversationDuration = parseInt(data.ConversationDuration || data.conversationDuration || "0", 10)

    // Determine the real call outcome
    const rawStatus = (data.Status || data.status || "").toLowerCase()
    const status = resolveCallStatus(rawStatus, conversationDuration, totalDuration)

    const supabase = await createClient()
    const now = new Date().toISOString()

    // Try to match caller to a patient
    let callerName: string | null = null
    let patientId: string | null = null

    const phoneToSearch = direction === "inbound" ? callFrom : callTo
    if (phoneToSearch) {
      const digits = phoneToSearch.replace(/\D/g, "").slice(-10)
      if (digits.length === 10) {
        const { data: patient } = await supabase
          .from("Patient")
          .select("id, fullName")
          .ilike("phone", `%${digits}`)
          .limit(1)
          .maybeSingle()

        if (patient) {
          callerName = patient.fullName
          patientId = patient.id
        }
      }
    }

    // Upsert by CallSid
    const { data: existing } = await supabase
      .from("CallLog")
      .select("id, status")
      .eq("exotelCallSid", callSid)
      .maybeSingle()

    if (existing) {
      // Only update if this is a "final" status (don't overwrite final with intermediate)
      const isFinalStatus = ["completed", "missed", "busy", "failed"].includes(status)
      const existingIsFinal = ["completed", "missed", "busy", "failed"].includes(existing.status)

      // Update if: new status is final, OR existing is not yet final
      if (isFinalStatus || !existingIsFinal) {
        await supabase
          .from("CallLog")
          .update({
            status: isFinalStatus ? status : existing.status,
            endTime: endTime ? new Date(endTime).toISOString() : null,
            duration: conversationDuration || totalDuration,
            recordingUrl: recordingUrl || undefined,
            callerName: callerName || undefined,
            patientId: patientId || undefined,
            rawResponse: data,
            updatedAt: now,
          })
          .eq("id", existing.id)
      }
    } else {
      await supabase.from("CallLog").insert({
        exotelCallSid: callSid,
        callFrom,
        callTo,
        direction,
        status,
        startTime: startTime ? new Date(startTime).toISOString() : now,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        duration: conversationDuration || totalDuration,
        recordingUrl,
        callerName,
        patientId,
        rawResponse: data,
        createdAt: now,
        updatedAt: now,
      })
    }

    console.log(`[Exotel Webhook] CallSid=${callSid} status=${status} convDuration=${conversationDuration} totalDuration=${totalDuration}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Exotel Webhook] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" })
}

/**
 * Resolve the actual call outcome.
 * Exotel's "Status: completed" just means the call flow finished — NOT that someone answered.
 * We use ConversationDuration to distinguish answered vs missed.
 */
function resolveCallStatus(rawStatus: string, conversationDuration: number, totalDuration: number): string {
  switch (rawStatus) {
    case "busy":
      return "busy"
    case "no-answer":
    case "noanswer":
      return "missed"
    case "failed":
    case "canceled":
      return "failed"
    case "completed":
      // "completed" = call flow finished. Check if anyone actually talked.
      // ConversationDuration > 0 means the agent picked up.
      if (conversationDuration > 0) return "completed"
      return "missed"
    case "in-progress":
    case "ringing":
      return "ringing"
    default:
      // If we have no recognized status but have duration info, infer from that
      if (totalDuration > 0 && conversationDuration === 0) return "missed"
      if (conversationDuration > 0) return "completed"
      return "ringing"
  }
}
