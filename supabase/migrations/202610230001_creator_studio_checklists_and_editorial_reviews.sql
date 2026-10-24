-- Creator Studio checklist and editorial review tables.
-- Applied to Supabase project cevylpnoexugwgygvtgu on 2026-10-23.
create table if not exists public.podcast_episode_checklist_items (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  task_key text not null,
  label text not null check (char_length(btrim(label)) between 1 and 240),
  is_complete boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, task_key)
);
create table if not exists public.podcast_episode_editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','in_review','approved','revision_requested','rejected')),
  feedback text check (feedback is null or char_length(feedback) <= 5000),
  submitted_version integer not null default 1 check (submitted_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists podcast_episode_checklist_episode_idx on public.podcast_episode_checklist_items(episode_id);
create index if not exists podcast_episode_editorial_episode_idx on public.podcast_episode_editorial_reviews(episode_id, created_at desc);
alter table public.podcast_episode_checklist_items enable row level security;
alter table public.podcast_episode_editorial_reviews enable row level security;
drop policy if exists "episode checklist creator select" on public.podcast_episode_checklist_items;
create policy "episode checklist creator select" on public.podcast_episode_checklist_items for select to authenticated
using (exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)));
drop policy if exists "episode checklist creator insert" on public.podcast_episode_checklist_items;
create policy "episode checklist creator insert" on public.podcast_episode_checklist_items for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)));
drop policy if exists "episode checklist creator update" on public.podcast_episode_checklist_items;
create policy "episode checklist creator update" on public.podcast_episode_checklist_items for update to authenticated
using (exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)))
with check (exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)));
drop policy if exists "episode checklist creator delete" on public.podcast_episode_checklist_items;
create policy "episode checklist creator delete" on public.podcast_episode_checklist_items for delete to authenticated
using (exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)));
drop policy if exists "editorial creator read own" on public.podcast_episode_editorial_reviews;
create policy "editorial creator read own" on public.podcast_episode_editorial_reviews for select to authenticated
using (submitted_by = (select auth.uid()) or exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)) or crowrules_is_admin());
drop policy if exists "editorial creator submit" on public.podcast_episode_editorial_reviews;
create policy "editorial creator submit" on public.podcast_episode_editorial_reviews for insert to authenticated
with check (submitted_by = (select auth.uid()) and status = 'pending' and exists (select 1 from public.podcast_episodes e where e.id = episode_id and private.can_manage_podcast(e.podcast_id)));
drop policy if exists "editorial admin manage" on public.podcast_episode_editorial_reviews;
create policy "editorial admin manage" on public.podcast_episode_editorial_reviews for all to authenticated
using (crowrules_is_admin()) with check (crowrules_is_admin());
