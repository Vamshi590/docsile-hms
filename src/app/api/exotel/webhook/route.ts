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
function mapLeg2StatusToDbStatus(
  leg2Status: string | null | undefined
): { status: string; duration: number } {
  const status = (leg2Status || "").toLowerCase().trim();

  switch (status) {
    case "completed":
      // Call was answered and ended normally
      return { status: "completed", duration: -1 }; // -1 means use actual duration
    case "busy":
      // Caller received busy signal
      return { status: "busy", duration: 0 };
    case "no-answer":
    case "noanswer":
      // Call ended without being answered
      return { status: "missed", duration: 0 };
    case "failed":
      // Call could not be completed (non-existent number, etc.)
      return { status: "failed", duration: 0 };
    case "canceled":
      // Call was canceled while queued or ringing
      return { status: "missed", duration: 0 };
    case "":
    case "null":
    default:
      // No second leg or unknown status = missed
      return { status: "missed", duration: 0 };
  }
}

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
 * Fetch call details to get Leg2Status.
 *
 * Uses the Exotel API with ?details=true to get leg information.
 * See: https://developer.exotel.com/api/make-a-call-api#call-details
 *
 * Response structure includes:
 * - Details.Leg1Status: Status of first leg (caller to ExoPhone)
 * - Details.Leg2Status: Status of second leg (ExoPhone to agent) - THIS is what we need
 * - Details.ConversationDuration: Duration of actual conversation
 * - Details.Legs[]: Array of leg objects with OnCallDuration
 *
 * Returns the Leg2Status and duration, or null if fetch fails.
 */
async function fetchCallDetails(
  callSid: string,
  auth: { sid: string; authHeader: string }
): Promise<{
  leg2Status: string | null;
  leg1Status: string | null;
  conversationDuration: number;
  details: any;
} | null> {
  try {
    // Fetch specific call with details=true to get Leg2Status
    const url = `https://api.exotel.com/v1/Accounts/${auth.sid}/Calls/${callSid}?details=true`;
    const response = await fetch(url, {
      headers: { Authorization: auth.authHeader },
    });

    if (!response.ok) {
      console.error(
        `[Exotel Details] Failed to fetch call ${callSid}: ${response.status}`
      );
      return null;
    }

    const result = await response.json();
    const callData = result?.Call || result;

    console.log(
      `[Exotel Details] Raw response for ${callSid}:`,
      JSON.stringify(callData).slice(0, 1500)
    );

    // Extract Details object which contains Leg1Status, Leg2Status, ConversationDuration
    const details = callData?.Details || {};
    const leg1Status = details.Leg1Status || null;
    const leg2Status = details.Leg2Status || null;
    const conversationDuration = parseInt(
      String(details.ConversationDuration || "0"),
      10
    );

    console.log(
      `[Exotel Details] CallSid=${callSid} Leg1Status="${leg1Status}" Leg2Status="${leg2Status}" ConversationDuration=${conversationDuration}`
    );

    return {
      leg2Status,
      leg1Status,
      conversationDuration,
      details,
    };
  } catch (error) {
    console.error(
      `[Exotel Details] Error fetching details for ${callSid}:`,
      error
    );
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
      const callDetails = await fetchCallDetails(callSid, auth);

      if (callDetails && callDetails.leg2Status !== null) {
        // Use Leg2Status from Details — this is the truth
        // Map Leg 2 status according to Exotel documentation
        const mappedStatus = mapLeg2StatusToDbStatus(callDetails.leg2Status);
        status = mappedStatus.status;

        // If status is completed, use conversation duration; otherwise 0
        if (mappedStatus.duration === -1) {
          displayDuration = callDetails.conversationDuration;
        } else {
          displayDuration = mappedStatus.duration;
        }

        // Include details in raw response for debugging
        rawResponse = {
          ...data,
          _details: callDetails.details,
          _leg2Status: callDetails.leg2Status,
        };

        console.log(
          `[Exotel Webhook] CallSid=${callSid} Leg2Status="${callDetails.leg2Status}" → dbStatus="${status}" duration=${displayDuration}`
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
