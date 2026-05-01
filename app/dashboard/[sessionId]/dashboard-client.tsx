"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { OpsPanel, OpsShell } from "@/components/ops-shell";
import { foldVapiTranscriptEvents } from "@/lib/call-transcript";
import { recordSessionVisit } from "@/lib/recent-sessions";
import type {
  DetectionMode,
  RoboflowSourceType,
  Session,
  SessionEvent,
} from "@/lib/types";

type Props = { sessionId: string };

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function DashboardClient({ sessionId }: Props) {
  const [violence, setViolence] = useState(false);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("roboflow");
  const [sourceType, setSourceType] = useState<RoboflowSourceType>("upload");
  const [streamUrl, setStreamUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFrame, setCameraFrame] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [runningRoboflow, setRunningRoboflow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuardQr, setShowGuardQr] = useState(false);
  const [transcriptEvents, setTranscriptEvents] = useState<SessionEvent[]>([]);
  const [ayanMode, setAyanMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("shrike.ayan-mode") === "on";
  });
  const [ayanStepIndex, setAyanStepIndex] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const detectionModeRef = useRef<HTMLSelectElement | null>(null);
  const violenceButtonRef = useRef<HTMLButtonElement | null>(null);
  const runSimulationButtonRef = useRef<HTMLButtonElement | null>(null);
  const qrButtonRef = useRef<HTMLButtonElement | null>(null);
  const sessionStatusRef = useRef<HTMLDivElement | null>(null);
  const transcriptPanelRef = useRef<HTMLDivElement | null>(null);

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
  const connected =
    session?.status === "connected" || session?.ring === "connected";

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
  const hasLiveConversation =
    connected || lines.length > 0 || Boolean(live.assistant || live.user);

  const ayanSteps = [
    {
      id: "select-simulation",
      title: "Select simulation fallback",
      detail:
        "First switch Detection Mode to Simulation fallback. We use this to run a safe guided demo without needing a live feed.",
      target: "detectionMode" as const,
      done: detectionMode === "simulation",
    },
    {
      id: "select-violence",
      title: "Choose Violence",
      detail:
        "In Simulation fallback, click Violence so the workflow triggers the urgent guard escalation path.",
      target: "violenceToggle" as const,
      done: violence,
    },
    {
      id: "run-simulation",
      title: "Run simulation",
      detail:
        "Now click Run simulation. This updates the session and starts the alert pipeline for the guard.",
      target: "runSimulation" as const,
      done: session?.incident === "violence" || session?.status === "ringing",
    },
    {
      id: "open-qr",
      title: "Show QR and scan with phone",
      detail:
        "Click the QR icon in Guard link, then scan it from the guard phone to open the guard screen.",
      target: "qrButton" as const,
      done: showGuardQr,
    },
    {
      id: "wait-pickup",
      title: "Wait for pickup call",
      detail:
        "Keep the guard page open on the phone and wait for the incoming call state. Then answer on the guard device.",
      target: "sessionStatus" as const,
      done: serverRinging || connected,
    },
    {
      id: "speak-agent",
      title: "Speak to the agent",
      detail:
        "Once connected, speak to the agent from the guard side. Watch this transcript panel to confirm two-way conversation.",
      target: "transcript" as const,
      done: hasLiveConversation,
    },
  ];

  const ayanStep = ayanSteps[Math.min(ayanStepIndex, ayanSteps.length - 1)];

  function highlightIf(stepTarget: (typeof ayanStep)["target"]) {
    return ayanMode && ayanStep?.target === stepTarget
      ? "ring-2 ring-warning ring-offset-2 ring-offset-surface-1"
      : "";
  }

  function setAyanModeEnabled(enabled: boolean) {
    setAyanMode(enabled);
    setAyanStepIndex(0);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("shrike.ayan-mode", enabled ? "on" : "off");
    }
  }

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length, live.assistant, live.user]);

  useEffect(() => {
    if (!ayanMode) return;
    if (!ayanStep?.done) return;
    if (ayanStepIndex >= ayanSteps.length - 1) return;
    const id = window.setTimeout(() => {
      setAyanStepIndex((prev) => Math.min(prev + 1, ayanSteps.length - 1));
    }, 300);
    return () => window.clearTimeout(id);
  }, [ayanMode, ayanStep?.done, ayanStepIndex, ayanSteps.length]);

  useEffect(() => {
    if (!ayanMode) return;
    const targetMap = {
      detectionMode: detectionModeRef.current,
      violenceToggle: violenceButtonRef.current,
      runSimulation: runSimulationButtonRef.current,
      qrButton: qrButtonRef.current,
      sessionStatus: sessionStatusRef.current,
      transcript: transcriptPanelRef.current,
    };
    const el = targetMap[ayanStep.target];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ayanMode, ayanStep.target, ayanStepIndex]);

  const anyRunActive = runningSimulation || runningRoboflow;

  const stopCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const showLiveCamera =
    detectionMode === "roboflow" && sourceType === "camera" && cameraActive;

  useEffect(() => {
    const el = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    if (el && stream && showLiveCamera) {
      el.srcObject = stream;
    }
  }, [showLiveCamera, cameraActive]);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start camera");
    }
  }

  function captureCameraFrame() {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera is not ready yet");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Unable to capture camera frame");
      return;
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1] ?? null;
    setCameraFrame(base64);
  }

  async function fileToBase64(file: File) {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 1)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function runSimulation() {
    setRunningSimulation(true);
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
      setRunningSimulation(false);
    }
  }

  async function runRoboflow() {
    setRunningRoboflow(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { sourceType };
      if (sourceType === "stream_url") {
        if (!streamUrl.trim()) {
          setError("Stream URL is required");
          return;
        }
        payload.streamUrl = streamUrl.trim();
      } else if (sourceType === "upload") {
        if (!uploadFile) {
          setError("Choose a file first");
          return;
        }
        payload.videoBase64 = await fileToBase64(uploadFile);
        payload.mimeType = uploadFile.type || "application/octet-stream";
      } else {
        if (!cameraFrame) {
          setError("Capture a camera frame first");
          return;
        }
        payload.imageBase64 = cameraFrame;
        payload.mimeType = "image/jpeg";
      }

      const res = await fetch(`/api/sessions/${sessionId}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setRunningRoboflow(false);
    }
  }

  const guardPath = `/guard/${sessionId}`;
  const guardQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    typeof window === "undefined"
      ? guardPath
      : `${window.location.origin}${guardPath}`,
  )}`;

  const btnBase =
    "inline-flex items-center justify-center border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-surface-3 disabled:opacity-50";
  const btnPrimary =
    "inline-flex h-10 items-center justify-center border border-accent/50 bg-accent-surface px-4 text-xs font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/20 disabled:opacity-50";
  const btnNeutral =
    "inline-flex h-10 items-center justify-center border border-border-strong bg-surface-2 px-4 text-xs font-semibold uppercase tracking-wide text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50";

  return (
    <OpsShell
      roleLabel="Operator"
      missionLine="Live workspace"
      sessionId={sessionId}
      session={session}
      barExtra={
        loading && !session ? (
          <span className="font-mono text-[10px] text-text-faint">sync…</span>
        ) : null
      }
    >
      <div className="mx-auto flex min-h-0 max-w-[1600px] flex-col gap-4 lg:flex-row lg:gap-0 lg:divide-x lg:divide-border-subtle">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:pr-4">
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="ops-reticle border border-danger/55 bg-danger-surface px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-danger">
                Threat
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {session?.incident && session.incident !== "none"
                  ? session.incident
                  : "none"}
              </p>
            </div>
            <div className="ops-reticle border border-accent/55 bg-accent-surface px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-accent">
                Intel
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {session?.status ?? "syncing"}
              </p>
            </div>
            <div className="ops-reticle border border-warning/55 bg-warning-surface px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-warning">
                Queue
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {serverRinging ? "ringing" : "standby"}
              </p>
            </div>
          </section>

          <OpsPanel title="Guard link" className="relative">
            <p className="text-xs leading-relaxed text-text-muted">
              Open on another display so the guard sees live status.
            </p>
            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
              <Link
                href={guardPath}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(btnBase, "border-accent/30 text-accent")}
              >
                Open guard phone
              </Link>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(
                    `${window.location.origin}${guardPath}`,
                  )
                }
                className={btnBase}
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => setShowGuardQr((open) => !open)}
                aria-label="Show guard link QR code"
                aria-expanded={showGuardQr}
                aria-controls="guard-link-qr"
                ref={qrButtonRef}
                className={cx(
                  btnBase,
                  "ml-auto h-9 w-9 p-0",
                  highlightIf("qrButton"),
                )}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3v3h-3zM17 17h4M14 20h3M20 14v3" />
                </svg>
              </button>
              {showGuardQr ? (
                <>
                  <button
                    type="button"
                    aria-label="Close QR popover"
                    className="fixed inset-0 z-10 cursor-default bg-black/40"
                    onClick={() => setShowGuardQr(false)}
                  />
                  <div
                    id="guard-link-qr"
                    className="absolute right-3 top-full z-20 mt-2 border border-border-subtle bg-surface-1 p-2 shadow-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- external QR API */}
                    <img
                      src={guardQrUrl}
                      alt="QR code for the guard link"
                      className="h-36 w-36"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </OpsPanel>

          <OpsPanel title="Detection">
            <p className="text-xs leading-relaxed text-text-muted">
              Roboflow is primary; simulation is a fallback. Runs are mutually
              exclusive while active.
            </p>
            <select
              ref={detectionModeRef}
              value={detectionMode}
              onChange={(e) => {
                const next = e.target.value as DetectionMode;
                if (next !== "roboflow") stopCamera();
                setDetectionMode(next);
              }}
              disabled={anyRunActive}
              className={cx(
                "h-9 w-full max-w-md border border-border-subtle bg-surface-0 px-2 font-mono text-xs text-text-primary",
                highlightIf("detectionMode"),
              )}
            >
              <option value="roboflow">Roboflow</option>
              <option value="simulation">Simulation fallback</option>
            </select>

            <div
              className={cx(
                "flex flex-col gap-3 border p-3",
                detectionMode === "roboflow"
                  ? "border-accent/40 bg-accent-surface/30"
                  : "border-border-subtle opacity-60",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Roboflow
              </p>
              <select
                value={sourceType}
                onChange={(e) => {
                  const next = e.target.value as RoboflowSourceType;
                  if (next !== "camera") stopCamera();
                  setSourceType(next);
                }}
                disabled={detectionMode !== "roboflow" || anyRunActive}
                className="h-9 border border-border-subtle bg-surface-0 px-2 font-mono text-xs"
              >
                <option value="upload">Upload video</option>
                <option value="camera">Live camera</option>
                <option value="stream_url">Stream URL</option>
              </select>

              {sourceType === "upload" ? (
                <input
                  type="file"
                  accept="video/*,image/*"
                  disabled={detectionMode !== "roboflow" || anyRunActive}
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-text-muted file:mr-2 file:border file:border-border-subtle file:bg-surface-2 file:px-2 file:py-1 file:text-xs"
                />
              ) : null}

              {sourceType === "stream_url" ? (
                <input
                  type="url"
                  placeholder="https://example.com/stream.m3u8"
                  value={streamUrl}
                  disabled={detectionMode !== "roboflow" || anyRunActive}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="h-9 border border-border-subtle bg-surface-0 px-2 font-mono text-xs"
                />
              ) : null}

              {sourceType === "camera" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={detectionMode !== "roboflow" || anyRunActive}
                      onClick={() =>
                        void (cameraActive ? stopCamera() : startCamera())
                      }
                      className={btnBase}
                    >
                      {cameraActive ? "Stop camera" : "Start camera"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        detectionMode !== "roboflow" ||
                        anyRunActive ||
                        !cameraActive
                      }
                      onClick={captureCameraFrame}
                      className={btnBase}
                    >
                      Capture frame
                    </button>
                  </div>
                  {cameraFrame ? (
                    <p className="font-mono text-[10px] text-text-faint">
                      Frame buffered.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                disabled={detectionMode !== "roboflow" || anyRunActive}
                onClick={() => void runRoboflow()}
                className={btnPrimary}
              >
                {runningRoboflow ? "Running Roboflow…" : "Run Roboflow"}
              </button>
            </div>

            <div
              className={cx(
                "flex flex-col gap-3 border p-3",
                detectionMode === "simulation"
                  ? "border-warning/45 bg-warning-surface/40"
                  : "border-border-subtle opacity-60",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Simulation fallback
              </p>
              <div
                className="flex border border-border-subtle p-0.5"
                role="group"
                aria-label="Detection outcome"
              >
                <button
                  ref={violenceButtonRef}
                  type="button"
                  disabled={detectionMode !== "simulation" || anyRunActive}
                  onClick={() => setViolence(false)}
                  className={cx(
                    "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                    !violence
                      ? "bg-surface-3 text-text-primary"
                      : "text-text-muted hover:bg-surface-2",
                  )}
                >
                  No violence
                </button>
                <button
                  type="button"
                  disabled={detectionMode !== "simulation" || anyRunActive}
                  onClick={() => setViolence(true)}
                  className={cx(
                    "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                    violence
                      ? "bg-danger text-text-primary"
                      : "text-text-muted hover:bg-surface-2",
                    highlightIf("violenceToggle"),
                  )}
                >
                  Violence
                </button>
              </div>
              <button
                ref={runSimulationButtonRef}
                type="button"
                disabled={detectionMode !== "simulation" || anyRunActive}
                onClick={() => void runSimulation()}
                className={cx(btnNeutral, highlightIf("runSimulation"))}
              >
                {runningSimulation ? "Running…" : "Run simulation"}
              </button>
            </div>

            {error ? (
              <p className="border border-danger/40 bg-danger-surface px-3 py-2 font-mono text-xs text-danger">
                {error}
              </p>
            ) : null}
          </OpsPanel>

          <div ref={sessionStatusRef}>
            <OpsPanel title="Session status" className={highlightIf("sessionStatus")}>
              {loading && !session ? (
                <p className="font-mono text-xs text-text-faint">Loading…</p>
              ) : session ? (
                <dl className="grid gap-2 font-mono text-xs">
                  <div className="flex justify-between gap-4 border-b border-border-subtle py-1.5">
                    <dt className="text-text-muted">Status</dt>
                    <dd className="font-tabular text-text-primary">
                      {session.status}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border-subtle py-1.5">
                    <dt className="text-text-muted">Incident</dt>
                    <dd className="font-tabular text-text-primary">
                      {session.incident ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-1.5">
                    <dt className="text-text-muted">Ring</dt>
                    <dd className="font-tabular text-text-primary">
                      {session.ring ?? "—"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </OpsPanel>
          </div>

          <OpsPanel title="Field response runbook">
            <p className="text-xs leading-relaxed text-text-muted">
              Guard action flow during a violent escalation. Keep radio traffic
              short and announce location before contact.
            </p>
            <div className="space-y-2 border border-border-subtle bg-surface-0 p-3">
              <div className="ops-reticle border border-warning/45 bg-warning-surface px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-warning">
                  01 · Approach
                </p>
                <p className="text-xs text-text-primary">
                  Move to corridor entry, maintain visual, request backup.
                </p>
              </div>
              <p className="font-mono text-[10px] text-text-faint">↓ secure channel</p>
              <div className="ops-reticle border border-danger/45 bg-danger-surface px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-danger">
                  02 · Contact
                </p>
                <p className="text-xs text-text-primary">
                  Separate culprits, issue verbal commands, confirm compliance.
                </p>
              </div>
              <p className="font-mono text-[10px] text-text-faint">↓ transcript logging</p>
              <div className="ops-reticle border border-accent/45 bg-accent-surface px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-accent">
                  03 · Stabilize
                </p>
                <p className="text-xs text-text-primary">
                  Report status, mark safe zone, hand over to response lead.
                </p>
              </div>
            </div>
          </OpsPanel>

          <p className="text-[11px] text-text-faint">
            <Link
              href="/"
              className="text-text-muted underline-offset-2 hover:text-accent hover:underline"
            >
              Command home
            </Link>
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[min(100%,400px)] lg:pl-4">
          <OpsPanel title="Video / feed" className="min-h-[200px] flex-1">
            {showLiveCamera ? (
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full border border-border-subtle bg-black object-contain"
              />
            ) : (
              <div className="flex flex-1 flex-col items-start justify-center gap-2 border border-dashed border-border-subtle bg-surface-0 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  No live feed
                </p>
                <p className="text-xs leading-relaxed text-text-faint">
                  Select live camera and start camera to preview here. Upload and
                  stream URL paths do not render a preview in this build.
                </p>
              </div>
            )}
          </OpsPanel>

          <div ref={transcriptPanelRef}>
            <OpsPanel
              title="Voice transcript"
              className={cx(
                "flex min-h-[280px] flex-1 flex-col",
                highlightIf("transcript"),
              )}
            >
              <p className="text-xs text-text-muted">
                Relay while Vapi is open. Assistant = dispatcher; Guard = line.
              </p>
              <div
                className="mt-2 min-h-0 flex-1 overflow-y-auto border border-border-subtle bg-surface-0 p-3 text-sm"
                aria-live="polite"
              >
                {lines.length === 0 && !live.assistant && !live.user ? (
                  <p className="text-xs text-text-faint">
                    No transcript yet. When the guard answers an alert, lines
                    appear here.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {lines.map((line) => (
                      <li key={line.id}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                          {line.role === "assistant" ? "Assistant" : "Guard"}
                        </p>
                        <p className="mt-0.5 leading-snug text-text-primary">
                          {line.text}
                        </p>
                      </li>
                    ))}
                    {live.assistant ? (
                      <li>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                          Assistant · live
                        </p>
                        <p className="mt-0.5 italic leading-snug text-text-muted">
                          {live.assistant}
                        </p>
                      </li>
                    ) : null}
                    {live.user ? (
                      <li>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                          Guard · live
                        </p>
                        <p className="mt-0.5 italic leading-snug text-text-muted">
                          {live.user}
                        </p>
                      </li>
                    ) : null}
                    <div ref={transcriptEndRef} />
                  </ul>
                )}
              </div>
            </OpsPanel>
          </div>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 z-40 flex w-[min(94vw,380px)] flex-col gap-2 border border-border-strong bg-surface-1/95 p-3 shadow-2xl backdrop-blur">
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
            Ayan mode
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={ayanMode}
            onClick={() => setAyanModeEnabled(!ayanMode)}
            className={cx(
              "inline-flex h-7 min-w-[56px] items-center border px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              ayanMode
                ? "border-warning/70 bg-warning-surface text-warning"
                : "border-border-subtle bg-surface-2 text-text-muted",
            )}
          >
            {ayanMode ? "On" : "Off"}
          </button>
        </label>
        {ayanMode ? (
          <>
            <div className="border border-warning/35 bg-warning-surface/40 p-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-warning">
                Step {ayanStepIndex + 1} / {ayanSteps.length}
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {ayanStep.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {ayanStep.detail}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAyanStepIndex((prev) => Math.max(0, prev - 1))}
                disabled={ayanStepIndex === 0}
                className={btnBase}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() =>
                  setAyanStepIndex((prev) =>
                    Math.min(prev + 1, ayanSteps.length - 1),
                  )
                }
                className={cx(btnBase, "border-warning/40 text-warning")}
              >
                {ayanStep.done
                  ? ayanStepIndex === ayanSteps.length - 1
                    ? "Completed"
                    : "Next"
                  : "Skip"}
              </button>
              <button
                type="button"
                onClick={() => setAyanModeEnabled(false)}
                className={cx(btnBase, "ml-auto")}
              >
                Exit tutorial
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-text-muted">
            Turn on Ayan mode for a highlighted, step-by-step walkthrough from
            simulation fallback to speaking with the agent.
          </p>
        )}
      </div>
    </OpsShell>
  );
}
