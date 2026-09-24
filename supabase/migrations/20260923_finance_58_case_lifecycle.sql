create or replace function public.run_podcast_finance_case_lifecycle()
returns integer language plpgsql security definer set search_path=public,pg_catalog as $$
declare c record; x record; f record; n integer:=0;
begin
 for c in select id from public.creators loop
   perform public.reconcile_creator_podcast_finance(c.id,null);
   for f in select * from public.cr_podcast_finance_cases where creator_id=c.id and case_type='integrity' and status<>'resolved' loop
     select * into x from public.cr_podcast_finance_reconciliation_results where creator_id=c.id and transaction_id=f.transaction_id order by checked_at desc limit 1;
     if found and x.reconciliation_status='matched' then
       insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,currency,case_id)
       select c.id,'system','Finance case condition changed','Case '||f.id::text||' now reconciles as matched. Review the case before resolving it.',x.currency,f.id
       where not exists(select 1 from public.cr_podcast_finance_alerts a where a.creator_id=c.id and a.case_id=f.id and a.title='Finance case condition changed' and a.created_at>now()-interval '24 hours');
       insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,from_status,to_status,note)
       select f.id,c.id,'note',f.status,f.status,'Automated monitoring detected that the latest reconciliation is matched; case remains open until explicitly resolved.'
       where not exists(select 1 from public.cr_podcast_finance_case_events e where e.case_id=f.id and e.event_type='note' and e.note like 'Automated monitoring detected that the latest reconciliation is matched%' and e.created_at>now()-interval '24 hours');
       n:=n+1;
     end if;
   end loop;
 end loop;
 return n;
end $$;
revoke all on function public.run_podcast_finance_case_lifecycle() from public;
select cron.unschedule(jobid) from cron.job where jobname='crowrules-finance-case-lifecycle';
select cron.schedule('crowrules-finance-case-lifecycle','30 6 * * *','select public.run_podcast_finance_case_lifecycle();');