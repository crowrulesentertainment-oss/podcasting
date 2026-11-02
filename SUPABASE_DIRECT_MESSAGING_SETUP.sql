-- CrowRules Podcasting: private member messaging
-- Apply to project cevylpnoexugwgygvtgu.
-- All direct-message data is participant-scoped; message requests require recipient acceptance.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.podcast_direct_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint podcast_direct_blocks_no_self check (blocker_id <> blocked_user_id)
);
create table if not exists public.podcast_direct_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_low uuid not null references auth.users(id) on delete cascade,
  participant_high uuid not null references auth.users(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint podcast_direct_conversations_pair_order check (participant_low < participant_high),
  constraint podcast_direct_conversations_initiator check (initiated_by in (participant_low, participant_high)),
  constraint podcast_direct_conversations_unique_pair unique (participant_low, participant_high)
);
create table if not exists public.podcast_direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.podcast_direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table if not exists public.podcast_direct_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.podcast_direct_conversations(id) on delete cascade,
  message_id uuid references public.podcast_direct_messages(id) on delete set null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('harassment','spam','hate','threats','sexual_content','other')),
  details text not null default '' check (char_length(details) <= 1500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  constraint podcast_direct_reports_not_self check (reporter_id <> reported_user_id)
);
create index if not exists podcast_direct_conversations_low_idx on public.podcast_direct_conversations(participant_low, updated_at desc);
create index if not exists podcast_direct_conversations_high_idx on public.podcast_direct_conversations(participant_high, updated_at desc);
create index if not exists podcast_direct_messages_conversation_idx on public.podcast_direct_messages(conversation_id, created_at desc);
create index if not exists podcast_direct_messages_sender_idx on public.podcast_direct_messages(sender_id, created_at desc);
create index if not exists podcast_direct_blocks_blocked_idx on public.podcast_direct_blocks(blocked_user_id, blocker_id);
create index if not exists podcast_direct_reports_status_idx on public.podcast_direct_reports(status, created_at desc);

create or replace function private.podcast_direct_pair_blocked(p_user_a uuid, p_user_b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when auth.uid() is null or auth.uid() not in (p_user_a,p_user_b) then true
  else exists(select 1 from public.podcast_direct_blocks b
    where (b.blocker_id=p_user_a and b.blocked_user_id=p_user_b)
       or (b.blocker_id=p_user_b and b.blocked_user_id=p_user_a)) end;
$$;
revoke all on function private.podcast_direct_pair_blocked(uuid,uuid) from public,anon;
grant execute on function private.podcast_direct_pair_blocked(uuid,uuid) to authenticated;

create or replace function private.guard_podcast_direct_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c record;
begin
  if auth.uid() is null or auth.uid() <> new.sender_id then raise exception 'Message sender must match the signed-in member.'; end if;
  select id,participant_low,participant_high,initiated_by,status into c
    from public.podcast_direct_conversations where id=new.conversation_id for update;
  if not found then raise exception 'Conversation not found.'; end if;
  if new.sender_id not in (c.participant_low,c.participant_high) then raise exception 'You are not a participant in this conversation.'; end if;
  if private.podcast_direct_pair_blocked(c.participant_low,c.participant_high) then raise exception 'Messaging is unavailable because one member has blocked the other.'; end if;
  if c.status='pending' then
    if c.initiated_by<>new.sender_id or exists(select 1 from public.podcast_direct_messages m where m.conversation_id=c.id)
    then raise exception 'Only the first message request can be sent before acceptance.'; end if;
  elsif c.status<>'accepted' then raise exception 'This message request is no longer active.'; end if;
  return new;
end;
$$;
revoke all on function private.guard_podcast_direct_message() from public,anon;
grant execute on function private.guard_podcast_direct_message() to authenticated;
drop trigger if exists podcast_direct_message_guard on public.podcast_direct_messages;
create trigger podcast_direct_message_guard before insert on public.podcast_direct_messages
for each row execute function private.guard_podcast_direct_message();

create or replace function private.touch_podcast_direct_conversation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.podcast_direct_conversations set updated_at=now() where id=new.conversation_id;
  return new;
end;
$$;
revoke all on function private.touch_podcast_direct_conversation() from public,anon,authenticated;
drop trigger if exists podcast_direct_message_touch on public.podcast_direct_messages;
create trigger podcast_direct_message_touch after insert on public.podcast_direct_messages
for each row execute function private.touch_podcast_direct_conversation();

alter table public.podcast_direct_blocks enable row level security;
alter table public.podcast_direct_conversations enable row level security;
alter table public.podcast_direct_messages enable row level security;
alter table public.podcast_direct_reports enable row level security;

drop policy if exists "Podcast direct blocks visible to blocker" on public.podcast_direct_blocks;
create policy "Podcast direct blocks visible to blocker" on public.podcast_direct_blocks for select to authenticated using (blocker_id=(select auth.uid()));
drop policy if exists "Podcast members can block another member" on public.podcast_direct_blocks;
create policy "Podcast members can block another member" on public.podcast_direct_blocks for insert to authenticated with check (blocker_id=(select auth.uid()) and blocked_user_id<>(select auth.uid()));
drop policy if exists "Podcast members can unblock another member" on public.podcast_direct_blocks;
create policy "Podcast members can unblock another member" on public.podcast_direct_blocks for delete to authenticated using (blocker_id=(select auth.uid()));

drop policy if exists "Conversation participants can read their conversations" on public.podcast_direct_conversations;
create policy "Conversation participants can read their conversations" on public.podcast_direct_conversations for select to authenticated using ((select auth.uid()) in (participant_low,participant_high));
drop policy if exists "Members can start a message request" on public.podcast_direct_conversations;
create policy "Members can start a message request" on public.podcast_direct_conversations for insert to authenticated with check (
  initiated_by=(select auth.uid()) and status='pending' and participant_low<participant_high
  and (select auth.uid()) in (participant_low,participant_high)
  and not private.podcast_direct_pair_blocked(participant_low,participant_high));
drop policy if exists "Recipients can accept or decline message requests" on public.podcast_direct_conversations;
create policy "Recipients can accept or decline message requests" on public.podcast_direct_conversations for update to authenticated
using (status='pending' and ((initiated_by=participant_low and participant_high=(select auth.uid())) or (initiated_by=participant_high and participant_low=(select auth.uid()))))
with check (status in ('accepted','declined') and ((initiated_by=participant_low and participant_high=(select auth.uid())) or (initiated_by=participant_high and participant_low=(select auth.uid()))));

drop policy if exists "Conversation participants can read messages" on public.podcast_direct_messages;
create policy "Conversation participants can read messages" on public.podcast_direct_messages for select to authenticated using (
  exists(select 1 from public.podcast_direct_conversations c where c.id=conversation_id and (select auth.uid()) in (c.participant_low,c.participant_high)));
drop policy if exists "Members can send messages in accepted conversations or initial requests" on public.podcast_direct_messages;
create policy "Members can send messages in accepted conversations or initial requests" on public.podcast_direct_messages for insert to authenticated with check (
  sender_id=(select auth.uid()) and exists(select 1 from public.podcast_direct_conversations c
    where c.id=conversation_id and sender_id in (c.participant_low,c.participant_high)
      and not private.podcast_direct_pair_blocked(c.participant_low,c.participant_high)
      and (c.status='accepted' or (c.status='pending' and c.initiated_by=sender_id
        and not exists(select 1 from public.podcast_direct_messages prior where prior.conversation_id=c.id)))));
drop policy if exists "Recipients can mark received messages read" on public.podcast_direct_messages;
create policy "Recipients can mark received messages read" on public.podcast_direct_messages for update to authenticated
using (sender_id<>(select auth.uid()) and exists(select 1 from public.podcast_direct_conversations c where c.id=conversation_id and (select auth.uid()) in (c.participant_low,c.participant_high)))
with check (sender_id<>(select auth.uid()) and exists(select 1 from public.podcast_direct_conversations c where c.id=conversation_id and (select auth.uid()) in (c.participant_low,c.participant_high)));

drop policy if exists "Reporters can submit a message safety report" on public.podcast_direct_reports;
create policy "Reporters can submit a message safety report" on public.podcast_direct_reports for insert to authenticated with check (
  reporter_id=(select auth.uid()) and reporter_id<>reported_user_id
  and exists(select 1 from public.podcast_direct_conversations c where c.id=conversation_id
    and reporter_id in (c.participant_low,c.participant_high) and reported_user_id in (c.participant_low,c.participant_high))
  and (message_id is null or exists(select 1 from public.podcast_direct_messages m where m.id=message_id
    and m.conversation_id=podcast_direct_reports.conversation_id and m.sender_id=reported_user_id)));
drop policy if exists "Reporters can view their own safety reports" on public.podcast_direct_reports;
create policy "Reporters can view their own safety reports" on public.podcast_direct_reports for select to authenticated using (reporter_id=(select auth.uid()));
drop policy if exists "Podcast admins can review direct message reports" on public.podcast_direct_reports;
create policy "Podcast admins can review direct message reports" on public.podcast_direct_reports for select to authenticated using (public.crowrules_is_admin());
drop policy if exists "Podcast admins can update direct message report status" on public.podcast_direct_reports;
create policy "Podcast admins can update direct message report status" on public.podcast_direct_reports for update to authenticated using (public.crowrules_is_admin()) with check (public.crowrules_is_admin());

revoke all on public.podcast_direct_blocks,public.podcast_direct_conversations,public.podcast_direct_messages,public.podcast_direct_reports from anon,public;
grant select,insert,delete on public.podcast_direct_blocks to authenticated;
grant select,insert on public.podcast_direct_conversations to authenticated;
grant update(status) on public.podcast_direct_conversations to authenticated;
grant select,insert on public.podcast_direct_messages to authenticated;
grant update(read_at) on public.podcast_direct_messages to authenticated;
grant select,insert on public.podcast_direct_reports to authenticated;
grant update(status) on public.podcast_direct_reports to authenticated;
