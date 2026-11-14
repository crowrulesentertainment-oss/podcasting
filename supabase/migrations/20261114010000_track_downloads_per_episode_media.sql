alter table public.podcast_episode_download_events
  add column if not exists media_id uuid
  references public.podcast_episode_media(id) on delete set null;

create index if not exists podcast_episode_download_events_media_id_idx
  on public.podcast_episode_download_events(media_id)
  where media_id is not null;

drop policy if exists "Listeners can log episode downloads"
  on public.podcast_episode_download_events;

create policy "Listeners can log episode downloads"
on public.podcast_episode_download_events
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.podcast_episodes e
    where e.id = podcast_episode_download_events.episode_id
      and e.podcast_id = podcast_episode_download_events.podcast_id
  )
  and (
    podcast_episode_download_events.media_id is null
    or exists (
      select 1
      from public.podcast_episode_media m
      join public.podcast_episodes e on e.id = m.episode_id
      where m.id = podcast_episode_download_events.media_id
        and m.episode_id = podcast_episode_download_events.episode_id
        and e.podcast_id = podcast_episode_download_events.podcast_id
    )
  )
  and (
    podcast_episode_download_events.user_id is null
    or podcast_episode_download_events.user_id = (select auth.uid())
  )
);

create or replace function private.get_podcast_episode_media_download_counts_impl(p_podcast_id uuid)
returns table(media_id uuid, episode_id uuid, original_filename text, media_type text, download_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select m.id, m.episode_id, m.original_filename, m.media_type, count(d.id)::bigint
  from public.podcast_episode_media m
  join public.podcast_episodes e on e.id = m.episode_id
  join public.podcasts p on p.id = e.podcast_id
  left join public.podcast_episode_download_events d
    on d.media_id = m.id
   and d.episode_id = e.id
   and d.podcast_id = p.id
  where e.podcast_id = p_podcast_id
    and (
      (e.status = 'published' and p.status = 'published')
      or (
        auth.uid() is not null
        and (private.can_manage_podcast(e.podcast_id) or public.crowrules_is_admin())
      )
    )
  group by m.id, m.episode_id, m.original_filename, m.media_type
$function$;

create or replace function public.get_podcast_episode_media_download_counts(p_podcast_id uuid)
returns table(media_id uuid, episode_id uuid, original_filename text, media_type text, download_count bigint)
language sql
stable
set search_path = ''
as $function$
  select * from private.get_podcast_episode_media_download_counts_impl($1)
$function$;

revoke all on function public.get_podcast_episode_media_download_counts(uuid) from public;
grant execute on function public.get_podcast_episode_media_download_counts(uuid) to anon, authenticated;
