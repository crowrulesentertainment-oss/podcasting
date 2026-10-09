-- Keep show-level and episode-level play counters synchronized with tracked playback.
-- Each inserted play event increments its episode and its parent podcast once.
create or replace function public.cr_count_podcast_play_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_podcast_id uuid;
begin
  if new.event_type = 'play' then
    if new.episode_id is not null then
      update public.podcast_episodes
         set play_count = coalesce(play_count, 0) + 1,
             updated_at = now()
       where id = new.episode_id;

      select podcast_id
        into target_podcast_id
        from public.podcast_episodes
       where id = new.episode_id;
    end if;

    target_podcast_id := coalesce(new.podcast_id, target_podcast_id);

    if target_podcast_id is not null then
      update public.podcasts
         set total_plays = coalesce(total_plays, 0) + 1,
             updated_at = now()
       where id = target_podcast_id;
    end if;
  end if;

  return new;
end;
$$;

-- The trigger is the only caller; don't expose this privileged function as an API.
revoke all on function public.cr_count_podcast_play_event() from public, anon, authenticated;

-- Reconcile show totals with the canonical episode counters already stored.
update public.podcasts p
   set total_plays = coalesce((
     select sum(pe.play_count)
       from public.podcast_episodes pe
      where pe.podcast_id = p.id
   ), 0),
       updated_at = now();
