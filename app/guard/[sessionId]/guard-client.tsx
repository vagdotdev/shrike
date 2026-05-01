"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VapiVoice } from "@/components/vapi-voice";
import type { Session } from "@/lib/types";

const GUARD_RINGTONES = ["/media/walkie1.mp3", "/media/walkie2.mp3"] as const;

type Props = { sessionId: string };

function disposeRingtone(audioRef: { current: HTMLAudioElement | null }) {
  const a = audioRef.current;
  if (a) {
    a.pause();
    a.removeAttribute("src");
    a.load();
    audioRef.current = null;
  }
}

export function GuardClient({ sessionId }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  /** After the guard ends the voice call, hide ring UI and audio until the server stops ringing (or PATCH applies). */
  const [dismissIncoming, setDismissIncoming] = useState(false);
  const prevRingingRef = useRef(false);
  const ringtoneIndexRef = useRef(0);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceCallActiveRef = useRef(false);
  voiceCallActiveRef.current = voiceCallActive;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const json = (await res.json()) as { session?: Session; error?: string };
    if (!res.ok) {
      setError(json.error ?? res.statusText);
      setSession(null);
      return;
    }
    setError(null);
    setSession(json.session ?? null);
  }, [sessionId]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const serverRinging =
    session?.status === "ringing" || session?.ring === "ringing";
  const ringing = serverRinging && !dismissIncoming;

  useEffect(() => {
    if (!serverRinging) setDismissIncoming(false);
  }, [serverRinging]);

  const endGuardCall = useCallback(async () => {
    setDismissIncoming(true);
    setVoiceCallActive(false);
    disposeRingtone(ringtoneAudioRef);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guard_call_ended" }),
      });
      const json = (await res.json()) as { session?: Session; error?: string };
      if (res.ok && json.session) {
        setSession(json.session);
        setError(null);
      } else {
        setError(json.error ?? res.statusText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    await refresh();
  }, [sessionId, refresh]);

  useEffect(() => {
    const wasRinging = prevRingingRef.current;
    prevRingingRef.current = ringing;

    if (ringing && !wasRinging) {
      disposeRingtone(ringtoneAudioRef);
      const src = GUARD_RINGTONES[ringtoneIndexRef.current % GUARD_RINGTONES.length];
      ringtoneIndexRef.current += 1;
      const audio = new Audio(src);
      audio.loop = true;
      ringtoneAudioRef.current = audio;
      if (!voiceCallActiveRef.current) {
        void audio.play().catch(() => {});
      }
    }

    if (!ringing && wasRinging) {
      disposeRingtone(ringtoneAudioRef);
      setVoiceCallActive(false);
    }
  }, [ringing]);

  useEffect(() => {
    const audio = ringtoneAudioRef.current;
    if (!audio) return;
    if (ringing && !voiceCallActive) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [ringing, voiceCallActive]);

  useEffect(() => {
    return () => disposeRingtone(ringtoneAudioRef);
  }, []);
  const clear =
    session?.status === "no_incident" ||
    session?.incident === "none" ||
    session?.ring === "not_rung";
  const processing = session?.status === "processing";

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col gap-6 px-6 py-10 text-zinc-900 dark:text-zinc-50">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Guard handset
        </p>
        <h1 className="mt-1 text-xl font-semibold">Block feed</h1>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">{sessionId}</p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {loading && !session ? (
        <p className="text-center text-sm text-zinc-500">Connecting…</p>
      ) : null}

      {session && (
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-6 transition-colors ${
            ringing
              ? "border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/30"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          {ringing ? (
            <>
              <p className="text-center text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                Incoming alert
              </p>
              <p className="text-center text-base leading-snug text-red-900 dark:text-red-100">
                Possible inmate-on-inmate violence flagged on your block.
                Answer the line to connect with the assistant.
              </p>
              <div className="mt-2 border-t border-red-200 pt-4 dark:border-red-900">
                <VapiVoice
                  relaySessionId={sessionId}
                  startLabel="Answer voice line"
                  endLabel="End call"
                  onCallStart={() => setVoiceCallActive(true)}
                  onCallEnd={() => void endGuardCall()}
                />
              </div>
            </>
          ) : session?.status === "resolved" && !processing ? (
            <p className="text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Voice line ended. This alert is cleared and the feed is back on
              standby.
            </p>
          ) : clear && !processing ? (
            <p className="text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Feed is quiet. Latest check:{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                no incident
              </span>
              .
            </p>
          ) : (
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Standing by…
              {processing && (
                <span className="mt-2 block font-medium text-amber-700 dark:text-amber-400">
                  Processing simulation…
                </span>
              )}
            </p>
          )}

          <p className="text-center font-mono text-[10px] text-zinc-400">
            status: {session.status}
          </p>
        </div>
      )}

      <p className="text-center text-sm text-zinc-500">
        <Link href="/" className="underline-offset-2 hover:underline">
          Home
        </Link>
      </p>
    </div>
  );
}
