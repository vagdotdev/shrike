/** Lifecycle values from README; persisted mainly in `sessions.status`. */
export type SessionStatus =
  | "created"
  | "waiting_for_guard"
  | "processing"
  | "incident_detected"
  | "no_incident"
  | "ringing"
  | "not_rung"
  | "connected"
  | "resolved";

export type Session = {
  id: string;
  status: SessionStatus | string;
  incident: string | null;
  ring: string | null;
  video_path: string | null;
  decision_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SessionEvent = {
  id: string;
  session_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};
