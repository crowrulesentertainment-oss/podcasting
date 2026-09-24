create or replace function public.auto_create_my_podcast_finance_cases()
returns integer language plpgsql security definer set search_path=public as $$
declare v_creator uuid; r record; v_case uuid; n integer:=0;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return 0; end if;
 for r in select * from public.get_my_podcast_finance_integrity() where reconciliation_status in ('review','unresolved') loop
   if not exists(select 1 from public.cr_podcast_finance_cases f where f.creator_id=v_creator and f.transaction_id=r.transaction_id and f.case_type='integrity' and f.status<>'resolved') then
     insert into public.cr_podcast_finance_cases(creator_id,transaction_id,case_type,title,description,amount_cents,currency)
     values(v_creator,r.transaction_id,'integrity',
       'Financial integrity exception',
       'Automatic case created from integrity status '||upper(r.reconciliation_status)||'. Variance: '||r.variance_cents||' cents. Ledger net: '||r.ledger_net_cents||' cents; recorded net: '||r.recorded_net_cents||' cents.',
       abs(r.variance_cents),r.currency) returning id into v_case;
     insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,to_status,note)
     values(v_case,v_creator,'created','open','Automatically created from Finance Integrity Engine.');
     n:=n+1;
   end if;
 end loop;
 return n;
end $$;
revoke all on function public.auto_create_my_podcast_finance_cases() from public;
grant execute on function public.auto_create_my_podcast_finance_cases() to authenticated;