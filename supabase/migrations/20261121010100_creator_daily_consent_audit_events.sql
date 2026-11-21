create table if not exists public.podcast_creator_daily_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('subscribe','unsubscribe')),
  event_source text not null,
  event_at timestamptz not null default now()
);
create index if not exists podcast_creator_daily_consent_events_user_idx
  on public.podcast_creator_daily_consent_events (user_id, event_at desc);
alter table public.podcast_creator_daily_consent_events enable row level security;
revoke all on public.podcast_creator_daily_consent_events from anon, authenticated;
grant all on public.podcast_creator_daily_consent_events to service_role;