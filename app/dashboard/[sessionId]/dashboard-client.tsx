"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { foldVapiTranscriptEvents } from "@/lib/call-transcript";
import type { Session, SessionEvent } from "@/lib/types";

type Props = { sessionId: string };

export function DashboardClient({ sessionId }: Props) {
  const [violence, setViolence] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptEvents, setTranscriptEvents] = useState<SessionEvent[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

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
    const id = setTimeout(() => {
      void refresh().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const refreshTranscript = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/events`);
    const json = (await res.json()) as {
      events?: SessionEvent[];
      error?: string;
    };
    if (!res.ok) return;
    setTranscriptEvents(json.events ?? []);
  }, [sessionId]);

  const serverRinging =
    session?.status === "ringing" || session?.ring === "ringing";

  useEffect(() => {
    const ms = serverRinging ? 550 : 4000;
    const boot = setTimeout(() => void refreshTranscript(), 0);
    const t = setInterval(() => void refreshTranscript(), ms);
    return () => {
      clearTimeout(boot);
      clearInterval(t);
    };
  }, [refreshTranscript, serverRinging]);

  const { lines, live } = foldVapiTranscriptEvents(transcriptEvents);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length, live.assistant, live.user]);

  async function runSimulation() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violence }),
      });
      const json = (await res.json()) as { session?: Session; error?: string };
      if (!res.ok) {
        setError(json.error ?? res.statusText);
        return;
      }
      setSession(json.session ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  const guardPath = `/guard/${sessionId}`;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-12 text-zinc-900 dark:text-zinc-50">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Operator dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Demo session</h1>
        <p className="font-mono text-xs text-zinc-500">{sessionId}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Guard link
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Open this on another window or device so the guard sees live status.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={guardPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            Open guard page
          </Link>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(
                `${window.location.origin}${guardPath}`,
              )
            }
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Copy URL
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Live voice transcript
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Relays from the guard handset while the Vapi line is open. Assistant is
          the AI dispatcher; Guard is the officer on the line.
        </p>
        <div
          className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50"
          aria-live="polite"
        >
          {lines.length === 0 &&
          !live.assistant &&
          !live.user ? (
            <p className="text-zinc-500">
              No transcript yet. When the guard answers an alert, lines appear
              here in near real time.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li key={line.id}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {line.role === "assistant" ? "Assistant" : "Guard"}
                  </p>
                  <p className="mt-0.5 leading-snug text-zinc-800 dark:text-zinc-100">
                    {line.text}
                  </p>
                </li>
              ))}
              {live.assistant ? (
                <li>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Assistant · live
                  </p>
                  <p className="mt-0.5 italic leading-snug text-zinc-600 dark:text-zinc-400">
                    {live.assistant}
                  </p>
                </li>
              ) : null}
              {live.user ? (
                <li>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Guard · live
                  </p>
                  <p className="mt-0.5 italic leading-snug text-zinc-600 dark:text-zinc-400">
                    {live.user}
                  </p>
                </li>
              ) : null}
              <div ref={transcriptEndRef} />
            </ul>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Simulated detection
        </h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Instead of uploading video, pick what the vision pipeline would have
          concluded, then run it through the same session state updates and
          guard alerting path.
        </p>

        <div
          className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700"
          role="group"
          aria-label="Detection outcome"
        >
          <button
            type="button"
            onClick={() => setViolence(false)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              !violence
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            No violence
          </button>
          <button
            type="button"
            onClick={() => setViolence(true)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              violence
                ? "bg-red-600 text-white dark:bg-red-600"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            Violence
          </button>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={() => void runSimulation()}
          className="flex h-11 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {running ? "Running…" : "Run simulation"}
        </button>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Session status
        </h2>
        {loading && !session ? (
          <p className="mt-2 text-sm text-zinc-500">Loading…</p>
        ) : session ? (
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Status</dt>
              <dd className="font-mono text-xs">{session.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Incident</dt>
              <dd className="font-mono text-xs">{session.incident ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Ring</dt>
              <dd className="font-mono text-xs">{session.ring ?? "—"}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/" className="underline-offset-2 hover:underline">
          Home
        </Link>
      </p>
    </div>
  );
}
