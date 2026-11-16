-- CrowRules Podcasting: Security & Access Control 15.0.3
-- Integrates the existing podcast admin registry with the established admin
-- authorization check and exposes tightly scoped security operations.

create or replace function private.cr_platform_is_admin_lookup()
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $function$
  select
    lower(coalesce((auth.jwt() -> 'app_metadata' ->> 'role'),'')) in ('admin','owner','super_admin')
    or exists (
      select 1 from public.members m
      where m.user_id = (select auth.uid())
        and lower(coalesce(m.status,'')) = 'active'
        and lower(coalesce(m.role,'')) in ('admin','owner','super_admin')
    )
    or exists (
      select 1 from public.hub_admins h
      where h.user_id = (select auth.uid())
        and lower(coalesce(h.role,'')) in ('admin','owner','super_admin')
    )
    or exists (
      select 1 from public.cr_admins a
      where a.user_id = (select auth.uid())
        and a.is_active = true
        and lower(coalesce(a.role,'')) in ('admin','owner','super_admin')
    );
$function$;

create or replace function public.podcasting_security_directory()
returns table (
  user_id uuid,
  email text,
  registry_role text,
  registry_active boolean,
  registry_created_at timestamptz,
  registry_updated_at timestamptz,
  effective_admin boolean,
  access_sources text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;
  return query
  select u.id, coalesce(u.email,''),
    a.role, coalesce(a.is_active,false), a.created_at, a.updated_at,
    (
      lower(coalesce(u.raw_app_meta_data->>'role','')) in ('admin','owner','super_admin')
      or (exists(select 1 from public.members m where m.user_id=u.id and lower(coalesce(m.status,''))='active' and lower(coalesce(m.role,'')) in ('admin','owner','super_admin')))
      or (exists(select 1 from public.hub_admins h where h.user_id=u.id and lower(coalesce(h.role,'')) in ('admin','owner','super_admin')))
      or coalesce(a.is_active,false)
    ),
    array_remove(array[
      case when lower(coalesce(u.raw_app_meta_data->>'role','')) in ('admin','owner','super_admin') then 'app_metadata' end,
      case when exists(select 1 from public.members m where m.user_id=u.id and lower(coalesce(m.status,''))='active' and lower(coalesce(m.role,'')) in ('admin','owner','super_admin')) then 'members' end,
      case when exists(select 1 from public.hub_admins h where h.user_id=u.id and lower(coalesce(h.role,'')) in ('admin','owner','super_admin')) then 'hub_admins' end,
      case when coalesce(a.is_active,false) then 'cr_admins' end
    ], null)
  from auth.users u
  left join public.cr_admins a on a.user_id=u.id
  order by
    (lower(coalesce(u.raw_app_meta_data->>'role','')) in ('admin','owner','super_admin')
      or exists(select 1 from public.members m where m.user_id=u.id and lower(coalesce(m.status,''))='active' and lower(coalesce(m.role,'')) in ('admin','owner','super_admin'))
      or exists(select 1 from public.hub_admins h where h.user_id=u.id and lower(coalesce(h.role,'')) in ('admin','owner','super_admin'))
      or coalesce(a.is_active,false)) desc,
    u.created_at desc;
end;
$$;

create or replace function public.podcasting_security_set_admin(p_user_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_before boolean := false;
  v_after boolean;
  v_other_sources text[];
begin
  if v_actor is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'SELF_ROLE_CHANGE_NOT_ALLOWED' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id=p_user_id;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  select coalesce(is_active,false) into v_before from public.cr_admins where user_id=p_user_id;
  if not p_is_active and v_before and (select count(*) from public.cr_admins where is_active=true and lower(role) in ('admin','owner','super_admin')) <= 1 then
    raise exception 'LAST_ACTIVE_REGISTRY_ADMIN' using errcode = '23514';
  end if;
  if p_is_active then
    insert into public.cr_admins(user_id,role,is_active,updated_at)
    values(p_user_id,'admin',true,now())
    on conflict (user_id) do update set role='admin',is_active=true,updated_at=now();
  else
    update public.cr_admins set is_active=false,updated_at=now() where user_id=p_user_id;
  end if;
  v_after := p_is_active;
  select array_remove(array[
    case when lower(coalesce(u.raw_app_meta_data->>'role','')) in ('admin','owner','super_admin') then 'app_metadata' end,
    case when exists(select 1 from public.members m where m.user_id=p_user_id and lower(coalesce(m.status,''))='active' and lower(coalesce(m.role,'')) in ('admin','owner','super_admin')) then 'members' end,
    case when exists(select 1 from public.hub_admins h where h.user_id=p_user_id and lower(coalesce(h.role,'')) in ('admin','owner','super_admin')) then 'hub_admins' end
  ],null) into v_other_sources from auth.users u where u.id=p_user_id;
  insert into public.cr_podcast_admin_audit(admin_user_id,action,entity_type,entity_id,details)
  values(v_actor,case when p_is_active then 'security.admin_granted' else 'security.admin_revoked' end,
    'cr_admins',p_user_id,jsonb_build_object('email',v_email,'registry_before',v_before,'registry_after',v_after,'other_admin_sources',coalesce(v_other_sources,'{}'::text[])));
  return jsonb_build_object('user_id',p_user_id,'email',v_email,'registry_active',v_after,'other_admin_sources',coalesce(v_other_sources,'{}'::text[]));
end;
$$;

create or replace function public.podcasting_security_sessions_list(p_limit integer default 100)
returns table (
  session_id uuid,
  user_id uuid,
  email text,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamp,
  not_after timestamptz,
  ip_address text,
  user_agent text,
  aal text,
  is_current boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;
  return query
  select s.id,s.user_id,coalesce(u.email,''),s.created_at,s.updated_at,s.refreshed_at,
    s.not_after,host(s.ip),s.user_agent,s.aal::text,
    s.id::text = (auth.jwt()->>'session_id')
  from auth.sessions s
  left join auth.users u on u.id=s.user_id
  order by s.refreshed_at desc nulls last,s.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$$;

create or replace function public.podcasting_security_revoke_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid; v_actor uuid:=auth.uid();
begin
  if v_actor is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_session_id is null or p_session_id::text=(auth.jwt()->>'session_id') then
    raise exception 'CANNOT_REVOKE_CURRENT_SESSION' using errcode = '42501';
  end if;
  delete from auth.sessions where id=p_session_id and user_id<>v_actor returning user_id into v_user_id;
  if v_user_id is null then raise exception 'SESSION_NOT_FOUND_OR_NOT_REVOCABLE' using errcode = 'P0002'; end if;
  insert into public.cr_podcast_admin_audit(admin_user_id,action,entity_type,entity_id,details)
  values(v_actor,'security.session_revoked','auth.sessions',p_session_id,jsonb_build_object('target_user_id',v_user_id,'revocation_scope','refresh_session'));
  return jsonb_build_object('session_id',p_session_id,'user_id',v_user_id,'revoked',true,
    'note','Refresh session revoked. Previously issued access JWTs may remain valid until their expiry unless the protected operation checks session_id against auth.sessions.');
end;
$$;

create or replace function public.podcasting_security_auth_events(p_limit integer default 100)
returns table (
  event_id uuid,
  occurred_at timestamptz,
  user_id uuid,
  email text,
  action text,
  ip_address text,
  user_agent text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;
  return query
  select e.id,e.created_at,
    case when (e.payload->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e.payload->>'user_id')::uuid else null end,
    coalesce(u.email,''),
    coalesce(e.payload->>'action','unknown'),
    nullif(e.ip_address,''),
    nullif(e.payload->>'user_agent',''),
    coalesce(e.payload->'metadata','{}'::json)
  from auth.audit_log_entries e
  left join auth.users u on u.id=case when (e.payload->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e.payload->>'user_id')::uuid else null end
  order by e.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$$;

-- Audit role registry changes with the existing append-only capture function.
drop trigger if exists cr_admin_audit_capture on public.cr_admins;
create trigger cr_admin_audit_capture
after insert or update or delete on public.cr_admins
for each row execute function private.cr_podcast_admin_audit_capture();

revoke all on function public.podcasting_security_directory() from public, anon;
revoke all on function public.podcasting_security_set_admin(uuid,boolean) from public, anon;
revoke all on function public.podcasting_security_sessions_list(integer) from public, anon;
revoke all on function public.podcasting_security_revoke_session(uuid) from public, anon;
revoke all on function public.podcasting_security_auth_events(integer) from public, anon;
grant execute on function public.podcasting_security_directory() to authenticated;
grant execute on function public.podcasting_security_set_admin(uuid,boolean) to authenticated;
grant execute on function public.podcasting_security_sessions_list(integer) to authenticated;
grant execute on function public.podcasting_security_revoke_session(uuid) to authenticated;
grant execute on function public.podcasting_security_auth_events(integer) to authenticated;
