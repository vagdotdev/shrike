import type { SessionEvent } from "@/lib/types";

export type TranscriptFoldLine = {
  id: string;
  role: "assistant" | "user";
  text: string;
  at: string;
};

/** Replays Vapi transcript events in order into committed lines + current partials per role. */
export function foldVapiTranscriptEvents(events: SessionEvent[]): {
  lines: TranscriptFoldLine[];
  live: Partial<Record<"assistant" | "user", string>>;
} {
  const lines: TranscriptFoldLine[] = [];
  const live: Partial<Record<"assistant" | "user", string>> = {};

  for (const ev of events) {
    if (ev.kind !== "vapi_transcript" || !ev.payload) continue;
    const p = ev.payload as {
      role?: string;
      transcript?: string;
      transcriptType?: string;
    };
    const role = p.role;
    if (role !== "assistant" && role !== "user") continue;
    const text = typeof p.transcript === "string" ? p.transcript : "";
    if (p.transcriptType === "partial") {
      if (text) live[role] = text;
      else delete live[role];
    } else if (p.transcriptType === "final") {
      delete live[role];
      if (text) {
        lines.push({ id: ev.id, role, text, at: ev.created_at });
      }
    }
  }

  return { lines, live };
}
