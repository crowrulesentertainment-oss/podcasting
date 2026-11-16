-- Correct scan-trigger deduplication so one failed-login burst yields one alert.
create or replace function public.podcasting_security_monitor_scan()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row record; v_alerts integer; v_critical integer;
begin
 if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(),false) then raise exception 'ADMIN_AUTH_REQUIRED' using errcode='42501'; end if;
 for v_row in select user_id,count(*) session_count from auth.sessions group by user_id having count(*)>=8 loop
  perform private.cr_security_emit_alert('session_anomaly','medium','Unusually high active session count',v_row.session_count||' active sessions are associated with one account. Confirm whether these sessions are expected.','auth.sessions',v_row.user_id::text,jsonb_build_object('session_count',v_row.session_count,'user_id',v_row.user_id),'session-anomaly:'||v_row.user_id::text||':'||date_trunc('hour',now())::text);
 end loop;
 for v_row in select identifier_hash,count(*) failure_count from public.podcasting_auth_failure_events where attempted_at>now()-interval '15 minutes' group by identifier_hash having count(*)>=5 loop
  perform private.cr_security_emit_alert('repeated_failed_logins','high','Repeated failed password sign-ins',v_row.failure_count||' failed password sign-ins were recorded for one identifier fingerprint in 15 minutes.','podcasting_auth_failure_events',left(v_row.identifier_hash,16),jsonb_build_object('failure_count',v_row.failure_count,'identifier_fingerprint',left(v_row.identifier_hash,16)),'failed-login:'||left(v_row.identifier_hash,32));
 end loop;
 select count(*) into v_alerts from public.podcasting_security_alerts where status in('open','acknowledged');
 select count(*) into v_critical from public.podcasting_security_alerts where severity='critical' and status in('open','acknowledged');
 return jsonb_build_object('open_alerts',v_alerts,'critical_alerts',v_critical,'scan_at',now());
end $$;