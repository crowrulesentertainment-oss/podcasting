create or replace function public.record_my_podcast_finance_adjustment(
 p_transaction_id uuid,p_adjustment_type text,p_amount_cents bigint,p_currency text,p_source_event_id text,p_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_id uuid;
begin
 select creator_id into v_creator from public.cr_podcast_revenue_splits where id=p_transaction_id;
 if v_creator is null or not exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=v_creator and m.user_id=auth.uid()) then raise exception 'Transaction not found'; end if;
 insert into public.cr_podcast_finance_adjustments(creator_id,transaction_id,adjustment_type,amount_cents,currency,source_event_id,reason)
 values(v_creator,p_transaction_id,p_adjustment_type,p_amount_cents,lower(coalesce(p_currency,'usd')),p_source_event_id,p_reason)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.record_my_podcast_finance_adjustment(uuid,text,bigint,text,text,text) from public;
grant execute on function public.record_my_podcast_finance_adjustment(uuid,text,bigint,text,text,text) to authenticated;