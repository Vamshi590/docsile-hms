import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
 * Key insight: We fetch call legs to determine the TRUE call outcome.
 * Leg 1 = caller → ExoPhone (always "completed" if caller connected)
 * Leg 2 = ExoPhone → agent (THIS tells us if the agent actually answered)
 */

// ─── Exotel API Helper ───────────────────────────────────────────────────────

function getExotelAuth() {
  const sid = process.env.EXOTEL_SID;
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  if (!sid || !apiKey || !apiToken) return null;
  return {
    sid,
    authHeader: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString(
      "base64"
    )}`,
  };
}

/**
 * Fetch the legs (sub-calls) for a given parent call.
 * Leg 0 = caller → ExoPhone ("From" leg)
 * Leg 1 = ExoPhone → agent ("To" leg - THIS tells us if the agent actually answered)
 *
 * Uses the Exotel API with ?details=true to get leg information.
 * See: https://developer.exotel.com/api/make-a-call-api#call-details
 *
 * Returns the agent leg's status, or null if no legs found.
 */
async function fetchCallLegs(
  callSid: string,
  auth: { sid: string; authHeader: string }
): Promise<{
  agentLegStatus: string;
  agentLegDuration: number;
  legs: any[];
} | null> {
  try {
    // Fetch specific call with details=true to get Legs array
    const url = `https://api.exotel.com/v1/Accounts/${auth.sid}/Calls/${callSid}?details=true`;
    const response = await fetch(url, {
      headers: { Authorization: auth.authHeader },
    });

    if (!response.ok) {
      console.error(
        `[Exotel Legs] Failed to fetch call ${callSid}: ${response.status}`
      );
      return null;
    }

    const result = await response.json();

    console.log(
      `[Exotel Legs] Raw response for ${callSid}:`,
      JSON.stringify(result).slice(0, 1000)
    );

    // Parse legs from response
    // Response format: { Call: { Sid, Status, ..., Legs: [...] } }
    let legs: any[] = [];
    const callData = result?.Call || result;

    if (Array.isArray(callData?.Legs)) {
      legs = callData.Legs;
    } else if (callData?.Legs?.Leg) {
      // Handle { Legs: { Leg: {...} } } or { Legs: { Leg: [...] } }
      legs = Array.isArray(callData.Legs.Leg)
        ? callData.Legs.Leg
        : [callData.Legs.Leg];
    }

    // Also handle nested { Leg: {...} } inside array
    legs = legs.map((l: any) => l.Leg || l);

    console.log(`[Exotel Legs] CallSid=${callSid} found ${legs.length} legs`);
    if (legs.length > 0) {
      console.log(
        `[Exotel Legs] Leg data:`,
        JSON.stringify(legs).slice(0, 800)
      );
    }

    // No legs found = call never connected
    if (legs.length === 0) {
      return { agentLegStatus: "no-answer", agentLegDuration: 0, legs };
    }

    // For two-number connections:
    // Leg Id=0 or first leg = "From" (caller to ExoPhone)
    // Leg Id=1 or second leg = "To" (ExoPhone to agent)
    // The agent leg status tells us if the agent actually answered

    // Find the "To" leg (Id=1) or use the last leg
    const agentLeg =
      legs.find((l: any) => String(l.Id) === "1") || legs[legs.length - 1];

    if (!agentLeg) {
      // Only caller leg exists — agent was never dialed
      return { agentLegStatus: "no-answer", agentLegDuration: 0, legs };
    }

    // Get status from the agent leg
    const agentStatus = (
      (agentLeg.Status || agentLeg.status || "") as string
    ).toLowerCase();

    // OnCallDuration is the duration the leg was on call (in seconds)
    const agentDuration = parseInt(
      String(
        agentLeg.OnCallDuration ||
          agentLeg.Duration ||
          agentLeg.duration ||
          "0"
      ),
      10
    );

    console.log(
      `[Exotel Legs] Agent leg: Status=${agentStatus}, OnCallDuration=${agentDuration}`
    );

    return {
      agentLegStatus: agentStatus,
      agentLegDuration: agentDuration,
      legs,
    };
  } catch (error) {
    console.error(`[Exotel Legs] Error fetching legs for ${callSid}:`, error);
    return null;
  }
}
export async function POST(request: NextRequest) {
  try {
    const webhookToken =
      request.headers.get("x-exotel-token") ||
      new URL(request.url).searchParams.get("token");

    if (
      process.env.EXOTEL_WEBHOOK_TOKEN &&
      webhookToken !== process.env.EXOTEL_WEBHOOK_TOKEN
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body — Exotel sends form-urlencoded
    const contentType = request.headers.get("content-type") || "";
    let data: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } else {
      try {
        data = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
    }

    // Log raw webhook data for debugging
    console.log("[Exotel Webhook] Raw data:", JSON.stringify(data));

    const callSid = data.CallSid || data.callSid || data.sid;
    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    const callFrom =
      data.CallFrom || data.callFrom || data.From || data.from || "";
    const callTo = data.CallTo || data.callTo || data.To || data.to || "";
    const direction = (
      data.Direction ||
      data.direction ||
      data.CallType ||
      "inbound"
    )
      .toLowerCase()
      .includes("out")
      ? "outbound"
      : "inbound";
    const startTime =
      data.StartTime || data.startTime || data.CurrentTime || null;
    const endTime = data.EndTime || data.endTime || null;
    const recordingUrl = data.RecordingUrl || data.recordingUrl || null;

    const supabase = await createClient();
    const now = new Date().toISOString();

    // ── Fetch call legs to determine the REAL call outcome ──
    const auth = getExotelAuth();
    let status: string;
    let displayDuration: number;
    let conversationDuration = parseInt(
      data.ConversationDuration || data.conversationDuration || "0",
      10
    );
    let totalDuration = parseInt(data.Duration || data.duration || "0", 10);
    let rawResponse: Record<string, any> = { ...data };

    if (auth) {
      const legData = await fetchCallLegs(callSid, auth);

      if (legData) {
        // Use the agent leg's status — this is the truth
        const agentStatus = legData.agentLegStatus;
        if (agentStatus === "completed") {
          status = "completed";
          displayDuration = legData.agentLegDuration;
        } else if (agentStatus === "busy") {
          status = "busy";
          displayDuration = 0;
        } else if (agentStatus === "failed" || agentStatus === "canceled") {
          status = "failed";
          displayDuration = 0;
        } else {
          // "no-answer", "ringing", empty, or only 1 leg = missed
          status = "missed";
          displayDuration = 0;
        }

        // Include legs in raw response for debugging
        rawResponse = { ...data, _legs: legData.legs };

        console.log(
          `[Exotel Webhook] CallSid=${callSid} agentLegStatus=${agentStatus} → status=${status} duration=${displayDuration}`
        );
      } else {
        // Fallback: couldn't fetch legs, use webhook data with ConversationDuration logic
        const rawStatus = (data.Status || data.status || "").toLowerCase();

        status = resolveCallStatus(
          rawStatus,
          conversationDuration,
          totalDuration
        );
        displayDuration = conversationDuration || totalDuration;

        console.log(
          `[Exotel Webhook] CallSid=${callSid} no legs data, using fallback: status=${status} duration=${displayDuration}`
        );
      }
    } else {
      // No Exotel credentials configured, use fallback logic
      const rawStatus = (data.Status || data.status || "").toLowerCase();

      status = resolveCallStatus(
        rawStatus,
        conversationDuration,
        totalDuration
      );
      displayDuration = conversationDuration || totalDuration;

      console.log(
        `[Exotel Webhook] CallSid=${callSid} no auth configured, using fallback: status=${status} duration=${displayDuration}`
      );
    }

    // Try to match caller to a patient
    let callerName: string | null = null;
    let patientId: string | null = null;

    const phoneToSearch = direction === "inbound" ? callFrom : callTo;
    if (phoneToSearch) {
      const digits = phoneToSearch.replace(/\D/g, "").slice(-10);
      if (digits.length === 10) {
        const { data: patient } = await supabase
          .from("Patient")
          .select("id, fullName")
          .ilike("phone", `%${digits}`)
          .limit(1)
          .maybeSingle();

        if (patient) {
          callerName = patient.fullName;
          patientId = patient.id;
        }
      }
    }

    // Upsert by CallSid
    const { data: existing } = await supabase
      .from("CallLog")
      .select("id, status")
      .eq("exotelCallSid", callSid)
      .maybeSingle();

    if (existing) {
      // Only update if this is a "final" status (don't overwrite final with intermediate)
      const isFinalStatus = ["completed", "missed", "busy", "failed"].includes(
        status
      );
      const existingIsFinal = [
        "completed",
        "missed",
        "busy",
        "failed",
      ].includes(existing.status);

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
          .eq("id", existing.id);
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
      });
    }

    console.log(
      `[Exotel Webhook] CallSid=${callSid} status=${status} convDuration=${conversationDuration} totalDuration=${totalDuration}`
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Exotel Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

/**
 * Resolve the actual call outcome.
 * Exotel's "Status: completed" just means the call flow finished — NOT that someone answered.
 * We use ConversationDuration to distinguish answered vs missed.
 */
function resolveCallStatus(
  rawStatus: string,
  conversationDuration: number,
  totalDuration: number
): string {
  switch (rawStatus) {
    case "busy":
      return "busy";
    case "no-answer":
    case "noanswer":
      return "missed";
    case "failed":
    case "canceled":
      return "failed";
    case "completed":
      // "completed" = call flow finished. Check if anyone actually talked.
      // ConversationDuration > 0 means the agent picked up.
      if (conversationDuration > 0) return "completed";
      return "missed";
    case "in-progress":
    case "ringing":
      return "ringing";
    default:
      // If we have no recognized status but have duration info, infer from that
      if (totalDuration > 0 && conversationDuration === 0) return "missed";
      if (conversationDuration > 0) return "completed";
      return "ringing";
  }
}
