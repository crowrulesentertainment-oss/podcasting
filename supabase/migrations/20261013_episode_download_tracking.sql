-- CrowRules Podcasting episode download analytics.
-- Compatible with the existing podcast_episode_downloads table; preserves historical events.
alter table public.podcast_episode_downloads
  add column if not exists podcast_id uuid,
  add column if not exists created_at timestamptz not null default now();

create index if not exists podcast_episode_downloads_episode_id_idx
  on public.podcast_episode_downloads (episode_id);
create index if not exists podcast_episode_downloads_podcast_id_idx
  on public.podcast_episode_downloads (podcast_id);

alter table public.podcast_episode_downloads enable row level security;

drop policy if exists "Public can record episode downloads" on public.podcast_episode_downloads;
create policy "Public can record episode downloads"
  on public.podcast_episode_downloads
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.podcast_episodes e
      where e.id = episode_id
    )
  );

drop policy if exists "Public can read episode download counts" on public.podcast_episode_downloads;
create policy "Public can read episode download counts"
  on public.podcast_episode_downloads
  for select to anon, authenticated
  using (true);

grant insert, select on public.podcast_episode_downloads to anon, authenticated;
