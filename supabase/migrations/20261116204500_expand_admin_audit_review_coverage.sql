-- Extend administrator audit coverage to the review and moderation workspaces.
do $$
declare v_table text;
v_tables text[] := array[
 'podcast_reviews',
 'podcast_review_replies',
 'podcast_review_reports',
 'podcast_review_analytics_monthly_reports',
 'podcast_episode_reviews',
 'podcast_episode_review_replies',
 'podcast_episode_review_reports',
 'podcast_episode_editorial_reviews',
 'podcast_platform_review_replies',
 'podcast_platform_review_reports',
 'podcast_platform_feedback_monthly_reports',
 'podcast_live_moderation_actions',
 'podcast_live_moderation_strikes',
 'podcast_chat_moderation'
];
begin
 foreach v_table in array v_tables loop
  if to_regclass('public.' || v_table) is not null then
   execute format('drop trigger if exists cr_admin_audit_capture on public.%I', v_table);
   execute format('create trigger cr_admin_audit_capture after insert or update or delete on public.%I for each row execute function private.cr_podcast_admin_audit_capture()', v_table);
  end if;
 end loop;
end;
$$;