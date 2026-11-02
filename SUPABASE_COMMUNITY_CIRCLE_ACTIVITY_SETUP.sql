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


-- Optional initial history seed: last 90 days, capped per source to keep the feed lightweight.
with recent_posts as (
 select p.circle_id,p.author_id actor_id,'discussion_created'::text activity_type,p.id target_id,'Started a new discussion'::text summary,p.created_at,jsonb_build_object('circle_name',c.name) metadata
 from public.podcast_community_circle_posts p join public.podcast_community_circles c on c.id=p.circle_id
 where p.created_at>now()-interval '90 days' order by p.created_at desc limit 200
), recent_replies as (
 select r.circle_id,r.author_id,'reply_created'::text,r.post_id,'Added a reply to a discussion'::text,r.created_at,jsonb_build_object('circle_name',c.name)
 from public.podcast_community_circle_replies r join public.podcast_community_circles c on c.id=r.circle_id
 where r.created_at>now()-interval '90 days' order by r.created_at desc limit 200
), recent_events as (
 select e.circle_id,e.creator_id,case when e.status='cancelled' then 'event_cancelled' else 'event_created' end::text,e.id,'Scheduled a community event'::text,e.created_at,jsonb_build_object('circle_name',c.name,'event_title',e.title,'starts_at',e.starts_at)
 from public.podcast_community_circle_events e join public.podcast_community_circles c on c.id=e.circle_id
 where e.created_at>now()-interval '90 days' order by e.created_at desc limit 100
), recent_members as (
 select m.circle_id,m.member_id,'member_joined'::text,m.circle_id,'Joined this community circle'::text,m.joined_at,jsonb_build_object('circle_name',c.name)
 from public.podcast_community_circle_members m join public.podcast_community_circles c on c.id=m.circle_id
 where m.joined_at>now()-interval '90 days' order by m.joined_at desc limit 100
), combined as (
 select * from recent_posts union all select * from recent_replies union all select * from recent_events union all select * from recent_members
)
insert into public.podcast_community_circle_activity(circle_id,actor_id,activity_type,target_id,summary,created_at,metadata)
select x.circle_id,x.actor_id,x.activity_type,x.target_id,x.summary,x.created_at,x.metadata
from combined x
where not exists(select 1 from public.podcast_community_circle_activity a where a.circle_id=x.circle_id and a.activity_type=x.activity_type and a.target_id=x.target_id and a.actor_id is not distinct from x.actor_id and a.created_at=x.created_at);
