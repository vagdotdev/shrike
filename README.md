# AI Prison CCTV Incident Monitoring Demo

## What This Is

A session-based demo that:

- processes uploaded prison CCTV-style video
- detects likely inmate-on-inmate violence
- alerts a guard through a phone-like page
- logs the full event lifecycle

Each run is one session with one video, one block/camera, and one guard page.

## Why This Exists

Operators cannot reliably watch many feeds at once.  
This project exists to shorten response time for likely violent incidents.

It is a triage system, not a legal decision system.

## Session Model

When a session is created, generate:

- `dashboard/[sessionId]`
- `guard/[sessionId]`

Dashboard: upload video, track processing, review outcome.  
Guard page: idle -> ringing -> answer/decline -> connected/end.

## Core Flow

1. Create session.
2. Open guard link.
3. Upload video.
4. Send video to Roboflow.
5. Evaluate detection result.
6. If threshold met: set `incident_detected` + `ringing` and trigger Vapi.
7. Else: set `no_incident` + `not_rung`.
8. Save all updates in Supabase and stream live status via Realtime.

## Session States

- `created`
- `waiting_for_guard`
- `processing`
- `incident_detected` or `no_incident`
- `ringing` or `not_rung`
- `connected`
- `resolved`

## Stack

- Next.js: dashboard, guard page, history, API routes
- Supabase Postgres: session data and logs
- Supabase Realtime: live updates
- Supabase Storage or S3: uploaded videos/artifacts
- Roboflow Workflows / Inference API: vision pipeline
- Vapi Web SDK: guard call experience

## V1 Detection Scope

Only detect likely inmate assault using:

- person detection
- tracking over time
- violence confidence over a short window
- sustained close interaction between at least two people

## Continuity

If work resumes in a new editor session:

1. Read `README.md`.
2. Read `ENGINEERING_PROGRESS_JOURNAL.md`.

