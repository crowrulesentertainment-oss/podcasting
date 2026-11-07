-- Phase 2: move API-exposed SECURITY DEFINER implementations out of public.
-- Project: cevylpnoexugwgygvtgu
-- 45 existing RPCs retain their public names/signatures as SECURITY INVOKER wrappers.
-- Their original SECURITY DEFINER bodies are moved to the non-exposed private schema.
-- Existing per-role execute permissions are preserved on both wrapper and implementation.

begin;
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

do $migrate$
declare
  r record;
  v_call text;
  v_body text;
  v_volatility text;
begin
  for r in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           pg_get_function_arguments(p.oid) as full_args,
           pg_get_function_result(p.oid) as result_type,
           p.proretset,
           p.provolatile,
           p.pronargs,
           has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
           has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_exec,
           has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.prokind='f'
      and (
        has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE')
      )
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    if exists (
      select 1 from pg_proc x
      join pg_namespace xn on xn.oid=x.pronamespace
      where xn.nspname='private'
        and x.proname=r.proname||'_impl'
        and pg_get_function_identity_arguments(x.oid)=r.identity_args
    ) then
      raise exception 'Private implementation collision for %(%)',r.proname,r.identity_args;
    end if;

    v_call := '';
    if r.pronargs > 0 then
      select string_agg('$'||g.n::text, ', ' order by g.n)
      into v_call
      from generate_series(1,r.pronargs) as g(n);
    end if;

    if r.proretset then
      v_body := 'select * from private.'||quote_ident(r.proname||'_impl')||'('||coalesce(v_call,'')||')';
    else
      v_body := 'select private.'||quote_ident(r.proname||'_impl')||'('||coalesce(v_call,'')||')';
    end if;

    v_volatility := case r.provolatile
      when 'i' then 'IMMUTABLE'
      when 's' then 'STABLE'
      else 'VOLATILE'
    end;

    execute format('alter function public.%I(%s) set schema private',r.proname,r.identity_args);
    execute format('alter function private.%I(%s) rename to %I',r.proname,r.identity_args,r.proname||'_impl');

    execute format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as %L',
      r.proname,r.full_args,r.result_type,v_volatility,v_body
    );

    execute format('revoke all on function public.%I(%s) from public, anon, authenticated, service_role',r.proname,r.identity_args);
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated, service_role',r.proname||'_impl',r.identity_args);

    if r.anon_exec then
      execute format('grant execute on function public.%I(%s) to anon',r.proname,r.identity_args);
      execute format('grant execute on function private.%I(%s) to anon',r.proname||'_impl',r.identity_args);
    end if;
    if r.auth_exec then
      execute format('grant execute on function public.%I(%s) to authenticated',r.proname,r.identity_args);
      execute format('grant execute on function private.%I(%s) to authenticated',r.proname||'_impl',r.identity_args);
    end if;
    if r.service_exec then
      execute format('grant execute on function public.%I(%s) to service_role',r.proname,r.identity_args);
      execute format('grant execute on function private.%I(%s) to service_role',r.proname||'_impl',r.identity_args);
    end if;
  end loop;
end
$migrate$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

notify pgrst, 'reload schema';
commit;
