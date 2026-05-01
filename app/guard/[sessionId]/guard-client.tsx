"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VapiVoice } from "@/components/vapi-voice";
import { recordSessionVisit } from "@/lib/recent-sessions";
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
  const [dismissIncoming, setDismissIncoming] = useState(false);
  const prevRingingRef = useRef(false);
  const ringtoneIndexRef = useRef(0);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceCallActiveRef = useRef(false);
  const ringtoneIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  const stopFallbackRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current !== null) {
      window.clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  }, []);

  const playFallbackBurst = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    gain.connect(ctx.destination);

    const low = ctx.createOscillator();
    low.type = "triangle";
    low.frequency.setValueAtTime(760, now);
    low.frequency.linearRampToValueAtTime(680, now + 0.24);
    low.connect(gain);
    low.start(now);
    low.stop(now + 0.25);

    const high = ctx.createOscillator();
    high.type = "sine";
    high.frequency.setValueAtTime(1120, now + 0.26);
    high.frequency.linearRampToValueAtTime(980, now + 0.5);
    high.connect(gain);
    high.start(now + 0.26);
    high.stop(now + 0.51);
  }, []);

  const startFallbackRingtone = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || ringtoneIntervalRef.current !== null) return;
    playFallbackBurst();
    ringtoneIntervalRef.current = window.setInterval(playFallbackBurst, 1200);
  }, [playFallbackBurst]);

  const stopAllRingtoneAudio = useCallback(() => {
    stopFallbackRingtone();
    disposeRingtone(ringtoneAudioRef);
  }, [stopFallbackRingtone]);

  const playSelectedRingtone = useCallback(() => {
    const audio = ringtoneAudioRef.current;
    if (!audio) {
      startFallbackRingtone();
      return;
    }
    void audio.play().then(stopFallbackRingtone).catch(startFallbackRingtone);
  }, [startFallbackRingtone, stopFallbackRingtone]);

  useEffect(() => {
    recordSessionVisit(sessionId);
  }, [sessionId]);

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
    voiceCallActiveRef.current = voiceCallActive;
  }, [voiceCallActive]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refresh().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const serverRinging =
    session?.status === "ringing" || session?.ring === "ringing";
  const ringing = serverRinging && !dismissIncoming;

  useEffect(() => {
    if (!serverRinging) {
      const id = setTimeout(() => setDismissIncoming(false), 0);
      return () => clearTimeout(id);
    }
  }, [serverRinging]);

  const endGuardCall = useCallback(async () => {
    setDismissIncoming(true);
    setVoiceCallActive(false);
    stopAllRingtoneAudio();
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
  }, [sessionId, refresh, stopAllRingtoneAudio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;

    const unlockAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AC();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      void ctx.resume().then(() => {
        audioUnlockedRef.current = true;
      }).catch(() => {});
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    unlockAudio();

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    const wasRinging = prevRingingRef.current;
    prevRingingRef.current = ringing;

    if (ringing && !wasRinging) {
      stopAllRingtoneAudio();
      const src =
        GUARD_RINGTONES[ringtoneIndexRef.current % GUARD_RINGTONES.length];
      ringtoneIndexRef.current += 1;
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.addEventListener("error", startFallbackRingtone);
      ringtoneAudioRef.current = audio;
      if (!voiceCallActiveRef.current) {
        playSelectedRingtone();
      }
    }

    if (!ringing && wasRinging) {
      stopAllRingtoneAudio();
      setVoiceCallActive(false);
    }
  }, [ringing, playSelectedRingtone, startFallbackRingtone, stopAllRingtoneAudio]);

  useEffect(() => {
    const audio = ringtoneAudioRef.current;
    if (ringing && !voiceCallActive) {
      playSelectedRingtone();
    } else {
      audio?.pause();
      stopFallbackRingtone();
    }
  }, [ringing, voiceCallActive, playSelectedRingtone, stopFallbackRingtone]);

  useEffect(() => {
    return () => {
      stopAllRingtoneAudio();
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx) {
        void ctx.close().catch(() => {});
      }
    };
  }, [stopAllRingtoneAudio]);

  const connected = voiceCallActive || session?.status === "connected";
  const showCallScreen = ringing || connected;
  const phoneApps = [
    "Messages",
    "Contacts",
    "Mail",
    "Camera",
    "Maps",
    "Notes",
    "Settings",
    "Browser",
    "Clock",
  ] as const;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <div className="font-mono text-[11px] text-zinc-300">11:56</div>
          <div className="font-mono text-[11px] text-zinc-400">Guard Phone</div>
          <div className="font-mono text-[11px] text-zinc-300">100%</div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4">
        {error ? (
          <p className="border border-red-600/50 bg-red-950/40 px-3 py-2 font-mono text-xs text-red-300">
            {error}
          </p>
        ) : null}

        {loading && !session ? (
          <p className="font-mono text-xs text-zinc-500">Connecting…</p>
        ) : null}

        {session &&
          (showCallScreen ? (
            <section className="flex min-h-[32rem] flex-1 flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Shrike Connect
                </p>
                <p
                  className={`mt-6 text-xs uppercase tracking-[0.18em] ${
                    ringing ? "text-amber-300" : "text-emerald-300"
                  }`}
                >
                  {ringing ? "Incoming call" : "Connected"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold">
                  {ringing ? "Answer call" : "On call"}
                </h1>
                <p className="mt-3 text-sm text-zinc-400">
                  {ringing
                    ? "Priority incident line is requesting connection."
                    : "Guard voice line active."}
                </p>
              </div>
              <div>
                <VapiVoice
                  relaySessionId={sessionId}
                  startLabel="Answer call"
                  endLabel="End call"
                  onCallStart={() => setVoiceCallActive(true)}
                  onCallEnd={() => void endGuardCall()}
                  containerClassName="items-stretch sm:items-stretch"
                  buttonClassName={`h-11 w-full rounded-xl text-sm font-semibold sm:w-full ${
                    ringing
                      ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                      : "bg-red-600 text-red-50 hover:bg-red-500 dark:bg-red-600 dark:text-red-50 dark:hover:bg-red-500"
                  }`}
                  errorClassName="text-red-300"
                  missingKeysClassName="text-zinc-400"
                />
              </div>
            </section>
          ) : (
            <section className="min-h-[32rem] rounded-xl border border-zinc-800 bg-gradient-to-b from-sky-700 via-sky-800 to-cyan-900 p-4">
              <div className="border-b border-sky-300/40 pb-3 text-center">
                <p className="text-lg font-medium text-sky-50">Home</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {phoneApps.map((app) => (
                  <div
                    key={app}
                    className="flex h-16 items-center justify-center rounded-xl border border-white/30 bg-white/20 px-1 text-center text-[11px] font-semibold text-white"
                  >
                    {app}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
