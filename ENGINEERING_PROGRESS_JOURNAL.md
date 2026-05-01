# Engineering Progress Journal

This is a simple running log of what happened from start to now, and what is still left.

---

## Project in one line

Shrike is a CCTV-style incident triage demo with two screens (command + guard), backed by Supabase, with simulation today and Roboflow planned next.

---

## Session timeline (start to now)

### Session 1 — Documentation baseline

- Set up the first README and journal notes.
- Captured the V1 architecture and basic product flow.
- Goal at that time: get everyone aligned on what we are building.

### Session 2 — Baseline app + Supabase + simulation flow

- Built the runnable app flow in Next.js (create session, open dashboard/guard paths).
- Added Supabase schema and core APIs for sessions, events, and transcript hooks.
- Added simulation endpoint for incident/no-incident drills.
- Added Vapi voice support on the guard side.

### Session 3 — UI polish milestone completed

- Fully polished dashboard and guard UI for the current milestone.
- Final UI direction is inspired by Palantir-style clarity: cleaner layout, tighter hierarchy, and more operator-friendly flow.
- Declared UI polish complete so engineering can focus on backend/data path completion.

### Session 4 — Docs refresh + client hardening

- Rewrote README and journal in a simpler onboarding style.
- Cleaned up home-page copy and removed unnecessary inline env reminder text.
- Improved guard/dashboard client behavior with safer React effect/ref handling and cleanup logic.

---

## What is working now

- End-to-end session flow in app routes.
- Supabase-backed sessions and event logging.
- Simulation path for violence/no-violence drills.
- Guard call experience with ringing/audio + Vapi integration.
- Environment template via `.env.local.example`.

---

## What is left (end of journal)

1. Complete Super Face video bucket upload + ingest path end-to-end.
2. Feed uploaded video path into processing/Roboflow path (not simulation-only).
3. Replace or gate simulation with Roboflow inference results.
4. Reduce heavy polling using Supabase Realtime where useful.
5. Add history view and automated tests for incident/no-incident flows.

---

## Operating rules

- Keep all meaningful state transitions logged.
- Keep outcomes easy to understand for operators.
- Never commit secrets; only keep real keys in local/private env.
