import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ sessionId: string }> };

type Body = { violence?: boolean };

export async function POST(req: Request, ctx: Ctx) {
  const { sessionId } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.violence !== "boolean") {
    return NextResponse.json(
      { error: "Expected { violence: boolean }" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();

  const { data: existing, error: fetchErr } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchErr) {
    console.error("simulate fetch", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error: procErr } = await supabase
    .from("sessions")
    .update({
      status: "processing",
      decision_summary: {
        mode: "simulation",
        violence: body.violence,
        at: new Date().toISOString(),
      },
    })
    .eq("id", sessionId);

  if (procErr) {
    console.error("simulate processing", procErr);
    return NextResponse.json({ error: procErr.message }, { status: 500 });
  }

  await supabase.from("session_events").insert({
    session_id: sessionId,
    kind: "simulation_processing",
    payload: { violence: body.violence },
  });

  if (body.violence) {
    const { error: finErr } = await supabase
      .from("sessions")
      .update({
        status: "ringing",
        incident: "incident_detected",
        ring: "ringing",
        decision_summary: {
          mode: "simulation",
          violence: true,
          outcome: "incident_detected",
          at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);

    if (finErr) {
      return NextResponse.json({ error: finErr.message }, { status: 500 });
    }

    await supabase.from("session_events").insert({
      session_id: sessionId,
      kind: "incident_simulated",
      payload: { ring: "ringing" },
    });
  } else {
    const { error: finErr } = await supabase
      .from("sessions")
      .update({
        status: "no_incident",
        incident: "none",
        ring: "not_rung",
        decision_summary: {
          mode: "simulation",
          violence: false,
          outcome: "no_incident",
          at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);

    if (finErr) {
      return NextResponse.json({ error: finErr.message }, { status: 500 });
    }

    await supabase.from("session_events").insert({
      session_id: sessionId,
      kind: "no_incident_simulated",
      payload: { ring: "not_rung" },
    });
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
