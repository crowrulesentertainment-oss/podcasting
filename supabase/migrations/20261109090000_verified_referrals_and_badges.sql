-- CrowRules Podcasting: verified member referrals and automatic referral milestone badges.
create table if not exists public.podcast_referral_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.podcast_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'verified' check (status in ('verified')),
  created_at timestamptz not null default now(),
  constraint podcast_referrals_no_self_referral check (referrer_user_id <> referred_user_id)
);
create index if not exists podcast_referrals_referrer_created_idx
  on public.podcast_referrals(referrer_user_id, created_at desc);

alter table public.podcast_referral_profiles enable row level security;
alter table public.podcast_referrals enable row level security;
drop policy if exists "Members can read their own referral profile" on public.podcast_referral_profiles;
create policy "Members can read their own referral profile"
  on public.podcast_referral_profiles for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Members can read referrals they sent" on public.podcast_referrals;
create policy "Members can read referrals they sent"
  on public.podcast_referrals for select to authenticated
  using (referrer_user_id = (select auth.uid()));
revoke all on public.podcast_referral_profiles from anon, authenticated;
revoke all on public.podcast_referrals from anon, authenticated;
grant select on public.podcast_referral_profiles, public.podcast_referrals to authenticated;

insert into public.podcast_badge_catalog
  (badge_key,name,description,category,icon,scope,is_active,display_order)
values
  ('first_referral','First Referral','Your first verified new member joined CrowRules Podcasting through your invitation.','Referral Recognition','🤝','creator',true,60),
  ('community_builder','Community Builder','You helped five new members join the CrowRules Podcasting community.','Referral Recognition','🌟','creator',true,61),
  ('rising_ambassador','Rising Ambassador','You welcomed ten verified new members to CrowRules Podcasting.','Referral Recognition','🚀','creator',true,62),
  ('crowrules_ambassador','CrowRules Ambassador','You welcomed twenty-five verified new members to CrowRules Podcasting.','Referral Recognition','🏅','creator',true,63),
  ('legendary_recruiter','Legendary Recruiter','You welcomed fifty verified new members to CrowRules Podcasting.','Referral Recognition','👑','creator',true,64)
on conflict (badge_key) do update set
  name=excluded.name, description=excluded.description, category=excluded.category,
  icon=excluded.icon, scope=excluded.scope, is_active=true, display_order=excluded.display_order;

create or replace function private.podcasting_my_referral_dashboard_impl()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_count integer := 0;
  v_referrals jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'Sign in to view your referral dashboard.'; end if;
  insert into public.podcast_referral_profiles(user_id, referral_code)
  values (v_user, 'CR' || upper(substr(md5(v_user::text), 1, 8)))
  on conflict (user_id) do nothing;
  select referral_code into v_code
  from public.podcast_referral_profiles where user_id=v_user;
  select count(*)::integer into v_count
  from public.podcast_referrals where referrer_user_id=v_user;
  select coalesce(jsonb_agg(jsonb_build_object(
    'status',r.status,'created_at',r.created_at,'member_label','Verified member'
  ) order by r.created_at desc),'[]'::jsonb)
  into v_referrals
  from public.podcast_referrals r where r.referrer_user_id=v_user;
  return jsonb_build_object('referral_code',v_code,'verified_referrals',v_count,'referrals',v_referrals);
end;
$function$;

create or replace function private.claim_podcast_referral_impl(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_referrer uuid;
  v_count integer := 0;
  v_badge text;
  v_public boolean := false;
begin
  if v_user is null then raise exception 'Sign in to claim a referral.'; end if;
  if nullif(trim(p_referral_code),'') is null then
    return jsonb_build_object('claimed',false,'reason','missing_code');
  end if;
  select user_id into v_referrer
  from public.podcast_referral_profiles
  where referral_code=upper(trim(p_referral_code));
  if v_referrer is null then
    return jsonb_build_object('claimed',false,'reason','invalid_code');
  end if;
  if v_referrer=v_user then
    return jsonb_build_object('claimed',false,'reason','self_referral');
  end if;
  insert into public.podcast_referrals(referrer_user_id,referred_user_id,referral_code)
  values(v_referrer,v_user,upper(trim(p_referral_code)))
  on conflict(referred_user_id) do nothing;
  if not found then
    return jsonb_build_object('claimed',false,'reason','already_claimed');
  end if;
  select count(*)::integer into v_count
  from public.podcast_referrals where referrer_user_id=v_referrer;
  select coalesce(p.is_public and p.network_public,false) into v_public
  from public.podcast_member_profiles p where p.user_id=v_referrer;
  for v_badge in
    select x.badge_key from (values
      (1,'first_referral'),(5,'community_builder'),(10,'rising_ambassador'),
      (25,'crowrules_ambassador'),(50,'legendary_recruiter')
    ) as x(threshold,badge_key)
    where v_count >= x.threshold
  loop
    insert into public.podcast_badge_assignments
      (target_type,target_id,badge_key,is_public,note,awarded_at)
    values('profile',v_referrer,v_badge,coalesce(v_public,false),
      'Earned through '||v_count||' verified CrowRules Podcasting referrals.',now())
    on conflict(target_type,target_id,badge_key) do nothing;
  end loop;
  return jsonb_build_object('claimed',true,'verified_referrals',v_count);
end;
$function$;

grant usage on schema private to authenticated;
revoke all on function private.podcasting_my_referral_dashboard_impl() from public, anon, authenticated;
revoke all on function private.claim_podcast_referral_impl(text) from public, anon, authenticated;
grant execute on function private.podcasting_my_referral_dashboard_impl() to authenticated;
grant execute on function private.claim_podcast_referral_impl(text) to authenticated;

create or replace function public.podcasting_my_referral_dashboard()
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.podcasting_my_referral_dashboard_impl(); $function$;
create or replace function public.claim_podcast_referral(p_referral_code text)
returns jsonb language sql volatile security invoker set search_path=''
as $function$ select private.claim_podcast_referral_impl(p_referral_code); $function$;
revoke all on function public.podcasting_my_referral_dashboard() from public, anon, authenticated;
revoke all on function public.claim_podcast_referral(text) from public, anon, authenticated;
grant execute on function public.podcasting_my_referral_dashboard() to authenticated;
grant execute on function public.claim_podcast_referral(text) to authenticated;
