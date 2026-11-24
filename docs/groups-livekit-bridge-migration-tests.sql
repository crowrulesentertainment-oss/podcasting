begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'host@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'guest@example.test'),
  ('30000000-0000-0000-0000-000000000003', 'other@example.test');

insert into public.crowspace_live_rooms (id, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'live'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'live'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'ended');

insert into public.crowspace_live_room_sessions
  (id, room_id, room_name, owner_user_id, mode, status, expires_at)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cr-group-test-active', '10000000-0000-0000-0000-000000000001', 'audio', 'active', now() + interval '1 hour'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'cr-group-test-expired', '10000000-0000-0000-0000-000000000001', 'audio', 'active', now() - interval '1 hour'),
  ('33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'cr-group-test-ended-room', '10000000-0000-0000-0000-000000000001', 'audio', 'active', now() + interval '1 hour');

insert into public.crowspace_live_room_invitations
  (id, session_id, token_hash, role, invited_user_id, max_uses, uses_count, expires_at, created_by)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', repeat('a',64), 'guest', null, 1, 0, now() + interval '1 hour', '10000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', repeat('b',64), 'listener', '20000000-0000-0000-0000-000000000002', 1, 0, now() + interval '1 hour', '10000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', repeat('c',64), 'guest', null, 1, 0, now() - interval '1 minute', '10000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', repeat('d',64), 'guest', null, 1, 0, now() + interval '1 hour', '10000000-0000-0000-0000-000000000001'),
  ('a5000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', repeat('e',64), 'guest', null, 1, 0, now() + interval '1 hour', '10000000-0000-0000-0000-000000000001'),
  ('a6000000-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333333', repeat('f',64), 'guest', null, 1, 0, now() + interval '1 hour', '10000000-0000-0000-0000-000000000001');

update public.crowspace_live_room_invitations
   set revoked_at = now()
 where id = 'a4000000-0000-4000-8000-000000000004';

set local role service_role;

do $test$
declare
  result jsonb;
begin
  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('a',64), '20000000-0000-0000-0000-000000000002'
  );
  if result is null or result->>'role' <> 'guest'
     or result->>'room_name' <> 'cr-group-test-active' then
    raise exception 'valid unbound guest invitation was not redeemed';
  end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('a',64), '30000000-0000-0000-0000-000000000003'
  );
  if result is not null then raise exception 'single-use invitation was redeemed twice'; end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('b',64), '30000000-0000-0000-0000-000000000003'
  );
  if result is not null then raise exception 'user-bound invitation accepted the wrong user'; end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('b',64), '20000000-0000-0000-0000-000000000002'
  );
  if result is null or result->>'role' <> 'listener' then
    raise exception 'user-bound listener invitation rejected the invited user';
  end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('c',64), '20000000-0000-0000-0000-000000000002'
  );
  if result is not null then raise exception 'expired invitation was redeemed'; end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('d',64), '20000000-0000-0000-0000-000000000002'
  );
  if result is not null then raise exception 'revoked invitation was redeemed'; end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('e',64), '20000000-0000-0000-0000-000000000002'
  );
  if result is not null then raise exception 'expired session invitation was redeemed'; end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    repeat('f',64), '20000000-0000-0000-0000-000000000002'
  );
  if result is not null then raise exception 'invitation for ended room was redeemed'; end if;

  result := public.crowspace_livekit_redeem_room_invitation(
    'not-a-sha256-hash', '20000000-0000-0000-0000-000000000002'
  );
  if result is not null then raise exception 'malformed token hash was accepted'; end if;
end;
$test$;

reset role;

do $verify$
begin
  if (select uses_count from public.crowspace_live_room_invitations
      where id = 'a1000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'successful redemption did not consume exactly one use';
  end if;
  if (select uses_count from public.crowspace_live_room_invitations
      where id = 'a2000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'wrong-user attempt consumed or valid redemption failed';
  end if;
end;
$verify$;

rollback;
