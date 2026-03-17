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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const url = `https://api.exotel.com/v1/Accounts/${sid}/Calls.json?StartTime>=${oneDayAgo.toISOString()}&PageSize=100`
    const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString("base64")

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${authHeader}` },
    })

    if (!response.ok) {
      return { success: false as const, error: `Exotel API error: ${response.status}` }
    }

    const result = await response.json()
    const calls = result?.Calls || []
    let synced = 0

    for (const call of calls) {
      const callSid = call.Sid
      const { data: existing } = await supabase
        .from("CallLog")
        .select("id")
        .eq("exotelCallSid", callSid)
        .maybeSingle()

      if (existing) continue

      // Try to match caller to patient
      const phoneToSearch = call.Direction === "inbound" ? call.From : call.To
      let callerName: string | null = null
      let patientId: string | null = null

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

      const nowStr = new Date().toISOString()
      await supabase.from("CallLog").insert({
        exotelCallSid: callSid,
        callFrom: call.From || "",
        callTo: call.To || "",
        direction: (call.Direction || "inbound").toLowerCase(),
        status: mapStatus(call.Status || ""),
        startTime: call.StartTime ? new Date(call.StartTime).toISOString() : nowStr,
        endTime: call.EndTime ? new Date(call.EndTime).toISOString() : null,
        duration: parseInt(call.Duration || "0", 10),
        recordingUrl: call.RecordingUrl || null,
        callerName,
        patientId,
        createdAt: nowStr,
        updatedAt: nowStr,
      })
      synced++
    }

    revalidatePath("/call-logs")
    return { success: true as const, synced }
  } catch (error) {
    console.error("Exotel sync error:", error)
    return { success: false as const, error: "Failed to sync calls from Exotel" }
  }
}

function mapStatus(s: string): string {
  const lower = s.toLowerCase()
  if (lower === "completed") return "completed"
  if (lower === "busy") return "busy"
  if (lower === "no-answer" || lower === "noanswer") return "missed"
  if (lower === "failed" || lower === "canceled") return "failed"
  return lower || "ringing"
}
