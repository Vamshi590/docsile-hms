"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

// ─── Call Analytics Types ────────────────────────────────────────────────────

export interface CallAnalyticsData {
  // KPIs
  totalCalls: number
  answeredCalls: number
  missedCalls: number
  busyCalls: number
  failedCalls: number
  answerRate: number
  missedRate: number
  avgDuration: number
  totalTalkTime: number
  inboundCalls: number
  outboundCalls: number
  linkedCalls: number
  // Changes vs previous period
  totalChange: number
  answeredChange: number
  missedChange: number
  // Hourly heatmap (0-23 → count per status)
  hourlyDistribution: { hour: number; answered: number; missed: number; busy: number; total: number }[]
  // Daily trend
  dailyTrend: { date: string; total: number; answered: number; missed: number; avgDuration: number }[]
  // Top callers
  topCallers: { phone: string; name: string | null; calls: number; answered: number; totalDuration: number }[]
  // Peak hours
  peakHour: number
  quietHour: number
  // Duration buckets
  durationBuckets: { label: string; count: number }[]
}

// ─── Get Call Analytics ──────────────────────────────────────────────────────

export async function getCallAnalytics(startDate: string, endDate: string): Promise<CallAnalyticsData> {
  await requireAuth()
  const supabase = await createClient()

  const from = new Date(startDate).toISOString()
  const to = new Date(endDate + "T23:59:59").toISOString()

  // Previous period for comparison
  const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime() + 86400000
  const prevEnd = new Date(new Date(startDate).getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs + 1)
  const prevFrom = prevStart.toISOString()
  const prevTo = new Date(prevEnd.getTime() + 86400000 - 1).toISOString()

  // Fetch current + previous period in parallel
  const [currentRes, prevRes] = await Promise.all([
    supabase.from("CallLog").select("*").gte("startTime", from).lte("startTime", to).order("startTime", { ascending: true }),
    supabase.from("CallLog").select("status").gte("startTime", prevFrom).lte("startTime", prevTo),
  ])

  const calls = currentRes.data ?? []
  const prevCalls = prevRes.data ?? []

  // ── KPIs ──
  const totalCalls = calls.length
  const answeredCalls = calls.filter(c => c.status === "completed").length
  const missedCalls = calls.filter(c => c.status === "missed").length
  const busyCalls = calls.filter(c => c.status === "busy").length
  const failedCalls = calls.filter(c => c.status === "failed").length
  const inboundCalls = calls.filter(c => c.direction === "inbound").length
  const outboundCalls = calls.filter(c => c.direction === "outbound").length
  const linkedCalls = calls.filter(c => c.patientId).length

  const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0)
  const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0
  const missedRate = totalCalls > 0 ? Math.round((missedCalls / totalCalls) * 100) : 0
  const avgDuration = answeredCalls > 0 ? Math.round(totalDuration / answeredCalls) : 0

  // ── Changes ──
  const prevTotal = prevCalls.length
  const prevAnswered = prevCalls.filter(c => c.status === "completed").length
  const prevMissed = prevCalls.filter(c => c.status === "missed").length
  const totalChange = prevTotal > 0 ? Math.round(((totalCalls - prevTotal) / prevTotal) * 100) : 0
  const answeredChange = prevAnswered > 0 ? Math.round(((answeredCalls - prevAnswered) / prevAnswered) * 100) : 0
  const missedChange = prevMissed > 0 ? Math.round(((missedCalls - prevMissed) / prevMissed) * 100) : 0

  // ── Hourly distribution ──
  const hourlyMap = Array.from({ length: 24 }, (_, h) => ({ hour: h, answered: 0, missed: 0, busy: 0, total: 0 }))
  for (const c of calls) {
    if (!c.startTime) continue
    const h = new Date(c.startTime).getHours()
    hourlyMap[h].total++
    if (c.status === "completed") hourlyMap[h].answered++
    else if (c.status === "missed") hourlyMap[h].missed++
    else if (c.status === "busy") hourlyMap[h].busy++
  }

  const peakHour = hourlyMap.reduce((max, h) => h.total > max.total ? h : max, hourlyMap[0]).hour
  const activeHours = hourlyMap.filter(h => h.total > 0)
  const quietHour = activeHours.length > 0
    ? activeHours.reduce((min, h) => h.total < min.total ? h : min, activeHours[0]).hour
    : 0

  // ── Daily trend ──
  const dailyMap = new Map<string, { total: number; answered: number; missed: number; duration: number; answeredCount: number }>()
  for (const c of calls) {
    if (!c.startTime) continue
    const day = c.startTime.split("T")[0]
    const existing = dailyMap.get(day) ?? { total: 0, answered: 0, missed: 0, duration: 0, answeredCount: 0 }
    existing.total++
    if (c.status === "completed") { existing.answered++; existing.answeredCount++; existing.duration += c.duration || 0 }
    else if (c.status === "missed") existing.missed++
    dailyMap.set(day, existing)
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, d]) => ({ date, total: d.total, answered: d.answered, missed: d.missed, avgDuration: d.answeredCount > 0 ? Math.round(d.duration / d.answeredCount) : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Top callers ──
  const callerMap = new Map<string, { name: string | null; calls: number; answered: number; totalDuration: number }>()
  for (const c of calls) {
    const phone = c.direction === "inbound" ? c.callFrom : c.callTo
    if (!phone) continue
    const digits = phone.replace(/\D/g, "").slice(-10)
    const existing = callerMap.get(digits) ?? { name: c.callerName, calls: 0, answered: 0, totalDuration: 0 }
    existing.calls++
    if (!existing.name && c.callerName) existing.name = c.callerName
    if (c.status === "completed") { existing.answered++; existing.totalDuration += c.duration || 0 }
    callerMap.set(digits, existing)
  }
  const topCallers = Array.from(callerMap.entries())
    .map(([phone, d]) => ({ phone, ...d }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10)

  // ── Duration buckets ──
  const buckets = [
    { label: "< 30s", min: 0, max: 30, count: 0 },
    { label: "30s–1m", min: 30, max: 60, count: 0 },
    { label: "1–2m", min: 60, max: 120, count: 0 },
    { label: "2–5m", min: 120, max: 300, count: 0 },
    { label: "5–10m", min: 300, max: 600, count: 0 },
    { label: "10m+", min: 600, max: Infinity, count: 0 },
  ]
  for (const c of calls) {
    if (c.status !== "completed" || !c.duration) continue
    const bucket = buckets.find(b => c.duration >= b.min && c.duration < b.max)
    if (bucket) bucket.count++
  }

  return {
    totalCalls, answeredCalls, missedCalls, busyCalls, failedCalls,
    answerRate, missedRate, avgDuration, totalTalkTime: totalDuration,
    inboundCalls, outboundCalls, linkedCalls,
    totalChange, answeredChange, missedChange,
    hourlyDistribution: hourlyMap, dailyTrend, topCallers,
    peakHour, quietHour,
    durationBuckets: buckets.map(({ label, count }) => ({ label, count })),
  }
}

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

    if (calls.length === 0) {
      return { success: true as const, synced: 0, message: "No calls to sync" }
    }

    // ── Step 1: Filter out already-synced calls early (single DB query) ──
    const allSids = calls.map((c: any) => c.Sid as string).filter(Boolean)
    const { data: existingLogs } = await supabase
      .from("CallLog")
      .select("exotelCallSid")
      .in("exotelCallSid", allSids)

    const existingSids = new Set((existingLogs || []).map((l) => l.exotelCallSid))
    const newCalls = calls.filter((c: any) => c.Sid && !existingSids.has(c.Sid))

    console.log(`[Exotel Sync] ${calls.length} from Exotel, ${existingSids.size} already synced, ${newCalls.length} new`)

    if (newCalls.length === 0) {
      revalidatePath("/call-logs")
      return { success: true as const, synced: 0, message: "All calls already synced" }
    }

    // ── Step 2: Parse new call data (CPU only, no I/O) ──
    const parsedCalls = newCalls
      .map((call: any) => {
        const callSid = call.Sid as string
        const callFrom = (call.From || "") as string
        const callTo = (call.To || "") as string
        const direction = ((call.Direction || "inbound") as string).toLowerCase().includes("out") ? "outbound" : "inbound"
        const startTimeRaw = (call.StartTime || call.DateCreated) as string | null
        const endTimeRaw = call.EndTime as string | null
        const recordingUrl = (call.RecordingUrl || null) as string | null

        const callDetails = parseDetailsFromCallData(call)

        let status: string
        let displayDuration: number

        if (callDetails && callDetails.leg2Status !== null) {
          const mappedStatus = mapLeg2StatusToDbStatus(callDetails.leg2Status)
          status = mappedStatus.status
          displayDuration = mappedStatus.duration === -1 ? callDetails.conversationDuration : mappedStatus.duration
        } else {
          status = ""
          displayDuration = 0
        }

        const phoneToSearch = direction === "inbound" ? callFrom : callTo
        const digits = phoneToSearch.replace(/\D/g, "").slice(-10)

        return {
          callSid, callFrom, callTo, direction, startTimeRaw, endTimeRaw,
          recordingUrl, status, displayDuration, callDetails, digits,
          rawCall: call,
        }
      })

    // ── Step 3: Fetch missing details from Exotel in parallel (only for new calls without inline details) ──
    const needsDetailFetch = parsedCalls.filter((c) => c.status === "")
    if (needsDetailFetch.length > 0) {
      console.log(`[Exotel Sync] Fetching details for ${needsDetailFetch.length} calls in parallel`)
      const BATCH_SIZE = 5
      for (let i = 0; i < needsDetailFetch.length; i += BATCH_SIZE) {
        const batch = needsDetailFetch.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map((c) => fetchCallDetails(c.callSid, auth))
        )
        for (let j = 0; j < batch.length; j++) {
          const details = results[j]
          if (details && details.leg2Status !== null) {
            const mapped = mapLeg2StatusToDbStatus(details.leg2Status)
            batch[j].status = mapped.status
            batch[j].displayDuration = mapped.duration === -1 ? details.conversationDuration : mapped.duration
            batch[j].callDetails = details
          } else {
            batch[j].status = "missed"
            batch[j].displayDuration = 0
          }
        }
      }
    }

    // ── Step 4: Batch patient lookup — single query for all unique phones ──
    const uniqueDigits = [...new Set(parsedCalls.map((c) => c.digits).filter((d) => d.length === 10))]
    const patientMap = new Map<string, { id: string; fullName: string }>()

    if (uniqueDigits.length > 0) {
      const orFilter = uniqueDigits.map((d) => `phone.ilike.%${d}`).join(",")
      const { data: patients } = await supabase
        .from("Patient")
        .select("id, fullName, phone")
        .or(orFilter)

      if (patients) {
        for (const p of patients) {
          const pDigits = (p.phone || "").replace(/\D/g, "").slice(-10)
          if (pDigits.length === 10 && !patientMap.has(pDigits)) {
            patientMap.set(pDigits, { id: p.id, fullName: p.fullName })
          }
        }
      }
    }

    // ── Step 5: Bulk insert all new calls in one query ──
    const nowStr = new Date().toISOString()
    const toInsert = parsedCalls.map((c) => {
      const patient = c.digits.length === 10 ? patientMap.get(c.digits) : null
      const rawResponse = { ...c.rawCall, _details: c.callDetails?.details || {}, _leg2Status: c.callDetails?.leg2Status || null }

      return {
        exotelCallSid: c.callSid,
        callFrom: c.callFrom,
        callTo: c.callTo,
        direction: c.direction,
        status: c.status || "missed",
        startTime: c.startTimeRaw ? new Date(c.startTimeRaw).toISOString() : nowStr,
        endTime: c.endTimeRaw ? new Date(c.endTimeRaw).toISOString() : null,
        duration: c.displayDuration,
        recordingUrl: c.recordingUrl,
        callerName: patient?.fullName || null,
        patientId: patient?.id || null,
        rawResponse,
        createdAt: nowStr,
        updatedAt: nowStr,
      }
    })

    const { error: insertErr } = await supabase.from("CallLog").insert(toInsert)
    if (insertErr) console.error("[Exotel Sync] Bulk insert error:", insertErr)

    console.log(`[Exotel Sync] Done: ${toInsert.length} new calls inserted`)

    revalidatePath("/call-logs")
    return { success: true as const, synced: toInsert.length, message: `${toInsert.length} new calls synced` }
  } catch (error) {
    console.error("[Exotel Sync] Error:", error)
    return { success: false as const, error: "Failed to sync calls from Exotel" }
  }
}
