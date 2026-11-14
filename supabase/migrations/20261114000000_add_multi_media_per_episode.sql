create table if not exists public.podcast_episode_media (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  media_type text not null check (media_type in ('audio','video')),
  original_filename text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  public_url text not null,
  storage_path text not null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists podcast_episode_media_episode_sort_idx on public.podcast_episode_media (episode_id, sort_order, created_at);
alter table public.podcast_episode_media enable row level security;
create policy podcast_episode_media_select on public.podcast_episode_media for select to anon, authenticated using (
  exists (select 1 from public.podcast_episodes e where e.id = episode_id and (
    (e.status = 'published' and coalesce(e.access_level, 'free') = 'free')
    or private.can_manage_podcast(e.podcast_id) or private.crowrules_is_admin_impl()
  ))
);
create policy podcast_episode_media_insert on public.podcast_episode_media for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.podcast_episodes e where e.id = episode_id and
    (private.can_manage_podcast(e.podcast_id) or private.crowrules_is_admin_impl()))
);
create policy podcast_episode_media_update on public.podcast_episode_media for update to authenticated using (
  exists (select 1 from public.podcast_episodes e where e.id = episode_id and
    (private.can_manage_podcast(e.podcast_id) or private.crowrules_is_admin_impl()))
) with check (
  created_by = auth.uid() and exists (select 1 from public.podcast_episodes e where e.id = episode_id and
    (private.can_manage_podcast(e.podcast_id) or private.crowrules_is_admin_impl()))
);
create policy podcast_episode_media_delete on public.podcast_episode_media for delete to authenticated using (
  exists (select 1 from public.podcast_episodes e where e.id = episode_id and
    (private.can_manage_podcast(e.podcast_id) or private.crowrules_is_admin_impl()))
);
