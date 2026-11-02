-- Community Circles Events & Meetups
-- Project: cevylpnoexugwgygvtgu
-- Apply with the Supabase SQL editor. Public Data API grants are explicit for the Oct 30 2026 exposure change.
create table if not exists public.podcast_community_circle_events (
 id uuid primary key default gen_random_uuid(),
 circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
 creator_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 3 and 120),
 description text not null default '' check(char_length(description)<=3000),
 event_type text not null default 'meetup' check(event_type in ('meetup','listening_party','ama','livestream','other')),
 starts_at timestamptz not null, ends_at timestamptz,
 location_type text not null default 'online' check(location_type in ('online','in_person','hybrid')),
 location_text text not null default '' check(char_length(location_text)<=300),
 meeting_url text not null default '' check(char_length(meeting_url)<=1000),
 episode_url text not null default '' check(char_length(episode_url)<=1000),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint circle_event_end_after_start check(ends_at is null or ends_at>starts_at)
);
create index if not exists podcast_circle_events_starts_idx on public.podcast_community_circle_events(starts_at) where status='scheduled';
create index if not exists podcast_circle_events_circle_idx on public.podcast_community_circle_events(circle_id,starts_at desc);
alter table public.podcast_community_circle_events enable row level security;
revoke all on public.podcast_community_circle_events from public,anon;
grant select,insert,update,delete on public.podcast_community_circle_events to authenticated;
drop policy if exists circle_events_select_members on public.podcast_community_circle_events;
create policy circle_events_select_members on public.podcast_community_circle_events for select to authenticated using(
 exists(select 1 from public.podcast_community_circles c where c.id=circle_id and (c.is_public=true or exists(select 1 from public.podcast_community_circle_members m where m.circle_id=c.id and m.member_id=(select auth.uid()))))
);
drop policy if exists circle_events_insert_moderators on public.podcast_community_circle_events;
create policy circle_events_insert_moderators on public.podcast_community_circle_events for insert to authenticated with check(
 creator_id=(select auth.uid()) and exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_events.circle_id and m.member_id=(select auth.uid()) and m.role in ('owner','moderator'))
);
drop policy if exists circle_events_update_moderators on public.podcast_community_circle_events;
create policy circle_events_update_moderators on public.podcast_community_circle_events for update to authenticated using(
 exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_events.circle_id and m.member_id=(select auth.uid()) and m.role in ('owner','moderator'))
) with check(
 exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_events.circle_id and m.member_id=(select auth.uid()) and m.role in ('owner','moderator'))
);
drop policy if exists circle_events_delete_owners on public.podcast_community_circle_events;
create policy circle_events_delete_owners on public.podcast_community_circle_events for delete to authenticated using(
 exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_events.circle_id and m.member_id=(select auth.uid()) and m.role='owner')
);
create table if not exists public.podcast_community_circle_event_rsvps(
 event_id uuid not null references public.podcast_community_circle_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 response text not null check(response in ('going','interested','declined')),
 updated_at timestamptz not null default now(), primary key(event_id,user_id)
);
create index if not exists podcast_circle_event_rsvps_event_idx on public.podcast_community_circle_event_rsvps(event_id,response);
alter table public.podcast_community_circle_event_rsvps enable row level security;
revoke all on public.podcast_community_circle_event_rsvps from public,anon;
grant select,insert,update,delete on public.podcast_community_circle_event_rsvps to authenticated;
drop policy if exists circle_event_rsvps_select_members on public.podcast_community_circle_event_rsvps;
create policy circle_event_rsvps_select_members on public.podcast_community_circle_event_rsvps for select to authenticated using(
 exists(select 1 from public.podcast_community_circle_events e join public.podcast_community_circle_members m on m.circle_id=e.circle_id where e.id=event_id and m.member_id=(select auth.uid()))
);
drop policy if exists circle_event_rsvps_insert_self on public.podcast_community_circle_event_rsvps;
create policy circle_event_rsvps_insert_self on public.podcast_community_circle_event_rsvps for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.podcast_community_circle_events e join public.podcast_community_circle_members m on m.circle_id=e.circle_id where e.id=event_id and e.status='scheduled' and m.member_id=(select auth.uid()))
);
drop policy if exists circle_event_rsvps_update_self on public.podcast_community_circle_event_rsvps;
create policy circle_event_rsvps_update_self on public.podcast_community_circle_event_rsvps for update to authenticated using(user_id=(select auth.uid())) with check(
 user_id=(select auth.uid()) and exists(select 1 from public.podcast_community_circle_events e join public.podcast_community_circle_members m on m.circle_id=e.circle_id where e.id=event_id and e.status='scheduled' and m.member_id=(select auth.uid()))
);
drop policy if exists circle_event_rsvps_delete_self on public.podcast_community_circle_event_rsvps;
create policy circle_event_rsvps_delete_self on public.podcast_community_circle_event_rsvps for delete to authenticated using(user_id=(select auth.uid()));
create or replace function private.notify_podcast_circle_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare member record; circle_label text; notif_type text; notif_title text; notif_body text; action text;
begin
 select c.name into circle_label from public.podcast_community_circles c where c.id=new.circle_id;
 if tg_op='INSERT' then
  notif_type:='circle_event_created'; notif_title:='New community event'; notif_body:='A new event was scheduled in '||coalesce(circle_label,'your circle')||': '||new.title||'.';
 else
  if (to_jsonb(old)-'updated_at')=(to_jsonb(new)-'updated_at') then return new; end if;
  notif_type:='circle_event_updated'; notif_title:=case when new.status='cancelled' then 'Community event cancelled' else 'Community event updated' end;
  notif_body:=case when new.status='cancelled' then new.title||' in '||coalesce(circle_label,'your circle')||' was cancelled.' else new.title||' in '||coalesce(circle_label,'your circle')||' has been updated.' end;
 end if;
 action:='/podcasting/listener/circle-events.html?event='||new.id::text;
 for member in select m.member_id from public.podcast_community_circle_members m where m.circle_id=new.circle_id and m.member_id<>new.creator_id loop
  insert into public.crowrules_notifications(user_id,actor_user_id,type,title,body,division,action_url,metadata,priority,dedupe_key)
  values(member.member_id,new.creator_id,notif_type,notif_title,notif_body,'Podcasting',action,jsonb_build_object('circle_id',new.circle_id,'event_id',new.id),55,'podcast-circle-event:'||new.id::text||':'||notif_type||':'||new.updated_at::text) on conflict do nothing;
 end loop;
 return new;
end; $$;
revoke all on function private.notify_podcast_circle_event() from public,anon,authenticated;
drop trigger if exists podcast_circle_event_notify on public.podcast_community_circle_events;
create trigger podcast_circle_event_notify after insert or update on public.podcast_community_circle_events for each row execute function private.notify_podcast_circle_event();


-- 24-hour and 1-hour reminders for members who RSVP Going or Interested.
-- A single 15-minute cron job checks two narrow windows, preventing repeated reminders.
create or replace function private.notify_podcast_circle_event_reminders()
returns void language plpgsql security definer set search_path=''
as $$
declare item record; reminder_kind text; reminder_title text; reminder_body text;
begin
 for item in
  select e.id,e.circle_id,e.creator_id,e.title,e.starts_at,r.user_id
  from public.podcast_community_circle_events e
  join public.podcast_community_circle_event_rsvps r on r.event_id=e.id and r.response in ('going','interested')
  where e.status='scheduled' and (
   (e.starts_at>now()+interval '23 hours 45 minutes' and e.starts_at<=now()+interval '24 hours') or
   (e.starts_at>now()+interval '45 minutes' and e.starts_at<=now()+interval '1 hour')
  )
 loop
  if item.starts_at>now()+interval '23 hours' then
   reminder_kind:='24h';reminder_title:='Tomorrow: community event';reminder_body:=item.title||' starts in about 24 hours.';
  else
   reminder_kind:='1h';reminder_title:='Starting soon: community event';reminder_body:=item.title||' starts in about an hour.';
  end if;
  insert into public.crowrules_notifications(user_id,actor_user_id,type,title,body,division,action_url,metadata,priority,dedupe_key)
  values(item.user_id,item.creator_id,'circle_event_reminder',reminder_title,reminder_body,'Podcasting','/podcasting/listener/circle-events.html?event='||item.id::text,jsonb_build_object('circle_id',item.circle_id,'event_id',item.id,'reminder',reminder_kind),70,'podcast-circle-event-reminder:'||item.id::text||':'||reminder_kind||':'||item.user_id::text)
  on conflict do nothing;
 end loop;
end; $$;
revoke all on function private.notify_podcast_circle_event_reminders() from public,anon,authenticated;
select cron.unschedule(jobid) from cron.job where jobname='podcast-community-circle-event-reminders';
select cron.schedule('podcast-community-circle-event-reminders','*/15 * * * *','select private.notify_podcast_circle_event_reminders();');
