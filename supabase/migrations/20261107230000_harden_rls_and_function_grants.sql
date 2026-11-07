-- CrowRules Supabase hardening
-- Project: cevylpnoexugwgygvtgu
-- Applied 2026-11-07. No tables or application data were removed.

-- 1. The 169 tables were already RLS-enabled and had no policies.
-- RLS therefore already denied all client rows. Add explicit deny policies
-- for anon/authenticated so the intent is visible and linted, without
-- granting any new access. service_role retains its normal RLS bypass.
do $block$
declare r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
        where p.schemaname=n.nspname and p.tablename=c.relname
      )
  loop
    execute format(
      'create policy %I on %I.%I for all to anon, authenticated using (false) with check (false)',
      'deny_api_access_no_policy', r.schema_name, r.table_name
    );
  end loop;
end
$block$;

-- 2. Eliminate role/session search_path mutability on this trigger function.
alter function public.create_crew_draft_from_approved_host_application()
  set search_path = '';

-- 3. Remove default PUBLIC EXECUTE from exposed SECURITY DEFINER functions.
-- Re-grant only the exact roles that had access before this change, preserving
-- the established app contract while preventing unrelated database roles from
-- inheriting EXECUTE merely through PUBLIC.
do $block$
declare r record; was_anon boolean; was_auth boolean; was_service boolean;
begin
  for r in
    select p.oid, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and (
        has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE')
      )
  loop
    was_anon := has_function_privilege('anon',r.oid,'EXECUTE');
    was_auth := has_function_privilege('authenticated',r.oid,'EXECUTE');
    was_service := has_function_privilege('service_role',r.oid,'EXECUTE');
    execute format('revoke all on function %I.%I(%s) from public',r.nspname,r.proname,r.args);
    execute format('revoke all on function %I.%I(%s) from anon',r.nspname,r.proname,r.args);
    execute format('revoke all on function %I.%I(%s) from authenticated',r.nspname,r.proname,r.args);
    execute format('revoke all on function %I.%I(%s) from service_role',r.nspname,r.proname,r.args);
    if was_anon then execute format('grant execute on function %I.%I(%s) to anon',r.nspname,r.proname,r.args); end if;
    if was_auth then execute format('grant execute on function %I.%I(%s) to authenticated',r.nspname,r.proname,r.args); end if;
    if was_service then execute format('grant execute on function %I.%I(%s) to service_role',r.nspname,r.proname,r.args); end if;
  end loop;
end
$block$;
