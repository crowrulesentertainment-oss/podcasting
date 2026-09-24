alter table public.cr_podcast_finance_cases add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','critical'));
alter table public.cr_podcast_finance_cases add column if not exists sla_due_at timestamptz;
alter table public.cr_podcast_finance_cases add column if not exists escalated_at timestamptz;
create index if not exists cr_podcast_finance_cases_sla_idx on public.cr_podcast_finance_cases(creator_id,status,sla_due_at);
create or replace function public.run_podcast_finance_case_sla()
returns integer language plpgsql security definer set search_path=public,pg_catalog as $$
declare r record; v_priority text; v_due timestamptz; n integer:=0;
begin
 for r in select * from public.cr_podcast_finance_cases where status<>'resolved' loop
   v_priority=case when abs(coalesce(r.amount_cents,0))>=100000 then 'critical' when abs(coalesce(r.amount_cents,0))>=25000 then 'high' else 'normal' end;
   v_due=case v_priority when 'critical' then r.created_at+interval '24 hours' when 'high' then r.created_at+interval '3 days' else r.created_at+interval '7 days' end;
   update public.cr_podcast_finance_cases set priority=v_priority,sla_due_at=v_due,updated_at=now() where id=r.id and (priority<>v_priority or sla_due_at is distinct from v_due);
   if v_due<=now() and r.escalated_at is null then
     update public.cr_podcast_finance_cases set priority='critical',escalated_at=now(),updated_at=now() where id=r.id;
     insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,currency,case_id)
     values(r.creator_id,'system','Finance case escalation','Case '||r.id::text||' has exceeded its review SLA and requires attention.',r.currency,r.id);
     insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,from_status,to_status,note)
     values(r.id,r.creator_id,'status_changed',r.status,r.status,'Automated SLA escalation: case exceeded its review window.');
     n:=n+1;
   end if;
 end loop;
 return n;
end $$;
revoke all on function public.run_podcast_finance_case_sla() from public;
select cron.unschedule(jobid) from cron.job where jobname='crowrules-finance-case-sla';
select cron.schedule('crowrules-finance-case-sla','0 7 * * *','select public.run_podcast_finance_case_sla();');