import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

type WebhookBody = {
  sessionId?: string;
  violenceDetected?: boolean;
  confidence?: number;
  sourceType?: string;
  eventId?: string;
};

export async function POST(req: Request) {
  const secret = process.env.ROBOFLOW_WEBHOOK_SECRET;
  const headerSecret = req.headers.get("x-roboflow-secret");
  if (secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.violenceDetected !== "boolean") {
    return NextResponse.json(
      { error: "Expected { sessionId, violenceDetected }" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const { data: existing, error: fetchErr } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", body.sessionId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const outcome = body.violenceDetected ? "incident_detected" : "no_incident";
  const ring = body.violenceDetected ? "ringing" : "not_rung";
  const nextStatus = body.violenceDetected ? "ringing" : "no_incident";

  const { error: updErr } = await supabase
    .from("sessions")
    .update({
      status: nextStatus,
      incident: outcome,
      ring,
      decision_summary: {
        mode: "roboflow",
        sourceType: body.sourceType ?? null,
        confidence:
          typeof body.confidence === "number" && Number.isFinite(body.confidence)
            ? body.confidence
            : null,
        outcome,
        via: "webhook",
        at: new Date().toISOString(),
      },
    })
    .eq("id", body.sessionId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("session_events").insert({
    session_id: body.sessionId,
    kind: "roboflow_webhook_result",
    payload: {
      eventId: body.eventId ?? null,
      violenceDetected: body.violenceDetected,
      confidence: body.confidence ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
