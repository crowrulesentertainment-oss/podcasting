-- Resolve approximate visitor location from the already-maintained live-presence session.
-- This avoids a second geolocation lookup and does not persist IP addresses.
create or replace function public.podcasting_record_page_view(
  p_idempotency_key uuid,
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_path text,
  p_page_title text default null,
  p_referrer_domain text default null,
  p_device_type text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_city text;
  v_region text;
  v_country text;
  v_lat numeric;
  v_lon numeric;
  v_country_name text := null;
  v_location_id uuid;
  v_location_key text;
  v_event_id bigint;
  v_visitor_new boolean := false;
  v_session_new boolean := false;
  v_rows integer := 0;
  v_day date := (now() at time zone 'UTC')::date;
  v_path text := left(coalesce(p_page_path, '/'), 300);
  v_device text := case when p_device_type in ('desktop','tablet','mobile') then p_device_type else 'unknown' end;
  v_referrer text := nullif(left(lower(trim(coalesce(p_referrer_domain, ''))), 253), '');
begin
  if p_idempotency_key is null or p_visitor_id is null or p_session_id is null then
    raise exception 'Visitor, session, and event identifiers are required' using errcode = '22023';
  end if;
  if v_path !~ '^/' or v_path ~ '[?#]' then
    raise exception 'Page path must be a sanitized path without query or fragment data' using errcode = '22023';
  end if;
  if p_page_title is not null and length(p_page_title) > 180 then
    raise exception 'Page title is too long' using errcode = '22023';
  end if;
  if v_referrer is not null and v_referrer !~ '^[a-z0-9.-]+(:[0-9]{1,5})?$' then
    v_referrer := null;
  end if;

  select nullif(left(trim(coalesce(s.city,'')),100),''),
         nullif(left(trim(coalesce(s.region,'')),100),''),
         case when upper(coalesce(s.country_code,'')) ~ '^[A-Z]{2}$' then upper(s.country_code) else null end,
         case when s.latitude between -90 and 90 then round(s.latitude,1) else null end,
         case when s.longitude between -180 and 180 then round(s.longitude,1) else null end
    into v_city, v_region, v_country, v_lat, v_lon
  from private.podcasting_live_presence_sessions s
  where s.session_id = p_session_id
    and s.last_seen_at >= now() - interval '15 minutes'
  limit 1;

  if v_city is null and v_region is null and v_country is null then
    v_location_key := 'unknown';
  else
    v_location_key := md5(lower(concat_ws('|', coalesce(v_city,''), coalesce(v_region,''), coalesce(v_country,''))));
  end if;

  insert into public.podcasting_visitor_locations
    (location_key, city, region, country_code, country_name, latitude, longitude)
  values
    (v_location_key, v_city, v_region, v_country, v_country_name, v_lat, v_lon)
  on conflict (location_key) do update
    set city = coalesce(excluded.city, public.podcasting_visitor_locations.city),
        region = coalesce(excluded.region, public.podcasting_visitor_locations.region),
        country_code = coalesce(excluded.country_code, public.podcasting_visitor_locations.country_code),
        latitude = coalesce(excluded.latitude, public.podcasting_visitor_locations.latitude),
        longitude = coalesce(excluded.longitude, public.podcasting_visitor_locations.longitude)
  returning id into v_location_id;

  insert into public.podcasting_page_view_events
    (idempotency_key, visitor_id, session_id, location_id, page_path, page_title, referrer_domain, device_type)
  values
    (p_idempotency_key, p_visitor_id, p_session_id, v_location_id, v_path,
     nullif(left(coalesce(p_page_title,''),180),''), v_referrer, v_device)
  on conflict (idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into public.podcasting_visitor_daily_uniques
    (visit_day, location_id, visitor_id, session_id)
  values (v_day, v_location_id, p_visitor_id, p_session_id)
  on conflict (visit_day, location_id, visitor_id) do nothing;
  get diagnostics v_rows = row_count;
  v_visitor_new := v_rows > 0;

  insert into public.podcasting_visitor_daily_sessions
    (visit_day, location_id, session_id)
  values (v_day, v_location_id, p_session_id)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_session_new := v_rows > 0;

  insert into public.podcasting_visitor_daily_rollups
    (visit_day, location_id, page_views, unique_visitors, sessions, updated_at)
  values (v_day, v_location_id, 1, case when v_visitor_new then 1 else 0 end,
          case when v_session_new then 1 else 0 end, now())
  on conflict (visit_day, location_id) do update
    set page_views = public.podcasting_visitor_daily_rollups.page_views + 1,
        unique_visitors = public.podcasting_visitor_daily_rollups.unique_visitors + excluded.unique_visitors,
        sessions = public.podcasting_visitor_daily_rollups.sessions + excluded.sessions,
        updated_at = now();

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$function$;

revoke all on function public.podcasting_record_page_view(uuid,uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.podcasting_record_page_view(uuid,uuid,uuid,text,text,text,text) to service_role;
