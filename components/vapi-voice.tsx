"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";

type CallState = "idle" | "connecting" | "active" | "error";

type VapiVoiceProps = {
  /** Primary action when idle (default: Start voice) */
  startLabel?: string;
  /** Label while in an active call (default: End call) */
  endLabel?: string;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  /** When set, transcript lines are POSTed for the operator dashboard. */
  relaySessionId?: string | null;
};

const PARTIAL_DEBOUNCE_MS = 320;

async function postTranscriptChunk(
  sessionId: string,
  body: {
    role: "assistant" | "user";
    transcript: string;
    transcriptType: "partial" | "final";
    turn?: number;
  },
) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      console.warn("transcript relay failed", res.status, j.error ?? res.statusText);
    }
  } catch (e) {
    console.warn("transcript relay error", e);
  }
}

export function VapiVoice({
  startLabel,
  endLabel,
  onCallStart,
  onCallEnd,
  relaySessionId,
}: VapiVoiceProps) {
  const vapiRef = useRef<Vapi | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const onCallStartRef = useRef(onCallStart);
  const onCallEndRef = useRef(onCallEnd);
  const relaySessionIdRef = useRef(relaySessionId);

  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPartialRef = useRef<{
    role: "assistant" | "user";
    transcript: string;
    turn?: number;
  } | null>(null);

  const flushPendingPartial = useCallback(() => {
    const sid = relaySessionIdRef.current;
    const pending = pendingPartialRef.current;
    pendingPartialRef.current = null;
    if (!sid || !pending?.transcript.trim()) return;
    void postTranscriptChunk(sid, {
      role: pending.role,
      transcript: pending.transcript,
      transcriptType: "partial",
      turn: pending.turn,
    });
  }, []);

  const clearPartialDebounce = useCallback(() => {
    if (partialTimerRef.current) {
      clearTimeout(partialTimerRef.current);
      partialTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    onCallStartRef.current = onCallStart;
    onCallEndRef.current = onCallEnd;
    relaySessionIdRef.current = relaySessionId;
  }, [onCallStart, onCallEnd, relaySessionId]);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  useEffect(() => {
    if (!publicKey) return;

    let cancelled = false;

    void (async () => {
      const { default: VapiCtor } = await import("@vapi-ai/web");
      if (cancelled) return;

      const vapi = new VapiCtor(publicKey);
      vapi.on("call-start", () => {
        setCallState("active");
        onCallStartRef.current?.();
      });
      vapi.on("call-end", () => {
        clearPartialDebounce();
        flushPendingPartial();
        setCallState("idle");
        onCallEndRef.current?.();
      });
      vapi.on("message", (m: unknown) => {
        if (process.env.NODE_ENV === "development") {
          console.log("message", m);
        }
        const sid = relaySessionIdRef.current;
        if (!sid || !m || typeof m !== "object") return;
        const msg = m as {
          type?: string;
          role?: string;
          transcript?: string;
          transcriptType?: string;
          turn?: number;
        };
        if (msg.type !== "transcript") return;
        if (msg.role !== "assistant" && msg.role !== "user") return;
        const transcript =
          typeof msg.transcript === "string" ? msg.transcript : "";
        const tt = msg.transcriptType;
        if (tt !== "partial" && tt !== "final") return;

        const role = msg.role;
        const turn =
          typeof msg.turn === "number" && Number.isFinite(msg.turn)
            ? msg.turn
            : undefined;

        if (tt === "final") {
          clearPartialDebounce();
          pendingPartialRef.current = null;
          void postTranscriptChunk(sid, {
            role,
            transcript,
            transcriptType: "final",
            turn,
          });
          return;
        }

        pendingPartialRef.current = { role, transcript, turn };
        clearPartialDebounce();
        partialTimerRef.current = setTimeout(() => {
          partialTimerRef.current = null;
          flushPendingPartial();
        }, PARTIAL_DEBOUNCE_MS);
      });
      vapi.on("error", (e) => {
        console.error("vapi error", e);
        setCallState("error");
      });

      vapiRef.current = vapi;
      setSdkReady(true);
    })();

    return () => {
      cancelled = true;
      clearPartialDebounce();
      flushPendingPartial();
      const v = vapiRef.current;
      vapiRef.current = null;
      setSdkReady(false);
      if (v) void v.stop();
    };
  }, [publicKey, clearPartialDebounce, flushPendingPartial]);

  const handleClick = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi || !assistantId) return;

    if (callState === "active" || callState === "connecting") {
      clearPartialDebounce();
      flushPendingPartial();
      await vapi.stop();
      setCallState("idle");
      return;
    }

    setCallState("connecting");
    try {
      await vapi.start(assistantId);
    } catch (e) {
      console.error(e);
      setCallState("error");
    }
  }, [
    assistantId,
    callState,
    clearPartialDebounce,
    flushPendingPartial,
  ]);

  if (!publicKey || !assistantId) {
    return (
      <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Add{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-900">
          NEXT_PUBLIC_VAPI_PUBLIC_KEY
        </code>{" "}
        and{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-900">
          NEXT_PUBLIC_VAPI_ASSISTANT_ID
        </code>{" "}
        to <span className="font-mono text-xs">.env.local</span> to enable voice.
      </p>
    );
  }

  const busy = callState === "connecting" || !sdkReady;
  const label =
    callState === "active"
      ? (endLabel ?? "End call")
      : callState === "connecting"
        ? "Connecting…"
        : callState === "error"
          ? "Try again"
          : (startLabel ?? "Start voice");

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-start">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy && callState !== "active"}
        className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto"
      >
        {label}
      </button>
      {callState === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Something went wrong. Check the browser console and your Vapi
          dashboard.
        </p>
      )}
    </div>
  );
}
