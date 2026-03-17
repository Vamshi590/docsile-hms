import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Exotel Passthru Webhook
 * Receives call status updates from Exotel and upserts into CallLog table.
 *
 * Exotel sends form-urlencoded POST with these fields:
 * - CallSid, CallFrom, CallTo, Direction, Status,
 *   StartTime, EndTime, Duration, RecordingUrl, etc.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the webhook token to prevent unauthorized access
    const webhookToken = request.headers.get("x-exotel-token") ||
      new URL(request.url).searchParams.get("token")

    if (process.env.EXOTEL_WEBHOOK_TOKEN && webhookToken !== process.env.EXOTEL_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Exotel sends form-urlencoded data
    const contentType = request.headers.get("content-type") || ""
    let data: Record<string, string> = {}

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        data[key] = value.toString()
      })
    } else {
      data = await request.json()
    }

    const callSid = data.CallSid || data.callSid
    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 })
    }

    const callFrom = data.CallFrom || data.callFrom || ""
    const callTo = data.CallTo || data.callTo || ""
    const direction = (data.Direction || data.direction || "inbound").toLowerCase()
    const status = mapExotelStatus(data.Status || data.status || "ringing")
    const startTime = data.StartTime || data.startTime || null
    const endTime = data.EndTime || data.endTime || null
    const duration = parseInt(data.Duration || data.duration || "0", 10)
    const recordingUrl = data.RecordingUrl || data.recordingUrl || null

    const supabase = await createClient()
    const now = new Date().toISOString()

    // Try to match caller to a patient by phone number
    let callerName: string | null = null
    let patientId: string | null = null

    const phoneToSearch = direction === "inbound" ? callFrom : callTo
    if (phoneToSearch) {
      // Search with last 10 digits to handle country code variations
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

    // Upsert: update if same CallSid exists, insert otherwise
    const { data: existing } = await supabase
      .from("CallLog")
      .select("id")
      .eq("exotelCallSid", callSid)
      .maybeSingle()

    if (existing) {
      await supabase
        .from("CallLog")
        .update({
          status,
          endTime: endTime ? new Date(endTime).toISOString() : null,
          duration,
          recordingUrl,
          callerName,
          patientId,
          updatedAt: now,
        })
        .eq("id", existing.id)
    } else {
      await supabase.from("CallLog").insert({
        exotelCallSid: callSid,
        callFrom,
        callTo,
        direction,
        status,
        startTime: startTime ? new Date(startTime).toISOString() : now,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        duration,
        recordingUrl,
        callerName,
        patientId,
        createdAt: now,
        updatedAt: now,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Exotel webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Also handle GET for Exotel's initial verification ping
export async function GET() {
  return NextResponse.json({ status: "ok" })
}

function mapExotelStatus(exotelStatus: string): string {
  const s = exotelStatus.toLowerCase()
  switch (s) {
    case "completed":
      return "completed"
    case "busy":
      return "busy"
    case "no-answer":
    case "noanswer":
      return "missed"
    case "failed":
    case "canceled":
      return "failed"
    case "in-progress":
    case "ringing":
      return "ringing"
    default:
      return s
  }
}
