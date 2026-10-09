-- Canonical play counting: podcast_play_events owns play counters.
-- The listen-session RPC stores duration/completion only, avoiding double-counting.
create or replace function public.record_podcast_listen_session(
  p_episode_id uuid,
  p_session_key text,
  p_seconds_listened integer default 0,
  p_completed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_inserted boolean := false;
  v_seconds integer := greatest(0, least(coalesce(p_seconds_listened, 0), 86400));
  v_podcast_id uuid;
begin
  if p_episode_id is null then raise exception 'episode_id is required'; end if;
  if p_session_key is null or length(p_session_key) < 16 or length(p_session_key) > 200 then
    raise exception 'session_key must be between 16 and 200 characters';
  end if;
  select e.podcast_id into v_podcast_id from public.podcast_episodes e where e.id = p_episode_id;
  if v_podcast_id is null then raise exception 'episode not found'; end if;

  update public.podcast_listens
     set seconds_listened = greatest(coalesce(seconds_listened, 0), v_seconds),
         completed = coalesce(completed, false) or coalesce(p_completed, false)
   where session_key = p_session_key
     and episode_id = p_episode_id
     and user_id is not distinct from v_user_id
  returning id into v_id;

  if v_id is null then
    insert into public.podcast_listens(user_id, episode_id, session_key, seconds_listened, completed)
    values (v_user_id, p_episode_id, p_session_key, v_seconds, coalesce(p_completed, false))
    returning id into v_id;
    v_inserted := true;
  end if;

  if v_inserted then
    update public.podcasts
       set listener_count = (
         select count(distinct l.user_id)::integer
         from public.podcast_listens l
         join public.podcast_episodes e on e.id = l.episode_id
         where e.podcast_id = v_podcast_id and l.user_id is not null
       ),
       updated_at = now()
     where id = v_podcast_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_podcast_listen_session(uuid, text, integer, boolean) from public;
grant execute on function public.record_podcast_listen_session(uuid, text, integer, boolean) to anon, authenticated;
