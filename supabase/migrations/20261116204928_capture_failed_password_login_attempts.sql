create table if not exists public.podcasting_auth_failure_events (
 id uuid primary key default gen_random_uuid(),
 identifier_hash text not null,
 source text not null default 'password_login' check (source='password_login'),
 attempted_at timestamptz not null default now()
);
alter table public.podcasting_auth_failure_events enable row level security;
revoke all on table public.podcasting_auth_failure_events from public,anon,authenticated;
create index if not exists podcasting_auth_failure_events_recent_idx on public.podcasting_auth_failure_events(attempted_at desc);
create index if not exists podcasting_auth_failure_events_identifier_idx on public.podcasting_auth_failure_events(identifier_hash,attempted_at desc);
create or replace function public.podcasting_record_login_failure(p_identifier text)
returns void language plpgsql security definer set search_path='' as $$
declare v_normalized text; v_hash text; v_recent integer;
begin
v_normalized:=lower(trim(coalesce(p_identifier,'')));
if length(v_normalized)<3 or length(v_normalized)>320 or position('@' in v_normalized)=0 then return; end if;
v_hash:=encode(extensions.digest(convert_to(v_normalized,'UTF8'),'sha256'),'hex');
perform pg_advisory_xact_lock(hashtext(v_hash));
select count(*) into v_recent from public.podcasting_auth_failure_events where identifier_hash=v_hash and attempted_at>now()-interval '15 minutes';
if v_recent>=12 then return; end if;
if (select count(*) from public.podcasting_auth_failure_events where attempted_at>now()-interval '1 minute')>=30 then return; end if;
insert into public.podcasting_auth_failure_events(identifier_hash,source) values(v_hash,'password_login');
delete from public.podcasting_auth_failure_events where attempted_at<now()-interval '90 days';
end $$;
revoke all on function public.podcasting_record_login_failure(text) from public;
grant execute on function public.podcasting_record_login_failure(text) to anon,authenticated;
create or replace function public.podcasting_security_auth_events(p_limit integer default 100)
returns table(event_id uuid,occurred_at timestamptz,user_id uuid,email text,action text,ip_address text,user_agent text,metadata jsonb)
language plpgsql security definer set search_path='' as $$
begin
if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(),false) then raise exception 'ADMIN_AUTH_REQUIRED' using errcode='42501'; end if;
return query select q.event_id,q.occurred_at,q.user_id,q.email,q.action,q.ip_address,q.user_agent,q.metadata from (
select e.id as event_id,e.created_at as occurred_at,
case when (e.payload->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e.payload->>'user_id')::uuid else null end as user_id,
coalesce(u.email,'') as email,coalesce(e.payload->>'action','unknown') as action,nullif(e.ip_address,'') as ip_address,nullif(e.payload->>'user_agent','') as user_agent,coalesce(e.payload->'metadata','{}'::json)::jsonb as metadata
from auth.audit_log_entries e left join auth.users u on u.id=case when (e.payload->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e.payload->>'user_id')::uuid else null end
union all
select f.id,f.attempted_at,null::uuid,'Identifier '||left(f.identifier_hash,12),'failed_password_login',null::text,null::text,jsonb_build_object('source',f.source,'identifier_fingerprint',left(f.identifier_hash,12))
from public.podcasting_auth_failure_events f
) q order by q.occurred_at desc limit greatest(1,least(coalesce(p_limit,100),250));
end $$;
revoke all on function public.podcasting_security_auth_events(integer) from public,anon;
grant execute on function public.podcasting_security_auth_events(integer) to authenticated;