"use client";

import { OpsMicroLabel, OpsPanel, OpsShell } from "@/components/ops-shell";
import {
  readRecentSessions,
  RECENT_SESSIONS_EVENT,
  recordSessionVisit,
} from "@/lib/recent-sessions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ReturnType<typeof readRecentSessions>>([]);

  useEffect(() => {
    const sync = () => setRecent(readRecentSessions());
    const boot = window.setTimeout(sync, 0);
    window.addEventListener(RECENT_SESSIONS_EVENT, sync);
    return () => {
      window.clearTimeout(boot);
      window.removeEventListener(RECENT_SESSIONS_EVENT, sync);
    };
  }, []);

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const json = (await res.json()) as {
        session?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.session?.id) {
        setError(json.error ?? "Could not create session");
        return;
      }
      recordSessionVisit(json.session.id);
      router.push(`/dashboard/${json.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsShell roleLabel="Command" missionLine="Session bootstrap">
      <div className="mx-auto max-w-xl">
        <OpsMicroLabel>Shrike · demo</OpsMicroLabel>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-text-primary">
          CCTV incident drill
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Start a session, open the guard link on a second screen or device,
          then simulate or run detection from the operator workspace and walk
          the alert path end to end.
        </p>

        <OpsPanel title="Actions" className="mt-8">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startSession()}
            className="flex h-10 w-full max-w-xs items-center justify-center border border-accent/50 bg-accent-surface px-4 text-xs font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start monitoring session"}
          </button>
          {error ? (
            <p className="border border-danger/40 bg-danger-surface px-3 py-2 font-mono text-xs text-danger">
              {error}
            </p>
          ) : null}
        </OpsPanel>

        <OpsPanel title="Session manager" className="mt-4">
          <p className="text-xs text-text-muted">
            Previous monitoring sessions (local workspace history).
          </p>
          <div className="max-h-56 overflow-auto border border-border-subtle">
            {recent.length === 0 ? (
              <p className="px-3 py-3 font-mono text-xs text-text-faint">
                No sessions yet.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {recent.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/dashboard/${entry.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-surface-2"
                    >
                      <span className="font-mono text-text-primary">{entry.id}</span>
                      <span className="font-mono text-[10px] text-text-faint">
                        {new Date(entry.at).toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </OpsPanel>
      </div>
    </OpsShell>
  );
}
