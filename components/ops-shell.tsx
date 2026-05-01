"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  readRecentSessions,
  RECENT_SESSIONS_EVENT,
  recordSessionVisit,
} from "@/lib/recent-sessions";
import type { Session } from "@/lib/types";

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function OpsMicroLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
      {children}
    </p>
  );
}

export function OpsPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "ops-grid flex flex-col gap-3 border border-border-subtle bg-surface-1 p-4",
        className,
      )}
    >
      {title ? (
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

function sessionChips(session: Session | null | undefined) {
  if (!session) return null;
  const chips: Array<{ key: string; label: string; tone: "neutral" | "accent" | "warn" | "danger" }> = [];

  chips.push({
    key: "status",
    label: String(session.status).replace(/_/g, " "),
    tone:
      session.status === "ringing" || session.ring === "ringing"
        ? "warn"
        : session.status === "incident_detected"
          ? "danger"
          : session.status === "connected"
            ? "accent"
            : "neutral",
  });

  if (session.incident && session.incident !== "none") {
    const inc = session.incident.toLowerCase();
    const violent =
      inc.includes("violence") || inc.includes("violent") || inc === "true";
    chips.push({
      key: "incident",
      label: `incident · ${session.incident}`,
      tone: violent ? "danger" : "warn",
    });
  }

  if (session.ring && session.ring !== "not_rung") {
    chips.push({
      key: "ring",
      label: `ring · ${session.ring}`,
      tone: session.ring === "ringing" ? "warn" : "neutral",
    });
  }

  return chips.map((c) => (
    <span
      key={c.key}
      className={cx(
        "inline-flex max-w-[10rem] truncate border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        c.tone === "neutral" &&
          "border-border-subtle bg-surface-2 text-text-muted",
        c.tone === "accent" &&
          "border-accent/40 bg-accent-surface text-accent",
        c.tone === "warn" &&
          "border-warning/45 bg-warning-surface text-warning",
        c.tone === "danger" &&
          "border-danger/45 bg-danger-surface text-danger",
      )}
      title={c.label}
    >
      {c.label}
    </span>
  ));
}

type OpsShellProps = {
  /** e.g. Command, Operator, Guard */
  roleLabel: string;
  /** Short line under product name */
  missionLine?: string;
  sessionId?: string | null;
  session?: Session | null;
  /** Extra nodes in mission bar (e.g. loading) */
  barExtra?: ReactNode;
  children: ReactNode;
  /** When false, hide new-session + recent (e.g. minimal) */
  showSessionRail?: boolean;
  /** Hide left rail on small screens (phone-first surfaces like guard). */
  hideRailOnMobile?: boolean;
};

export function OpsShell({
  roleLabel,
  missionLine,
  sessionId,
  session,
  barExtra,
  children,
  showSessionRail = true,
  hideRailOnMobile = false,
}: OpsShellProps) {
  const router = useRouter();
  const [recent, setRecent] = useState<ReturnType<typeof readRecentSessions>>([]);
  const [creating, setCreating] = useState(false);

  const refreshRecent = useCallback(() => {
    setRecent(readRecentSessions());
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => refreshRecent(), 0);
    window.addEventListener(RECENT_SESSIONS_EVENT, refreshRecent);
    return () => {
      window.clearTimeout(boot);
      window.removeEventListener(RECENT_SESSIONS_EVENT, refreshRecent);
    };
  }, [refreshRecent]);

  async function newSession() {
    setCreating(true);
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const json = (await res.json()) as {
        session?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.session?.id) return;
      recordSessionVisit(json.session.id);
      router.push(`/dashboard/${json.session.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 bg-surface-0 text-text-primary">
      <aside
        className={cx(
          "ops-grid flex w-14 shrink-0 flex-col items-center border-r border-border-subtle bg-surface-1 py-3",
          hideRailOnMobile && "hidden sm:flex",
        )}
        aria-label="Primary navigation"
      >
        <Link
          href="/"
          title="Home"
          className="ops-reticle flex h-10 w-10 items-center justify-center border border-transparent text-text-muted transition-colors hover:border-accent/55 hover:bg-accent-surface hover:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path d="M12 3.5 4 9v10.5h16V9l-8-5.5Z" />
            <path d="M9.5 13.5h5v6h-5z" />
          </svg>
        </Link>
        {showSessionRail ? (
          <>
            <button
              type="button"
              title="Start new session"
              disabled={creating}
              onClick={() => void newSession()}
              className="ops-reticle mt-3 flex h-10 w-10 items-center justify-center border border-border-subtle bg-surface-2 text-text-primary transition-colors hover:border-accent/60 hover:bg-accent-surface hover:text-accent disabled:opacity-50"
            >
              {creating ? (
                <span className="font-mono text-xs">…</span>
              ) : (
                <span className="text-lg font-light leading-none">+</span>
              )}
            </button>
            <div
              className="mt-4 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1"
              title="Recent sessions"
            >
              {recent.map((e) => (
                <Link
                  key={e.id}
                  href={`/dashboard/${e.id}`}
                  title={e.id}
                  className="ops-reticle flex h-9 w-9 shrink-0 items-center justify-center border border-border-subtle bg-surface-0 font-mono text-[9px] font-semibold text-text-muted transition-colors hover:border-accent/55 hover:text-accent"
                >
                  {e.id.slice(0, 4)}
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="ops-grid flex h-12 shrink-0 items-center gap-4 border-b border-border-subtle bg-surface-1 px-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-bold tracking-[0.12em] text-text-muted uppercase">
                Shrike
              </span>
              <span className="text-[11px] text-text-faint">/</span>
              <span className="text-xs font-medium text-text-primary">
                {roleLabel}
              </span>
              {missionLine ? (
                <>
                  <span className="text-[11px] text-text-faint">·</span>
                  <span className="truncate text-[11px] text-text-muted">
                    {missionLine}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {sessionId ? (
            <code className="hidden max-w-[14rem] truncate font-mono text-[10px] text-text-faint sm:block font-tabular">
              {sessionId}
            </code>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {sessionChips(session)}
            {barExtra}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
