"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(`/dashboard/${json.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Shrike demo
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            CCTV incident drill
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Start a session, open the guard link on a second screen or device,
            then use the dashboard to simulate an incident or a clear feed and
            walk the full alert path end to end.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void startSession()}
          className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Starting…" : "Start demo session"}
        </button>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </main>
    </div>
  );
}
