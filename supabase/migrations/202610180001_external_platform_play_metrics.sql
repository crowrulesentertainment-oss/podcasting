-- Track the latest verified per-episode play totals reported by external platforms.
-- The upsert key is (episode_id, platform), so re-importing a snapshot applies only
-- the delta to existing CrowRules totals instead of counting the same plays twice.

create table if not exists public.podcast_external_play_metrics (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid not null references public.podcasts(id) on delete cascade,
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  platform text not null check (platform in ('spotify','apple_podcasts','youtube','youtube_music','amazon_music','iheart','pocket_casts','podcast_addict','castbox','overcast','other')),
  plays bigint not null check (plays >= 0),
  source text not null default 'creator_report' check (source in ('creator_report','csv_import','api_sync')),
  report_reference text,
  reported_at timestamptz not null default now(),
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists podcast_external_play_metrics_episode_platform_uidx
  on public.podcast_external_play_metrics(episode_id, platform);
create index if not exists podcast_external_play_metrics_podcast_idx
  on public.podcast_external_play_metrics(podcast_id);

alter table public.podcast_external_play_metrics enable row level security;
grant select, insert, update, delete on public.podcast_external_play_metrics to authenticated;

drop policy if exists podcast_external_plays_creator_select on public.podcast_external_play_metrics;
create policy podcast_external_plays_creator_select on public.podcast_external_play_metrics
  for select to authenticated using (private.can_manage_podcast(podcast_id));

drop policy if exists podcast_external_plays_creator_insert on public.podcast_external_play_metrics;
create policy podcast_external_plays_creator_insert on public.podcast_external_play_metrics
  for insert to authenticated with check (
    imported_by = (select auth.uid())
    and private.can_manage_podcast(podcast_id)
    and exists (select 1 from public.podcast_episodes e where e.id = episode_id and e.podcast_id = podcast_id)
  );

drop policy if exists podcast_external_plays_creator_update on public.podcast_external_play_metrics;
create policy podcast_external_plays_creator_update on public.podcast_external_play_metrics
  for update to authenticated using (private.can_manage_podcast(podcast_id))
  with check (
    imported_by = (select auth.uid())
    and private.can_manage_podcast(podcast_id)
    and exists (select 1 from public.podcast_episodes e where e.id = episode_id and e.podcast_id = podcast_id)
  );

drop policy if exists podcast_external_plays_creator_delete on public.podcast_external_play_metrics;
create policy podcast_external_plays_creator_delete on public.podcast_external_play_metrics
  for delete to authenticated using (private.can_manage_podcast(podcast_id));

create or replace function private.apply_external_podcast_play_delta()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  delta bigint;
  target_episode uuid;
  target_podcast uuid;
begin
  if tg_op = 'INSERT' then
    delta := new.plays;
    target_episode := new.episode_id;
    target_podcast := new.podcast_id;
  elsif tg_op = 'DELETE' then
    delta := -old.plays;
    target_episode := old.episode_id;
    target_podcast := old.podcast_id;
  else
    if new.episode_id is distinct from old.episode_id or new.podcast_id is distinct from old.podcast_id then
      update public.podcast_episodes
        set play_count = greatest(0, coalesce(play_count,0) - old.plays),
            total_plays = greatest(0, coalesce(total_plays,play_count,0) - old.plays)
        where id = old.episode_id;
      update public.podcasts
        set total_plays = greatest(0,coalesce(total_plays,0)-old.plays)
        where id = old.podcast_id;
      update public.podcast_episodes
        set play_count = coalesce(play_count,0) + new.plays,
            total_plays = coalesce(total_plays,play_count,0) + new.plays
        where id = new.episode_id;
      update public.podcasts
        set total_plays = coalesce(total_plays,0)+new.plays
        where id = new.podcast_id;
      new.updated_at := now();
      return new;
    end if;
    delta := new.plays - old.plays;
    target_episode := new.episode_id;
    target_podcast := new.podcast_id;
  end if;

  if target_episode is not null and delta <> 0 then
    update public.podcast_episodes
      set play_count = greatest(0, coalesce(play_count,0) + delta),
          total_plays = greatest(0, coalesce(total_plays,play_count,0) + delta)
      where id = target_episode;
  end if;
  if target_podcast is not null and delta <> 0 then
    update public.podcasts
      set total_plays = greatest(0, coalesce(total_plays,0) + delta)
      where id = target_podcast;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.apply_external_podcast_play_delta() from public, anon, authenticated;
drop trigger if exists trg_apply_external_podcast_play_delta on public.podcast_external_play_metrics;
create trigger trg_apply_external_podcast_play_delta
  after insert or update of plays, episode_id, podcast_id or delete
  on public.podcast_external_play_metrics
  for each row execute function private.apply_external_podcast_play_delta();
