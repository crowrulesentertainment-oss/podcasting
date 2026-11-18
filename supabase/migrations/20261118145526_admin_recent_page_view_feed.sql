create or replace function private.podcasting_admin_recent_page_views_impl(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit,20),100));
begin
  if (select auth.uid()) is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'page_path', e.page_path,
    'page_title', e.page_title,
    'created_at', e.created_at,
    'device_type', e.device_type,
    'city', l.city,
    'region', l.region,
    'country_code', l.country_code,
    'country_name', coalesce(l.country_name,l.country_code)
  ) order by e.created_at desc),'[]'::jsonb)
  into v_rows
  from (
    select id, location_id, page_path, page_title, created_at, device_type
    from public.podcasting_page_view_events
    order by created_at desc
    limit v_limit
  ) e
  join public.podcasting_visitor_locations l on l.id=e.location_id;
  return v_rows;
end;
$function$;

create or replace function public.podcasting_admin_recent_page_views(p_limit integer default 20)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.podcasting_admin_recent_page_views_impl($1);
$function$;

revoke all on function public.podcasting_admin_recent_page_views(integer) from public, anon;
grant execute on function public.podcasting_admin_recent_page_views(integer) to authenticated;
