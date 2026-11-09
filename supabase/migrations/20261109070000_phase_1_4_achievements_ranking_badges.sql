-- CrowRules Podcasting Phase 1.4: achievements, ranking badges, and complete public listener leaderboard.

insert into public.podcast_badge_catalog
  (badge_key,name,description,category,icon,scope,is_active,display_order)
values
  ('first_top_10','First Top 10','Your first appearance in a CrowRules Top 10 chart.','Rankings','🏅','any',true,30),
  ('top_host','Top Host','Ranked #1 among CrowRules hosts in the all-time chart.','Rankings','🎙️','creator',true,31),
  ('rising_star','Rising Star','Reached the weekly Top 10 while moving up the chart.','Rankings','🚀','creator',true,32),
  ('100_qualified_plays','100 Qualified Plays','Reached 100 qualified plays across published CrowRules episodes.','Milestones','💯','any',true,33),
  ('monthly_champion','Monthly Champion','Finished #1 in a CrowRules monthly host or listener chart.','Rankings','🏆','any',true,34)
on conflict (badge_key) do update set
  name=excluded.name,description=excluded.description,category=excluded.category,
  icon=excluded.icon,scope=excluded.scope,is_active=true,display_order=excluded.display_order;

create or replace function private.get_public_podcast_listener_play_leaderboard_impl()
returns table(user_id uuid,display_name text,username text,avatar_url text,qualified_plays bigint,unique_episodes bigint,badge_count integer)
language sql stable security definer set search_path=''
as $function$
  with eligible as (
    select e.user_id,count(*)::bigint qualified_plays,
           count(distinct e.episode_id)::bigint unique_episodes
    from public.podcast_play_events e
    join public.podcast_episodes ep on ep.id=e.episode_id
    join public.podcasts s on s.id=ep.podcast_id
    where e.user_id is not null and e.event_type='play'
      and ep.status='published' and ep.is_published=true and ep.is_active=true
      and s.status='published'
    group by e.user_id
  )
  select p.user_id,coalesce(nullif(p.display_name,''),nullif(p.username,''),'CrowRules Listener')::text,
         p.username,p.avatar_url,coalesce(x.qualified_plays,0)::bigint,
         coalesce(x.unique_episodes,0)::bigint,count(distinct d.achievement_key)::integer
  from public.podcast_member_profiles p
  join auth.users au on au.id=p.user_id
  left join eligible x on x.user_id=p.user_id
  left join public.podcast_listener_achievement_unlocks u on u.user_id=p.user_id
  left join public.podcast_listener_achievement_definitions d
    on d.achievement_key=u.achievement_key and d.is_active=true
  where p.is_public=true and p.network_public=true and p.activity_public=true
  group by p.user_id,p.display_name,p.username,p.avatar_url,x.qualified_plays,x.unique_episodes
  order by coalesce(x.qualified_plays,0) desc,coalesce(x.unique_episodes,0) desc,p.user_id;
$function$;

create or replace function private.podcasting_award_ranking_badges_impl()
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_total integer:=0; v_rows integer:=0;
begin
  -- First Top 10: hosts and show owners.
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select distinct 'profile',c.member_id,'first_top_10',coalesce(mp.is_public and mp.network_public,false),
         'Reached the Top 10 in a CrowRules host chart.',now()
  from public.host_rankings_period_live h
  join public.creators c on c.id::text=h.host_key
  join public.podcast_member_profiles mp on mp.user_id=c.member_id
  where h.ranking<=10 and c.member_id is not null
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select distinct 'profile',c.member_id,'first_top_10',coalesce(mp.is_public and mp.network_public,false),
         'A CrowRules show you host reached the Top 10.',now()
  from public.podcast_rankings_period_live r
  join public.podcasts s on s.id=r.podcast_id
  join public.creators c on c.id=s.creator_id
  join public.podcast_member_profiles mp on mp.user_id=c.member_id
  where r.ranking<=10 and c.member_id is not null
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  -- First Top 10: listeners with at least one qualified play.
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select 'profile',ranked.user_id,'first_top_10',coalesce(mp.is_public and mp.network_public,false),
         'Reached the Top 10 in qualified CrowRules listening.',now()
  from (
    select l.user_id,row_number() over(order by l.qualified_plays desc,l.unique_episodes desc,l.user_id) position
    from public.get_public_podcast_listener_play_leaderboard() l where l.qualified_plays>0
  ) ranked
  join public.podcast_member_profiles mp on mp.user_id=ranked.user_id
  where ranked.position<=10
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  -- All-time #1 host.
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select 'profile',c.member_id,'top_host',coalesce(mp.is_public and mp.network_public,false),
         'Ranked #1 on the all-time CrowRules host chart.',now()
  from public.host_rankings_period_live h
  join public.creators c on c.id::text=h.host_key
  join public.podcast_member_profiles mp on mp.user_id=c.member_id
  where h.period_type='all_time' and h.ranking=1 and c.member_id is not null
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  -- Weekly Top 10 host moving up.
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select 'profile',c.member_id,'rising_star',coalesce(mp.is_public and mp.network_public,false),
         'Entered or advanced within the weekly CrowRules host Top 10.',now()
  from public.host_rankings_period_live h
  join public.creators c on c.id::text=h.host_key
  join public.podcast_member_profiles mp on mp.user_id=c.member_id
  where h.period_type='7_days' and h.ranking<=10 and h.movement='UP' and c.member_id is not null
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  -- Monthly host champion.
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select 'profile',c.member_id,'monthly_champion',coalesce(mp.is_public and mp.network_public,false),
         'Finished #1 on the monthly CrowRules host chart.',now()
  from public.host_rankings_period_live h
  join public.creators c on c.id::text=h.host_key
  join public.podcast_member_profiles mp on mp.user_id=c.member_id
  where h.period_type='30_days' and h.ranking=1 and c.member_id is not null
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  -- Monthly listener champion (rolling 30-day qualified plays).
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select 'profile',ranked.user_id,'monthly_champion',coalesce(mp.is_public and mp.network_public,false),
         'Finished #1 in the rolling 30-day qualified listener chart.',now()
  from (
    select e.user_id,row_number() over(order by count(*) desc,e.user_id) position
    from public.podcast_play_events e
    join public.podcast_episodes ep on ep.id=e.episode_id
    join public.podcasts s on s.id=ep.podcast_id
    join public.podcast_member_profiles p on p.user_id=e.user_id
    where e.event_type='play' and e.created_at>=now()-interval '30 days'
      and ep.status='published' and ep.is_published=true and ep.is_active=true and s.status='published'
      and p.is_public=true and p.network_public=true and p.activity_public=true
    group by e.user_id
  ) ranked
  join public.podcast_member_profiles mp on mp.user_id=ranked.user_id
  where ranked.position=1
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;

  -- Backfill 100 qualified plays for existing members.
  insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
  select 'profile',p.user_id,'100_qualified_plays',coalesce(p.is_public and p.network_public,false),
         'Reached at least 100 qualified plays across published CrowRules episodes.',now()
  from public.podcast_member_profiles p
  join auth.users au on au.id=p.user_id
  join (
    select e.user_id,count(*)::bigint plays
    from public.podcast_play_events e
    join public.podcast_episodes ep on ep.id=e.episode_id
    join public.podcasts s on s.id=ep.podcast_id
    where e.event_type='play' and ep.status='published' and ep.is_published=true
      and ep.is_active=true and s.status='published'
    group by e.user_id having count(*)>=100
  ) totals on totals.user_id=p.user_id
  on conflict(target_type,target_id,badge_key) do nothing;
  get diagnostics v_rows=row_count; v_total:=v_total+v_rows;
  return v_total;
end;
$function$;

create or replace function private.podcast_award_100_qualified_plays_trigger()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_count bigint; v_public boolean:=false;
begin
  if new.user_id is null or new.event_type<>'play' then return new; end if;
  select count(*)::bigint into v_count
  from public.podcast_play_events e
  join public.podcast_episodes ep on ep.id=e.episode_id
  join public.podcasts s on s.id=ep.podcast_id
  where e.user_id=new.user_id and e.event_type='play'
    and ep.status='published' and ep.is_published=true and ep.is_active=true
    and s.status='published';
  if v_count>=100 then
    select coalesce(p.is_public and p.network_public,false) into v_public
    from public.podcast_member_profiles p where p.user_id=new.user_id;
    insert into public.podcast_badge_assignments(target_type,target_id,badge_key,is_public,note,awarded_at)
    values('profile',new.user_id,'100_qualified_plays',coalesce(v_public,false),
      'Reached at least 100 qualified plays across published CrowRules episodes.',now())
    on conflict(target_type,target_id,badge_key) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists podcast_award_100_qualified_plays on public.podcast_play_events;
create trigger podcast_award_100_qualified_plays
after insert on public.podcast_play_events
for each row execute function private.podcast_award_100_qualified_plays_trigger();

create or replace function public.podcasting_admin_capture_ranking_snapshot(p_period_type text default '7_days')
returns integer language plpgsql set search_path to 'public','pg_temp'
as $function$
declare
  v_period text:=case p_period_type when 'weekly' then '7_days' when 'monthly' then '30_days' else p_period_type end;
  v_count integer:=0; v_inserted integer:=0;
begin
  if not private.crowrules_is_admin_impl() then raise exception 'Administrator access required'; end if;
  if v_period not in ('7_days','30_days','all_time') then raise exception 'Unsupported ranking period'; end if;

  insert into public.podcast_ranking_chart_history(ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
  select 'podcasts',v_period,'show',v.podcast_id,v.ranking,v.ranking_score,v.listens,now()
  from public.podcast_rankings_period_live v where v.period_type=v_period order by v.ranking;
  get diagnostics v_inserted=row_count; v_count:=v_count+v_inserted;

  insert into public.podcast_ranking_chart_history(ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
  select 'hosts',v_period,'host',v.host_key::uuid,v.ranking,v.ranking_score,v.listens,now()
  from public.host_rankings_period_live v
  where v.period_type=v_period and v.host_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by v.ranking;
  get diagnostics v_inserted=row_count; v_count:=v_count+v_inserted;

  insert into public.podcast_ranking_chart_history(ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
  select 'episodes',v_period,'episode',v.episode_id,v.ranking,v.ranking_score,v.listens,now()
  from public.episode_rankings_period_live v where v.period_type=v_period order by v.ranking;
  get diagnostics v_inserted=row_count; v_count:=v_count+v_inserted;

  if v_period='all_time' then
    insert into public.podcast_ranking_chart_history(ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
    select 'listeners','all_time','listener',ranked.user_id,ranked.position,ranked.qualified_plays,ranked.qualified_plays,now()
    from (
      select l.user_id,l.qualified_plays,
             row_number() over(order by l.qualified_plays desc,l.unique_episodes desc,l.user_id) position
      from public.get_public_podcast_listener_play_leaderboard() l where l.qualified_plays>0
    ) ranked;
    get diagnostics v_inserted=row_count; v_count:=v_count+v_inserted;
  end if;

  perform private.podcasting_award_ranking_badges_impl();
  return v_count;
end;
$function$;
