-- Harden canonical playback tracking.
-- Resolve show attribution from the episode row when an episode is known;
-- never trust a client-supplied podcast_id over the episode's actual parent.
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

      select podcast_id into target_podcast_id
        from public.podcast_episodes
       where id = new.episode_id;
    end if;

    target_podcast_id := coalesce(target_podcast_id, new.podcast_id);

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

revoke all on function public.cr_count_podcast_play_event() from public, anon, authenticated;
