-- Shrike: sessions + audit log
-- Apply in Supabase SQL Editor or via CLI migration.

-- After creating tables, add them to the `supabase_realtime` publication if you want
-- Postgres changes streamed to clients, e.g.:
--   alter publication supabase_realtime add table public.sessions;
--   alter publication supabase_realtime add table public.session_events;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'created',
  incident text,
  ring text,
  video_path text,
  decision_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
  before update on public.sessions
  for each row
  execute function public.set_updated_at();

create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  kind text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists session_events_session_id_idx on public.session_events (session_id, created_at desc);
