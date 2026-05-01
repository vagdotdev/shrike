import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        status: "waiting_for_guard",
        incident: null,
        ring: null,
        video_path: null,
        decision_summary: null,
      })
      .select("id, status, incident, ring, created_at, updated_at")
      .single();

    if (error) {
      console.error("create session", error);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 },
      );
    }

    await supabase.from("session_events").insert({
      session_id: data.id,
      kind: "session_created",
      payload: { source: "api" },
    });

    return NextResponse.json({ session: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
