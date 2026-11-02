-- CrowRules Podcasting: Community Circles Activity Feed
-- Project: cevylpnoexugwgygvtgu
-- Run through Supabase SQL Editor. RLS and explicit Data API grants are included.
create table if not exists public.podcast_community_circle_activity (
 id uuid primary key default gen_random_uuid(),
 circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 activity_type text not null check(activity_type in ('discussion_created','reply_created','event_created','event_updated','event_cancelled','member_joined')),
 target_id uuid,
 summary text not null check(char_length(summary) between 1 and 240),
 created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists podcast_circle_activity_feed_idx on public.podcast_community_circle_activity(circle_id,created_at desc);
alter table public.podcast_community_circle_activity enable row level security;
revoke all on public.podcast_community_circle_activity from public,anon;
grant select on public.podcast_community_circle_activity to authenticated;
drop policy if exists circle_activity_select_members on public.podcast_community_circle_activity;
create policy circle_activity_select_members on public.podcast_community_circle_activity for select to authenticated
using(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_activity.circle_id and m.member_id=(select auth.uid())));
create or replace function private.record_podcast_circle_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare c_id uuid; a_id uuid; t_id uuid; a_type text; a_summary text; extra jsonb:='{}'::jsonb; circle_label text;
begin
 if tg_table_name='podcast_community_circle_posts' then
  c_id:=new.circle_id; a_id:=new.author_id; t_id:=new.id; a_type:='discussion_created'; a_summary:='Started a new discussion';
 elsif tg_table_name='podcast_community_circle_replies' then
  c_id:=new.circle_id; a_id:=new.author_id; t_id:=new.post_id; a_type:='reply_created'; a_summary:='Added a reply to a discussion';
 elsif tg_table_name='podcast_community_circle_events' then
  c_id:=new.circle_id; a_id:=new.creator_id; t_id:=new.id;
  if tg_op='INSERT' then a_type:='event_created'; a_summary:='Scheduled a community event';
  elsif new.status='cancelled' and old.status<>'cancelled' then a_type:='event_cancelled'; a_summary:='Cancelled a community event';
  else a_type:='event_updated'; a_summary:='Updated a community event'; end if;
  extra:=jsonb_build_object('event_title',new.title,'starts_at',new.starts_at);
  if tg_op='UPDATE' and (to_jsonb(old)-'updated_at')=(to_jsonb(new)-'updated_at') then return new; end if;
 elsif tg_table_name='podcast_community_circle_members' then
  c_id:=new.circle_id; a_id:=new.member_id; t_id:=new.circle_id; a_type:='member_joined'; a_summary:='Joined this community circle';
 else return new;
 end if;
 select c.name into circle_label from public.podcast_community_circles c where c.id=c_id;
 extra:=extra||jsonb_build_object('circle_name',coalesce(circle_label,'Community Circle'));
 insert into public.podcast_community_circle_activity(circle_id,actor_id,activity_type,target_id,summary,metadata)
 values(c_id,a_id,a_type,t_id,a_summary,extra);
 return new;
end; $$;
revoke all on function private.record_podcast_circle_activity() from public,anon,authenticated;
drop trigger if exists podcast_circle_activity_post on public.podcast_community_circle_posts;
create trigger podcast_circle_activity_post after insert on public.podcast_community_circle_posts for each row execute function private.record_podcast_circle_activity();
drop trigger if exists podcast_circle_activity_reply on public.podcast_community_circle_replies;
create trigger podcast_circle_activity_reply after insert on public.podcast_community_circle_replies for each row execute function private.record_podcast_circle_activity();
drop trigger if exists podcast_circle_activity_event on public.podcast_community_circle_events;
create trigger podcast_circle_activity_event after insert or update on public.podcast_community_circle_events for each row execute function private.record_podcast_circle_activity();
drop trigger if exists podcast_circle_activity_member on public.podcast_community_circle_members;
create trigger podcast_circle_activity_member after insert on public.podcast_community_circle_members for each row execute function private.record_podcast_circle_activity();
