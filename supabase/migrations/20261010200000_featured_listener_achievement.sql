-- CrowRules Podcasting: secure featured listener achievement
-- A listener can feature only an achievement they have actually unlocked.
create table if not exists public.podcast_listener_featured_achievements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  achievement_key text not null references public.podcast_listener_achievement_definitions(achievement_key) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.podcast_listener_featured_achievements enable row level security;
revoke all on public.podcast_listener_featured_achievements from anon, authenticated;
drop policy if exists "Listeners can read their own featured achievement" on public.podcast_listener_featured_achievements;
create policy "Listeners can read their own featured achievement"
  on public.podcast_listener_featured_achievements
  for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.podcast_listener_featured_achievements to authenticated;

create or replace function public.set_featured_podcast_listener_achievement(p_achievement_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to feature an achievement';
  end if;

  if p_achievement_key is null or btrim(p_achievement_key) = '' then
    delete from public.podcast_listener_featured_achievements where user_id = v_user_id;
    return jsonb_build_object('featured_key', null);
  end if;

  if not exists (
    select 1
    from public.podcast_listener_achievement_unlocks u
    join public.podcast_listener_achievement_definitions d
      on d.achievement_key = u.achievement_key
    where u.user_id = v_user_id
      and u.achievement_key = p_achievement_key
      and d.is_active = true
  ) then
    raise exception 'You can only feature an achievement you have unlocked';
  end if;

  insert into public.podcast_listener_featured_achievements(user_id, achievement_key, updated_at)
  values (v_user_id, p_achievement_key, now())
  on conflict (user_id) do update
    set achievement_key = excluded.achievement_key, updated_at = now();

  return jsonb_build_object('featured_key', p_achievement_key);
end;
$$;
revoke all on function public.set_featured_podcast_listener_achievement(text) from public, anon;
grant execute on function public.set_featured_podcast_listener_achievement(text) to authenticated;

create or replace function public.get_public_podcast_listener_featured_badge(p_user_id uuid)
returns table(user_id uuid, achievement_key text, name text, description text, icon text, unlocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.user_id, d.achievement_key, d.name, d.description, d.icon, u.unlocked_at
  from public.podcast_listener_featured_achievements f
  join public.podcast_listener_achievement_definitions d
    on d.achievement_key = f.achievement_key and d.is_active = true
  join public.podcast_listener_achievement_unlocks u
    on u.user_id = f.user_id and u.achievement_key = f.achievement_key
  where f.user_id = p_user_id
    and (
      auth.uid() = p_user_id
      or exists (
        select 1 from public.podcast_member_profiles p
        where p.user_id = p_user_id
          and p.is_public = true
          and p.network_public = true
      )
    );
$$;
revoke all on function public.get_public_podcast_listener_featured_badge(uuid) from public;
grant execute on function public.get_public_podcast_listener_featured_badge(uuid) to anon, authenticated;
