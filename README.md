# Shrike — CCTV incident drill

Welcome. This repo is a **session-based demo** of prison-style CCTV triage: one upload block, one operator dashboard, one guard handset, and a full paper trail of what happened.

## Why it exists

Control rooms cannot watch every feed at once. Shrike explores **faster handoff** from a likely violent clip to a guard who can answer, decline, or connect — with state and transcripts persisted for review. It is a **triage drill**, not a legal or disciplinary system.

## What you will see

1. **Home** — create a new session in one click.
2. **Dashboard** (`/dashboard/[sessionId]`) — guard deep link, session status, Roboflow detection controls (upload, camera, stream URL) plus a simulation fallback toggle.
3. **Guard** (`/guard/[sessionId]`) — idle → ringing → answer or dismiss → connected / end, with optional voice via Vapi.

Each session is independent: its own row in Postgres, events log, and URLs.

## Quick start

**Requirements:** Node.js 20+ recommended, npm (or compatible package manager).

```bash
npm install
cp .env.local.example .env.local
```

Edit **`.env.local`** (never commit it; it is gitignored):

| Area | Variables |
|------|-----------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from [Project Settings → API](https://supabase.com/dashboard). Apply `supabase/schema.sql` to your project if tables are not created yet. |
| **Vapi** | `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` — from [Vapi dashboard](https://dashboard.vapi.ai); used in the browser for the guard line. |
| **Roboflow** | `ROBOFLOW_API_KEY`, `ROBOFLOW_WORKFLOW_URL` — used by `/api/sessions/[sessionId]/detect` for primary detection flow. Optional webhook hardening: `ROBOFLOW_WEBHOOK_SECRET`. |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), start a session, open the guard URL from the dashboard, then run either Roboflow detection or simulation fallback.

## Session model (high level)

- **Created** → waiting for guard / processing → **incident_detected** or **no_incident** → **ringing** or **not_rung** → **connected** / resolved paths as implemented in API and UI.
- State and important transitions are stored in **Supabase**; the app may use polling today with Realtime as a natural next step (see journal).

## Stack

- **Next.js** (App Router) — pages and API routes.
- **Supabase** — Postgres (`sessions`, `session_events`), future Storage/Realtime as needed.
- **Vapi** — `@vapi-ai/web` on the guard page.
- **Roboflow** — primary detector path (`/detect`) with simulation retained as explicit fallback.

## Docs and continuity

- **`ENGINEERING_PROGRESS_JOURNAL.md`** — what is built, what is next, and a short session log for handoffs.

If you pick this up in a new editor session, read this README and the journal first, then run from **Quick start** with a fresh `.env.local`.
