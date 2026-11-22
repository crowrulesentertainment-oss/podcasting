-- CrowRules Connection Groups — local-only RLS integration tests
-- Run only after the recovered migration history, Phase 1 draft, and
-- groups social-permissions draft have been applied to a disposable local DB.
-- Every fixture is synthetic and the transaction is rolled back at the end.
-- DO NOT run against the linked production project.

begin;

do $preflight$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='podcast_community_circles'
      and column_name='visibility'
  ) then
    raise exception 'Phase 1 migration is missing: podcast_community_circles.visibility';
  end if;
  if to_regclass('public.podcast_community_circle_categories') is null then
    raise exception 'Phase 1 migration is missing: dynamic categories table';
  end if;
  if to_regclass('public.podcast_community_circle_join_requests') is null then
    raise exception 'Phase 1 migration is missing: join requests table';
  end if;
  if to_regclass('public.podcast_community_circle_messages') is null then
    raise exception 'Phase 1 migration is missing: group messages table';
  end if;
  if to_regprocedure('public.review_podcast_circle_join_request(uuid,text)') is null then
    raise exception 'Phase 1 migration is missing the public approval wrapper';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.podcast_community_circle_join_requests'::regclass) then
    raise exception 'RLS is not enabled on join requests';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.podcast_community_circle_messages'::regclass) then
    raise exception 'RLS is not enabled on group messages';
  end if;
  if has_table_privilege('anon','public.podcast_community_circle_replies','SELECT') then
    raise exception 'Anonymous reply SELECT is not part of the approved API contract';
  end if;
end
$preflight$;

-- Synthetic Auth identities. Fixed IDs are safe because the whole test rolls back.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-owner-a@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-mod-a@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-member-a@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-owner-b@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-member-b@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-requester@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-outsider@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-invitee@example.test','',now(),now(),now(),'{}','{}'),
  ('00000000-0000-4000-8000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated','crg-admin@example.test','',now(),now(),now(),'{}','{}');

-- Circle A is discoverable/private, B is hidden, C is public.
insert into public.podcast_community_circles (
  id, owner_id, name, description, category, is_public, is_featured,
  community_rules, branch_key, visibility, group_chat_enabled
) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','CRG Private A','Private test circle','Test',false,false,'','community','private',true),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','CRG Hidden B','Hidden test circle','Test',false,false,'','community','hidden',false),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','CRG Public C','Public test circle','Test',true,false,'','community','public',true),
  ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','CRG Hidden D','Uninvited hidden test circle','Test',false,false,'','community','hidden',true);

insert into public.podcast_community_circle_members (circle_id, member_id, role) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','moderator'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','member'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','owner'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','member');

insert into public.podcast_community_circle_posts (id, circle_id, author_id, body) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Private A post'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','Hidden B post'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Public C post');

insert into public.podcast_community_circle_messages (circle_id, sender_id, body) values
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','Disabled group chat fixture');

insert into public.podcast_community_circle_invites (
  circle_id, inviter_id, invitee_id, status
) values (
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000008',
  'accepted'
);

-- Anonymous discovery: active categories and public/private metadata are visible; hidden is not.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $anon_tests$
declare v_count integer;
begin
  if not exists (select 1 from public.podcast_community_circle_categories where is_active=true) then
    raise exception 'Active categories should be publicly readable';
  end if;

  select count(*) into v_count
  from public.podcast_community_circles
  where id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003'
  );
  if v_count <> 2 then raise exception 'Anonymous discovery should show public and private metadata'; end if;

  if exists (select 1 from public.podcast_community_circles where id='10000000-0000-4000-8000-000000000002') then
    raise exception 'Hidden group leaked to anonymous discovery';
  end if;

  if exists (select 1 from public.podcast_community_circle_posts where id='20000000-0000-4000-8000-000000000001') then
    raise exception 'Private group post leaked to anonymous visitor';
  end if;

  if not exists (select 1 from public.podcast_community_circle_posts where id='20000000-0000-4000-8000-000000000003') then
    raise exception 'Public group post should be visible anonymously';
  end if;
end
$anon_tests$;
reset role;

-- Member A can see the private A group/feed/roster, but cannot cross into B.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{}}',true);
do $member_a_tests$
declare v_count integer; v_rows integer;
begin
  if not exists (select 1 from public.podcast_community_circles where id='10000000-0000-4000-8000-000000000001') then
    raise exception 'Member A cannot discover own private group';
  end if;
  if exists (select 1 from public.podcast_community_circles where id='10000000-0000-4000-8000-000000000002') then
    raise exception 'Member A can discover unrelated hidden group';
  end if;
  if not exists (select 1 from public.podcast_community_circle_posts where id='20000000-0000-4000-8000-000000000001') then
    raise exception 'Member A cannot read own private group post';
  end if;
  if exists (select 1 from public.podcast_community_circle_posts where id='20000000-0000-4000-8000-000000000002') then
    raise exception 'Member A can read hidden group B post';
  end if;

  select count(*) into v_count
  from public.podcast_community_circle_members
  where circle_id='10000000-0000-4000-8000-000000000001';
  if v_count <> 3 then raise exception 'Member A should see the full roster of circle A'; end if;

  if exists (
    select 1 from public.podcast_community_circle_members
    where circle_id='10000000-0000-4000-8000-000000000002'
  ) then raise exception 'Member A can read circle B roster'; end if;

  insert into public.podcast_community_circle_posts (circle_id, author_id, body)
  values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Member A can post');

  begin
    insert into public.podcast_community_circle_posts (circle_id, author_id, body)
    values ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','Cross-circle post must fail');
    raise exception 'Expected cross-circle post insert to be rejected';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.podcast_community_circle_replies (post_id, circle_id, author_id, body)
  values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Valid reply A');

  begin
    insert into public.podcast_community_circle_replies (post_id, circle_id, author_id, body)
    values ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Mismatched post/group must fail');
    raise exception 'Expected mismatched post/group reply to be rejected';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.podcast_community_circle_replies (post_id, circle_id, author_id, body)
    values ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','Nonmember reply must fail');
    raise exception 'Expected nonmember reply to be rejected';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.podcast_community_circle_messages (circle_id, sender_id, body)
  values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Member A chat message');

  begin
    insert into public.podcast_community_circle_messages (circle_id, sender_id, body)
    values ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','Cross-circle chat must fail');
    raise exception 'Expected cross-circle chat insert to be rejected';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.podcast_community_circle_categories (name,slug)
    values ('CRG Member Category','crg-member-category');
    raise exception 'Regular member created a platform category';
  exception when insufficient_privilege then
    null;
  end;

  update public.podcast_community_circle_members
  set role='moderator'
  where circle_id='10000000-0000-4000-8000-000000000001'
    and member_id='00000000-0000-4000-8000-000000000003';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Regular member promoted their own role'; end if;
end
$member_a_tests$;

-- Requester may request private access but cannot impersonate another member.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","app_metadata":{}}',true);
insert into public.podcast_community_circle_join_requests (circle_id,user_id,status)
values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006','pending');

do $requester_tests$
begin
  begin
    insert into public.podcast_community_circle_join_requests (circle_id,user_id,status)
    values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','pending');
    raise exception 'Expected join-request impersonation to be rejected';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.podcast_community_circle_join_requests (circle_id,user_id,status)
    values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006','pending');
    raise exception 'Expected duplicate pending request to be rejected';
  exception when unique_violation then
    null;
  end;
end
$requester_tests$;

-- An ordinary member cannot approve; owner can atomically approve and add membership.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{}}',true);
do $unauthorized_review$
declare v_request uuid;
begin
  select id into v_request
  from public.podcast_community_circle_join_requests
  where circle_id='10000000-0000-4000-8000-000000000001'
    and user_id='00000000-0000-4000-8000-000000000006'
    and status='pending';
  begin
    perform public.review_podcast_circle_join_request(v_request,'approved');
    raise exception 'Expected non-moderator approval to be rejected';
  exception when insufficient_privilege then
    null;
  end;
end
$unauthorized_review$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}',true);
do $owner_approval$
declare v_request uuid;
begin
  select id into v_request
  from public.podcast_community_circle_join_requests
  where circle_id='10000000-0000-4000-8000-000000000001'
    and user_id='00000000-0000-4000-8000-000000000006'
    and status='pending';
  perform public.review_podcast_circle_join_request(v_request,'approved');

  if not exists (
    select 1 from public.podcast_community_circle_join_requests
    where id=v_request and status='approved'
      and reviewed_by='00000000-0000-4000-8000-000000000001'
  ) then raise exception 'Owner approval did not update the request'; end if;

  if not exists (
    select 1 from public.podcast_community_circle_members
    where circle_id='10000000-0000-4000-8000-000000000001'
      and member_id='00000000-0000-4000-8000-000000000006'
      and role='member'
  ) then raise exception 'Owner approval did not create membership atomically'; end if;
end
$owner_approval$;

-- Public self-join remains available; hidden membership requires an accepted invite.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated","app_metadata":{}}',true);
insert into public.podcast_community_circle_members (circle_id,member_id,role)
values ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000007','member');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000008","role":"authenticated","app_metadata":{}}',true);
insert into public.podcast_community_circle_members (circle_id,member_id,role)
values ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000008','member');

do $wrong_hidden_invite$
begin
  begin
    insert into public.podcast_community_circle_members (circle_id,member_id,role)
    values ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000008','member');
    raise exception 'An invite for hidden group B must not authorize hidden group D';
  exception when insufficient_privilege then
    null;
  end;
end
$wrong_hidden_invite$;

-- Member B must not read or write messages belonging to circle A.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{}}',true);
do $cross_group_chat$
begin
  if exists (select 1 from public.podcast_community_circle_messages where circle_id='10000000-0000-4000-8000-000000000001') then
    raise exception 'Circle B member can read Circle A chat';
  end if;
  begin
    insert into public.podcast_community_circle_messages (circle_id,sender_id,body)
    values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','Circle B member cannot write Circle A chat');
    raise exception 'Expected cross-group chat write to be rejected';
  exception when insufficient_privilege then
    null;
  end;
end
$cross_group_chat$;

-- Chat is hidden when disabled, even for a current member.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{}}',true);
do $disabled_chat$
begin
  if exists (
    select 1 from public.podcast_community_circle_messages
    where circle_id='10000000-0000-4000-8000-000000000002'
  ) then raise exception 'Disabled group chat is visible'; end if;

  begin
    insert into public.podcast_community_circle_messages (circle_id,sender_id,body)
    values ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','Disabled chat must reject writes');
    raise exception 'Expected disabled group chat insert to be rejected';
  exception when insufficient_privilege then
    null;
  end;
end
$disabled_chat$;

-- Platform-admin JWT claim continues to authorize admin-only access to private feeds.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated","app_metadata":{"role":"admin"}}',true);
do $admin_tests$
begin
  insert into public.podcast_community_circle_categories (name,slug,display_order)
  values ('CRG Admin Category','crg-admin-category',999);

  if not exists (select 1 from public.podcast_community_circle_categories where slug='crg-admin-category') then
    raise exception 'Platform admin cannot create a dynamic category';
  end if;

  if not exists (
    select 1 from public.podcast_community_circle_posts
    where id='20000000-0000-4000-8000-000000000001'
  ) then raise exception 'Platform admin cannot inspect private group content'; end if;
end
$admin_tests$;

-- Category ID writes synchronize the legacy text label, and legacy is_public
-- writes continue to map false to hidden rather than discoverable private.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}',true);

insert into public.podcast_community_circles (
  id,owner_id,name,description,category,category_id,is_public,is_featured,
  community_rules,branch_key,visibility,group_chat_enabled
)
select
  '10000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000001',
  'CRG Category Sync',
  'Category synchronization test',
  'Legacy label',
  id,
  true,
  false,
  '',
  'community',
  'public',
  true
from public.podcast_community_circle_categories
where slug='crg-admin-category';

insert into public.podcast_community_circles (
  id,owner_id,name,description,category,is_public,is_featured,community_rules,branch_key
) values (
  '10000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000001',
  'CRG Legacy Visibility',
  'Legacy visibility compatibility test',
  'General',
  false,
  false,
  '',
  'community'
);

do $compatibility_tests$
begin
  if not exists (
    select 1 from public.podcast_community_circles
    where id='10000000-0000-4000-8000-000000000005'
      and category='CRG Admin Category'
      and category_id=(select id from public.podcast_community_circle_categories where slug='crg-admin-category')
  ) then raise exception 'Category ID did not synchronize the legacy category label'; end if;

  if not exists (
    select 1 from public.podcast_community_circles
    where id='10000000-0000-4000-8000-000000000006'
      and visibility='hidden'
      and is_public=false
  ) then raise exception 'Legacy is_public=false did not remain hidden'; end if;
end
$compatibility_tests$;

reset role;
rollback;

-- Reaching this line means all assertions passed and all synthetic fixtures
-- were rolled back. Run from psql with ON_ERROR_STOP=1.
