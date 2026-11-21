-- LOCAL-ONLY policy ledger smoke tests.
-- Run only after applying the policy migration to a disposable local Supabase database.
-- Supply two existing disposable Auth user UUIDs in the variables below.
-- This script rolls back all policy fixtures and acceptance records at the end.
\if :{?member_a}
\else
  \set member_a '00000000-0000-0000-0000-000000000001'
\endif
\if :{?member_b}
\else
  \set member_b '00000000-0000-0000-0000-000000000002'
\endif

begin;
select set_config('test.member_a', :'member_a', true);
select set_config('test.member_b', :'member_b', true);

-- Confirm the two test users exist before creating foreign-keyed acceptance rows.
do $$
begin
  if not exists (select 1 from auth.users where id = current_setting('test.member_a')::uuid) then
    raise exception 'member_a must be an existing disposable auth.users row';
  end if;
  if not exists (select 1 from auth.users where id = current_setting('test.member_b')::uuid) then
    raise exception 'member_b must be an existing disposable auth.users row';
  end if;
end $$;

-- Create a disposable required policy version as the database owner.
insert into public.policy_documents(document_key,title,description)
values ('local_test_terms','Local Test Terms','Temporary test fixture')
returning id \gset doc_

insert into public.policy_versions(
  document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at
)
values (
  :'doc_id','local-1','https://example.invalid/local-test-terms',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  true,'published',now()-interval '1 minute',now()
)
returning id \gset ver_
select set_config('test.version_id', :'ver_id', true);

-- Anonymous: published policy metadata is readable; acceptance ledger and RPC are not.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select count(*) >= 1 as anon_can_read_published_versions
from public.policy_versions where id=current_setting('test.version_id')::uuid;
select count(*) >= 1 as anon_can_read_published_document
from public.policy_documents where id=:'doc_id'::uuid;
select not has_table_privilege('anon','public.policy_acceptances','SELECT') as anon_cannot_select_acceptance_ledger;
select not has_function_privilege('anon','public.accept_current_required_policy_versions(uuid[])','EXECUTE') as anon_cannot_execute_acceptance_rpc;
select not has_schema_privilege('anon','crowrules_policy_private','USAGE') as anon_cannot_access_private_schema;
reset role;

-- An authenticated database role without a JWT subject must not accept.
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $
begin
  begin
    perform public.accept_current_required_policy_versions(
      array[current_setting('test.version_id')::uuid]
    );
    raise exception 'SECURITY FAILURE: RPC accepted a request without auth.uid()';
  exception when sqlstate '28000' then null;
  end;
end $;
reset role;

-- Member A accepts. The RPC derives identity from auth.uid().
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member_a'),true);
select public.accept_current_required_policy_versions(array[current_setting('test.version_id')::uuid]) = 1
  as member_a_first_acceptance_inserts_one;
select public.accept_current_required_policy_versions(array[current_setting('test.version_id')::uuid]) = 0
  as member_a_repeat_is_idempotent;
reset role;

-- Member B accepts the same version; this must create a separate owner-scoped row.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member_b'),true);
select public.accept_current_required_policy_versions(array[current_setting('test.version_id')::uuid]) = 1
  as member_b_acceptance_is_scoped_to_member_b;
reset role;

-- Member A can see A's row but cannot see B's row.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member_a'),true);
select count(*) = 1 as member_a_can_read_own_acceptance
from public.policy_acceptances where user_id=current_setting('test.member_a')::uuid;
select count(*) = 0 as member_a_cannot_read_member_b
from public.policy_acceptances where user_id=current_setting('test.member_b')::uuid;
select not has_table_privilege('authenticated','public.policy_acceptances','INSERT') as member_cannot_insert_directly;
select not has_table_privilege('authenticated','public.policy_acceptances','UPDATE') as member_cannot_update_directly;
select not has_table_privilege('authenticated','public.policy_acceptances','DELETE') as member_cannot_delete_directly;
select has_function_privilege('authenticated','public.accept_current_required_policy_versions(uuid[])','EXECUTE') as member_can_execute_public_rpc;
select has_schema_privilege('authenticated','crowrules_policy_private','USAGE') as member_can_reach_private_impl_schema;

-- Direct client insert is denied by table privileges.
do $$
begin
  begin
    insert into public.policy_acceptances(user_id,policy_version_id)
    values (current_setting('test.member_a')::uuid, current_setting('test.version_id')::uuid);
    raise exception 'SECURITY FAILURE: direct acceptance insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Owner-side assertions and immutability check.
do $$
begin
  if (select count(*) from public.policy_acceptances where policy_version_id=current_setting('test.version_id')::uuid) <> 2 then
    raise exception 'Expected one acceptance per test member';
  end if;
  begin
    update public.policy_acceptances set accepted_at=now()
    where user_id=current_setting('test.member_a')::uuid and policy_version_id=current_setting('test.version_id')::uuid;
    raise exception 'SECURITY FAILURE: acceptance update unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    delete from public.policy_acceptances
    where user_id=current_setting('test.member_a')::uuid and policy_version_id=current_setting('test.version_id')::uuid;
    raise exception 'SECURITY FAILURE: acceptance delete unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
end $;

rollback;
