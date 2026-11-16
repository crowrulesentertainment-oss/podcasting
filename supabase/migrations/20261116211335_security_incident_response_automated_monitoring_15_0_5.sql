-- Security Incident Response & Automated Monitoring 15.0.5
alter table public.podcasting_security_notification_outbox drop constraint if exists podcasting_security_notification_outbox_status_check;
alter table public.podcasting_security_notification_outbox
 add column if not exists next_attempt_at timestamptz not null default now(),
 add column if not exists last_attempt_at timestamptz,
 add column if not exists locked_at timestamptz;
alter table public.podcasting_security_notification_outbox add constraint podcasting_security_notification_outbox_status_check check(status in('pending','sending','sent','failed','dead_letter'));
create index if not exists podcasting_security_notification_due_idx on public.podcasting_security_notification_outbox(status,next_attempt_at,created_at);
create unique index if not exists podcasting_security_incidents_alert_unique_idx on public.podcasting_security_incidents(alert_id) where alert_id is not null;

create or replace function private.cr_security_create_critical_incident()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_admin uuid;
begin
 if new.severity<>'critical' or new.status not in('open','acknowledged') then return new; end if;
 if exists(select 1 from public.podcasting_security_incidents i where i.alert_id=new.id) then return new; end if;
 select a.user_id into v_admin from public.cr_admins a where a.is_active=true order by a.created_at asc limit 1;
 if v_admin is null then return new; end if;
 insert into public.podcasting_security_incidents(alert_id,title,severity,status,owner_user_id,summary,investigation_notes,created_by,updated_by)
 values(new.id,'Automatic response: '||new.title,'critical','investigating',null,
 'Automatically opened because a critical security alert was detected. Review the source, affected account, and evidence.',
 'Automatically created by Security Incident Response 15.0.5. Alert details: '||coalesce(new.details::text,'{}'),v_admin,v_admin)
 on conflict(alert_id) where alert_id is not null do nothing;
 return new;
end $$;
drop trigger if exists podcasting_security_auto_incident on public.podcasting_security_alerts;
create trigger podcasting_security_auto_incident after insert or update of severity,status on public.podcasting_security_alerts for each row execute function private.cr_security_create_critical_incident();

create or replace function private.cr_security_monitor_scan_worker()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row record; v_alerts integer; v_critical integer;
begin
 for v_row in select user_id,count(*) session_count from auth.sessions group by user_id having count(*)>=8 loop
  perform private.cr_security_emit_alert('session_anomaly',case when v_row.session_count>=12 then 'critical' else 'medium' end,
   case when v_row.session_count>=12 then 'Critical session count anomaly' else 'Unusually high active session count' end,
   v_row.session_count||' active sessions are associated with one account. Confirm whether these sessions are expected.',
   'auth.sessions',v_row.user_id::text,jsonb_build_object('session_count',v_row.session_count,'user_id',v_row.user_id),
   'session-anomaly:'||v_row.user_id::text||':'||date_trunc('hour',now())::text);
 end loop;
 for v_row in select identifier_hash,count(*) failure_count from public.podcasting_auth_failure_events where attempted_at>now()-interval '15 minutes' group by identifier_hash having count(*)>=5 loop
  perform private.cr_security_emit_alert('repeated_failed_logins',case when v_row.failure_count>=10 then 'critical' else 'high' end,
   case when v_row.failure_count>=10 then 'Critical failed-login burst' else 'Repeated failed password sign-ins' end,
   v_row.failure_count||' failed password sign-ins were recorded for one privacy-preserving identifier fingerprint in 15 minutes.',
   'podcasting_auth_failure_events',left(v_row.identifier_hash,16),jsonb_build_object('failure_count',v_row.failure_count,'identifier_fingerprint',left(v_row.identifier_hash,16)),
   'failed-login:'||left(v_row.identifier_hash,32));
 end loop;
 select count(*) into v_alerts from public.podcasting_security_alerts where status in('open','acknowledged');
 select count(*) into v_critical from public.podcasting_security_alerts where severity='critical' and status in('open','acknowledged');
 return jsonb_build_object('open_alerts',v_alerts,'critical_alerts',v_critical,'scan_at',now());
end $$;
revoke all on function private.cr_security_monitor_scan_worker() from public,anon,authenticated;

create or replace function public.podcasting_security_worker_token_valid(p_token text)
returns boolean language sql security definer set search_path='' as $$
 select current_setting('request.jwt.claim.role',true)='service_role'
 and length(coalesce(p_token,''))>=24
 and exists(select 1 from vault.decrypted_secrets where name='podcast_email_worker_secret' and decrypted_secret=p_token)
$$;
revoke all on function public.podcasting_security_worker_token_valid(text) from public,anon,authenticated;
grant execute on function public.podcasting_security_worker_token_valid(text) to service_role;

create or replace function private.cr_security_worker_tick()
returns bigint language plpgsql security definer set search_path='' as $$
declare v_request_id bigint;
begin
 perform private.cr_security_monitor_scan_worker();
 update public.podcasting_security_notification_outbox
 set status=case when attempts>=8 then 'dead_letter' else 'failed' end, next_attempt_at=now(),locked_at=null,
 last_error=coalesce(last_error,'Worker lease expired before delivery completed.')
 where status='sending' and locked_at<now()-interval '10 minutes';
 update public.podcasting_security_notification_outbox set status='dead_letter',locked_at=null where status='failed' and attempts>=8;
 select net.http_post(url:='https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/podcasting-security-alert-email',
  headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-',
   'x-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='podcast_email_worker_secret')),
  body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=20000) into v_request_id;
 return v_request_id;
end $$;
revoke all on function private.cr_security_worker_tick() from public,anon,authenticated;

do $$ declare v_job bigint; begin
 for v_job in select jobid from cron.job where jobname='crowrules-podcasting-security-response-15-0-5' loop perform cron.unschedule(v_job); end loop;
 perform cron.schedule('crowrules-podcasting-security-response-15-0-5','* * * * *','select private.cr_security_worker_tick();');
end $$;

create or replace function public.podcasting_security_trends(p_days integer default 14)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_days integer:=greatest(1,least(coalesce(p_days,14),90));
begin
 if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(),false) then raise exception 'ADMIN_AUTH_REQUIRED' using errcode='42501'; end if;
 select jsonb_build_object(
  'days',v_days,
  'alerts_by_day',coalesce((select jsonb_agg(jsonb_build_object('date',q.bucket_date,'total',q.total,'critical',q.critical,'high',q.high) order by q.bucket_date) from (select date_trunc('day',created_at)::date bucket_date,count(*) total,count(*) filter(where severity='critical') critical,count(*) filter(where severity='high') high from public.podcasting_security_alerts where created_at>=now()-make_interval(days=>v_days) group by 1) q),'[]'::jsonb),
  'by_type',coalesce((select jsonb_agg(jsonb_build_object('type',q.alert_type,'count',q.n) order by q.n desc) from (select alert_type,count(*) n from public.podcasting_security_alerts where created_at>=now()-make_interval(days=>v_days) group by alert_type) q),'[]'::jsonb),
  'open_alerts',(select count(*) from public.podcasting_security_alerts where status in('open','acknowledged')),
  'unacknowledged',(select count(*) from public.podcasting_security_alerts where status='open'),
  'incidents_open',(select count(*) from public.podcasting_security_incidents where status in('investigating','contained')),
  'notification_pending',(select count(*) from public.podcasting_security_notification_outbox where status in('pending','failed')),
  'notification_sending',(select count(*) from public.podcasting_security_notification_outbox where status='sending'),
  'notification_failed',(select count(*) from public.podcasting_security_notification_outbox where status='dead_letter'),
  'notification_sent_24h',(select count(*) from public.podcasting_security_notification_outbox where status='sent' and sent_at>=now()-interval '24 hours'),
  'worker_schedule',(select schedule from cron.job where jobname='crowrules-podcasting-security-response-15-0-5' and active limit 1),
  'worker_last_run',(select jsonb_build_object('status',r.status,'started_at',r.start_time,'finished_at',r.end_time,'return_message',r.return_message) from cron.job j join cron.job_run_details r on r.jobid=j.jobid where j.jobname='crowrules-podcasting-security-response-15-0-5' order by r.start_time desc limit 1)
 ) into v_result;
 return v_result;
end $$;
