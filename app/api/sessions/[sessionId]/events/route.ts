import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ sessionId: string }> };

const TRANSCRIPT_KIND = "vapi_transcript" as const;

export async function GET(_req: Request, ctx: Ctx) {
  const { sessionId } = await ctx.params;

  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("session_events")
      .select("id, session_id, kind, payload, created_at")
      .eq("session_id", sessionId)
      .eq("kind", TRANSCRIPT_KIND)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      console.error("session events list", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
