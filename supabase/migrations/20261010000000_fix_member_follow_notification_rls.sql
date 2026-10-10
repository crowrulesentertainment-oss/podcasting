-- Fix duplicate member-follow notification trigger.
-- The removed trigger inserted directly into podcast_notifications as the
-- authenticated caller, which violates that table's recipient-only RLS.
-- Keep cr_podcast_member_follow_notification, which routes notifications
-- through the existing CrowRules notification system.
drop trigger if exists trg_podcast_member_follow_notification
  on public.podcast_member_follows;
