# Engineering Progress Journal

Use this file as the running log for:

- what was done in each session
- what is left for next session

## Project Snapshot

Session-based prison CCTV demo:

- upload video (planned; pipeline today is **simulation** + state machine)
- run violence detection pipeline (Roboflow wired in env only; not driving decisions yet)
- trigger guard alert when threshold is met
- store and stream state changes (polling today; Realtime publication optional per `schema.sql` comments)

## Current Progress

- Product scope and session model documented (`README.md`).
- **Next.js App Router** app with TypeScript, Tailwind, home → create session → dashboard flow.
- **Supabase**: `lib/supabase/server.ts` + browser client pattern; `supabase/schema.sql` for `sessions` and `session_events` with `updated_at` trigger.
- **APIs**: `POST /api/sessions`, `GET`/`PATCH /api/sessions/[sessionId]`, `POST /api/sessions/[sessionId]/simulate`, transcript `POST` + listing `GET` on session routes (Vapi transcript → `session_events`).
- **UI**: `/dashboard/[sessionId]` (operator: guard link, simulation toggle, polling refresh), `/guard/[sessionId]` (ringing UX, walkie ringtones, **Vapi** voice via `@vapi-ai/web`, `guard_call_ended` flow).
- **Env template**: `.env.local.example` for Supabase, Roboflow, Vapi.

## Session Push Log

Add one entry per work session.

### Session 001 - Documentation Baseline

**Date:** 2026-05-01  
**Push summary:** Created baseline project docs for continuity and handoff.  
**Done:**

- Added `README.md`
- Added engineering progress journal format
- Defined V1 architecture, flow, and scope

**Left for next session (at the time):**

- Bootstrap Next.js project
- Create Supabase schema
- Implement session APIs

---

### Session 002 - App + Supabase + Simulated incident path

**Date:** 2026-05-01  
**Push summary:** Scaffolded the runnable demo: sessions in Postgres, operator and guard UIs, simulation API, Vapi guard line, transcript logging hooks.  
**Done:**

- Bootstrapped Next.js with `/`, `/dashboard/[sessionId]`, `/guard/[sessionId]`.
- Added `supabase/schema.sql` (`sessions`, `session_events`, indexes, `set_updated_at` trigger).
- Implemented `POST /api/sessions` (creates row, logs `session_created`) and `GET`/`PATCH` for single session (`guard_call_ended` → resolved / not_rung).
- Implemented `POST /api/sessions/[sessionId]/simulate` with `{ violence: boolean }` to drive `processing` → `ringing` + incident or `no_incident`, with matching `session_events`.
- Dashboard client: guard deep link, periodic refresh, simulation control.
- Guard client: polling, ringtone audio, **Vapi** integration (`VapiVoice` component), dismiss / end-call behavior aligned with server state.
- Transcript API routes persisting `vapi_transcript` rows for audit/replay.

**Left for next session:**

- See **Next TODO** below (video storage, deploy / second device, UI polish).

---

## Next TODO (Priority Order)

Owner task list — do these in order unless blocked:

1. **Video bucket and real ingest**  
   Create/configure a Supabase Storage bucket (or chosen object store), upload from the dashboard, store `video_path` (or signed URL strategy), and thread that file into the processing path (eventually Roboflow) instead of simulation-only.

2. **Deploy + guard link on another phone**  
   Ship the app to a **public URL** (for example Vercel), set production env vars, and verify the guard link works from a **second device** on cellular or another network (HTTPS, mic permissions, Vapi keys, any CORS or domain allowlisting).

3. **UI polish — command + guard**  
   Elevate visual design and UX on both **operator/command** (dashboard) and **guard** surfaces: layout, typography, motion, incident states, and clarity under stress — while keeping scope aligned with V1 triage.

**After the above (deeper backlog):**

- Wire **Roboflow** workflow/inference to replace or gate the simulation endpoint.
- Enable **Supabase Realtime** on `sessions` (add tables to `supabase_realtime` publication) to reduce polling.
- **History** page and end-to-end tests for incident vs no-incident paths.

## Carry-Forward Notes

- Keep V1 scope narrow. Do not add broad anomaly categories yet.
- Persist every important state transition.
- Prefer deterministic thresholds and clear decision summaries.
- Rotate or strip any real keys from committed examples before sharing the repo publicly.
