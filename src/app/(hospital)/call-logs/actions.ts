"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

// ─── Fetch Call Logs ─────────────────────────────────────────────────────────

export async function getCallLogs(filters: {
  startDate: string
  endDate: string
  status?: string
  direction?: string
  search?: string
}) {
  await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from("CallLog")
    .select("*")
    .gte("startTime", new Date(filters.startDate).toISOString())
    .lte("startTime", new Date(filters.endDate + "T23:59:59").toISOString())
    .order("startTime", { ascending: false })

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }

  if (filters.direction && filters.direction !== "all") {
    query = query.eq("direction", filters.direction)
  }

  if (filters.search) {
    query = query.or(
      `callFrom.ilike.%${filters.search}%,callerName.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── Get Call Stats ──────────────────────────────────────────────────────────

export async function getCallStats(startDate: string, endDate: string) {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("CallLog")
    .select("status, direction, duration")
    .gte("startTime", new Date(startDate).toISOString())
    .lte("startTime", new Date(endDate + "T23:59:59").toISOString())

  if (error) throw error

  const stats = {
    total: data.length,
    completed: 0,
    missed: 0,
    busy: 0,
    failed: 0,
    inbound: 0,
    outbound: 0,
    totalDuration: 0,
    avgDuration: 0,
  }

  for (const call of data) {
    if (call.status === "completed") stats.completed++
    else if (call.status === "missed") stats.missed++
    else if (call.status === "busy") stats.busy++
    else if (call.status === "failed") stats.failed++

    if (call.direction === "inbound") stats.inbound++
    else if (call.direction === "outbound") stats.outbound++

    stats.totalDuration += call.duration || 0
  }

  stats.avgDuration = stats.completed > 0 ? Math.round(stats.totalDuration / stats.completed) : 0

  return stats
}

// ─── Update Call Notes ───────────────────────────────────────────────────────

export async function updateCallNotes(id: string, notes: string) {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("CallLog")
    .update({ notes, updatedAt: new Date().toISOString() })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/call-logs")
  return { success: true as const }
}

// ─── Link Call to Patient ────────────────────────────────────────────────────

export async function linkCallToPatient(id: string, patientId: string, callerName: string) {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("CallLog")
    .update({ patientId, callerName, updatedAt: new Date().toISOString() })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/call-logs")
  return { success: true as const }
}

// ─── Search Patients for Linking ─────────────────────────────────────────────

export async function searchPatients(query: string) {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("Patient")
    .select("id, fullName, phone, patientId")
    .or(`fullName.ilike.%${query}%,phone.ilike.%${query}%,patientId.ilike.%${query}%`)
    .limit(10)

  if (error) throw error
  return data
}

// ─── Sync from Exotel API ────────────────────────────────────────────────────

export async function syncExotelCalls() {
  await requireAuth()

  const sid = process.env.EXOTEL_SID
  const apiKey = process.env.EXOTEL_API_KEY
  const apiToken = process.env.EXOTEL_API_TOKEN

  if (!sid || !apiKey || !apiToken) {
    return { success: false as const, error: "Exotel API credentials not configured" }
  }

  try {
    const supabase = await createClient()
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // Use Exotel v2 API which returns detailed call data including conversation_duration
    const params = new URLSearchParams({
      "StartTime": threeDaysAgo.toISOString(),
      "EndTime": now.toISOString(),
      "PageSize": "200",
      "SortBy": "DateCreated:desc",
    })

    const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString("base64")

    // Try v2 API first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let calls: any[] = []
    let apiVersion = "v2"

    const v2Url = `https://api.exotel.com/v2/accounts/${sid}/calls?${params}`
    console.log("[Exotel Sync] Fetching v2:", v2Url)

    let response = await fetch(v2Url, {
      headers: { Authorization: `Basic ${authHeader}` },
    })

    if (response.ok) {
      const result = await response.json()
      console.log("[Exotel Sync] v2 response keys:", Object.keys(result))
      // v2 returns { response: [...] } or { data: [...] }
      calls = result?.response || result?.data || []
    } else {
      // Fallback to v1 API
      apiVersion = "v1"
      const v1Url = `https://api.exotel.com/v1/Accounts/${sid}/Calls.json`
      console.log("[Exotel Sync] v2 failed, trying v1:", v1Url)

      response = await fetch(v1Url, {
        headers: { Authorization: `Basic ${authHeader}` },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Exotel Sync] API error:", response.status, errorText)
        return { success: false as const, error: `Exotel API error: ${response.status}` }
      }

      const result = await response.json()
      console.log("[Exotel Sync] v1 response keys:", Object.keys(result))
      // v1 can return { Calls: [...] } or { Calls: { Call: [...] } }
      const rawCalls = result?.Calls
      if (Array.isArray(rawCalls)) {
        calls = rawCalls.map((c: any) => c.Call || c)
      } else if (rawCalls?.Call) {
        calls = Array.isArray(rawCalls.Call) ? rawCalls.Call : [rawCalls.Call]
      }
    }

    console.log(`[Exotel Sync] Found ${calls.length} calls via ${apiVersion}`)
    if (calls.length > 0) {
      console.log("[Exotel Sync] Sample call keys:", Object.keys(calls[0]))
      console.log("[Exotel Sync] Sample call:", JSON.stringify(calls[0]).slice(0, 500))
    }

    let synced = 0
    let updated = 0

    for (const call of calls) {
      // Handle both v1 (PascalCase) and v2 (snake_case) field names
      const callSid = (call.Sid || call.sid || call.CallSid) as string
      if (!callSid) continue

      const callFrom = (call.From || call.from || call.CallFrom || "") as string
      const callTo = (call.To || call.to || call.CallTo || "") as string
      const rawDirection = ((call.Direction || call.direction || "inbound") as string).toLowerCase()
      const direction = rawDirection.includes("out") ? "outbound" : "inbound"

      // Duration fields
      const totalDuration = parseInt(String(call.Duration || call.duration || "0"), 10)
      const conversationDuration = parseInt(String(call.ConversationDuration || call.conversation_duration || "0"), 10)

      // Status: use conversation_duration to determine real outcome
      const rawStatus = ((call.Status || call.status || "") as string).toLowerCase()
      const status = resolveCallStatus(rawStatus, conversationDuration, totalDuration)

      const startTimeRaw = (call.StartTime || call.start_time || call.DateCreated || call.date_created) as string | null
      const endTimeRaw = (call.EndTime || call.end_time) as string | null
      const recordingUrl = (call.RecordingUrl || call.recording_url) as string | null

      // Use conversation duration (actual talk time) as the displayed duration
      const displayDuration = conversationDuration || totalDuration

      // Try to match caller to patient
      const phoneToSearch = direction === "inbound" ? callFrom : callTo
      let callerName: string | null = null
      let patientIdVal: string | null = null

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
            patientIdVal = patient.id
          }
        }
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from("CallLog")
        .select("id, status")
        .eq("exotelCallSid", callSid)
        .maybeSingle()

      const nowStr = new Date().toISOString()

      if (existing) {
        // Update if the new status is more accurate (final vs intermediate)
        const isFinal = ["completed", "missed", "busy", "failed"].includes(status)
        const existingIsFinal = ["completed", "missed", "busy", "failed"].includes(existing.status)

        if (isFinal && !existingIsFinal) {
          await supabase.from("CallLog").update({
            status,
            duration: displayDuration,
            endTime: endTimeRaw ? new Date(endTimeRaw).toISOString() : null,
            recordingUrl,
            callerName,
            patientId: patientIdVal,
            rawResponse: call,
            updatedAt: nowStr,
          }).eq("id", existing.id)
          updated++
        }
      } else {
        await supabase.from("CallLog").insert({
          exotelCallSid: callSid,
          callFrom,
          callTo,
          direction,
          status,
          startTime: startTimeRaw ? new Date(startTimeRaw).toISOString() : nowStr,
          endTime: endTimeRaw ? new Date(endTimeRaw).toISOString() : null,
          duration: displayDuration,
          recordingUrl,
          callerName,
          patientId: patientIdVal,
          rawResponse: call,
          createdAt: nowStr,
          updatedAt: nowStr,
        })
        synced++
      }
    }

    revalidatePath("/call-logs")
    return { success: true as const, synced, message: `${synced} new, ${updated} updated` }
  } catch (error) {
    console.error("[Exotel Sync] Error:", error)
    return { success: false as const, error: "Failed to sync calls from Exotel" }
  }
}

/**
 * Resolve actual call outcome.
 * Exotel "Status: completed" = call flow finished, NOT that agent answered.
 * ConversationDuration > 0 means someone actually picked up and talked.
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
      // "completed" = call flow finished. Check actual talk time.
      if (conversationDuration > 0) return "completed"
      return "missed"
    case "in-progress":
    case "ringing":
      return "ringing"
    default:
      if (totalDuration > 0 && conversationDuration === 0) return "missed"
      if (conversationDuration > 0) return "completed"
      return "ringing"
  }
}
