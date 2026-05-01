import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ sessionId: string }> };

type PatchBody = { action?: string };

export async function PATCH(req: Request, ctx: Ctx) {
  const { sessionId } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "guard_call_ended") {
    return NextResponse.json(
      { error: "Unknown action. Use { \"action\": \"guard_call_ended\" }." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();

  const { data: existing, error: fetchErr } = await supabase
    .from("sessions")
    .select("id, status, ring")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchErr) {
    console.error("patch session fetch", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error: updErr } = await supabase
    .from("sessions")
    .update({
      status: "resolved",
      ring: "not_rung",
    })
    .eq("id", sessionId);

  if (updErr) {
    console.error("patch session update", updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supabase.from("session_events").insert({
    session_id: sessionId,
    kind: "guard_call_ended",
    payload: { previous_status: existing.status, previous_ring: existing.ring },
  });

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

export async function GET(_req: Request, ctx: Ctx) {
  const { sessionId } = await ctx.params;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id, status, incident, ring, video_path, decision_summary, created_at, updated_at",
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("get session", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
