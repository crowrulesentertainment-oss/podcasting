-- Keep podcast_episodes.play_count synchronized with each recorded play event.
-- Backfill existing events so already-recorded plays appear in episode statistics.

create or replace function public.cr_count_podcast_play_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.event_type = 'play' and new.episode_id is not null then
    update public.podcast_episodes
       set play_count = coalesce(play_count, 0) + 1,
           updated_at = now()
     where id = new.episode_id;
  end if;
  return new;
end;
$$;

revoke all on function public.cr_count_podcast_play_event() from public, anon, authenticated;

drop trigger if exists trg_count_podcast_play_event on public.podcast_play_events;
create trigger trg_count_podcast_play_event
after insert on public.podcast_play_events
for each row execute function public.cr_count_podcast_play_event();

update public.podcast_episodes pe
   set play_count = (
     select count(*)
       from public.podcast_play_events ppe
      where ppe.episode_id = pe.id
        and ppe.event_type = 'play'
   ),
       updated_at = now()
 where exists (
   select 1
     from public.podcast_play_events ppe
    where ppe.episode_id = pe.id
      and ppe.event_type = 'play'
 );
