-- Add indexes for the new platform-review foreign keys and member history queries.
create index if not exists podcast_platform_review_replies_admin_user_idx
  on public.podcast_platform_review_replies(admin_user_id);
create index if not exists podcast_platform_review_votes_user_idx
  on public.podcast_platform_review_votes(user_id);
create index if not exists podcast_platform_review_reports_reporter_idx
  on public.podcast_platform_review_reports(reporter_user_id);
create index if not exists podcast_platform_review_reports_reviewed_by_idx
  on public.podcast_platform_review_reports(reviewed_by);
create index if not exists podcast_platform_feedback_user_created_idx
  on public.podcast_platform_feedback(user_id,created_at desc);
