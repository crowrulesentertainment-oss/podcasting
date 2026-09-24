create or replace function public.run_podcast_finance_monitoring()
returns integer language plpgsql security definer set search_path=public,pg_catalog as $$
declare c record; x record; v_case uuid; v_alert uuid; n integer:=0;
begin
 for c in select id from public.creators loop
   perform public.reconcile_creator_podcast_finance(c.id,null);
   for x in select * from public.cr_podcast_finance_reconciliation_results where creator_id=c.id and reconciliation_status in ('review','unresolved') loop
     if not exists(select 1 from public.cr_podcast_finance_cases f where f.creator_id=c.id and f.transaction_id=x.transaction_id and f.case_type='integrity' and f.status<>'resolved') then
       insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,threshold_cents,currency)
       values(c.id,'system','Financial integrity exception','Automatic monitoring detected a '||x.reconciliation_status||' reconciliation exception. Variance: '||x.variance_cents||' cents.',abs(x.variance_cents),x.currency)
       returning id into v_alert;
       insert into public.cr_podcast_finance_cases(creator_id,transaction_id,alert_id,case_type,status,title,description,amount_cents,currency)
       values(c.id,x.transaction_id,v_alert,'integrity','open','Financial integrity exception','Background monitoring detected a '||x.reconciliation_status||' reconciliation exception. Variance: '||x.variance_cents||' cents. Ledger net: '||x.ledger_net_cents||'. Recorded net: '||x.recorded_net_cents||'.',abs(x.variance_cents),x.currency)
       returning id into v_case;
       update public.cr_podcast_finance_alerts set case_id=v_case where id=v_alert;
       insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,to_status,note)
       values(v_case,c.id,'created','open','Automatically created by background Finance Monitoring Engine.');
       n:=n+1;
     end if;
   end loop;
 end loop;
 return n;
end $$;
revoke all on function public.run_podcast_finance_monitoring() from public;
create unique index if not exists cr_podcast_finance_alert_case_dedupe on public.cr_podcast_finance_alerts(creator_id,title,created_at);
select cron.unschedule(jobid) from cron.job where jobname='crowrules-finance-monitoring';
select cron.schedule('crowrules-finance-monitoring','0 6 * * *','select public.run_podcast_finance_monitoring();');