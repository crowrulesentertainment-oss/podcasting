create table if not exists public.podcast_distribution_events (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid not null references public.podcasts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform text not null,
  event_type text not null check (event_type in ('preflight','submission_started','submission_confirmed','submission_failed','manual_status_updated')),
  outcome text not null check (outcome in ('success','warning','error','pending')),
  message text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists podcast_distribution_events_podcast_created_idx
  on public.podcast_distribution_events (podcast_id, created_at desc);
alter table public.podcast_distribution_events enable row level security;
revoke all on public.podcast_distribution_events from anon, authenticated;
grant select on public.podcast_distribution_events to authenticated;
drop policy if exists "Podcast managers can read distribution events" on public.podcast_distribution_events;
create policy "Podcast managers can read distribution events"
on public.podcast_distribution_events for select to authenticated
using (exists (
  select 1 from public.podcast_creators pc
  where pc.podcast_id = podcast_distribution_events.podcast_id
    and pc.user_id = (select auth.uid())
    and pc.can_manage = true
));
