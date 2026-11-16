-- CrowRules Reviews Phase 3: episode review access hardening and query indexes.
create index if not exists podcast_episode_reviews_published_episode_created_idx
 on public.podcast_episode_reviews(episode_id,created_at desc) where status='published';
create index if not exists podcast_episode_reviews_published_user_created_idx
 on public.podcast_episode_reviews(user_id,created_at desc) where status='published';
create index if not exists podcast_episode_review_reports_review_status_idx
 on public.podcast_episode_review_reports(review_id,status,created_at desc);
create index if not exists podcast_episode_review_replies_review_status_idx
 on public.podcast_episode_review_replies(review_id,status);

alter table public.podcast_episode_reviews enable row level security;
alter table public.podcast_episode_review_replies enable row level security;
alter table public.podcast_episode_review_reports enable row level security;
alter table public.podcast_episode_review_votes enable row level security;
alter table public.podcast_member_profile_stats enable row level security;

drop policy if exists "Members can update their own episode reviews" on public.podcast_episode_reviews;
create policy "Members can update their own episode reviews"
 on public.podcast_episode_reviews for update to authenticated
 using ((select auth.uid())=user_id and status='published')
 with check (
  (select auth.uid())=user_id and status='published'
  and exists(
   select 1 from public.podcast_episodes e
   join public.podcasts p on p.id=e.podcast_id
   where e.id=podcast_episode_reviews.episode_id and e.status='published' and p.status='published'
  )
 );

drop policy if exists "Members submit episode review reports" on public.podcast_episode_review_reports;
create policy "Members submit episode review reports"
 on public.podcast_episode_review_reports for insert to authenticated
 with check (
  (select auth.uid())=reporter_user_id
  and exists(select 1 from public.podcast_episode_reviews r where r.id=review_id and r.status='published')
 );

drop policy if exists "Members manage own episode review votes" on public.podcast_episode_review_votes;
create policy "Members manage own episode review votes"
 on public.podcast_episode_review_votes for all to authenticated
 using ((select auth.uid())=user_id)
 with check (
  (select auth.uid())=user_id
  and exists(select 1 from public.podcast_episode_reviews r where r.id=review_id and r.status='published')
 );

revoke all on table public.podcast_episode_review_votes from anon;
grant select,insert,delete on table public.podcast_episode_review_votes to authenticated;
revoke all on table public.podcast_episode_review_reports from anon;
grant select,insert,update,delete on table public.podcast_episode_review_reports to authenticated;
revoke all on table public.podcast_episode_review_replies from anon;
grant select on table public.podcast_episode_review_replies to anon;
grant select,insert,update,delete on table public.podcast_episode_review_replies to authenticated;
revoke all on table public.podcast_episode_reviews from anon;
grant select on table public.podcast_episode_reviews to anon;
grant select,insert,update,delete on table public.podcast_episode_reviews to authenticated;
grant select on table public.podcast_member_profile_stats to anon,authenticated;
