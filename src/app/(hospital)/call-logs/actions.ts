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

// ─── Exotel API Helper ───────────────────────────────────────────────────────

function getExotelAuth() {
  const sid = process.env.EXOTEL_SID
  const apiKey = process.env.EXOTEL_API_KEY
  const apiToken = process.env.EXOTEL_API_TOKEN
  if (!sid || !apiKey || !apiToken) return null
  return {
    sid,
    authHeader: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}`,
  }
}

/**
 * Map Exotel Leg 2 (agent leg) status to our database status.
 *
 * According to Exotel docs, Leg 2 status can be:
 * - completed: The call was answered and has ended normally → "completed"
 * - busy: The caller received a busy signal → "busy"
 * - no-answer: The call ended without being answered → "missed"
 * - failed: The call could not be completed as dialed (non-existent number) → "failed"
 * - canceled: The call was canceled while queued or ringing → "missed"
 * - null/empty: The call did not have a second leg → "missed"
 */
function mapLeg2StatusToDbStatus(leg2Status: string | null | undefined): { status: string; duration: number } {
  const status = (leg2Status || "").toLowerCase().trim()

  switch (status) {
    case "completed":
      return { status: "completed", duration: -1 } // -1 means use actual duration
    case "busy":
      return { status: "busy", duration: 0 }
    case "no-answer":
    case "noanswer":
      return { status: "missed", duration: 0 }
    case "failed":
      return { status: "failed", duration: 0 }
    case "canceled":
      return { status: "missed", duration: 0 }
    case "":
    case "null":
    default:
      return { status: "missed", duration: 0 }
  }
}

/**
 * Fetch call details to get Leg2Status.
 *
 * Uses the Exotel API with ?details=true to get leg information.
 * See: https://developer.exotel.com/api/make-a-call-api#call-details
 *
 * Response structure includes:
 * - Details.Leg1Status: Status of first leg (caller to ExoPhone)
 * - Details.Leg2Status: Status of second leg (ExoPhone to agent) - THIS is what we need
 * - Details.ConversationDuration: Duration of actual conversation
 */
async function fetchCallDetails(callSid: string, auth: { sid: string; authHeader: string }): Promise<{
  leg2Status: string | null
  leg1Status: string | null
  conversationDuration: number
  details: any
} | null> {
  try {
    const url = `https://api.exotel.com/v1/Accounts/${auth.sid}/Calls/${callSid}?details=true`
    const response = await fetch(url, {
      headers: { Authorization: auth.authHeader },
    })

    if (!response.ok) {
      console.error(`[Exotel Details] Failed to fetch call ${callSid}: ${response.status}`)
      return null
    }

    const result = await response.json()
    const callData = result?.Call || result

    console.log(`[Exotel Details] Raw response for ${callSid}:`, JSON.stringify(callData).slice(0, 1500))

    // Extract Details object which contains Leg1Status, Leg2Status, ConversationDuration
    const details = callData?.Details || {}
    const leg1Status = details.Leg1Status || null
    const leg2Status = details.Leg2Status || null
    const conversationDuration = parseInt(String(details.ConversationDuration || "0"), 10)

    console.log(
      `[Exotel Details] CallSid=${callSid} Leg1Status="${leg1Status}" Leg2Status="${leg2Status}" ConversationDuration=${conversationDuration}`
    )

    return { leg2Status, leg1Status, conversationDuration, details }
  } catch (error) {
    console.error(`[Exotel Details] Error fetching details for ${callSid}:`, error)
    return null
  }
}

/**
 * Parse Leg2Status directly from call data (when fetched with details=true).
 * This avoids needing a separate API call for each call's legs.
 */
function parseDetailsFromCallData(callData: any): {
  leg2Status: string | null
  leg1Status: string | null
  conversationDuration: number
  details: any
} | null {
  try {
    const details = callData?.Details || {}

    // Check if we have Details with Leg2Status
    if (!details.Leg2Status && !details.Leg1Status) {
      return null // No details available
    }

    const leg1Status = details.Leg1Status || null
    const leg2Status = details.Leg2Status || null
    const conversationDuration = parseInt(String(details.ConversationDuration || "0"), 10)

    console.log(
      `[Exotel Sync] Found Details in call data: Leg1Status="${leg1Status}" Leg2Status="${leg2Status}" ConversationDuration=${conversationDuration}`
    )

    return { leg2Status, leg1Status, conversationDuration, details }
  } catch (error) {
    console.error("[Exotel Sync] Error parsing details from call data:", error)
    return null
  }
}

// ─── Sync from Exotel API ────────────────────────────────────────────────────

export async function syncExotelCalls() {
  await requireAuth()

  const auth = getExotelAuth()
  if (!auth) {
    return { success: false as const, error: "Exotel API credentials not configured" }
  }

  try {
    const supabase = await createClient()

    // Fetch call list from v1 API with details=true to get Legs in one request
    const v1Url = `https://api.exotel.com/v1/Accounts/${auth.sid}/Calls.json?details=true`
    console.log("[Exotel Sync] Fetching calls with details:", v1Url)

    const response = await fetch(v1Url, {
      headers: { Authorization: auth.authHeader },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Exotel Sync] API error:", response.status, errorText)
      return { success: false as const, error: `Exotel API error: ${response.status}` }
    }

    const result = await response.json()

    // Parse calls list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let calls: any[] = []
    const rawCalls = result?.Calls
    if (Array.isArray(rawCalls)) {
      calls = rawCalls.map((c: any) => c.Call || c)
    } else if (rawCalls?.Call) {
      calls = Array.isArray(rawCalls.Call) ? rawCalls.Call : [rawCalls.Call]
    }

    // Filter to only parent calls (ParentCallSid is empty)
    calls = calls.filter((c: any) => !c.ParentCallSid)

    console.log(`[Exotel Sync] Found ${calls.length} parent calls`)

    let synced = 0
    let updated = 0

    for (const call of calls) {
      const callSid = call.Sid as string
      if (!callSid) continue

      const callFrom = (call.From || "") as string
      const callTo = (call.To || "") as string
      const direction = ((call.Direction || "inbound") as string).toLowerCase().includes("out") ? "outbound" : "inbound"
      const startTimeRaw = (call.StartTime || call.DateCreated) as string | null
      const endTimeRaw = call.EndTime as string | null
      const recordingUrl = (call.RecordingUrl || null) as string | null

      // ── Parse Details from the call data (already included with details=true) ──
      // Details contains Leg2Status which tells us the true outcome
      let callDetails = parseDetailsFromCallData(call)

      // If no details in the bulk response, fetch individually
      if (!callDetails) {
        callDetails = await fetchCallDetails(callSid, auth)
      }

      let status: string
      let displayDuration: number

      if (callDetails && callDetails.leg2Status !== null) {
        // Use Leg2Status from Details — this is the truth
        const mappedStatus = mapLeg2StatusToDbStatus(callDetails.leg2Status)
        status = mappedStatus.status

        // If status is completed, use conversation duration; otherwise 0
        if (mappedStatus.duration === -1) {
          displayDuration = callDetails.conversationDuration
        } else {
          displayDuration = mappedStatus.duration
        }

        console.log(`[Exotel Sync] CallSid=${callSid} Leg2Status="${callDetails.leg2Status}" → dbStatus="${status}" duration=${displayDuration}`)
      } else {
        // Fallback: couldn't get details, default to missed
        status = "missed"
        displayDuration = 0
        console.log(`[Exotel Sync] CallSid=${callSid} no Leg2Status data, defaulting to missed`)
      }

      // Build raw response with details included
      const rawResponse = { ...call, _details: callDetails?.details || {}, _leg2Status: callDetails?.leg2Status || null }

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

      // Upsert
      const { data: existing } = await supabase
        .from("CallLog")
        .select("id")
        .eq("exotelCallSid", callSid)
        .maybeSingle()

      const nowStr = new Date().toISOString()

      if (existing) {
        await supabase.from("CallLog").update({
          status,
          duration: displayDuration,
          endTime: endTimeRaw ? new Date(endTimeRaw).toISOString() : null,
          recordingUrl,
          callerName,
          patientId: patientIdVal,
          rawResponse,
          updatedAt: nowStr,
        }).eq("id", existing.id)
        updated++
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
          rawResponse,
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
