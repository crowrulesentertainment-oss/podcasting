create or replace function public.run_my_podcast_finance_integrity_alerts()
returns integer language plpgsql security definer set search_path=public as $$
declare v_creator uuid; r record; n integer:=0; v_exists boolean;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return 0; end if;
 for r in select * from public.get_my_podcast_finance_integrity() where reconciliation_status in ('review','unresolved') loop
   select exists(select 1 from public.cr_podcast_finance_alerts a where a.creator_id=v_creator and a.alert_type='system' and a.title='Financial integrity exception' and a.message like '%'||r.transaction_id::text||'%' and a.created_at > now()-interval '24 hours') into v_exists;
   if not v_exists then
     insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,threshold_cents,currency)
     values(v_creator,'system','Financial integrity exception',
       'Transaction '||r.transaction_id||' requires finance review. Variance: '||r.variance_cents||' cents. Status: '||upper(r.reconciliation_status)||'.',
       abs(r.variance_cents),r.currency);
     n:=n+1;
   end if;
 end loop;
 return n;
end $$;
revoke all on function public.run_my_podcast_finance_integrity_alerts() from public;
grant execute on function public.run_my_podcast_finance_integrity_alerts() to authenticated;