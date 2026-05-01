import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ sessionId: string }> };

type TranscriptBody = {
  role?: string;
  transcript?: string;
  transcriptType?: "partial" | "final";
  turn?: number;
};

export async function POST(req: Request, ctx: Ctx) {
  const { sessionId } = await ctx.params;

  let body: TranscriptBody;
  try {
    body = (await req.json()) as TranscriptBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const role = body.role;
  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  const transcriptType = body.transcriptType;
  const turn =
    typeof body.turn === "number" && Number.isFinite(body.turn)
      ? body.turn
      : null;

  if (role !== "assistant" && role !== "user") {
    return NextResponse.json(
      { error: "role must be \"assistant\" or \"user\"" },
      { status: 400 },
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "transcript must be a non-empty string" },
      { status: 400 },
    );
  }

  if (transcriptType !== "partial" && transcriptType !== "final") {
    return NextResponse.json(
      { error: "transcriptType must be \"partial\" or \"final\"" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();

  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessErr) {
    console.error("transcript session lookup", sessErr);
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error: insErr } = await supabase.from("session_events").insert({
    session_id: sessionId,
    kind: "vapi_transcript",
    payload: { role, transcript, transcriptType, turn },
  });

  if (insErr) {
    console.error("transcript insert", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
