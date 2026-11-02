-- CrowRules Podcasting Community Trust & Reputation Center
create table if not exists public.podcast_community_circle_helpful_votes (
 reply_id uuid not null references public.podcast_community_circle_replies(id) on delete cascade,
 circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
 voter_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(reply_id,voter_id)
);
create index if not exists podcast_circle_helpful_votes_circle_idx on public.podcast_community_circle_helpful_votes(circle_id,created_at desc);
alter table public.podcast_community_circle_helpful_votes enable row level security;
revoke all on public.podcast_community_circle_helpful_votes from public,anon;
grant select,insert,delete on public.podcast_community_circle_helpful_votes to authenticated;
drop policy if exists circle_helpful_votes_select_members on public.podcast_community_circle_helpful_votes;
create policy circle_helpful_votes_select_members on public.podcast_community_circle_helpful_votes for select to authenticated
using(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_helpful_votes.circle_id and m.member_id=(select auth.uid())));
drop policy if exists circle_helpful_votes_insert_members on public.podcast_community_circle_helpful_votes;
create policy circle_helpful_votes_insert_members on public.podcast_community_circle_helpful_votes for insert to authenticated
with check(voter_id=(select auth.uid())
 and exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_helpful_votes.circle_id and m.member_id=(select auth.uid()))
 and exists(select 1 from public.podcast_community_circle_replies r where r.id=podcast_community_circle_helpful_votes.reply_id and r.circle_id=podcast_community_circle_helpful_votes.circle_id and r.author_id<>(select auth.uid()))
);
drop policy if exists circle_helpful_votes_delete_own on public.podcast_community_circle_helpful_votes;
create policy circle_helpful_votes_delete_own on public.podcast_community_circle_helpful_votes for delete to authenticated
using(voter_id=(select auth.uid()) and exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_helpful_votes.circle_id and m.member_id=(select auth.uid())));
