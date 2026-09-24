create or replace function public.auto_create_my_podcast_finance_cases()
returns integer language plpgsql security definer set search_path=public as $$
declare v_creator uuid; r record; v_case uuid; v_alert uuid; v_count integer:=0;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return 0; end if;
 for r in select * from public.get_my_podcast_finance_integrity() where reconciliation_status in ('review','unresolved') loop
   if not exists(select 1 from public.cr_podcast_finance_cases f where f.creator_id=v_creator and f.transaction_id=r.transaction_id and f.case_type='integrity' and f.status<>'resolved') then
     select a.id into v_alert from public.cr_podcast_finance_alerts a where a.creator_id=v_creator and a.case_id is null and a.title='Financial integrity exception' and a.created_at>now()-interval '24 hours' order by a.created_at desc limit 1;
     insert into public.cr_podcast_finance_cases(creator_id,transaction_id,alert_id,case_type,status,title,description,amount_cents,currency)
     values(v_creator,r.transaction_id,v_alert,'integrity','open','Financial integrity exception',
       'Automatic case created for reconciliation status '||r.reconciliation_status||'. Variance: '||r.variance_cents||' cents. Ledger net: '||r.ledger_net_cents||'. Recorded net: '||r.recorded_net_cents||'.',
       abs(r.variance_cents),r.currency) returning id into v_case;
     insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,to_status,note)
     values(v_case,v_creator,'created','open','Automatically created from Finance Integrity Engine.');
     if v_alert is not null then update public.cr_podcast_finance_alerts set case_id=v_case where id=v_alert and creator_id=v_creator; end if;
     v_count:=v_count+1;
   end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.auto_create_my_podcast_finance_cases() from public;
grant execute on function public.auto_create_my_podcast_finance_cases() to authenticated;