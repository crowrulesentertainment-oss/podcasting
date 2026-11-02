-- CrowRules Podcasting: Community Circles Recognition Center
-- RLS: circle members can read; any member can appreciate another member;
-- only owners/moderators can award member of the month.
create table if not exists public.podcast_community_circle_recognitions (
 id uuid primary key default gen_random_uuid(),
 circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
 giver_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 recognition_type text not null check(recognition_type in ('appreciation','member_of_month')),
 message text not null default '' check(char_length(message)<=240),
 period_start date not null default (date_trunc('month',now())::date),
 created_at timestamptz not null default now(),
 constraint recognition_no_self_award check(giver_id<>recipient_id)
);
create index if not exists podcast_circle_recognition_feed_idx on public.podcast_community_circle_recognitions(circle_id,created_at desc);
create unique index if not exists podcast_circle_appreciation_monthly_unique on public.podcast_community_circle_recognitions(circle_id,giver_id,recipient_id,period_start) where recognition_type='appreciation';
create unique index if not exists podcast_circle_member_of_month_unique on public.podcast_community_circle_recognitions(circle_id,period_start) where recognition_type='member_of_month';
alter table public.podcast_community_circle_recognitions enable row level security;
revoke all on public.podcast_community_circle_recognitions from public,anon;
grant select,insert on public.podcast_community_circle_recognitions to authenticated;
drop policy if exists circle_recognition_select_members on public.podcast_community_circle_recognitions;
create policy circle_recognition_select_members on public.podcast_community_circle_recognitions for select to authenticated
using(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_recognitions.circle_id and m.member_id=(select auth.uid())));
drop policy if exists circle_recognition_insert_appreciation on public.podcast_community_circle_recognitions;
create policy circle_recognition_insert_appreciation on public.podcast_community_circle_recognitions for insert to authenticated
with check (giver_id=(select auth.uid()) and recognition_type='appreciation' and period_start=date_trunc('month',now())::date
 and exists(select 1 from public.podcast_community_circle_members g where g.circle_id=podcast_community_circle_recognitions.circle_id and g.member_id=(select auth.uid()))
 and exists(select 1 from public.podcast_community_circle_members r where r.circle_id=podcast_community_circle_recognitions.circle_id and r.member_id=podcast_community_circle_recognitions.recipient_id));
drop policy if exists circle_recognition_insert_month_award on public.podcast_community_circle_recognitions;
create policy circle_recognition_insert_month_award on public.podcast_community_circle_recognitions for insert to authenticated
with check (giver_id=(select auth.uid()) and recognition_type='member_of_month' and period_start=date_trunc('month',now())::date
 and exists(select 1 from public.podcast_community_circle_members g where g.circle_id=podcast_community_circle_recognitions.circle_id and g.member_id=(select auth.uid()) and g.role in ('owner','moderator'))
 and exists(select 1 from public.podcast_community_circle_members r where r.circle_id=podcast_community_circle_recognitions.circle_id and r.member_id=podcast_community_circle_recognitions.recipient_id));
