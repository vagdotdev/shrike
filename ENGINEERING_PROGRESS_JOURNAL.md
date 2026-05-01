# Engineering progress

This file is the **handoff log** for Shrike: what ships today, what is queued, and brief notes per work session so anyone (including future you) can land quickly.

---

## Product snapshot

Shrike demonstrates **CCTV-style incident triage** in a controlled drill:

- One session at a time with a **command** surface and a **guard** surface.
- **Simulation** drives “violence detected” vs “no incident” until Roboflow fully owns the decision path.
- **Supabase** holds session rows and append-only-style **events** (including Vapi transcript hooks).
- **Vapi** powers the optional live voice line on the guard page.

Scope stays narrow: **likely inmate-on-inmate violence** as a single detection target, not broad anomaly detection.

---

## What is working now

- **Next.js** app: home → `POST /api/sessions` → dashboard and guard routes with TypeScript and Tailwind.
- **Database**: `supabase/schema.sql` — `sessions`, `session_events`, indexes, `updated_at` trigger (run against your Supabase project).
- **APIs**: create session; get/patch session; `POST .../simulate` with `{ violence: boolean }`; session **events** and **transcript** routes for audit/replay.
- **Operator UI**: guard link copy, polling refresh, simulation control.
- **Guard UI**: ringing UX, audio cues, Vapi integration (`VapiVoice`), dismiss and end-call flows aligned with server state.
- **Environment**: `.env.local.example` lists Supabase, Roboflow, and Vapi variables; real values live only in `.env.local`.

---

## Near-term roadmap (priority order)

1. **Video ingest (remaining task)** — Add Super Face video bucket flow end-to-end: upload from dashboard, persist file path/URL, and thread stored video into processing (then Roboflow) instead of simulation-only.

**After that**

- Wire **Roboflow** workflow/inference to replace or gate simulation.
- **Supabase Realtime** on `sessions` where polling is heavy today.
- **History** view and automated tests for incident vs no-incident paths.

---

## Principles (carry forward)

- Log every meaningful state transition.
- Prefer clear thresholds and short human-readable summaries over black-box scores.
- Never commit secrets; rotate keys if a template or log ever leaked.

---

## Session log

Add a short entry when you merge meaningful work.

### 2026-05-01 — Docs, home copy, client hardening

- README and this journal rewritten for a clearer, friendlier onboarding path (env via `.env.local.example`, no secrets in git).
- Home page: removed inline `.env.local` reminder; tightened hero copy for operators.
- Guard/dashboard: small React effect cleanups (ref sync, deferred refresh/cleanup) for stricter runtime behavior.
- **Next:** complete Super Face video bucket integration for real video ingest.

### 2026-05-01 — UI polish completed; focus narrowed

- Dashboard and guard UI polish is considered done for the current milestone.
- Engineering focus is now narrowed to a single remaining deliverable: video upload/ingest through the Super Face video bucket.

### 2026-05-01 — Baseline app + Supabase + simulated path

- Runnable demo: sessions in Postgres, dashboard and guard UIs, simulation API, Vapi on guard, transcript persistence hooks.

### 2026-05-01 — Documentation baseline

- Initial README, journal structure, V1 architecture and flow notes.
