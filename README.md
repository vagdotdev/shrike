# Shrike

Shrike is a session-based CCTV incident triage demo. It models how an operator can quickly hand off a likely violent incident to a guard, while preserving a complete event trail for review.

This project is a triage workflow simulation only. It is not intended as a legal, disciplinary, or evidence-management system.

## Overview

The app includes three core experiences:

1. **Home** - Create a new drill session.
2. **Operator Dashboard** (`/dashboard/[sessionId]`) - View session status, share the guard deep link, and run detection using upload, camera, or stream URL (with a simulation fallback).
3. **Guard Handset** (`/guard/[sessionId]`) - Handle call states (idle, ringing, answered, dismissed, connected, ended) with optional Vapi voice.

Each session is isolated and tracked independently in Postgres with its own URLs and event history.

## Architecture at a Glance

- **Frontend and API:** Next.js App Router
- **Data store:** Supabase Postgres (`sessions`, `session_events`)
- **Voice path:** Vapi (`@vapi-ai/web`)
- **Detection path:** Roboflow (`/api/sessions/[sessionId]/detect`) with simulation fallback

## Getting Started

### Prerequisites

- Node.js 20+
- npm (or compatible package manager)

### Installation

```bash
npm install
cp .env.local.example .env.local
```

### Environment Variables

Update `.env.local` (do not commit this file; it is gitignored):

| Area | Required Variables | Notes |
|------|--------------------|-------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Create from [Supabase Project Settings -> API](https://supabase.com/dashboard). Apply `supabase/schema.sql` if tables are missing. |
| Vapi | `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | Create in the [Vapi dashboard](https://dashboard.vapi.ai). Used by the guard voice client. |
| Roboflow | `ROBOFLOW_API_KEY`, `ROBOFLOW_WORKFLOW_URL` | Used by `/api/sessions/[sessionId]/detect`. Optional hardening: `ROBOFLOW_WEBHOOK_SECRET`. |

### Run Locally

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000), create a session, open the guard URL from the dashboard, and run either Roboflow detection or simulation mode.

## Session Lifecycle

At a high level, session flow follows:

`created -> processing/waiting_for_guard -> incident_detected | no_incident -> ringing | not_rung -> connected / resolved`

State transitions and event logs are persisted in Supabase.

## Operational Notes

- Polling is currently used in parts of the UI flow.
- Supabase Realtime is a natural next step for reducing polling latency.

## Project Continuity

- `ENGINEERING_PROGRESS_JOURNAL.md` tracks implementation history, pending work, and handoff notes.

If you are resuming work in a new session, read this README and the journal first, then start with a fresh `.env.local`.
