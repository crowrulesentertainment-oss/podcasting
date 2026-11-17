alter table private.podcasting_live_presence_sessions
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists latitude numeric(4,1),
  add column if not exists longitude numeric(4,1);

create or replace function private.podcasting_touch_live_presence_geo_impl(
  p_session_id uuid, p_city text, p_region text, p_country_code text, p_latitude numeric, p_longitude numeric
) returns void language plpgsql security definer set search_path = '' as $function$
declare v_rows integer;
begin
  if p_session_id is null then raise exception 'Session ID is required' using errcode = '22023'; end if;
  update private.podcasting_live_presence_sessions
  set city = nullif(left(trim(coalesce(p_city,'')),100),''),
      region = nullif(left(trim(coalesce(p_region,'')),100),''),
      country_code = case when p_country_code ~ '^[A-Z]{2}$' then p_country_code else country_code end,
      latitude = case when p_latitude between -90 and 90 then round(p_latitude,1) else null end,
      longitude = case when p_longitude between -180 and 180 then round(p_longitude,1) else null end
  where session_id = p_session_id and user_id is not distinct from (select auth.uid());
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Active visitor session was not found' using errcode = 'P0002'; end if;
end;
$function$;
revoke all on function private.podcasting_touch_live_presence_geo_impl(uuid,text,text,text,numeric,numeric) from public, anon, authenticated;

create or replace function public.podcasting_touch_live_presence_geo(
  p_session_id uuid, p_city text, p_region text, p_country_code text, p_latitude numeric, p_longitude numeric
) returns void language sql security definer set search_path = '' as $function$
  select private.podcasting_touch_live_presence_geo_impl($1,$2,$3,$4,$5,$6);
$function$;
revoke all on function public.podcasting_touch_live_presence_geo(uuid,text,text,text,numeric,numeric) from public;
grant execute on function public.podcasting_touch_live_presence_geo(uuid,text,text,text,numeric,numeric) to anon, authenticated;

create or replace function private.podcasting_admin_live_activity_impl()
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare result jsonb;
begin
  if (select auth.uid()) is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'active_total', count(*),
    'by_page', coalesce((select jsonb_agg(jsonb_build_object('page_path',page_path,'active',active_count) order by active_count desc,page_path)
      from (select coalesce(nullif(page_path,''),'/') page_path,count(*)::int active_count from private.podcasting_live_presence_sessions where last_seen_at>=now()-interval '90 seconds' group by 1) p),'[]'::jsonb),
    'by_city', coalesce((select jsonb_agg(jsonb_build_object('city',city,'region',region,'country_code',country_code,'latitude',latitude,'longitude',longitude,'active',active_count) order by active_count desc,city,region)
      from (select city,region,country_code,round(avg(latitude),1) latitude,round(avg(longitude),1) longitude,count(*)::int active_count from private.podcasting_live_presence_sessions where last_seen_at>=now()-interval '90 seconds' and city is not null group by city,region,country_code) c),'[]'::jsonb),
    'by_region', coalesce((select jsonb_agg(jsonb_build_object('region',region,'country_code',country_code,'active',active_count) order by active_count desc,region,country_code)
      from (select region,country_code,count(*)::int active_count from private.podcasting_live_presence_sessions where last_seen_at>=now()-interval '90 seconds' and region is not null group by region,country_code) r),'[]'::jsonb),
    'by_country', coalesce((select jsonb_agg(jsonb_build_object('country_code',country_code,'active',active_count) order by active_count desc,country_code)
      from (select country_code,count(*)::int active_count from private.podcasting_live_presence_sessions where last_seen_at>=now()-interval '90 seconds' and country_code is not null group by country_code) c),'[]'::jsonb),
    'unlocated', (select count(*)::int from private.podcasting_live_presence_sessions where last_seen_at>=now()-interval '90 seconds' and country_code is null and city is null and region is null),
    'generated_at',now()
  ) into result from private.podcasting_live_presence_sessions where last_seen_at>=now()-interval '90 seconds';
  return result;
end;
$function$;
