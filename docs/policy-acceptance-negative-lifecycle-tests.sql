-- LOCAL-ONLY negative, lifecycle, and immutability tests for the policy ledger.
-- Run after the migration and smoke harness against a disposable PostgreSQL database.
-- Uses synthetic Auth identities and rolls back every fixture at the end.

begin;

insert into public.policy_documents(document_key,title,description)
values
  ('negative_required','Negative Test Required','Disposable fixture'),
  ('negative_required_two','Negative Test Required Two','Disposable fixture'),
  ('negative_draft','Negative Test Draft','Disposable fixture'),
  ('negative_withdrawn','Negative Test Withdrawn','Disposable fixture'),
  ('negative_future','Negative Test Future','Disposable fixture'),
  ('negative_superseded','Negative Test Superseded','Disposable fixture'),
  ('negative_optional','Negative Test Optional','Disposable fixture');

select id as required_doc_id from public.policy_documents where document_key='negative_required' \gset
select id as required_doc_two_id from public.policy_documents where document_key='negative_required_two' \gset
select id as draft_doc_id from public.policy_documents where document_key='negative_draft' \gset
select id as withdrawn_doc_id from public.policy_documents where document_key='negative_withdrawn' \gset
select id as future_doc_id from public.policy_documents where document_key='negative_future' \gset
select id as superseded_doc_id from public.policy_documents where document_key='negative_superseded' \gset

insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at)
values
  (:'required_doc_id','required-1','https://example.invalid/required-1',repeat('a',64),true,'published',now()-interval '1 hour',now()-interval '1 hour'),
  (:'required_doc_two_id','required-2','https://example.invalid/required-2',repeat('7',64),true,'published',now()-interval '30 minutes',now()-interval '30 minutes'),
  (:'draft_doc_id','draft-1','https://example.invalid/draft-1',repeat('b',64),true,'draft',now()+interval '1 hour',null),
  (:'withdrawn_doc_id','withdrawn-1','https://example.invalid/withdrawn-1',repeat('c',64),true,'withdrawn',now()-interval '2 hours',now()-interval '2 hours'),
  (:'future_doc_id','future-1','https://example.invalid/future-1',repeat('d',64),true,'published',now()+interval '1 day',now()),
  (:'superseded_doc_id','superseded-required-1','https://example.invalid/superseded-required-1',repeat('e',64),true,'published',now()-interval '2 hours',now()-interval '2 hours');

select id as required_version_id from public.policy_versions where document_id=:'required_doc_id'::uuid \gset
select id as required_version_two_id from public.policy_versions where document_id=:'required_doc_two_id'::uuid \gset
select id as draft_version_id from public.policy_versions where document_id=:'draft_doc_id'::uuid \gset
select id as withdrawn_version_id from public.policy_versions where document_id=:'withdrawn_doc_id'::uuid \gset
select id as future_version_id from public.policy_versions where document_id=:'future_doc_id'::uuid \gset
select id as superseded_required_version_id from public.policy_versions where document_id=:'superseded_doc_id'::uuid \gset

-- The latest published version is authoritative. A newer non-required version
-- supersedes the old required version and removes that document from the required set.
insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at)
values (:'superseded_doc_id','superseded-optional-2','https://example.invalid/superseded-optional-2',repeat('f',64),false,'published',now()-interval '1 hour',now()-interval '1 hour');
select id as superseding_optional_version_id from public.policy_versions where document_id=:'superseded_doc_id'::uuid and version_label='superseded-optional-2' \gset

-- Constraint and unique-key validation.
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

select pg_temp.assert_sqlstate(
  format('insert into public.policy_documents(document_key,title) values (%L,%L)','negative_required','Duplicate key'),
  '23505','duplicate policy document key'
);
select pg_temp.assert_sqlstate(
  format('insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at) values (%L,%L,%L,%L,true,''published'',now(),now())',:'required_doc_id','required-1','https://example.invalid/duplicate',repeat('1',64)),
  '23505','duplicate version label for one document'
);
select pg_temp.assert_sqlstate(
  format('insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at) values (%L,%L,%L,%L,true,''published'',now(),now())',:'required_doc_id','bad-hash','https://example.invalid/bad-hash','not-a-sha256'),
  '23514','malformed content checksum'
);
select pg_temp.assert_sqlstate(
  format('insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at) values (%L,%L,%L,%L,true,''published'',now(),now())',:'required_doc_id','bad-url','http://example.invalid/bad-url',repeat('2',64)),
  '23514','non-HTTPS policy content URL'
);
select pg_temp.assert_sqlstate(
  format('insert into public.policy_versions(document_id,version_label,content_url,content_sha256,requires_acceptance,status,effective_at,published_at) values (%L,%L,%L,%L,true,''published'',now(),now())',:'required_doc_id','','https://example.invalid/bad-status',repeat('3',64)),
  '23514','empty version label is invalid'
);

-- psql variables are not visible inside PL/pgSQL. Set fixture IDs as transaction
-- settings, then exercise all invalid sets using those settings.
select set_config('test.required_version_id', :'required_version_id', true);
select set_config('test.required_version_two_id', :'required_version_two_id', true);
select set_config('test.draft_version_id', :'draft_version_id', true);
select set_config('test.withdrawn_version_id', :'withdrawn_version_id', true);
select set_config('test.future_version_id', :'future_version_id', true);
select set_config('test.superseded_required_version_id', :'superseded_required_version_id', true);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $
begin
  begin perform public.accept_current_required_policy_versions(array[]::uuid[]);
    raise exception 'empty version list unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array['99999999-9999-9999-9999-999999999999'::uuid]);
    raise exception 'unknown version unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array[current_setting('test.draft_version_id')::uuid]);
    raise exception 'draft version unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array[current_setting('test.withdrawn_version_id')::uuid]);
    raise exception 'withdrawn version unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array[current_setting('test.future_version_id')::uuid]);
    raise exception 'not-yet-effective version unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array[current_setting('test.superseded_required_version_id')::uuid]);
    raise exception 'superseded required version unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array[current_setting('test.required_version_id')::uuid]);
    raise exception 'incomplete required set unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.accept_current_required_policy_versions(array[
    current_setting('test.required_version_id')::uuid,
    current_setting('test.required_version_id')::uuid
  ]);
    raise exception 'duplicate version ID unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
end $$;

-- The exact current required set succeeds. The newer optional version has
-- superseded its document's former required version and is not required.
select public.accept_current_required_policy_versions(array[
  current_setting('test.required_version_id')::uuid,
  current_setting('test.required_version_two_id')::uuid
]) = 2 as exact_current_required_set_succeeds;
reset role;

-- Immutable version content: all identifying/content/effectivity fields reject edits.
select pg_temp.assert_sqlstate(format('update public.policy_versions set version_label=%L where id=%L','rewritten-label',:'required_version_id'),'55000','version label immutable');
select pg_temp.assert_sqlstate(format('update public.policy_versions set content_url=%L where id=%L','https://example.invalid/rewritten',:'required_version_id'),'55000','content URL immutable');
select pg_temp.assert_sqlstate(format('update public.policy_versions set content_sha256=%L where id=%L',repeat('9',64),:'required_version_id'),'55000','content checksum immutable');
select pg_temp.assert_sqlstate(format('update public.policy_versions set requires_acceptance=false where id=%L',:'required_version_id'),'55000','acceptance requirement immutable');
select pg_temp.assert_sqlstate(format('update public.policy_versions set effective_at=now()-interval ''3 days'' where id=%L',:'required_version_id'),'55000','effective timestamp immutable');
select pg_temp.assert_sqlstate(format('update public.policy_versions set document_id=%L where id=%L',:'draft_doc_id',:'required_version_id'),'55000','document association immutable');

-- Legal lifecycle: draft -> published -> withdrawn.
update public.policy_versions set status='published',published_at=now()
where id=:'draft_version_id'::uuid;
update public.policy_versions set status='withdrawn'
where id=:'draft_version_id'::uuid;

-- Illegal lifecycle transitions and publication timestamp rewrites are rejected.
select pg_temp.assert_sqlstate(format('update public.policy_versions set status=''published'' where id=%L',:'draft_version_id'),'55000','withdrawn cannot be republished');
select pg_temp.assert_sqlstate(format('update public.policy_versions set status=''draft'',published_at=null where id=%L',:'required_version_id'),'55000','published cannot return to draft');
select pg_temp.assert_sqlstate(format('update public.policy_versions set published_at=now()+interval ''1 day'' where id=%L',:'required_version_id'),'55000','publication timestamp immutable after publish');

-- Final owner-side check: exactly one acceptance was inserted by the valid set.
do $$
begin
  if (select count(*) from public.policy_acceptances where policy_version_id in (
    current_setting('test.required_version_id')::uuid,
    current_setting('test.required_version_two_id')::uuid
  )) <> 2 then
    raise exception 'Expected exactly two acceptances from the complete current required set';
  end if;
  if exists (select 1 from public.policy_acceptances where policy_version_id=current_setting('test.superseded_required_version_id')::uuid) then
    raise exception 'Superseded required version must not have an acceptance';
  end if;
end $$;

rollback;
