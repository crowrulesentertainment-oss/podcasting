-- CrowRules Podcasting: durable event for every successful audio play.
-- Apply this migration in the Supabase SQL Editor or through the project's migration workflow.
create table if not exists public.podcast_play_events (
  id bigint generated always as identity primary key,
  session_key text not null,
  episode_id uuid,
  podcast_id uuid,
  episode_title text not null default 'Untitled audio',
  audio_url text not null default '',
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null default 'play' check (event_type = 'play'),
  created_at timestamptz not null default now()
);

create index if not exists podcast_play_events_created_at_idx
  on public.podcast_play_events (created_at desc);
create index if not exists podcast_play_events_episode_created_idx
  on public.podcast_play_events (episode_id, created_at desc);
create index if not exists podcast_play_events_podcast_created_idx
  on public.podcast_play_events (podcast_id, created_at desc);
create unique index if not exists podcast_play_events_session_key_uidx
  on public.podcast_play_events (session_key);

alter table public.podcast_play_events enable row level security;

drop policy if exists "Anyone can record an audio play event" on public.podcast_play_events;
create policy "Anyone can record an audio play event"
  on public.podcast_play_events
  for insert to anon, authenticated
  with check (
    (auth.uid() is null and user_id is null)
    or (auth.uid() is not null and (user_id is null or user_id = auth.uid()))
  );

drop policy if exists "Users can read their own audio play events" on public.podcast_play_events;
create policy "Users can read their own audio play events"
  on public.podcast_play_events
  for select to authenticated
  using (user_id = auth.uid());

grant insert on public.podcast_play_events to anon, authenticated;
grant select on public.podcast_play_events to authenticated;
grant usage, select on sequence public.podcast_play_events_id_seq to anon, authenticated;
