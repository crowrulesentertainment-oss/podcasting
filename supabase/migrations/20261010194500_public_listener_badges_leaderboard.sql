create or replace function public.get_public_podcast_listener_badges(p_user_ids uuid[])
returns table (user_id uuid, badges jsonb, badge_count integer)
language sql stable security definer set search_path = ''
as $function$
  select p.user_id,
    coalesce(jsonb_agg(jsonb_build_object('achievement_key',d.achievement_key,'name',d.name,'description',d.description,'icon',d.icon,'unlocked_at',u.unlocked_at) order by d.sort_order,u.unlocked_at) filter (where d.achievement_key is not null),'[]'::jsonb),
    count(d.achievement_key)::integer
  from public.podcast_member_profiles p
  left join public.podcast_listener_achievement_unlocks u on u.user_id=p.user_id
  left join public.podcast_listener_achievement_definitions d on d.achievement_key=u.achievement_key and d.is_active=true
  where p.user_id=any(coalesce(p_user_ids,array[]::uuid[])) and p.is_public=true and p.network_public=true
  group by p.user_id limit 100;
$function$;
revoke all on function public.get_public_podcast_listener_badges(uuid[]) from public;
grant execute on function public.get_public_podcast_listener_badges(uuid[]) to anon, authenticated;

create or replace function public.get_public_podcast_listener_leaderboard()
returns table (user_id uuid, display_name text, username text, avatar_url text, completed_episodes bigint, badge_count integer, badges jsonb)
language sql stable security definer set search_path = ''
as $function$
  with eligible as (
    select l.user_id,l.episode_id from public.podcast_listens l
    join public.podcast_episodes e on e.id=l.episode_id
    join public.podcasts s on s.id=e.podcast_id
    where l.completed=true and l.seconds_listened >= greatest(60,ceil(coalesce(e.duration_seconds,300)*0.8)::integer)
      and e.status='published' and e.is_published=true and e.is_active=true and s.status='published'
    group by l.user_id,l.episode_id
  ), totals as (select user_id,count(*)::bigint as completed_episodes from eligible group by user_id)
  select p.user_id,coalesce(nullif(p.display_name,''),nullif(p.username,''),'CrowRules Listener'),
    p.username,p.avatar_url,t.completed_episodes,count(d.achievement_key)::integer,
    coalesce(jsonb_agg(jsonb_build_object('achievement_key',d.achievement_key,'name',d.name,'icon',d.icon) order by d.sort_order) filter(where d.achievement_key is not null),'[]'::jsonb)
  from totals t join public.podcast_member_profiles p on p.user_id=t.user_id
  left join public.podcast_listener_achievement_unlocks u on u.user_id=p.user_id
  left join public.podcast_listener_achievement_definitions d on d.achievement_key=u.achievement_key and d.is_active=true
  where p.is_public=true and p.network_public=true and p.activity_public=true
  group by p.user_id,p.display_name,p.username,p.avatar_url,t.completed_episodes
  order by t.completed_episodes desc,count(d.achievement_key) desc,p.user_id limit 10;
$function$;
revoke all on function public.get_public_podcast_listener_leaderboard() from public;
grant execute on function public.get_public_podcast_listener_leaderboard() to anon, authenticated;
