-- Disposable-only policy expiration tests.
-- Run after the base versioned policy migration and docs/policy-version-expiration-migration-draft.sql.
-- Every fixture is synthetic and rolled back.

begin;

create or replace function pg_temp.assert_sqlstate(p_sql text,p_expected_state text,p_label text)
returns void language plpgsql as $$
declare v_actual_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_actual_state = returned_sqlstate;
    if v_actual_state = p_expected_state then return; end if;
    raise exception '%: expected SQLSTATE %, received %',p_label,p_expected_state,v_actual_state;
  end;
  raise exception '%: statement unexpectedly succeeded',p_label;
end $$;

insert into public.policy_documents(document_key,title)
values
 ('expiry_no_end','Expiry No End'),
 ('expiry_future_end','Expiry Future End'),
 ('expiry_replacement','Expiry Replacement'),
 ('expiry_blocked','Expiry Blocked'),
 ('expiry_no_resurrection','Expiry No Resurrection'),
 ('expiry_draft_edit','Expiry Draft Edit');

select id as no_end_doc from public.policy_documents where document_key='expiry_no_end' \gset
select id as future_doc from public.policy_documents where document_key='expiry_future_end' \gset
select id as replacement_doc from public.policy_documents where document_key='expiry_replacement' \gset
select id as blocked_doc from public.policy_documents where document_key='expiry_blocked' \gset
select id as resurrection_doc from public.policy_documents where document_key='expiry_no_resurrection' \gset

insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at,expires_at)
values
 (:'no_end_doc','no-end-1','https://example.invalid/no-end',repeat('a',64),true,'published',now()-interval '1 day',now()-interval '1 day',null),
 (:'future_doc','future-end-1','https://example.invalid/future-end',repeat('b',64),true,'published',now()-interval '1 day',now()-interval '1 day',now()+interval '1 day'),
 (:'replacement_doc','replacement-old','https://example.invalid/replacement-old',repeat('c',64),true,'published',now()-interval '3 days',now()-interval '3 days',now()-interval '1 day'),
 (:'replacement_doc','replacement-current','https://example.invalid/replacement-current',repeat('d',64),true,'published',now()-interval '1 hour',now()-interval '1 hour',now()+interval '1 day'),
 (:'resurrection_doc','resurrection-old-required','https://example.invalid/resurrection-old',repeat('1',64),true,'published',now()-interval '4 days',now()-interval '4 days',null),
 (:'resurrection_doc','resurrection-new-optional-expired','https://example.invalid/resurrection-new',repeat('2',64),false,'published',now()-interval '2 days',now()-interval '2 days',now()-interval '1 day'),
 (:'draft_doc','draft-expiry-edit','https://example.invalid/draft-expiry',repeat('4',64),true,'draft',now()-interval '1 hour',null,null);

select id as no_end_version from public.policy_versions where document_id=:'no_end_doc'::uuid \gset
select id as future_version from public.policy_versions where document_id=:'future_doc'::uuid \gset
select id as replacement_current from public.policy_versions where document_id=:'replacement_doc'::uuid and version_label='replacement-current' \gset
select id as resurrection_old from public.policy_versions where document_id=:'resurrection_doc'::uuid and version_label='resurrection-old-required' \gset

select pg_temp.assert_sqlstate(
 format('insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at,expires_at) values (%L,%L,%L,%L,true,''published'',now(),now(),now())',:'no_end_doc','invalid-expiry','https://example.invalid/invalid-expiry',repeat('3',64)),
 '23514','expiration must follow effective date'
);

-- Expiration may be configured while draft, then is frozen on publication.
update public.policy_versions
set expires_at=now()+interval '30 days'
where id=:'draft_version'::uuid;
update public.policy_versions
set status='published',published_at=now()
where id=:'draft_version'::uuid;

select set_config('test.expiry_no_end_version', :'no_end_version', true);
select set_config('test.expiry_future_version', :'future_version', true);
select set_config('test.expiry_replacement_current', :'replacement_current', true);
select set_config('test.expiry_resurrection_old', :'resurrection_old', true);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);

-- No-expiry and future-expiry versions remain valid; the effective replacement
-- supersedes its expired predecessor.
do $test$
declare v_count integer;
begin
  v_count := public.accept_current_required_policy_versions(array[
    current_setting('test.expiry_no_end_version')::uuid,
    current_setting('test.expiry_future_version')::uuid,
    current_setting('test.expiry_replacement_current')::uuid
  ]);
  if v_count <> 3 then raise exception 'Expected three current required acceptances, got %',v_count; end if;
end
$test$;

-- An expired newer optional version supersedes the old required version;
-- the old required version must not be resurrected into the acceptance set.
do $test$
declare v_count integer;
begin
  v_count := public.accept_current_required_policy_versions(array[
    current_setting('test.expiry_no_end_version')::uuid,
    current_setting('test.expiry_future_version')::uuid,
    current_setting('test.expiry_replacement_current')::uuid
  ]);
  if v_count <> 0 then raise exception 'Repeated exact acceptance should be idempotent'; end if;
  if exists (
    select 1 from public.policy_acceptances
    where policy_version_id=current_setting('test.expiry_resurrection_old')::uuid
  ) then raise exception 'Expired newer optional version revived old required version'; end if;
end
$test$;

-- Add an expired latest required version with only a future-effective replacement.
-- It must block subsequent acceptance until that replacement becomes effective.
reset role;
insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at,expires_at)
values
 ( :'blocked_doc','blocked-expired','https://example.invalid/blocked-expired',repeat('e',64),true,'published',now()-interval '3 days',now()-interval '3 days',now()),
 (:'blocked_doc','blocked-future-replacement','https://example.invalid/blocked-future',repeat('f',64),true,'published',now()+interval '1 day',now(),now()+interval '2 days');
select id as blocked_version from public.policy_versions where document_id=:'blocked_doc'::uuid and version_label='blocked-expired' \gset
select set_config('test.expiry_blocked_version', :'blocked_version', true);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);

do $test$
begin
  begin
    perform public.accept_current_required_policy_versions(array[
      current_setting('test.expiry_no_end_version')::uuid,
      current_setting('test.expiry_future_version')::uuid,
      current_setting('test.expiry_replacement_current')::uuid,
      current_setting('test.expiry_blocked_version')::uuid
    ]);
    raise exception 'Expired required policy unexpectedly allowed acceptance';
  exception when sqlstate '22023' then
    if sqlerrm not like 'A required policy has expired%' then raise; end if;
  end;
end
$test$;

reset role;
select pg_temp.assert_sqlstate(
 format('update public.policy_versions set expires_at=now()+interval ''30 days'' where id=%L',:'replacement_current'),
 '55000','published expiration immutable'
);
select pg_temp.assert_sqlstate(
 format('update public.policy_versions set expires_at=now()+interval ''60 days'' where id=%L',:'draft_version'),
 '55000','draft expiration becomes immutable after publication'
);

do $test$
begin
  if not exists (
    select 1 from public.policy_acceptances
    where policy_version_id=current_setting('test.expiry_no_end_version')::uuid
      and user_id='10000000-0000-0000-0000-000000000001'::uuid
  ) then raise exception 'Expected original acceptance history to remain'; end if;
end
$test$;

rollback;
