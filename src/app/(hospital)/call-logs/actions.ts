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
 * Fetch the legs (sub-calls) for a given parent call.
 * Leg 1 = caller → ExoPhone (always "completed" if caller connected)
 * Leg 2 = ExoPhone → agent (THIS tells us if the agent actually answered)
 *
 * Returns the agent leg's status, or null if no legs found.
 */
async function fetchCallLegs(callSid: string, auth: { sid: string; authHeader: string }): Promise<{
  agentLegStatus: string
  agentLegDuration: number
  legs: any[]
} | null> {
  try {
    const url = `https://api.exotel.com/v1/Accounts/${auth.sid}/Calls/${callSid}/Legs.json`
    const response = await fetch(url, {
      headers: { Authorization: auth.authHeader },
    })

    if (!response.ok) return null

    const result = await response.json()

    // Parse legs — can be { Legs: [...] } or { Call: { Legs: [...] } }
    let legs: any[] = []
    if (Array.isArray(result?.Legs)) {
      legs = result.Legs
    } else if (result?.Call?.Legs) {
      legs = Array.isArray(result.Call.Legs) ? result.Call.Legs : [result.Call.Legs]
    } else if (Array.isArray(result)) {
      legs = result
    }

    // Also handle nested { Leg: {...} } inside array
    legs = legs.map((l: any) => l.Leg || l)

    console.log(`[Exotel Legs] CallSid=${callSid} found ${legs.length} legs`)
    if (legs.length > 0) {
      console.log(`[Exotel Legs] Leg data:`, JSON.stringify(legs).slice(0, 500))
    }

    // The agent leg is typically the second leg (index 1), or the one where the
    // "To" is NOT the ExoPhone number. If only 1 leg, the agent was never dialed.
    if (legs.length === 0) {
      return { agentLegStatus: "no-answer", agentLegDuration: 0, legs }
    }

    if (legs.length === 1) {
      // Only caller leg exists — agent was never dialed or call ended before connect
      return { agentLegStatus: "no-answer", agentLegDuration: 0, legs }
    }

    // Second leg (or last leg) is the agent leg
    const agentLeg = legs[legs.length - 1]
    const agentStatus = ((agentLeg.Status || agentLeg.status || "") as string).toLowerCase()
    const agentDuration = parseInt(String(agentLeg.Duration || agentLeg.duration || "0"), 10)

    return { agentLegStatus: agentStatus, agentLegDuration: agentDuration, legs }
  } catch (error) {
    console.error(`[Exotel Legs] Error fetching legs for ${callSid}:`, error)
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

    // Fetch call list from v1 API
    const v1Url = `https://api.exotel.com/v1/Accounts/${auth.sid}/Calls.json`
    console.log("[Exotel Sync] Fetching calls:", v1Url)

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

      // ── Fetch legs to determine the REAL call outcome ──
      const legData = await fetchCallLegs(callSid, auth)

      let status: string
      let displayDuration: number

      if (legData) {
        // Use the agent leg's status — this is the truth
        const agentStatus = legData.agentLegStatus
        if (agentStatus === "completed") {
          status = "completed"
          displayDuration = legData.agentLegDuration
        } else if (agentStatus === "busy") {
          status = "busy"
          displayDuration = 0
        } else if (agentStatus === "failed" || agentStatus === "canceled") {
          status = "failed"
          displayDuration = 0
        } else {
          // "no-answer", "ringing", empty, or only 1 leg = missed
          status = "missed"
          displayDuration = 0
        }

        console.log(`[Exotel Sync] CallSid=${callSid} agentLegStatus=${agentStatus} → status=${status} duration=${displayDuration}`)
      } else {
        // Fallback: couldn't fetch legs, use parent call data
        status = "missed"
        displayDuration = 0
        console.log(`[Exotel Sync] CallSid=${callSid} no legs data, defaulting to missed`)
      }

      // Build raw response with legs included
      const rawResponse = { ...call, _legs: legData?.legs || [] }

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
