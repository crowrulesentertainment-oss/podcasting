-- Permanent anonymous page-view analytics and private admin notifications.
-- Additive only: legacy podcasting_visitor_events and presence objects remain unchanged.

create table if not exists public.podcasting_visitor_locations (
  id uuid primary key default gen_random_uuid(),
  location_key text not null unique,
  city text,
  region text,
  country_code text,
  country_name text,
  latitude numeric(5,1),
  longitude numeric(6,1),
  created_at timestamptz not null default now(),
  constraint podcasting_visitor_locations_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint podcasting_visitor_locations_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint podcasting_visitor_locations_longitude_check
    check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.podcasting_page_view_events (
  id bigint generated always as identity primary key,
  idempotency_key uuid not null unique,
  visitor_id uuid not null,
  session_id uuid not null,
  location_id uuid not null references public.podcasting_visitor_locations(id),
  page_path text not null,
  page_title text,
  referrer_domain text,
  device_type text not null default 'unknown',
  created_at timestamptz not null default now(),
  constraint podcasting_page_view_events_path_check
    check (page_path ~ '^/' and length(page_path) <= 300),
  constraint podcasting_page_view_events_device_check
    check (device_type in ('desktop','tablet','mobile','unknown')),
  constraint podcasting_page_view_events_title_check
    check (page_title is null or length(page_title) <= 180),
  constraint podcasting_page_view_events_referrer_check
    check (referrer_domain is null or length(referrer_domain) <= 253)
);

create table if not exists public.podcasting_visitor_daily_uniques (
  visit_day date not null,
  location_id uuid not null references public.podcasting_visitor_locations(id),
  visitor_id uuid not null,
  session_id uuid not null,
  first_seen_at timestamptz not null default now(),
  primary key (visit_day, location_id, visitor_id)
);

create table if not exists public.podcasting_visitor_daily_sessions (
  visit_day date not null,
  location_id uuid not null references public.podcasting_visitor_locations(id),
  session_id uuid not null,
  first_seen_at timestamptz not null default now(),
  primary key (visit_day, location_id, session_id)
);

create table if not exists public.podcasting_visitor_daily_rollups (
  visit_day date not null,
  location_id uuid not null references public.podcasting_visitor_locations(id),
  page_views bigint not null default 0,
  unique_visitors bigint not null default 0,
  sessions bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (visit_day, location_id),
  constraint podcasting_visitor_daily_rollups_nonnegative
    check (page_views >= 0 and unique_visitors >= 0 and sessions >= 0)
);

create index if not exists podcasting_page_view_events_created_at_idx
  on public.podcasting_page_view_events (created_at desc);
create index if not exists podcasting_page_view_events_visitor_created_idx
  on public.podcasting_page_view_events (visitor_id, created_at desc);
create index if not exists podcasting_page_view_events_location_created_idx
  on public.podcasting_page_view_events (location_id, created_at desc);
create index if not exists podcasting_page_view_events_path_created_idx
  on public.podcasting_page_view_events (page_path, created_at desc);
create index if not exists podcasting_visitor_daily_rollups_day_idx
  on public.podcasting_visitor_daily_rollups (visit_day desc);

alter table public.podcasting_visitor_locations enable row level security;
alter table public.podcasting_page_view_events enable row level security;
alter table public.podcasting_visitor_daily_uniques enable row level security;
alter table public.podcasting_visitor_daily_sessions enable row level security;
alter table public.podcasting_visitor_daily_rollups enable row level security;

-- No anon/authenticated table policies or direct table grants are created.
-- All visitor ingestion is performed by the server-side Edge Function using service_role.

create or replace function public.podcasting_record_page_view(
  p_idempotency_key uuid,
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_path text,
  p_page_title text default null,
  p_referrer_domain text default null,
  p_device_type text default 'unknown',
  p_city text default null,
  p_region text default null,
  p_country_code text default null,
  p_country_name text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_location_id uuid;
  v_location_key text;
  v_event_id bigint;
  v_visitor_new boolean := false;
  v_session_new boolean := false;
  v_rows integer := 0;
  v_day date := (now() at time zone 'UTC')::date;
  v_city text := nullif(left(trim(coalesce(p_city, '')), 100), '');
  v_region text := nullif(left(trim(coalesce(p_region, '')), 100), '');
  v_country text := case when upper(coalesce(p_country_code, '')) ~ '^[A-Z]{2}$'
                         then upper(p_country_code) else null end;
  v_country_name text := nullif(left(trim(coalesce(p_country_name, '')), 100), '');
  v_lat numeric := case when p_latitude between -90 and 90 then round(p_latitude, 1) else null end;
  v_lon numeric := case when p_longitude between -180 and 180 then round(p_longitude, 1) else null end;
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
        country_name = coalesce(excluded.country_name, public.podcasting_visitor_locations.country_name),
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

revoke all on function public.podcasting_record_page_view(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.podcasting_record_page_view(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric) to service_role;

create or replace function private.podcasting_admin_page_view_metrics_impl(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_from timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  v_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  v_limit integer := greatest(1, least(coalesce(p_limit,10),100));
  v_result jsonb;
begin
  if (select auth.uid()) is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_from >= v_to then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;

  with filtered as (
    select e.id, e.visitor_id, e.session_id, e.location_id, e.page_path, e.created_at
    from public.podcasting_page_view_events e
    where e.created_at >= v_from and e.created_at < v_to
  ),
  totals as (
    select count(*)::bigint page_views,
           count(distinct visitor_id)::bigint unique_visitors,
           count(distinct session_id)::bigint sessions
    from filtered
  ),
  city as (
    select l.city, l.region, l.country_code, l.country_name, l.latitude, l.longitude,
           count(*)::bigint page_views, count(distinct f.visitor_id)::bigint unique_visitors,
           count(distinct f.session_id)::bigint sessions
    from filtered f join public.podcasting_visitor_locations l on l.id=f.location_id
    where l.city is not null
    group by l.city,l.region,l.country_code,l.country_name,l.latitude,l.longitude
    order by page_views desc, unique_visitors desc limit v_limit
  ),
  region as (
    select l.region, l.country_code, l.country_name,
           count(*)::bigint page_views, count(distinct f.visitor_id)::bigint unique_visitors,
           count(distinct f.session_id)::bigint sessions
    from filtered f join public.podcasting_visitor_locations l on l.id=f.location_id
    where l.region is not null
    group by l.region,l.country_code,l.country_name
    order by page_views desc, unique_visitors desc limit v_limit
  ),
  country as (
    select l.country_code, l.country_name,
           count(*)::bigint page_views, count(distinct f.visitor_id)::bigint unique_visitors,
           count(distinct f.session_id)::bigint sessions
    from filtered f join public.podcasting_visitor_locations l on l.id=f.location_id
    where l.country_code is not null
    group by l.country_code,l.country_name
    order by page_views desc, unique_visitors desc limit v_limit
  ),
  daily as (
    select (created_at at time zone 'UTC')::date day,
           count(*)::bigint page_views,
           count(distinct visitor_id)::bigint unique_visitors
    from filtered group by 1 order by 1
  )
  select jsonb_build_object(
    'page_views', totals.page_views,
    'unique_visitors', totals.unique_visitors,
    'sessions', totals.sessions,
    'cities', coalesce((select jsonb_agg(to_jsonb(city)) from city),'[]'::jsonb),
    'regions', coalesce((select jsonb_agg(to_jsonb(region)) from region),'[]'::jsonb),
    'countries', coalesce((select jsonb_agg(to_jsonb(country)) from country),'[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily)) from daily),'[]'::jsonb),
    'generated_at', now()
  ) into v_result from totals;
  return v_result;
end;
$function$;

create or replace function public.podcasting_admin_page_view_metrics(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 10
)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.podcasting_admin_page_view_metrics_impl($1,$2,$3);
$function$;

revoke all on function public.podcasting_admin_page_view_metrics(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.podcasting_admin_page_view_metrics(timestamptz,timestamptz,integer) to authenticated;

-- Minimal notification payload; visitor identifiers and location detail never enter Realtime.
create or replace function private.podcasting_broadcast_page_view_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform realtime.send(
    jsonb_build_object('event_id', new.id, 'created_at', new.created_at),
    'page_view_inserted',
    'podcasting:admin:visitor-activity',
    true
  );
  return new;
end;
$function$;

drop trigger if exists podcasting_page_view_realtime_broadcast on public.podcasting_page_view_events;
create trigger podcasting_page_view_realtime_broadcast
after insert on public.podcasting_page_view_events
for each row execute function private.podcasting_broadcast_page_view_insert();

drop policy if exists "Podcasting admin visitor activity broadcast receive" on realtime.messages;
create policy "Podcasting admin visitor activity broadcast receive"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = 'podcasting:admin:visitor-activity'
  and coalesce(private.crowrules_is_admin_impl(), false)
);

comment on table public.podcasting_page_view_events is
  'Append-only anonymous page-view events; excludes raw IPs, account IDs, query strings and private content.';
comment on table public.podcasting_visitor_locations is
  'Approximate geolocation directory; coordinates are rounded to 0.1 degrees and no IP addresses are stored.';
