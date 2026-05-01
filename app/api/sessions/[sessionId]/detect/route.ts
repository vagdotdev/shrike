import { NextResponse } from "next/server";
import { runRoboflowDetection } from "@/lib/roboflow";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { RoboflowSourceType } from "@/lib/types";

type Ctx = { params: Promise<{ sessionId: string }> };

type Body = {
  sourceType?: RoboflowSourceType;
  streamUrl?: string;
  imageBase64?: string;
  videoBase64?: string;
  mimeType?: string;
};

function sourcePayloadValid(body: Body): boolean {
  if (body.sourceType === "stream_url") return typeof body.streamUrl === "string";
  if (body.sourceType === "upload" || body.sourceType === "camera") {
    return (
      typeof body.imageBase64 === "string" || typeof body.videoBase64 === "string"
    );
  }
  return false;
}

export async function POST(req: Request, ctx: Ctx) {
  const { sessionId } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    body.sourceType !== "upload" &&
    body.sourceType !== "camera" &&
    body.sourceType !== "stream_url"
  ) {
    return NextResponse.json(
      { error: "Expected sourceType: upload | camera | stream_url" },
      { status: 400 },
    );
  }

  if (!sourcePayloadValid(body)) {
    return NextResponse.json(
      { error: "Missing source payload for selected sourceType" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const { data: existing, error: fetchErr } = await supabase
    .from("sessions")
    .select("id, status, decision_summary")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchErr) {
    console.error("detect fetch", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (existing.status === "processing") {
    return NextResponse.json(
      {
        error:
          "A detection flow is already running for this session. Wait for it to finish.",
      },
      { status: 409 },
    );
  }

  const startedAt = new Date().toISOString();
  const { error: procErr } = await supabase
    .from("sessions")
    .update({
      status: "processing",
      decision_summary: {
        mode: "roboflow",
        sourceType: body.sourceType,
        phase: "processing",
        at: startedAt,
      },
    })
    .eq("id", sessionId);

  if (procErr) {
    console.error("detect processing", procErr);
    return NextResponse.json({ error: procErr.message }, { status: 500 });
  }

  await supabase.from("session_events").insert({
    session_id: sessionId,
    kind: "roboflow_processing",
    payload: { sourceType: body.sourceType, startedAt },
  });

  try {
    const result = await runRoboflowDetection({
      sessionId,
      sourceType: body.sourceType,
      streamUrl: body.streamUrl,
      imageBase64: body.imageBase64,
      videoBase64: body.videoBase64,
      mimeType: body.mimeType,
    });

    const outcome = result.violenceDetected ? "incident_detected" : "no_incident";
    const ring = result.violenceDetected ? "ringing" : "not_rung";
    const nextStatus = result.violenceDetected ? "ringing" : "no_incident";

    const { error: finErr } = await supabase
      .from("sessions")
      .update({
        status: nextStatus,
        incident: outcome,
        ring,
        decision_summary: {
          mode: "roboflow",
          sourceType: body.sourceType,
          confidence: result.confidence,
          outcome,
          at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);

    if (finErr) {
      console.error("detect final update", finErr);
      return NextResponse.json({ error: finErr.message }, { status: 500 });
    }

    await supabase.from("session_events").insert({
      session_id: sessionId,
      kind: result.violenceDetected ? "incident_detected" : "no_incident_detected",
      payload: {
        mode: "roboflow",
        sourceType: body.sourceType,
        confidence: result.confidence,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Roboflow request failed";
    await supabase
      .from("sessions")
      .update({
        status: "created",
        decision_summary: {
          mode: "roboflow",
          sourceType: body.sourceType,
          phase: "failed",
          error: message,
          at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: session, error: readErr } = await supabase
    .from("sessions")
    .select(
      "id, status, incident, ring, video_path, decision_summary, created_at, updated_at",
    )
    .eq("id", sessionId)
    .single();

  if (readErr || !session) {
    return NextResponse.json(
      { error: readErr?.message ?? "Read failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ session });
}
