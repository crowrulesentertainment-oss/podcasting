-- CrowRules Podcasting security hardening
-- Keep admin RPCs callable by authenticated users, but never by anonymous clients.
revoke execute on function public.admin_delete_episode(uuid) from anon;
revoke execute on function public.admin_delete_live_channel(uuid) from anon;
revoke execute on function public.admin_delete_podcast(uuid) from anon;
revoke execute on function public.admin_upsert_episode(uuid,uuid,text,text,text,integer,integer,timestamptz,integer,text,text,text,text,text,text,boolean) from anon;
revoke execute on function public.admin_upsert_live_channel(uuid,text,text,text,text,text,text,text,boolean,integer,integer,text,text,uuid,uuid) from anon;
revoke execute on function public.admin_upsert_podcast(uuid,text,text,text,text,text,text,text,text,boolean,boolean) from anon;
revoke execute on function public.podcasting_admin_bulk_update_member_reports(uuid[],text,text) from anon;
revoke execute on function public.podcasting_admin_member_report_analytics() from anon;
revoke execute on function public.podcasting_admin_member_report_events(uuid) from anon;
revoke execute on function public.podcasting_admin_member_report_resolution(uuid) from anon;
revoke execute on function public.podcasting_admin_member_reports() from anon;
revoke execute on function public.podcasting_admin_update_member_report(uuid,text,text) from anon;
revoke execute on function public.podcasting_admin_update_member_report(uuid,text) from anon;
revoke execute on function public.podcasting_admin_update_member_report_notes(uuid,text) from anon;
