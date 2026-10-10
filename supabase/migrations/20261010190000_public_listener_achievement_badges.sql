create or replace function public.get_podcast_listener_achievement_badges(p_user_id uuid)
returns table (
  achievement_key text,
  name text,
  description text,
  icon text,
  unlocked_at timestamptz,
  metric_value integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  select d.achievement_key, d.name, d.description, d.icon, u.unlocked_at, u.metric_value
  from public.podcast_listener_achievement_unlocks u
  join public.podcast_listener_achievement_definitions d on d.achievement_key = u.achievement_key
  where u.user_id = p_user_id and d.is_active = true
    and (auth.uid() = p_user_id or exists (
      select 1 from public.podcast_member_profiles p
      where p.user_id = p_user_id and p.is_public = true and p.network_public = true
    ))
  order by d.sort_order asc, u.unlocked_at asc;
$function$;
revoke all on function public.get_podcast_listener_achievement_badges(uuid) from public;
grant execute on function public.get_podcast_listener_achievement_badges(uuid) to anon, authenticated;
