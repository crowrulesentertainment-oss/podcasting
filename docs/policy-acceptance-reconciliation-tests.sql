-- LOCAL/CI-ONLY policy reconciliation security and lifecycle tests.
-- Run after the base ledger, expiration, and reconciliation draft SQL files.
-- Uses synthetic Auth users and rolls back all fixtures.

\if :{?member_a}
\else
  \set member_a '10000000-0000-0000-0000-000000000001'
\endif

begin;

-- Privilege boundary: authenticated gets the public wrapper, never the private
-- schema/helper. The function owner is non-login and cannot bypass RLS.
select not has_schema_privilege('anon','crowrules_policy_private','USAGE')
  as anon_cannot_use_private_schema;
select not has_schema_privilege('authenticated','crowrules_policy_private','USAGE')
  as authenticated_cannot_use_private_schema;
select not has_schema_privilege('service_role','crowrules_policy_private','USAGE')
  as service_role_cannot_use_private_schema;
select not has_function_privilege('authenticated',
  'crowrules_policy_private.accept_current_required_policy_versions_impl(uuid[])','EXECUTE')
  as authenticated_cannot_execute_private_helper;
select not has_function_privilege('anon',
  'crowrules_policy_private.accept_current_required_policy_versions_impl(uuid[])','EXECUTE')
  as anon_cannot_execute_private_helper;
select has_function_privilege('authenticated',
  'public.accept_current_required_policy_versions(uuid[])','EXECUTE')
  as authenticated_can_execute_public_wrapper;
select not has_function_privilege('anon',
  'public.accept_current_required_policy_versions(uuid[])','EXECUTE')
  as anon_cannot_execute_public_wrapper;
select not has_table_privilege('authenticated','public.policy_documents','INSERT')
  as member_cannot_insert_policy_documents_directly;
select not has_table_privilege('authenticated','public.policy_versions','INSERT')
  as member_cannot_insert_policy_versions_directly;
select not has_table_privilege('authenticated','public.policy_versions','UPDATE')
  as member_cannot_update_policy_versions_directly;
select has_table_privilege('crowrules_policy_owner','public.policy_acceptances','INSERT')
  as restricted_owner_can_insert_acceptance;
select has_table_privilege('crowrules_policy_owner','public.policy_acceptances','SELECT')
  as restricted_owner_can_check_idempotency;

select (
  not r.rolcanlogin and not r.rolsuper and not r.rolcreatedb
  and not r.rolcreaterole and not r.rolreplication and not r.rolbypassrls
  and not r.rolinherit
) as function_owner_is_restricted
from pg_catalog.pg_roles r
where r.rolname='crowrules_policy_owner';

select not exists (
  select 1
  from pg_catalog.pg_auth_members m
  where m.roleid=(select oid from pg_catalog.pg_roles where rolname='crowrules_policy_owner')
     or m.member=(select oid from pg_catalog.pg_roles where rolname='crowrules_policy_owner')
) as function_owner_has_no_role_memberships;

select pg_catalog.pg_get_userbyid(p.proowner)='crowrules_policy_owner'
  and p.prosecdef
  and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=""%'
  as public_wrapper_is_restricted_definer
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='accept_current_required_policy_versions'
  and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_policy_version_ids uuid[]';

select pg_catalog.pg_get_userbyid(p.proowner)='crowrules_policy_owner'
  and not p.prosecdef
  and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=""%'
  as private_helper_is_invoker_owned_by_restricted_role
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='crowrules_policy_private'
  and p.proname='accept_current_required_policy_versions_impl';

select pg_catalog.pg_get_userbyid(c.relowner)='crowrules_policy_owner'
  as current_view_has_restricted_owner
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='policy_current_versions';

select not exists (
  select 1
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('policy_documents','policy_versions','policy_acceptances')
    and c.relowner=(select oid from pg_catalog.pg_roles where rolname='crowrules_policy_owner')
) as function_owner_does_not_own_policy_tables;

-- Synthetic document with an older published version and a newer published
-- version. The newer version must be the only current result.
insert into public.policy_documents(document_key,title,description)
values ('reconcile_withdrawal','Reconciliation Withdrawal','Disposable fixture')
returning id \gset reconcile_doc_

insert into public.policy_versions(
  document_id,version_label,content_url,content_sha256,
  requires_acceptance,status,effective_at,published_at
)
values (
  :'reconcile_doc_id','old-required',
  'https://example.invalid/reconcile-old',repeat('a',64),
  true,'published',transaction_timestamp()-interval '2 days',
  transaction_timestamp()-interval '2 days'
)
returning id \gset reconcile_old_

insert into public.policy_versions(
  document_id,version_label,content_url,content_sha256,
  requires_acceptance,status,effective_at,published_at
)
values (
  :'reconcile_doc_id','new-required',
  'https://example.invalid/reconcile-new',repeat('b',64),
  true,'published',transaction_timestamp()-interval '1 day',
  transaction_timestamp()-interval '1 day'
)
returning id \gset reconcile_new_

select set_config('test.reconcile_old_id', :'reconcile_old_id', true);
select set_config('test.reconcile_new_id', :'reconcile_new_id', true);

set local role anon;
select count(*)=1 as anonymous_can_read_current_version_contract
from public.policy_current_versions
where document_id=:'reconcile_doc_id'::uuid
  and policy_version_id=:'reconcile_new_id'::uuid;
reset role;


select count(*)=1 as current_view_selects_only_latest_published
from public.policy_current_versions
where document_id=:'reconcile_doc_id'::uuid
  and policy_version_id=:'reconcile_new_id'::uuid;

select count(*)=1 as history_marks_old_version_superseded
from public.policy_published_history
where policy_version_id=:'reconcile_old_id'::uuid
  and history_state='superseded'
  and document_state='active';

-- The private implementation cannot be invoked directly by an authenticated member.
set local role authenticated;
do $test$
begin
  begin
    perform crowrules_policy_private.accept_current_required_policy_versions_impl(array[]::uuid[]);
    raise exception 'Authenticated member unexpectedly invoked private helper';
  exception when insufficient_privilege then null;
  end;
end
$test$;
reset role;

-- Only a synthetic admin claim can use the admin lifecycle RPC. The CI/local
-- bootstrap supplies a test-only private.crowrules_is_admin_impl() stub.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'member_a', true);
select set_config('request.jwt.claim.role','admin',true);
select public.policy_admin_withdraw_version(:'reconcile_new_id'::uuid);
reset role;

-- Latest withdrawn version leaves no current version; old published text is
-- historical only and the document state is explicitly withdrawn.
set local role anon;
select count(*)=0 as anonymous_current_view_hides_withdrawn_document
from public.policy_current_versions
where document_id=:'reconcile_doc_id'::uuid;
select count(*)=0 as anonymous_base_read_hides_withdrawn_content
from public.policy_versions
where id=:'reconcile_new_id'::uuid;
select count(*)=1 as anonymous_history_marks_document_withdrawn
from public.policy_published_history
where policy_version_id=:'reconcile_old_id'::uuid
  and document_state='withdrawn';
reset role;

select count(*)=0 as withdrawn_latest_has_no_current_version
from public.policy_current_versions
where document_id=:'reconcile_doc_id'::uuid;

select count(*)=1 as prior_published_version_marked_historical_after_withdrawal
from public.policy_published_history
where policy_version_id=:'reconcile_old_id'::uuid
  and history_state='superseded'
  and document_state='withdrawn';

-- A non-admin authenticated member cannot use administrative lifecycle RPCs.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'member_a', true);
select set_config('request.jwt.claim.role','member',true);
do $test$
begin
  begin
    perform public.policy_admin_create_document(
      'reconcile_forbidden','Forbidden','Should not be created'
    );
    raise exception 'Non-admin unexpectedly created a policy document';
  exception when insufficient_privilege then
    if sqlerrm not like 'ADMIN_AUTH_REQUIRED%' then raise; end if;
  end;
end
$test$;

-- The old required version cannot be accepted after the newer version is
-- withdrawn. This proves the old row does not become current again.
do $test$
begin
  begin
    perform public.accept_current_required_policy_versions(
      array[current_setting('test.reconcile_old_id')::uuid]
    );
    raise exception 'Withdrawn latest version unexpectedly revived its predecessor';
  exception when sqlstate '22023' then
    if sqlerrm not like 'A required policy is withdrawn%' then raise; end if;
  end;
end
$test$;
reset role;

-- A future-effective replacement does not cure the withdrawal gap early.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'member_a', true);
select set_config('request.jwt.claim.role','admin',true);
select public.policy_admin_create_draft_version(
  :'reconcile_doc_id'::uuid,
  'future-replacement',
  'https://example.invalid/reconcile-future',
  repeat('c',64),
  true,
  transaction_timestamp()+interval '1 day',
  null
) as future_version_id \gset
select public.policy_admin_publish_version(:'future_version_id'::uuid);
reset role;

select count(*)=0 as future_replacement_is_not_current_early
from public.policy_current_versions
where document_id=:'reconcile_doc_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'member_a', true);
select set_config('request.jwt.claim.role','member',true);
do $test$
begin
  begin
    perform public.accept_current_required_policy_versions(
      array[current_setting('test.reconcile_old_id')::uuid]
    );
    raise exception 'Future replacement unexpectedly cured withdrawal gap';
  exception when sqlstate '22023' then null;
  end;
end
$test$;
reset role;

-- A newly published, already-effective replacement becomes current and is the
-- only acceptable version. Acceptance remains attributed to the JWT subject.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'member_a', true);
select set_config('request.jwt.claim.role','admin',true);
select public.policy_admin_create_draft_version(
  :'reconcile_doc_id'::uuid,
  'effective-replacement',
  'https://example.invalid/reconcile-effective',
  repeat('d',64),
  true,
  transaction_timestamp()-interval '1 minute',
  null
) as effective_version_id \gset
select public.policy_admin_publish_version(:'effective_version_id'::uuid);
reset role;

select count(*)=1 as effective_replacement_is_current
from public.policy_current_versions
where document_id=:'reconcile_doc_id'::uuid
  and policy_version_id=:'effective_version_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'member_a', true);
select set_config('request.jwt.claim.role','member',true);
select public.accept_current_required_policy_versions(
  array[:'effective_version_id'::uuid]
)=1 as acceptance_uses_effective_replacement;
reset role;

select count(*)=0 as old_version_was_not_accepted
from public.policy_acceptances
where user_id=:'member_a'::uuid
  and policy_version_id=:'reconcile_old_id'::uuid;

select count(*)=1 as replacement_acceptance_recorded
from public.policy_acceptances
where user_id=:'member_a'::uuid
  and policy_version_id=:'effective_version_id'::uuid;


rollback;
