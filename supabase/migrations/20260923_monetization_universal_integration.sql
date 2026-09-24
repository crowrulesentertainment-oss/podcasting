-- CrowRules Podcasting Monetization 127.0
-- Universal repository integration notes and idempotent security-summary RPC.
-- The production database has already been updated; this migration keeps repository
-- infrastructure reproducible for future Supabase deployments.

create or replace function public.get_my_podcast_playback_security_summary()
returns jsonb
language sql
security definer
set search_path=''
as $$
select jsonb_build_object(
  'registered_devices',(select count(*) from public.cr_podcast_playback_devices where user_id=auth.uid() and revoked_at is null),
  'revoked_devices',(select count(*) from public.cr_podcast_playback_devices where user_id=auth.uid() and revoked_at is not null),
  'active_sessions',(select count(*) from public.cr_podcast_playback_sessions where user_id=auth.uid() and status='active' and last_seen_at>now()-interval '2 minutes'),
  'events_24h',(select count(*) from public.cr_podcast_playback_device_events where user_id=auth.uid() and occurred_at>now()-interval '24 hours'),
  'denials_24h',(select count(*) from public.cr_podcast_playback_device_events where user_id=auth.uid() and event_type='playback_denied' and occurred_at>now()-interval '24 hours')
)
$$;

revoke all on function public.get_my_podcast_playback_security_summary() from public,anon;
grant execute on function public.get_my_podcast_playback_security_summary() to authenticated;