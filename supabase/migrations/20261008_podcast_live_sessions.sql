-- CrowRules Podcasting: live session metadata
-- Run in Supabase SQL Editor for project configured in creator/live-admin.html.
-- This stores session metadata/status only; it does not provide audio streaming.
create table if not exists public.podcast_live_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  podcast_id uuid null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1200),
  status text not null default 'created' check (status in ('created','live','ended')),
  visibility text not null default 'public' check (visibility in ('public','unlisted')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists podcast_live_sessions_creator_created_idx
  on public.podcast_live_sessions (creator_id, created_at desc);
create index if not exists podcast_live_sessions_status_idx
  on public.podcast_live_sessions (status, created_at desc);
alter table public.podcast_live_sessions enable row level security;
drop policy if exists "Creators can read own live sessions" on public.podcast_live_sessions;
create policy "Creators can read own live sessions"
  on public.podcast_live_sessions for select to authenticated
  using (auth.uid() = creator_id);
drop policy if exists "Creators can create own live sessions" on public.podcast_live_sessions;
create policy "Creators can create own live sessions"
  on public.podcast_live_sessions for insert to authenticated
  with check (auth.uid() = creator_id);
drop policy if exists "Creators can update own live sessions" on public.podcast_live_sessions;
create policy "Creators can update own live sessions"
  on public.podcast_live_sessions for update to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);
grant select, insert, update on public.podcast_live_sessions to authenticated;
